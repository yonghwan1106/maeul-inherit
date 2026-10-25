// E1 life-function decomposition evaluation (spec 7.1, bundle B6). `npm run eval:e1`
//   systems: b0_type / b0 / b0plus (rules) / haiku55 (claude-haiku-5-5, no fallback model, real calls)
//   sets   : synth = data/eval/testset_e1_synth.json (60, generated from bundle A's test bank)
//            real  = data/eval/testset_e1_real.json  (20, article sentences labelled by bundle A)
//            dev   = data/eval/testset_e1_dev.json   (15, prompt tuning only — `--sets dev`, written to e1_dev_check.json)
// Writes data/eval/e1.json (+ raw replies in data/eval/raw/). Seeded, deterministic order.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DecomposeRequest } from "../../lib/apiTypes";
import type { FnCode } from "../../lib/types";
import { FN_CODES } from "../../lib/ontology";
import { ruleCodes, type RuleSystem } from "../../lib/fallback/rules";
import { decomposeLive } from "../../lib/llm/decompose";
import { hasKey } from "../../lib/llm/client";
import { L1_VERSION } from "../../lib/llm/prompts";

const ROOT = path.resolve(path.dirname(process.argv[1]), "..", "..");
const EVAL = path.join(ROOT, "data", "eval");
const RAW = path.join(EVAL, "raw");

interface Case {
  id: string;
  kind?: string;
  input: DecomposeRequest;
  gold: FnCode[];
  trap?: { fn: FnCode; kind?: string; text?: string } | null;
  traps?: { fn: FnCode; kind?: string; text?: string }[];
  humanChecked?: boolean;
}
interface SetFile { meta?: Record<string, unknown>; cases: Case[] }

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const SETS: Record<string, string> = {
  synth: "testset_e1_synth.json",
  real: "testset_e1_real.json",
  dev: "testset_e1_dev.json",
};

function loadSet(name: string): { file: string; raw: string; set: SetFile } | null {
  const file = path.join(EVAL, SETS[name]);
  if (!existsSync(file)) return null;
  const raw = readFileSync(file, "utf8");
  const parsed = JSON.parse(raw) as SetFile | Case[];
  const set = Array.isArray(parsed) ? { cases: parsed } : parsed;
  return { file, raw, set };
}

const trapsOf = (c: Case) => [...(c.trap ? [c.trap] : []), ...(c.traps ?? [])];

export interface SetScore {
  n: number;
  microF1: number;
  precision: number;
  recall: Record<"F06" | "F07" | "F09" | "F10", number | null>;
  recallAll: Partial<Record<FnCode, number | null>>;
  trapFP: number;
  trapCases: number;
  exact: number;
}

export function score(cases: Case[], preds: FnCode[][]): SetScore {
  let tp = 0, fp = 0, fn = 0, trapFP = 0, trapCases = 0, exact = 0;
  const per: Record<string, { tp: number; pos: number }> = {};
  for (const c of FN_CODES) per[c] = { tp: 0, pos: 0 };
  cases.forEach((cs, i) => {
    const g = new Set(cs.gold);
    const p = new Set(preds[i]);
    for (const c of FN_CODES) {
      if (g.has(c)) per[c].pos += 1;
      if (g.has(c) && p.has(c)) { tp += 1; per[c].tp += 1; }
      else if (!g.has(c) && p.has(c)) fp += 1;
      else if (g.has(c) && !p.has(c)) fn += 1;
    }
    const tr = trapsOf(cs);
    if (tr.length) {
      trapCases += 1;
      trapFP += tr.filter((t) => p.has(t.fn) && !g.has(t.fn)).length;
    }
    if (FN_CODES.every((c) => g.has(c) === p.has(c))) exact += 1;
  });
  const r = (c: FnCode) => (per[c].pos ? round(per[c].tp / per[c].pos) : null);
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const rec = tp + fn ? tp / (tp + fn) : 0;
  return {
    n: cases.length,
    microF1: round(precision + rec ? (2 * precision * rec) / (precision + rec) : 0),
    precision: round(precision),
    recall: { F06: r("F06"), F07: r("F07"), F09: r("F09"), F10: r("F10") },
    recallAll: Object.fromEntries(FN_CODES.map((c) => [c, r(c)])),
    trapFP,
    trapCases,
    exact,
  };
}

const round = (x: number) => Math.round(x * 1000) / 1000;

async function runLlm(setName: string, cases: Case[], model: string) {
  const preds: FnCode[][] = [];
  const raws: unknown[] = [];
  let pieces = 0, evidenceFound = 0, violations = 0, failures = 0;
  const CONC = 3;
  const out: { id: string; pred: FnCode[]; firstViolation: boolean; pieces: number; found: number; fail: string | null; texts: string[]; functions: unknown }[] = new Array(cases.length);
  let next = 0;
  async function worker() {
    while (next < cases.length) {
      const i = next++;
      const c = cases[i];
      const r = await decomposeLive(c.input, "", { model, noFallback: true });
      const v = r.firstValidation;
      out[i] = {
        id: c.id,
        pred: r.response.functions.map((f) => f.code),
        firstViolation: !v || v.schemaViolation,
        pieces: v ? v.functions.length : 0,
        found: v ? v.evidenceFound : 0,
        fail: r.response.mode === "rules" ? r.response.validator.fallbackReason : null,
        texts: r.rawTexts,
        functions: r.response.functions,
      };
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  for (const o of out) {
    preds.push(o.fail ? [] : o.pred);
    if (o.firstViolation) violations += 1;
    pieces += o.pieces;
    evidenceFound += o.found;
    if (o.fail) failures += 1;
    raws.push({ id: o.id, fail: o.fail, texts: o.texts, functions: o.functions });
  }
  mkdirSync(RAW, { recursive: true });
  writeFileSync(path.join(RAW, `e1_${model}_${setName}.json`), JSON.stringify({ model, prompt: L1_VERSION, runAt: new Date().toISOString(), raws }, null, 1) + "\n", "utf8");
  return { preds, evidenceRate: pieces ? round(evidenceFound / pieces) : 0, schemaViolation: round(violations / cases.length), failures };
}

async function main() {
  const setNames = arg("sets", "synth,real").split(",").filter(Boolean);
  const model = arg("model", "claude-haiku-5-5");
  const noLlm = process.argv.includes("--no-llm") || !hasKey();
  const RULES: RuleSystem[] = ["b0_type", "b0", "b0plus"];
  const sets: Record<string, unknown> = {};
  const systems: Record<string, Record<string, unknown>> = { b0_type: {}, b0: {}, b0plus: {}, haiku55: {} };
  const perCase: Record<string, unknown[]> = {};
  let evidenceN = 0, evidenceSum = 0, violSum = 0, violN = 0;

  for (const name of setNames) {
    const loaded = loadSet(name);
    if (!loaded) {
      console.log(`e1: set ${name} missing (${SETS[name]}) — skipped`);
      continue;
    }
    const { raw, set } = loaded;
    const cases = set.cases;
    const humanChecked = cases.filter((c) => c.humanChecked === true).length;
    sets[name] = name === "real"
      ? { n: cases.length, sha256: createHash("sha256").update(raw).digest("hex"), humanChecked }
      : { n: cases.length, sha256: createHash("sha256").update(raw).digest("hex") };
    const caseRows: Record<string, unknown>[] = cases.map((c) => ({ id: c.id, gold: c.gold }));
    for (const sys of RULES) {
      const preds = cases.map((c) => ruleCodes(c.input, sys));
      const s = score(cases, preds);
      systems[sys][name] = { microF1: s.microF1, recall: s.recall, trapFP: s.trapFP, precision: s.precision, exact: s.exact, trapCases: s.trapCases };
      preds.forEach((p, i) => (caseRows[i][sys] = p));
    }
    if (!noLlm) {
      const r = await runLlm(name, cases, model);
      const s = score(cases, r.preds);
      systems.haiku55[name] = { microF1: s.microF1, recall: s.recall, trapFP: s.trapFP, precision: s.precision, exact: s.exact, trapCases: s.trapCases, recallAll: s.recallAll, llmFailures: r.failures, evidenceRate: r.evidenceRate, schemaViolation: r.schemaViolation };
      r.preds.forEach((p, i) => (caseRows[i].haiku55 = p));
      if (name !== "dev") {
        evidenceSum += r.evidenceRate * cases.length; evidenceN += cases.length;
        violSum += r.schemaViolation * cases.length; violN += cases.length;
      }
    }
    perCase[name] = caseRows;
    const line = (sys: string) => {
      const v = systems[sys][name] as { microF1: number; trapFP: number } | undefined;
      return v ? `${sys}=${v.microF1}(trapFP ${v.trapFP})` : `${sys}=-`;
    };
    console.log(`e1 ${name} n=${cases.length}: ${["b0_type", "b0", "b0plus", "haiku55"].map(line).join(" ")}`);
  }
  if (!noLlm) {
    systems.haiku55.evidenceRate = evidenceN ? round(evidenceSum / evidenceN) : 0;
    systems.haiku55.schemaViolation = violN ? round(violSum / violN) : 0;
  }

  const devOnly = setNames.length === 1 && setNames[0] === "dev";
  const outFile = path.join(EVAL, devOnly ? "e1_dev_check.json" : "e1.json");
  const prev = existsSync(outFile) ? (JSON.parse(readFileSync(outFile, "utf8")) as Record<string, unknown>) : {};
  const result = {
    runAt: new Date().toISOString(),
    seed: 42,
    prompt: L1_VERSION,
    models: noLlm ? [] : [model],
    sets: { ...(prev.sets as object), ...sets, ...(devOnly ? {} : { dev: { n: loadSet("dev")?.set.cases.length ?? 0 } }) },
    systems: { ...systems, sonnet5: null },
    sc1Pieces: devOnly ? undefined : sc1Pieces(),
    perCase,
    note: "합성 시험 세트는 생성기가 먼저 고른 기능 집합이 정답. 실문장 라벨은 개발팀(프롬프트 작성자가 아닌 워커) 작성.",
  };
  writeFileSync(outFile, JSON.stringify(result, null, 1) + "\n", "utf8");
  console.log(`e1 -> ${path.relative(ROOT, outFile)}`);
}

/** SC1 pieces: B0-type count vs the precomputed haiku-5-5 answer in data/scenarios/sc1_seungchi.json. */
function sc1Pieces(): { b0_type: number; haiku55: number | null } {
  const f = path.join(ROOT, "data", "scenarios", "sc1_seungchi.json");
  let haiku: number | null = null;
  let input: DecomposeRequest | null = null;
  if (existsSync(f)) {
    const sc = JSON.parse(readFileSync(f, "utf8")) as { store: { sbizSub: string; items: string[]; hours: string; villageId: string; memo: string }; precomputed?: { decompose?: { response?: { functions?: unknown[]; mode?: string } } } };
    input = { sbizSub: sc.store.sbizSub, items: sc.store.items, hours: sc.store.hours, villageId: sc.store.villageId, memo: sc.store.memo };
    const resp = sc.precomputed?.decompose?.response;
    if (resp && resp.mode !== "rules" && Array.isArray(resp.functions)) haiku = resp.functions.length;
  }
  const b0 = input ? ruleCodes(input, "b0_type").length : 0;
  return { b0_type: b0, haiku55: haiku };
}

main().catch((e) => {
  console.error("e1 failed:", (e as Error).message);
  process.exit(1);
});
