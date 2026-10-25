// Engine tests (spec 5.11) — `npm run test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Confirmation, FnCode, FunctionPiece, Region, Tri } from "../lib/types";
import { computeVoi, makeCells, planScope, triAnd, triOr, withOverrides, solveVM } from "../lib/engine";
import { removeDominated, searchBest, type Cand } from "../lib/engine/cover";
import type { Cells } from "../lib/engine/cells";
import { mulberry32 } from "../lib/engine/util";
import { loadRegion, scenarioDefs } from "../scripts/eval/lib_a";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const piece = (code: FnCode, importance: 1 | 2 | 3 = 2): FunctionPiece =>
  ({ code, importance, evidence: "", needsCheck: false, source: "manual", enabled: true });
const KM_PER_DEG_LAT = 6371.0088 * Math.PI / 180;
const conf = (cellKey: string, value: Tri, by: Confirmation["by"] = "담당자"): Confirmation =>
  ({ cellKey, value, by, at: "2026-10-26T00:00:00+09:00" });

function tinyRegion(resources: Region["resources"], extraPoints: Region["points"] = []): Region {
  return {
    meta: {},
    villages: [{ id: "v1", name: "가리", lat: 36, lon: 127, pop: 100, popAssumed: true, isSeat: false, foodStores: 0, codeVerified: false }],
    points: [{ id: "p_v1_node", villageId: "v1", name: "가리", lat: 36, lon: 127, kind: "village_node", weight: 100 / (1 + extraPoints.length) }, ...extraPoints],
    resources,
  };
}

// 1. three-valued truth table (18 cells)
test("Tri AND/OR truth table", () => {
  const V: Tri[] = ["Y", "U", "N"];
  const AND: Record<string, Tri> = { YY: "Y", YU: "U", YN: "N", UY: "U", UU: "U", UN: "N", NY: "N", NU: "N", NN: "N" };
  const OR: Record<string, Tri> = { YY: "Y", YU: "Y", YN: "Y", UY: "Y", UU: "U", UN: "U", NY: "Y", NU: "U", NN: "N" };
  let n = 0;
  for (const a of V) for (const b of V) {
    assert.equal(triAnd(a, b), AND[a + b]); n++;
    assert.equal(triOr(a, b), OR[a + b]); n++;
  }
  assert.equal(n, 18);
});

// 2a. walk 1.0 km boundary (straight 0.83 km x 1.2 = 0.996 -> Y, 0.84 km x 1.2 = 1.008 -> N)
test("walk boundary 0.83 km = Y, 0.84 km = N", () => {
  const mk = (km: number) => tinyRegion([{ id: "bank1", name: "가농협", cls: "bank", src: ["osm"], lat: 36 + km / KM_PER_DEG_LAT, lon: 127, note: "" }]);
  const fns = [piece("F08")];
  const bit = 1 << 7;
  const c83 = makeCells(mk(0.83), fns, []);
  const c84 = makeCells(mk(0.84), fns, []);
  assert.equal(c83.masks.walk.get("p_v1_node")?.get("bank1")?.y, bit);
  assert.equal(c84.masks.walk.get("p_v1_node")?.get("bank1"), undefined);
  assert.equal(c84.masks.car.get("p_v1_node")?.get("bank1")?.y, bit);
});

// 2b. delivery area U -> homebound U; confirmed Y -> Y
test("care_link area U gives homebound U, confirmation Y gives Y", () => {
  const reg = tinyRegion([{ id: "care_link", name: "생활지원 연계", cls: "care_link", src: ["derived"], note: "" }]);
  const fns = [piece("F01", 3)];
  const c0 = makeCells(reg, fns, []);
  const e0 = c0.masks.homebound.get("p_v1_node")?.get("care_link");
  assert.deepEqual([e0?.y, e0?.u], [0, 1]);
  const c1 = makeCells(reg, fns, [conf("area:care_link:v1", "Y")]);
  const e1 = c1.masks.homebound.get("p_v1_node")?.get("care_link");
  assert.deepEqual([e1?.y, e1?.u], [1, 0]);
  // incremental override gives the same masks as a fresh build
  const c2 = withOverrides(c0, { "area:care_link:v1": "Y" });
  assert.deepEqual(c2.masks.homebound.get("p_v1_node")?.get("care_link")?.y, 1);
});

// 2c. combined resource hubdrop d@h counts as ONE place
test("hubdrop is counted as one resource", () => {
  const reg = tinyRegion([
    { id: "hanaro_x", name: "하나로마트(가)", cls: "hanaro", src: ["osm"], lat: 36.1, lon: 127.1, myeon: "화산면", note: "" },
    { id: "hub_1", name: "가경로당", cls: "hub", src: ["osm"], lat: 36.0001, lon: 127, myeon: "화산면", villageId: "v1", note: "" },
    { id: "hubdrop_hanaro_x_1", name: "하나로마트(가) → 가경로당", cls: "hubdrop", src: ["derived"], lat: 36.0001, lon: 127, villageId: "v1", deliverer: "hanaro_x", hubId: "hub_1", note: "" },
  ]);
  const fns = [piece("F01", 3), piece("F02", 2), piece("F05", 2)];
  const cells = makeCells(reg, fns, [conf("hubdrop:hanaro_x:hub_1", "Y")]);
  const vm = solveVM(reg, cells, "v1", "walk");
  assert.deepEqual(vm.set, ["hubdrop_hanaro_x_1"]);
  assert.equal(vm.set.length, 1);
  assert.ok(Math.abs(vm.L - 1) < 1e-9);
});

// 3. brute force: dominance removal + search == search over all candidates (seed 42, 1,000 fixtures)
test("brute-force match 1,000 random fixtures (seed 42)", () => {
  const rnd = mulberry32(42);
  const int = (n: number) => Math.floor(rnd() * n);
  let match = 0;
  const N = 1000;
  for (let t = 0; t < N; t++) {
    const nCore = 1 + int(6);
    const coreMask = (1 << nCore) - 1;
    const imp = Array.from({ length: nCore }, () => 1 + int(3));
    const weightTable = new Float64Array(1024);
    for (let m = 0; m < 1024; m++) for (let b = 0; b < nCore; b++) if ((m >> b) & 1) weightTable[m] += imp[b];
    const cells = { coreMask, weightTable } as unknown as Cells;
    const np = 1 + int(4);
    const nc = 1 + int(10);
    const cands: Cand[] = [];
    for (let i = 0; i < nc; i++) {
      const y: number[] = [], u: number[] = [];
      for (let p = 0; p < np; p++) {
        const yy = int(1 << nCore) & int(1 << nCore);
        const uu = int(1 << nCore) & ~yy & coreMask;
        y.push(yy); u.push(uu);
      }
      cands.push({ id: `r${String(i).padStart(2, "0")}`, y, u, burden: int(4) });
    }
    const w = Array.from({ length: np }, () => 1 + int(3));
    const kept = removeDominated(cands);
    const a = searchBest(kept, w, cells);
    const b = searchBest(cands, w, cells);
    if (Math.abs(a.L - b.L) < 1e-9 && Math.abs(a.U - b.U) < 1e-9 && a.size === b.size) match++;
  }
  const rate = match / N;
  mkdirSync(path.join(ROOT, "data", "eval"), { recursive: true });
  writeFileSync(path.join(ROOT, "data", "eval", "engine_check.json"),
    JSON.stringify({ bruteForceCases: N, bruteForceMatch: rate, seed: 42, maxCandidates: 10, maxPoints: 4 }, null, 1) + "\n", "utf8");
  assert.equal(rate, 1);
});

// 4-6 on the real region
const region = loadRegion();
const sc1 = scenarioDefs()[0];

test("VOI: all dL >= 0 and setting a cell to N keeps L", () => {
  const cells = makeCells(region, sc1.fns, []);
  const plan = planScope(region, cells, sc1.store, sc1.fns);
  const voi = computeVoi(region, cells, plan, sc1.store, sc1.fns);
  assert.ok(voi.length > 0);
  for (const v of voi) for (const m of ["car", "walk", "homebound"] as const) assert.ok(v.dL[m] >= -1e-9, `${v.cellKey} ${m} ${v.dL[m]}`);
  for (const v of voi.slice(0, 40)) {
    const next = withOverrides(cells, { [v.cellKey]: "N" });
    for (const vm of plan.byVM) {
      const nv = solveVM(region, next, vm.villageId, vm.mode);
      assert.ok(Math.abs(nv.L - vm.L) < 1e-9, `${v.cellKey} changes L of ${vm.villageId}|${vm.mode}`);
    }
  }
});

test("demo value on a real-named cell is ignored", () => {
  const stop = Object.keys(Object.fromEntries(makeCells(region, sc1.fns, []).registry)).find((k) => k.startsWith("stop:tour_A:"))!;
  const cells = makeCells(region, sc1.fns, [
    conf("area:hanaro_hwasan:seungchi", "Y", "시연 입력값"),
    conf(stop, "Y", "시연 입력값"),
  ]);
  assert.equal(cells.values.get("area:hanaro_hwasan:seungchi"), "U");
  assert.equal(cells.ignored.length, 1);
  assert.equal(cells.values.get(stop), "Y");
});

test("performance: SC1 planScope < 50 ms, computeVoi < 300 ms", () => {
  let planMs = Infinity, voiMs = Infinity;
  for (let i = 0; i < 3; i++) {
    const cells = makeCells(region, sc1.fns, []);
    const t0 = performance.now();
    const plan = planScope(region, cells, sc1.store, sc1.fns);
    const t1 = performance.now();
    computeVoi(region, cells, plan, sc1.store, sc1.fns);
    const t2 = performance.now();
    planMs = Math.min(planMs, t1 - t0);
    voiMs = Math.min(voiMs, t2 - t1);
  }
  assert.ok(planMs < 50, `planScope ${planMs} ms`);
  assert.ok(voiMs < 300, `computeVoi ${voiMs} ms`);
});
