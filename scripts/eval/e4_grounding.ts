// E4 grounding evaluation (spec 7.4, bundle B6). `npm run eval:e4`
//   generation 30 = 3 scenarios x 5 confirmation states x 2 documents (walk resident notice, agency request to the
//   state's top-1 「먼저 전화할 곳」 agency). Real claude-haiku-5-5 calls through the product path (no precomputed cache).
//   states: base / demo1 (scenario demo value) / demo2 (+ a second demo stop value) / allN (every 이동장터 A stop = N)
//           / report (base + one pending resident report — reports never change the three values)
//   unit   = data/eval/testset_e4_unit.json (20 wrong + 20 right sentences, 「단위 시험(같은 팀 작성)」)
// Writes data/eval/e4.json (+ raw texts in data/eval/raw/e4_raw.json).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Confirmation, PlanDigest, Region, Scenario } from "../../lib/types";
import { hasKey } from "../../lib/llm/client";
import { L4_VERSION } from "../../lib/llm/prompts";
import { composeLive, parseComposeRequest, sanitizeDigest, regionNames } from "../../lib/llm/compose";
import { inputHash } from "../../lib/guard/cache";
import { groundText } from "../../lib/validate/grounding";
import { agencyOfCell, agencyRequestFor, bestModeOf, buildState, residentRequest } from "../../lib/scenarioDocs";

const ROOT = path.resolve(path.dirname(process.argv[1]), "..", "..");
const EVAL = path.join(ROOT, "data", "eval");
const IDS = ["sc1_seungchi", "sc2_waryong", "sc3_ungok"];
const STATES = ["base", "demo1", "demo2", "allN", "report"] as const;
type St = (typeof STATES)[number];

/** Second demo value per scenario (realNamed=false stop cells only; 시연 입력값). */
const SECOND_DEMO: Record<string, { pointId: string; note: string }> = {
  sc1_seungchi: { pointId: "p_seungchi_node", note: "목요일 오후" },
  sc2_waryong: { pointId: "p_waryong_node", note: "화요일 오후" },
  sc3_ungok: { pointId: "p_chunsan_node", note: "금요일 오전" },
};

const AT = "2026-10-26T00:00:00+09:00";

function confFor(region: Region, sc: Scenario, st: St): Confirmation[] {
  if (st === "base" || st === "report") return [];
  if (st === "demo1") return sc.demoConfirmations;
  if (st === "demo2") {
    const s = SECOND_DEMO[sc.id];
    return [...sc.demoConfirmations, { cellKey: `stop:tour_A:${s.pointId}`, value: "Y", note: s.note, by: "시연 입력값", at: AT }];
  }
  // allN: every tour stop cell in the registry -> N
  const st0 = buildState(region, sc, "base");
  return [...st0.cells.registry.keys()].filter((k) => k.startsWith("stop:tour_A:")).sort().map((k) => ({ cellKey: k, value: "N" as const, by: "시연 입력값" as const, at: AT }));
}

function reasonKind(reason: string): string[] {
  const out: string[] = [];
  for (const part of reason.split(" · ")) {
    if (/요일/.test(part) && /— 확인된 요일/.test(part)) out.push("day");
    else if (/계획에 없는 곳/.test(part)) out.push("resource");
    else if (/계획에 없는 숫자/.test(part)) out.push("number");
    else if (/전화번호/.test(part)) out.push("phone");
    else if (/확인된 시간 없음/.test(part)) out.push("time");
    else if (/단정/.test(part)) out.push("assertive");
    else out.push("other");
  }
  return out;
}

const round = (x: number) => Math.round(x * 1000) / 1000;

/** Outside the checker's rules (spec 6.3 lists no promise check): promise-like endings in FINAL texts, counted for honesty. */
export const PROMISE_RE = /드리겠습니다|드릴게요|안내드릴|보내드렸|반드시|약속/;
function outOfScope(finals: string[]) {
  const hits = finals.filter((t) => PROMISE_RE.test(t)).length;
  return { promiseLike: hits, n: finals.length, note: "근거 대조기 검사 항목 밖 — 약속 표현(「다시 안내드리겠습니다」 등)이 남은 최종 문서 수(정규식 집계)" };
}

function unitScore(region: Region) {
  const unit = JSON.parse(readFileSync(path.join(EVAL, "testset_e4_unit.json"), "utf8")) as {
    meta: { pinned: string }; digest: PlanDigest; cases: { id: string; expectBlock: boolean; category: string; sentence: string }[];
  };
  const names = regionNames(region);
  let tp = 0, fb = 0, nW = 0, nR = 0;
  const byCat: Record<string, { n: number; blocked: number }> = {};
  const misses: { id: string; sentence: string; expectBlock: boolean }[] = [];
  for (const c of unit.cases) {
    const blocked = !groundText(c.sentence, unit.digest, names).pass;
    byCat[c.category] = byCat[c.category] ?? { n: 0, blocked: 0 };
    byCat[c.category].n += 1;
    if (blocked) byCat[c.category].blocked += 1;
    if (c.expectBlock) { nW += 1; if (blocked) tp += 1; } else { nR += 1; if (blocked) fb += 1; }
    if (blocked !== c.expectBlock) misses.push({ id: c.id, sentence: c.sentence, expectBlock: c.expectBlock });
  }
  const pinned = groundText(unit.meta.pinned, unit.digest, names);
  return {
    label: "단위 시험(같은 팀 작성)",
    nWrong: nW, nRight: nR,
    recall: round(nW ? tp / nW : 0), falseBlock: round(nR ? fb / nR : 0),
    detected: tp, falselyBlocked: fb, byCategory: byCat, misses,
    pinned: { sentence: unit.meta.pinned, blocked: !pinned.pass, reason: pinned.blocked[0]?.reason ?? null },
  };
}

async function main() {
  const region = JSON.parse(readFileSync(path.join(ROOT, "data", "region_hwasan.json"), "utf8")) as Region;
  const unit = unitScore(region);
  console.log(`e4 unit: recall ${unit.recall} (${unit.detected}/${unit.nWrong}) falseBlock ${unit.falseBlock} (${unit.falselyBlocked}/${unit.nRight}) pinned blocked=${unit.pinned.blocked}`);
  const unitOnly = process.argv.includes("--unit-only") || !hasKey();

  const rows: Record<string, unknown>[] = [];
  const raws: Record<string, unknown>[] = [];
  const reasons: Record<string, number> = {};
  const examples: { sentence: string; reason: string; scenario: string; state: string; docType: string }[] = [];
  let n = 0, first = 0, regen = 0, tmpl = 0, final = 0;

  if (!unitOnly) {
    const jobs: { sc: Scenario; st: St; req: ReturnType<typeof residentRequest> }[] = [];
    for (const id of IDS) {
      const sc = JSON.parse(readFileSync(path.join(ROOT, "data", "scenarios", `${id}.json`), "utf8")) as Scenario;
      for (const st of STATES) {
        const conf = confFor(region, sc, st);
        const state = buildState(region, sc, st === "base" || st === "report" ? "base" : "demo", undefined, conf);
        const walker = sc.residents.find((r) => r.mode === "walk") ?? sc.residents[0];
        jobs.push({ sc, st, req: residentRequest(region, sc, state, walker) });
        const top = state.voi.find((v) => agencyOfCell(v.cellKey));
        const ag = top ? agencyOfCell(top.cellKey)! : "hanaro_hwasan";
        jobs.push({ sc, st, req: agencyRequestFor(region, sc, state, ag, top ? bestModeOf(top) : "walk") });
      }
    }
    for (const j of jobs) {
      const parsed = parseComposeRequest(JSON.parse(JSON.stringify(j.req)));
      if (!parsed.ok) throw new Error(parsed.message);
      const req = parsed.req;
      const digest = sanitizeDigest(region, req);
      const h = inputHash("compose", { ...req, digest });
      const r = await composeLive(region, req, digest, h);
      n += 1;
      if (r.firstPass) first += 1;
      if (r.regenerated) regen += 1;
      if (r.response.template) tmpl += 1;
      if (r.response.grounding.pass) final += 1;
      for (const b of r.firstBlocked) {
        for (const k of reasonKind(b.reason)) reasons[k] = (reasons[k] ?? 0) + 1;
        if (examples.length < 3 && b.sentence) examples.push({ sentence: b.sentence, reason: b.reason, scenario: j.sc.id, state: j.st, docType: req.docType });
      }
      const tag = `${j.sc.id} ${j.st} ${req.docType}${req.agencyResId ? ":" + req.agencyResId : ""}`;
      rows.push({ id: tag, firstPass: r.firstPass, regenerated: r.regenerated, template: r.response.template, finalPass: r.response.grounding.pass, model: r.response.model, firstBlocked: r.firstBlocked });
      raws.push({ id: tag, texts: r.texts, final: r.response.text });
      console.log(`e4 ${tag}: first=${r.firstPass} regen=${r.regenerated} template=${r.response.template}`);
    }
  }

  const prevFile = path.join(EVAL, "e4.json");
  const prev = existsSync(prevFile) ? (JSON.parse(readFileSync(prevFile, "utf8")) as Record<string, unknown>) : null;
  const gen = unitOnly && prev && typeof prev.n === "number" && (prev.n as number) > 0
    ? { n: prev.n, firstPass: prev.firstPass, regenRate: prev.regenRate, templateRate: prev.templateRate, finalPass: prev.finalPass, reasons: prev.reasons, examples: prev.examples, perCase: prev.perCase, models: prev.models, generatedAt: prev.generatedAt }
    : { n, firstPass: round(n ? first / n : 0), regenRate: round(n ? regen / n : 0), templateRate: round(n ? tmpl / n : 0), finalPass: round(n ? final / n : 0), reasons, examples, perCase: rows, models: unitOnly ? [] : ["claude-haiku-5-5"], generatedAt: new Date().toISOString() };
  let finals = raws.map((r) => String(r.final ?? ""));
  const rawFile = path.join(EVAL, "raw", "e4_raw.json");
  if (!finals.length && existsSync(rawFile)) finals = (JSON.parse(readFileSync(rawFile, "utf8")) as { raws: { final: string }[] }).raws.map((r) => r.final);
  const out = { runAt: new Date().toISOString(), prompt: L4_VERSION, ...gen, unit, outOfScope: outOfScope(finals), note: "생성 30건 = 시나리오 3 × 확인 상태 5 × 문서 2. 사전계산 캐시를 쓰지 않은 실제 호출. 단위 시험은 같은 팀 작성." };
  writeFileSync(prevFile, JSON.stringify(out, null, 1) + "\n", "utf8");
  if (raws.length) {
    mkdirSync(path.join(EVAL, "raw"), { recursive: true });
    writeFileSync(path.join(EVAL, "raw", "e4_raw.json"), JSON.stringify({ prompt: L4_VERSION, runAt: out.runAt, raws }, null, 1) + "\n", "utf8");
  }
  console.log(`e4: n=${gen.n} firstPass ${gen.firstPass} regen ${gen.regenRate} template ${gen.templateRate} finalPass ${gen.finalPass} -> data/eval/e4.json`);
}

main().catch((e) => {
  console.error("e4 failed:", (e as Error).message);
  process.exit(1);
});
