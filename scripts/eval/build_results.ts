// npm run eval:results — merge e1~e4 + engine checks into data/eval/results.json (spec 7.5).
// results.json is the ONLY source of numbers for S5, the report and the video. Missing parts (another
// bundle has not run yet) are written as the schema skeleton with `pending: true` so S5 can say so.
import { existsSync } from "node:fs";
import { gitCommit, readJson, rel, sha256File, writeJson } from "./lib_a";

type J = Record<string, unknown>;
const load = (p: string): J | null => (existsSync(rel(p)) ? readJson<J>(p) : null);
const strip = (o: J | null, ...keys: string[]): J | null => {
  if (!o) return null;
  const c: J = { ...o };
  for (const k of keys) delete c[k];
  return c;
};

const e1 = load("data/eval/e1.json");
const e2 = load("data/eval/e2.json");
const e3 = load("data/eval/e3.json");
const e4 = load("data/eval/e4.json");
const check = load("data/eval/engine_check.json");
const bench = load("data/eval/bench.json") as { scenarios?: Record<string, { planMs: number; voiMs: number }> } | null;

const scMs = (k: "planMs" | "voiMs") => {
  const s = bench?.scenarios ?? {};
  return { sc1: s.sc1_seungchi?.[k] ?? null, sc2: s.sc2_waryong?.[k] ?? null, sc3: s.sc3_ungok?.[k] ?? null };
};

const sysSkel = () => ({ synth: { microF1: null, recall: { F06: null, F07: null, F09: null, F10: null }, trapFP: null }, real: { microF1: null, recall: { F06: null, F07: null, F09: null, F10: null }, trapFP: null } });
const E1_SKELETON = {
  pending: true,
  sets: { synth: { n: 60, sha256: null }, real: { n: 20, sha256: null, humanChecked: 0 }, dev: { n: 15 } },
  systems: { b0_type: sysSkel(), b0: sysSkel(), b0plus: sysSkel(), haiku55: { ...sysSkel(), evidenceRate: null, schemaViolation: null }, sonnet5: null },
  sc1Pieces: { b0_type: null, haiku55: null },
};
const E4_SKELETON = {
  pending: true, n: 30, firstPass: null, regenRate: null, templateRate: null, finalPass: null, reasons: {},
  unit: { nWrong: 20, nRight: 20, recall: null, falseBlock: null }, examples: [],
};
const E3_SKELETON = { pending: true, n: 11, byP: { "0.3": null, "0.5": null, "0.7": null } };
const E2_SKELETON = { pending: true, n: 33, nByMode: { car: 11, walk: 11, homebound: 11 }, independent: false, systems: {}, headline: {} };

const models = new Set<string>();
const collect = (o: unknown) => {
  if (!o || typeof o !== "object") return;
  const x = o as J;
  for (const k of ["models", "model"]) {
    const v = x[k] ?? (x.meta as J | undefined)?.[k];
    if (Array.isArray(v)) v.forEach((m) => typeof m === "string" && models.add(m));
    else if (typeof v === "string") models.add(v);
  }
};
collect(e1); collect(e4);
const llm = load("data/eval/e2_llm_outputs.json");
collect(llm);
if ((e2?.systems as J | undefined)?.b2a) models.add("claude-haiku-5-5");

const inputs: Record<string, string> = {};
for (const f of ["data/eval/e1.json", "data/eval/e2.json", "data/eval/e3.json", "data/eval/e4.json", "data/eval/engine_check.json", "data/eval/bench.json",
  "data/eval/e2_cases.json", "data/eval/testset_e1_synth.json", "data/eval/testset_e1_real.json", "data/eval/testset_e1_dev.json", "data/eval/testset_e4_unit.json"]) {
  if (existsSync(rel(f))) inputs[f] = sha256File(f);
}

const results = {
  meta: {
    runAt: new Date().toISOString(),
    commit: gitCommit(),
    seed: 42,
    regionSha256: sha256File("data/region_hwasan.json"),
    paramsSha256: sha256File("lib/engine/params.ts"),
    models: [...models].sort(),
    inputs,
    pending: { e1: !e1, e2: !e2, e3: !e3, e4: !e4, b2: !(e2?.systems as J | undefined)?.b2a },
  },
  engine: {
    bruteForceCases: (check?.bruteForceCases as number | undefined) ?? null,
    bruteForceMatch: (check?.bruteForceMatch as number | undefined) ?? null,
    planMs: scMs("planMs"),
    voiMs: scMs("voiMs"),
  },
  e1: e1 ? strip(e1, "cases", "perCase", "raw") : E1_SKELETON,
  e2: e2 ? strip(e2, "cases", "engine") : E2_SKELETON,
  e3: e3 ? strip(e3, "cases") : E3_SKELETON,
  e4: e4 ? strip(e4, "cases", "perCase", "raw") : E4_SKELETON,
};
writeJson("data/eval/results.json", results);
console.log(`results.json: commit ${results.meta.commit} · pending ${JSON.stringify(results.meta.pending)} · e2.n=${(results.e2 as J).n} · e3.n=${(results.e3 as J).n} · bruteForce ${results.engine.bruteForceMatch} · models ${results.meta.models.join(",") || "-"}`);
