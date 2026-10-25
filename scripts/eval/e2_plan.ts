// npm run eval:e2 — E2 plan evaluation (spec 7.2-3). B1 / B1b / B1g / engine computed here; B2a / B2b
// (LLM-only, bundle B: data/eval/e2_llm_outputs.json) scored with score.ts. Writes data/eval/e2.json.
import { existsSync } from "node:fs";
import type { FnCode, Mode } from "../../lib/types";
import { MODES } from "../../lib/types";
import { b1, b1b, b1g, makeCells, solveVM } from "../../lib/engine";
import { E2_FNS, loadRegion, readJson, rel, sha256File, writeJson } from "./lib_a";
import { planErrors, scoreScope, type ErrorCount, type LlmPlan, type SetScore } from "./score";

interface E2Case { caseId: string; villageId: string; mode: Mode; scope: string[] }
interface LlmRow { caseId: string; variant: "b2a" | "b2b"; raw?: string; parsed?: { plans?: LlmPlan[] } | null }

const region = loadRegion();
const cells = makeCells(region, E2_FNS, []);
const coreFns: FnCode[] = E2_FNS.map((f) => f.code);
const { cases } = readJson<{ cases: E2Case[] }>("data/eval/e2_cases.json");

type Sys = "b1" | "b1b" | "b1g" | "engine";
const SYSTEMS: Sys[] = ["b1", "b1b", "b1g", "engine"];
const pick = (s: SetScore) => ({ L: s.L, U: s.U, countY: s.countY, countU: s.countU, countN: s.countN });
const mean = (xs: SetScore[]): SetScore => {
  const n = xs.length || 1;
  const o: SetScore = { L: 0, U: 0, countY: 0, countU: 0, countN: 0 };
  for (const x of xs) for (const k of Object.keys(o) as (keyof SetScore)[]) o[k] += x[k] / n;
  return o;
};
const r4 = (s: SetScore) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Math.round(v * 10000) / 10000]));

const perCase: Record<string, unknown>[] = [];
const byMode: Record<Sys, Record<Mode, SetScore[]>> = Object.fromEntries(SYSTEMS.map((s) => [s, { car: [], walk: [], homebound: [] }])) as never;
for (const c of cases) {
  const sets: Record<Sys, Record<string, string[]>> = { b1: {}, b1b: {}, b1g: {}, engine: {} };
  for (const vid of c.scope) {
    sets.b1[vid] = b1(region, cells, vid, c.mode, E2_FNS).set;
    sets.b1b[vid] = b1b(region, cells, vid, c.mode, E2_FNS).set;
    sets.b1g[vid] = b1g(region, cells, vid, c.mode, E2_FNS).set;
    sets.engine[vid] = solveVM(region, cells, vid, c.mode).set;
  }
  const row: Record<string, unknown> = { caseId: c.caseId, villageId: c.villageId, mode: c.mode, scope: c.scope };
  for (const s of SYSTEMS) {
    const sc = scoreScope(region, cells, c.mode, sets[s], c.scope);
    byMode[s][c.mode].push(sc);
    row[s] = { sets: sets[s], ...r4(pick(sc)) };
  }
  perCase.push(row);
}

// ---- LLM-only (B5 output, optional until it exists)
const llmFile = "data/eval/e2_llm_outputs.json";
const llmSys: Record<string, unknown> = {};
let b2aAssertUCases: number | null = null;
if (existsSync(rel(llmFile))) {
  const rowsRaw = readJson<unknown>(llmFile);
  const rows: LlmRow[] = Array.isArray(rowsRaw) ? rowsRaw as LlmRow[] : ((rowsRaw as { outputs?: LlmRow[] }).outputs ?? []);
  for (const variant of ["b2a", "b2b"] as const) {
    const vr = rows.filter((r) => r.variant === variant);
    if (!vr.length) { llmSys[variant] = null; continue; }
    const mm: Record<Mode, SetScore[]> = { car: [], walk: [], homebound: [] };
    const errs: Record<keyof ErrorCount, { cases: number; total: number }> = {
      unknownRes: { cases: 0, total: 0 }, accessN: { cases: 0, total: 0 }, capN: { cases: 0, total: 0 },
      assertU: { cases: 0, total: 0 }, over3: { cases: 0, total: 0 },
    };
    let parseFail = 0, scored = 0;
    for (const c of cases) {
      const row = vr.find((r) => r.caseId === c.caseId);
      const plans = row?.parsed?.plans ?? null;
      if (!plans) parseFail++;
      const sets: Record<string, string[]> = {};
      const caseErr: ErrorCount = { unknownRes: 0, accessN: 0, capN: 0, assertU: 0, over3: 0 };
      for (const vid of c.scope) {
        const p = plans?.find((x) => x.villageId === vid);
        const set = (p?.set ?? []).filter((id) => typeof id === "string");
        sets[vid] = set;
        if (p) {
          const e = planErrors(region, cells, c.mode, { villageId: vid, set, assign: Array.isArray(p.assign) ? p.assign : [] }, coreFns);
          for (const k of Object.keys(caseErr) as (keyof ErrorCount)[]) caseErr[k] += e[k];
        }
      }
      for (const k of Object.keys(errs) as (keyof ErrorCount)[]) {
        errs[k].total += caseErr[k];
        if (caseErr[k] > 0) errs[k].cases++;
      }
      mm[c.mode].push(scoreScope(region, cells, c.mode, sets, c.scope));
      scored++;
    }
    llmSys[variant] = {
      byMode: Object.fromEntries(MODES.map((m) => [m, r4(mean(mm[m]))])),
      errors: errs, n: scored, parseFail,
    };
    if (variant === "b2a") b2aAssertUCases = errs.assertU.cases;
  }
} else {
  llmSys.b2a = null;
  llmSys.b2b = null;
}

const systems: Record<string, unknown> = {};
for (const s of SYSTEMS) systems[s] = Object.fromEntries(MODES.map((m) => [m, r4(mean(byMode[s][m]))]));
Object.assign(systems, llmSys);
const walk = (s: Sys) => mean(byMode[s].walk).countY;
const engineCheck = existsSync(rel("data/eval/engine_check.json")) ? readJson<Record<string, unknown>>("data/eval/engine_check.json") : null;

const out = {
  n: cases.length,
  nByMode: Object.fromEntries(MODES.map((m) => [m, cases.filter((c) => c.mode === m).length])),
  independent: false,
  fns: E2_FNS.map((f) => ({ code: f.code, importance: f.importance })),
  casesSha256: sha256File("data/eval/e2_cases.json"),
  llmOutputs: existsSync(rel(llmFile)) ? { file: llmFile, sha256: sha256File(llmFile) } : null,
  systems,
  headline: {
    walkCountY: {
      engine: +walk("engine").toFixed(4), b1g: +walk("b1g").toFixed(4), b1: +walk("b1").toFixed(4),
      diffVsB1g: +(walk("engine") - walk("b1g")).toFixed(4),
    },
    b2aAssertUCases,
  },
  note: "엔진은 같은 칸 위에서 최적화하므로 확실 몫이 기준선보다 낮을 수 없습니다. 수치는 '얼마나 더'를 뜻하며, 사례들은 자원을 공유해 서로 독립이 아닙니다.",
  engine: engineCheck,
  cases: perCase,
};
writeJson("data/eval/e2.json", out);
for (const m of MODES) {
  console.log(`E2 ${m}: ` + SYSTEMS.map((s) => { const x = mean(byMode[s][m]); return `${s} Y${x.countY.toFixed(2)} L${(x.L * 100).toFixed(1)}%`; }).join(" | "));
}
console.log(`E2 headline walk countY engine ${walk("engine").toFixed(2)} vs b1g ${walk("b1g").toFixed(2)} (diff ${(walk("engine") - walk("b1g")).toFixed(2)}), b2a assertU cases ${b2aAssertUCases ?? "n/a (B5 output missing)"}`);
