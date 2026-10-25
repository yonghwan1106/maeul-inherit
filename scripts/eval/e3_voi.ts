// npm run eval:e3 — E3 "먼저 전화할 곳" design check (spec 7.3). 11 virtual closures (ri nodes), all 3 modes.
// Strategies: VOI (re-chosen at every decision node), nearest-first, random (200 orders, seed 42).
// Each cell independently turns out Y with p in {0.3, 0.5, 0.7}, else N. Three confirmations -> the 8 outcome
// branches are enumerated exactly (no Monte Carlo). Tree structure does not depend on p (VOI ranking is p-free),
// so trees are built once and weighted per p. Writes data/eval/e3.json.
import type { Mode, Tri } from "../../lib/types";
import { MODES } from "../../lib/types";
import { computeVoi, makeCells, planScope, withOverrides } from "../../lib/engine";
import type { Cells } from "../../lib/engine";
import { haversineKm } from "../../lib/geo";
import { mulberry32 } from "../../lib/engine/util";
import { E2_FNS, loadRegion, now, writeJson } from "./lib_a";

const PS = [0.3, 0.5, 0.7];
const DEPTH = 3;
const N_RANDOM = 200;
const region = loadRegion();
const base = makeCells(region, E2_FNS, []);
const t0 = now();

type Vec = { L: Record<Mode, number>; Y: Record<Mode, number> };
type Tree = { leaf: Vec } | { key: string; yes: Tree; no: Tree };
const zero = (): Record<Mode, number> => ({ car: 0, walk: 0, homebound: 0 });

function cellLoc(key: string): { lat: number; lon: number } | null {
  const [kind, a, b] = key.split(":");
  const res = (id: string) => region.resources.find((r) => r.id === id);
  const pt = (id: string) => region.points.find((p) => p.id === id);
  const node = (vid: string) => region.points.find((p) => p.villageId === vid && p.kind === "village_node");
  let o: { lat?: number; lon?: number } | undefined;
  if (kind === "stop") o = pt(b);
  else if (kind === "cap" || kind === "open") o = res(a);
  else if (kind === "area") o = node(b);
  else if (kind === "hubdrop") o = res(b);
  else if (kind === "bus") o = node(a);
  return o && typeof o.lat === "number" && typeof o.lon === "number" ? { lat: o.lat, lon: o.lon } : null;
}

const prob = (outcomes: Tri[], p: number) => outcomes.reduce((acc, t) => acc * (t === "Y" ? p : 1 - p), 1);

const perCase: Record<string, unknown>[] = [];
const agg: Record<string, Record<"voi" | "nearest" | "random", Vec>> = {};
for (const p of PS) agg[String(p)] = { voi: { L: zero(), Y: zero() }, nearest: { L: zero(), Y: zero() }, random: { L: zero(), Y: zero() } };

const villages = [...region.villages].sort((a, b) => (a.id < b.id ? -1 : 1));
for (const v of villages) {
  const store = { lat: v.lat, lon: v.lon, villageId: v.id };
  const plan0 = planScope(region, base, store, E2_FNS);
  const L0 = Object.fromEntries(MODES.map((m) => [m, plan0.summary[m].L])) as Record<Mode, number>;
  const Y0 = Object.fromEntries(MODES.map((m) => [m, plan0.summary[m].countY])) as Record<Mode, number>;
  const scopeVM = new Set(plan0.scope.flatMap((vid) => MODES.map((m) => vid + "|" + m)));
  const cand = [...base.registry.entries()]
    .filter(([k, d]) => d.kind !== "bus" && (base.values.get(k) ?? "U") === "U" && [...(base.affects.get(k) ?? [])].some((x) => scopeVM.has(x)))
    .map(([k]) => k).sort();
  const candSet = new Set(cand);

  const memo = new Map<string, Vec>();
  const stateKey = (ov: Map<string, Tri>) => [...ov.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map((e) => e.join("=")).join("|");
  const cellsFor = (ov: Map<string, Tri>): Cells => (ov.size ? withOverrides(base, ov) : base);
  const leafOf = (ov: Map<string, Tri>): Vec => {
    const sk = stateKey(ov);
    const hit = memo.get(sk);
    if (hit) return hit;
    const pl = planScope(region, cellsFor(ov), store, E2_FNS);
    const vec: Vec = { L: zero(), Y: zero() };
    for (const m of MODES) { vec.L[m] = pl.summary[m].L - L0[m]; vec.Y[m] = pl.summary[m].countY - Y0[m]; }
    memo.set(sk, vec);
    return vec;
  };

  // VOI tree (re-chosen at each node)
  let voiNodes = 0;
  const voiTree = (ov: Map<string, Tri>, depth: number): Tree => {
    if (depth === DEPTH) return { leaf: leafOf(ov) };
    const c = cellsFor(ov);
    const pl = planScope(region, c, store, E2_FNS);
    const items = computeVoi(region, c, pl, store, E2_FNS, { filter: (k) => candSet.has(k) && !ov.has(k) });
    voiNodes++;
    if (!items.length) return { leaf: leafOf(ov) };
    const key = items[0].cellKey;
    return {
      key,
      yes: voiTree(new Map([...ov, [key, "Y"]]), depth + 1),
      no: voiTree(new Map([...ov, [key, "N"]]), depth + 1),
    };
  };
  // fixed-order tree (nearest / random)
  const seqTree = (seq: string[], ov: Map<string, Tri>, depth: number): Tree => {
    if (depth === Math.min(DEPTH, seq.length)) return { leaf: leafOf(ov) };
    const key = seq[depth];
    return {
      key,
      yes: seqTree(seq, new Map([...ov, [key, "Y"]]), depth + 1),
      no: seqTree(seq, new Map([...ov, [key, "N"]]), depth + 1),
    };
  };
  const expect = (t: Tree, p: number, path: Tri[] = []): Vec => {
    if ("leaf" in t) {
      const w = prob(path, p);
      const o: Vec = { L: zero(), Y: zero() };
      for (const m of MODES) { o.L[m] = w * t.leaf.L[m]; o.Y[m] = w * t.leaf.Y[m]; }
      return o;
    }
    const a = expect(t.yes, p, [...path, "Y"]);
    const b = expect(t.no, p, [...path, "N"]);
    for (const m of MODES) { a.L[m] += b.L[m]; a.Y[m] += b.Y[m]; }
    return a;
  };

  const voi = voiTree(new Map(), 0);
  const origin = { lat: v.lat, lon: v.lon };
  const dist = (k: string) => { const l = cellLoc(k); return l ? haversineKm(origin.lat, origin.lon, l.lat, l.lon) : Infinity; };
  const nearestSeq = [...cand].sort((a, b) => dist(a) - dist(b) || (a < b ? -1 : 1)).slice(0, DEPTH);
  const nearest = seqTree(nearestSeq, new Map(), 0);
  const rnd = mulberry32(42);
  const randomTrees: Tree[] = [];
  for (let i = 0; i < N_RANDOM; i++) {
    const pool = [...cand];
    const seq: string[] = [];
    for (let j = 0; j < Math.min(DEPTH, pool.length); j++) seq.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    randomTrees.push(seqTree(seq, new Map(), 0));
  }

  const row: Record<string, unknown> = { villageId: v.id, scope: plan0.scope, nCandidates: cand.length, voiDecisionNodes: voiNodes,
    voiFirst: "key" in voi ? voi.key : null, nearestSeq, byP: {} as Record<string, unknown> };
  for (const p of PS) {
    const ev = expect(voi, p), en = expect(nearest, p);
    const er: Vec = { L: zero(), Y: zero() };
    for (const t of randomTrees) { const e = expect(t, p); for (const m of MODES) { er.L[m] += e.L[m] / N_RANDOM; er.Y[m] += e.Y[m] / N_RANDOM; } }
    (row.byP as Record<string, unknown>)[String(p)] = { voi: ev, nearest: en, random: er };
    const A = agg[String(p)];
    for (const m of MODES) {
      A.voi.L[m] += ev.L[m] / villages.length; A.voi.Y[m] += ev.Y[m] / villages.length;
      A.nearest.L[m] += en.L[m] / villages.length; A.nearest.Y[m] += en.Y[m] / villages.length;
      A.random.L[m] += er.L[m] / villages.length; A.random.Y[m] += er.Y[m] / villages.length;
    }
  }
  perCase.push(row);
  console.log(`e3 ${v.id}: scope=${plan0.scope.join(",")} candidates=${cand.length} voiNodes=${voiNodes} first=${row.voiFirst}`);
}

const pp = (x: number) => Math.round(x * 100 * 100) / 100; // fraction -> %p, 2 decimals
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const byP: Record<string, unknown> = {};
for (const p of PS) {
  const A = agg[String(p)];
  const fmt = (vec: Vec) => ({ car: pp(vec.L.car), walk: pp(vec.L.walk), homebound: pp(vec.L.homebound), sum: pp(vec.L.car + vec.L.walk + vec.L.homebound) });
  const fmtY = (vec: Vec) => ({ car: r3(vec.Y.car), walk: r3(vec.Y.walk), homebound: r3(vec.Y.homebound), sum: r3(vec.Y.car + vec.Y.walk + vec.Y.homebound) });
  const sumV = A.voi.L.car + A.voi.L.walk + A.voi.L.homebound;
  const sumR = A.random.L.car + A.random.L.walk + A.random.L.homebound;
  byP[String(p)] = {
    voi: fmt(A.voi), nearest: fmt(A.nearest), random: fmt(A.random),
    ratioVoiRandom: sumR > 1e-12 ? Math.round((sumV / sumR) * 100) / 100 : null,
    countY: { voi: fmtY(A.voi), nearest: fmtY(A.nearest), random: fmtY(A.random) },
  };
}
const ms = Math.round(now() - t0);
writeJson("data/eval/e3.json", {
  n: villages.length, depth: DEPTH, nRandomOrders: N_RANDOM, seed: 42, ps: PS, unit: "L 상승 기대값 = %p(이용권 리 평균), countY = 확실 개수 상승 기대값",
  note: "설계 검증 — 같은 기준으로 고르고 채점하므로 VOI가 유리한 것은 거의 정의상 당연",
  candidatesExclude: ["bus"], ms, byP, cases: perCase,
});
for (const p of PS) console.log(`E3 p=${p}: ${JSON.stringify(byP[String(p)])}`);
console.log(`e3 done in ${ms} ms`);
