// Grounding checker 「틀린 내용 거르기」 (spec 6.3) — rules only, never throws, pure (no node APIs).
// Splits text into sentences, extracts resource names (region names + alias words), weekdays, clock times,
// numbers and phone numbers, and checks each against the PlanDigest:
//   resource not in digest -> block · weekday not in digest days -> block · number not in numbersAllowed -> block
//   phone number -> block (no confirmed contacts) · clock time -> block (digest has no times)
//   sentence mentions a 「확인 중」-only resource, uses an assertive ending and has no 「확인」 -> block
import type { GroundingBlock, GroundingCheck, GroundingResult } from "../apiTypes";
import type { PlanDigest } from "../types";
import { PHONE_SOURCE } from "../guard/redact";

export const ALIASES = ["하나로마트", "농협", "우체국", "이동장터", "경로당", "경로회관", "마을회관", "생활지원"] as const;
export const ASSERTIVE_RE = /옵니다|와요|됩니다|돼요|가능합니다|받을 수 있습니다|해 줍니다/;
const DAY_RE = /[월화수목금토일]요일/g;
const TIME_RE = /(?:오전|오후)?\s?\d{1,2}시/g;
const NUM_RE = /\d+(?:\.\d+)?/g;

export interface NameEntry { name: string }

export function splitSentences(text: string): string[] {
  return (text ?? "")
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Region names worth matching: >= 3 chars, longest first (so 「미남경로회관」 wins over shorter names). */
export function regionNameList(names: NameEntry[]): string[] {
  const set = new Set<string>();
  for (const n of names) {
    const nm = (n.name ?? "").trim();
    if (nm.length >= 3) set.add(nm);
  }
  return [...set].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
}

type Item = PlanDigest["items"][number];
interface Mention { pos: number; end: number; hit: Item[] }
const SUBJECT_AFTER = /^\s*(?:이|가|은|는|도|의|에서)(?![가-힣])|^\s*(?:이|가|은|는|도|의|에서)\s/;

function itemsForMention(mention: string, items: Item[], alias: boolean): Item[] {
  const exact = items.filter((i) => i.name === mention);
  if (exact.length) return exact;
  if (alias && mention === "농협") return items.filter((i) => i.name.includes("농협") || i.name.includes("하나로"));
  return items.filter((i) => i.name.includes(mention));
}

const fmtDays = (d: string[]) => (d.length ? d.join("·") : "");

export function checkSentence(sentence: string, digest: PlanDigest, names: string[]): { checked: GroundingCheck[]; reasons: string[] } {
  const checked: GroundingCheck[] = [];
  const reasons: string[] = [];
  let rest = sentence;

  // phone numbers first (their digits must not be read as numbers)
  for (const m of rest.match(new RegExp(PHONE_SOURCE, "g")) ?? []) {
    checked.push({ kind: "phone", value: m, ok: false });
    reasons.push(`전화번호 ${m} — 확인된 연락처 없음`);
  }
  rest = rest.replace(new RegExp(PHONE_SOURCE, "g"), " ");

  // resource names (region, longest first), then aliases on what is left.
  // Matched spans are blanked with same-length spaces so positions stay comparable.
  const mentioned: Mention[] = [];
  const take = (nm: string, alias: boolean) => {
    const pos = rest.indexOf(nm);
    if (pos < 0) return;
    const hit = itemsForMention(nm, digest.items, alias);
    checked.push({ kind: "resource", value: nm, ok: hit.length > 0 });
    if (!hit.length) reasons.push(`${nm} — 계획에 없는 곳`);
    else mentioned.push({ pos, end: pos + nm.length, hit });
    rest = rest.split(nm).join(" ".repeat(nm.length));
  };
  for (const nm of names) take(nm, false);
  for (const al of ALIASES) take(al, true);
  mentioned.sort((a, b) => a.pos - b.pos);

  // weekdays
  const allowedDays = [...new Set(digest.items.flatMap((i) => i.days ?? []))];
  for (const d of sentence.match(DAY_RE) ?? []) {
    const ok = allowedDays.includes(d);
    checked.push({ kind: "day", value: d, ok });
    if (!ok) reasons.push(allowedDays.length ? `${d} — 확인된 요일(${fmtDays(allowedDays)})과 다름` : `${d} — 확인된 요일 없음`);
  }

  // clock times (digest carries no times)
  for (const t of rest.match(TIME_RE) ?? []) {
    checked.push({ kind: "time", value: t.trim(), ok: false });
    reasons.push(`${t.trim()} — 확인된 시간 없음`);
  }
  rest = rest.replace(TIME_RE, " ");

  // numbers
  for (const n of rest.match(NUM_RE) ?? []) {
    const v = Number(n);
    const ok = digest.numbersAllowed.some((a) => Math.abs(a - v) < 1e-9);
    checked.push({ kind: "number", value: n, ok });
    if (!ok) reasons.push(`숫자 ${n} — 계획에 없는 숫자`);
  }

  // assertive wording about a 「확인 중」-only resource that is the sentence's subject:
  // the first mentioned resource, or any mention followed by a subject-like particle (이/가/은/는/도/의/에서).
  const checkingOnly = (m: Mention) => m.hit.every((i) => i.status === "확인 중");
  const subjects = mentioned.filter((m, i) => i === 0 || SUBJECT_AFTER.test(sentence.slice(m.end)));
  const target = subjects.find(checkingOnly);
  if (target && ASSERTIVE_RE.test(sentence) && !sentence.includes("확인")) {
    const nm = target.hit[0].name;
    checked.push({ kind: "assertive", value: nm, ok: false });
    reasons.push(`확인 중인 자원을 단정함(${nm})`);
  } else if (target) {
    checked.push({ kind: "assertive", value: target.hit[0].name, ok: true });
  }
  return { checked, reasons };
}

/** Check a whole text. `attempts` is filled in by the caller (number of LLM generations). */
export function groundText(text: string, digest: PlanDigest, regionNames: NameEntry[], attempts = 1): GroundingResult {
  try {
    const names = regionNameList([...regionNames, ...digest.items.map((i) => ({ name: i.name }))]);
    const checked: GroundingCheck[] = [];
    const blocked: GroundingBlock[] = [];
    for (const s of splitSentences(text)) {
      const r = checkSentence(s, digest, names);
      checked.push(...r.checked);
      if (r.reasons.length) blocked.push({ sentence: s, reason: r.reasons.join(" · ") });
    }
    return { pass: blocked.length === 0, attempts, checked, blocked };
  } catch {
    return { pass: false, attempts, checked: [], blocked: [{ sentence: "", reason: "검사 오류" }] };
  }
}
