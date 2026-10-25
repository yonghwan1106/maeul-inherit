// npm run bench — SC1~SC3 planScope (< 50 ms) and computeVoi (< 300 ms) on the real region (spec 5.5, 5.7, 12 A).
// Writes data/eval/bench.json (merged into results.json engine block by build_results).
import { computeVoi, makeCells, planScope } from "../lib/engine";
import { loadRegion, now, scenarioDefs, writeJson } from "./eval/lib_a";

const region = loadRegion();
const out: Record<string, { cellsMs: number; planMs: number; voiMs: number; nVoi: number; scope: string[] }> = {};
let ok = true;
for (const sc of scenarioDefs()) {
  // warm-up (JIT), then measure the median of 5 runs
  const runs: { c: number; p: number; v: number; n: number; scope: string[] }[] = [];
  for (let i = 0; i < 6; i++) {
    const t0 = now();
    const cells = makeCells(region, sc.fns, []);
    const t1 = now();
    const plan = planScope(region, cells, sc.store, sc.fns);
    const t2 = now();
    const voi = computeVoi(region, cells, plan, sc.store, sc.fns);
    const t3 = now();
    if (i > 0) runs.push({ c: t1 - t0, p: t2 - t1, v: t3 - t2, n: voi.length, scope: plan.scope });
  }
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const r = { cellsMs: +med(runs.map((x) => x.c)).toFixed(2), planMs: +med(runs.map((x) => x.p)).toFixed(2),
    voiMs: +med(runs.map((x) => x.v)).toFixed(2), nVoi: runs[0].n, scope: runs[0].scope };
  out[sc.id] = r;
  const pass = r.planMs < 50 && r.voiMs < 300;
  ok &&= pass;
  console.log(`${sc.id}: scope=${r.scope.join(",")} makeCells ${r.cellsMs} ms · planScope ${r.planMs} ms (<50) · computeVoi ${r.voiMs} ms (<300, ${r.nVoi} cells) ${pass ? "OK" : "SLOW"}`);
}
writeJson("data/eval/bench.json", { node: process.version, runAt: new Date().toISOString(), scenarios: out });
if (!ok) process.exitCode = 1;
