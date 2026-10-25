// E1 real-sentence label review (objection E3-③: match rate against an answer key people set).
//   npx tsx scripts/eval/e1_review.ts sheet <out.csv>   -> review sheet (UTF-8 with BOM, opens in Excel)
//   npx tsx scripts/eval/e1_review.ts apply <in.csv>    -> writes reviewed gold + humanChecked into
//                                                          data/eval/testset_e1_real.json
// After apply: `npm run eval:e1 -- --from-raw` (re-scores the kept haiku replies, no new LLM calls) and
// `npm run eval:results`. The sheet's first columns hold the draft label so the reviewer only marks O or
// writes the corrected codes.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { FnCode } from "../../lib/types";
import { FN_CODES } from "../../lib/ontology";
import { COPY } from "../../lib/copy";

const ROOT = path.resolve(path.dirname(process.argv[1]), "..", "..");
const SET = path.join(ROOT, "data", "eval", "testset_e1_real.json");
const E1 = path.join(ROOT, "data", "eval", "e1.json");

interface Trap { fn: FnCode; kind?: string; text?: string }
interface Case { id: string; input: { sbizSub: string; items: string[]; memo: string }; gold: FnCode[]; traps?: Trap[]; humanChecked?: boolean; review?: Record<string, unknown> }
interface SetFile { meta: Record<string, unknown>; cases: Case[] }

// points the independent review flagged; shown to the reviewer as a question, not as an answer
const ISSUES: Record<string, string> = {
  "real-06": "과거형(했었는데 없어졌어) — 루브릭상 그만둔 일이면 정답 없음으로 고치기",
  "real-07": "배달하는 주체가 그 가게인지 문장만으로 확인",
  "real-09": "「생필품을 공급」을 장보기(F01)로 볼지",
  "real-15": "택배를 맡아 둔 곳이 주유소 — 대상 시설로 볼지",
  "real-16": "택배를 맡아 둔 곳이 다른 리 마을회관 — 대상 시설로 볼지",
  "real-17": "가게가 아닌 이동 트럭 — 대상 시설로 볼지",
  "real-18": "주어가 가게인지 사람인지, 잔심부름을 배달(F07)로 볼지",
  "real-19": "농협 마트(다른 곳) 이야기 — 다른 곳이면 정답 없음으로 고치기",
  "real-20": "하나로마트 배송이 실제로는 안 된다는 말 — 정답 없음(함정) 그대로 둘지",
};

const names = (xs: FnCode[]) => (xs.length ? xs.map((c) => `${c} ${COPY.fnName[c]}`).join(" / ") : "(없음)");
const q = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
const HEAD = ["id", "원문(메모)", "업종", "팔던 물건", "초벌 정답", "함정(라벨 아님)", "AI(haiku-5-5) 답", "쟁점", "검수(O=그대로 · X=고침)", "고친 정답(코드, 예: F01 F05 / 없음)", "검수 메모"];

function sheet(out: string) {
  const set = JSON.parse(readFileSync(SET, "utf8")) as SetFile;
  const e1 = JSON.parse(readFileSync(E1, "utf8")) as { perCase?: { real?: { id: string; haiku55?: FnCode[] }[] } };
  const ai = new Map((e1.perCase?.real ?? []).map((r) => [r.id, r.haiku55 ?? []]));
  const rows = [HEAD.map(q).join(",")];
  for (const c of set.cases) {
    rows.push([
      c.id, c.input.memo, c.input.sbizSub, c.input.items.join("·"), names(c.gold),
      (c.traps ?? []).map((t) => `${t.fn} ${COPY.fnName[t.fn]}(${t.kind ?? ""})`).join(" / "),
      names(ai.get(c.id) ?? []), ISSUES[c.id] ?? "", "", "", "",
    ].map(q).join(","));
  }
  writeFileSync(out, "﻿" + rows.join("\r\n") + "\r\n", "utf8");
  console.log(`sheet -> ${out} (${set.cases.length} rows, ${Object.keys(ISSUES).length} flagged)`);
}

function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); out.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, "")); out.push(row); }
  return out;
}

function apply(inp: string) {
  const rows = parseCsv(readFileSync(inp, "utf8").replace(/^﻿/, ""));
  const set = JSON.parse(readFileSync(SET, "utf8")) as SetFile;
  const at = new Date().toISOString();
  let n = 0, changed = 0;
  for (const r of rows.slice(1)) {
    const [id, , , , , , , , mark, fixed, memo] = r;
    const c = set.cases.find((x) => x.id === id?.trim());
    const m = (mark ?? "").trim().toUpperCase();
    if (!c || (m !== "O" && m !== "X")) continue;
    if (m === "X") {
      const codes = (fixed ?? "").toUpperCase().match(/F\d\d/g) ?? [];
      const bad = codes.filter((x) => !FN_CODES.includes(x as FnCode));
      if (bad.length) throw new Error(`${id}: unknown codes ${bad.join(",")}`);
      const gold = Array.from(new Set(codes)).sort() as FnCode[];
      if (gold.join() !== [...c.gold].sort().join()) changed++;
      c.review = { draftGold: c.gold, at, memo: memo ?? "" };
      c.gold = gold;
    } else c.review = { draftGold: c.gold, at, memo: memo ?? "" };
    c.humanChecked = true;
    n++;
  }
  const total = set.cases.filter((c) => c.humanChecked === true).length;
  set.meta.humanChecked = total;
  set.meta.labelStatus = total ? `AI 보조 초벌 라벨, 사람 검수 ${total}건(${at.slice(0, 10)})` : set.meta.labelStatus;
  // targeted text edits keep the hand-formatted file (one case per few lines) readable in diffs
  let txt = readFileSync(SET, "utf8");
  for (const c of set.cases) {
    if (!c.review || c.review.at !== at) continue;
    const start = txt.indexOf(`"id": "${c.id}"`);
    if (start < 0) throw new Error(`${c.id}: not found in file text`);
    const nextId = txt.indexOf(`"id": "`, start + 5);
    const end = nextId < 0 ? txt.length : nextId;
    let seg = txt.slice(start, end);
    seg = seg.replace(/"gold": \[[^\]]*\]/, `"gold": ${JSON.stringify(c.gold).replace(/","/g, '", "')}`);
    seg = seg.replace(/"humanChecked": (true|false)(, "review": \{[^}]*\})?/, `"humanChecked": true, "review": ${JSON.stringify(c.review)}`);
    txt = txt.slice(0, start) + seg + txt.slice(end);
  }
  txt = txt.replace(/("meta": \{[\s\S]*?"humanChecked": )\d+/, `$1${total}`);
  txt = txt.replace(/("meta": \{[\s\S]*?"labelStatus": )"[^"]*"/, `$1${JSON.stringify(set.meta.labelStatus)}`);
  JSON.parse(txt); // still valid JSON
  writeFileSync(SET, txt, "utf8");
  console.log(`apply: ${n} rows reviewed (${changed} labels changed), humanChecked ${total}/${set.cases.length}`);
  console.log("next: npm run eval:e1 -- --from-raw && npm run eval:results");
}

const [cmd, file] = process.argv.slice(2);
if (cmd === "sheet" && file) sheet(file);
else if (cmd === "apply" && file) apply(file);
else {
  console.error("usage: e1_review.ts sheet <out.csv> | apply <in.csv>");
  process.exit(2);
}
