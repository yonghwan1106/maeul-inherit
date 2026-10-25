// Coverage optimisation (spec 5.5): per (village, mode) exhaustive search over sets of size 1..MAX_SET
// after dominance removal. Objective (lexicographic): L desc, U desc, |S| asc, burden sum asc, ids asc.
import type { Assignment, Channel, FnCode, FunctionPiece, Mode, ModeSummary, Plan, PlanVM, Point, Region, Tri } from "../types";
import { MODES } from "../types";
import { FN_BIT, FN_CODES, SOCIAL_MASK } from "../ontology";
import { haversineKm } from "../geo";
import type { Cells, ResPointCell } from "./cells";
import { P } from "./params";
import { cmpStr, indexRegion, popcount } from "./util";

export interface StoreLoc { lat: number; lon: number; villageId: string }

const CH_ORDER: Channel[] = ["visit", "deliver", "tour", "hubdrop"];

export interface Cand { id: string; y: number[]; u: number[]; burden: number }

/** Candidate vectors for a set of points (core functions only). */
export function candidatesFor(cells: Cells, pts: Point[], mode: Mode): Cand[] {
  const core = cells.coreMask;
  const ids = new Set<string>();
  for (const p of pts) {
    const inner = cells.masks[mode].get(p.id);
    if (!inner) continue;
    for (const [rid, e] of inner) if ((e.y | e.u) & core) ids.add(rid);
  }
  const out: Cand[] = [];
  for (const id of [...ids].sort(cmpStr)) {
    const y: number[] = [], u: number[] = [];
    let b = 0;
    for (const p of pts) {
      const e = cells.masks[mode].get(p.id)?.get(id);
      y.push((e?.y ?? 0) & core);
      u.push((e?.u ?? 0) & core);
      b += cells.burden(id, p.id, mode);
    }
    out.push({ id, y, u, burden: pts.length ? b / pts.length : 0 });
  }
  return out;
}

/** a dominates b: on every point y(a) ⊇ y(b), (y|u)(a) ⊇ (y|u)(b), and burden(a) ≤ burden(b). */
function dominates(a: Cand, b: Cand): boolean {
  if (a.burden > b.burden + P.EPS) return false;
  for (let i = 0; i < a.y.length; i++) {
    if ((a.y[i] & b.y[i]) !== b.y[i]) return false;
    const pa = a.y[i] | a.u[i], pb = b.y[i] | b.u[i];
    if ((pa & pb) !== pb) return false;
  }
  return true;
}

export function removeDominated(cands: Cand[]): Cand[] {
  return cands.filter((r) => !cands.some((q) => q !== r && dominates(q, r) && (!dominates(r, q) || q.id < r.id)));
}

export interface SetValue { L: number; U: number; size: number; burden: number; key: string; idx: number[] }

/** Lexicographic comparison (negative = a better). */
export function cmpValue(a: SetValue, b: SetValue): number {
  if (Math.abs(a.L - b.L) > P.EPS) return b.L - a.L;
  if (Math.abs(a.U - b.U) > P.EPS) return b.U - a.U;
  if (a.size !== b.size) return a.size - b.size;
  if (Math.abs(a.burden - b.burden) > P.EPS) return a.burden - b.burden;
  return cmpStr(a.key, b.key);
}

/** Exhaustive search over subsets of size 1..maxSet (i<j<k), points weighted by w. */
export function searchBest(cands: Cand[], w: number[], cells: Cells, maxSet: number = P.MAX_SET): SetValue {
  const W = cells.weightTable;
  const wtot = W[cells.coreMask];
  const sw = w.reduce((a, b) => a + b, 0) || 1;
  const n = cands.length;
  const np = w.length;
  let best: SetValue = { L: 0, U: 0, size: 0, burden: 0, key: "", idx: [] };
  if (wtot <= 0 || n === 0) return best;
  const evalIdx = (ix: number[]): SetValue => {
    let L = 0, U = 0, b = 0;
    for (let p = 0; p < np; p++) {
      let Y = 0, YU = 0;
      for (const i of ix) { Y |= cands[i].y[p]; YU |= cands[i].y[p] | cands[i].u[p]; }
      L += w[p] * W[Y];
      U += w[p] * W[YU];
    }
    for (const i of ix) b += cands[i].burden;
    return { L: L / sw / wtot, U: U / sw / wtot, size: ix.length, burden: b, key: ix.map((i) => cands[i].id).join(","), idx: ix };
  };
  let first = true;
  const consider = (ix: number[]) => {
    const v = evalIdx(ix);
    if (first || cmpValue(v, best) < 0) { best = v; first = false; }
  };
  for (let i = 0; i < n; i++) {
    consider([i]);
    if (maxSet < 2) continue;
    for (let j = i + 1; j < n; j++) {
      consider([i, j]);
      if (maxSet < 3) continue;
      for (let k = j + 1; k < n; k++) consider([i, j, k]);
    }
  }
  return best;
}

/** Tri of resource r for function bit at a point entry. */
function triOf(e: ResPointCell | undefined, bit: number): Tri {
  if (!e) return "N";
  if ((e.y >> bit) & 1) return "Y";
  if ((e.u >> bit) & 1) return "U";
  return "N";
}

function repChannel(e: ResPointCell | undefined, bit: number, want: Tri): Channel {
  if (e) {
    for (const ch of CH_ORDER) {
      const m = e.byChannel[ch];
      if (!m) continue;
      if (want === "Y" && (m.y >> bit) & 1) return ch;
      if (want === "U" && ((m.y | m.u) >> bit) & 1) return ch;
    }
  }
  return "visit";
}

/** Build a PlanVM for a given set (shared by the optimiser and the baselines). */
export function vmFromSet(cells: Cells, region: Region, villageId: string, mode: Mode, set: string[],
  extra?: { truncated?: boolean; nCandidates?: number }): PlanVM {
  const idx = indexRegion(region);
  const pts = idx.pointsOf.get(villageId) ?? [];
  const core = cells.coreMask;
  const nCore = popcount(core);
  const sw = pts.reduce((a, p) => a + p.weight, 0) || 1;
  const W = cells.weightTable;
  const wtot = W[core] || 1;
  let L = 0, U = 0, cY = 0, cU = 0, cN = 0;
  let anyPossible = 0;
  for (const p of pts) {
    let Y = 0, YU = 0;
    for (const rid of set) {
      const e = cells.masks[mode].get(p.id)?.get(rid);
      if (!e) continue;
      Y |= e.y & core;
      YU |= (e.y | e.u) & core;
    }
    anyPossible |= YU;
    L += p.weight * W[Y];
    U += p.weight * W[YU];
    const ny = popcount(Y), nu = popcount(YU & ~Y);
    cY += p.weight * ny;
    cU += p.weight * nu;
    cN += p.weight * (nCore - ny - nu);
  }
  const byFn: Partial<Record<FnCode, Assignment[]>> = {};
  const gaps: FnCode[] = [];
  for (const fn of FN_CODES) {
    const bit = FN_BIT[fn];
    if (!((core >> bit) & 1)) continue;
    const yRes: Assignment[] = [], uRes: Assignment[] = [];
    for (const rid of [...set].sort(cmpStr)) {
      let best: Tri = "N";
      let bestEntry: ResPointCell | undefined;
      for (const p of pts) {
        const e = cells.masks[mode].get(p.id)?.get(rid);
        const t = triOf(e, bit);
        if (t === "Y" || (t === "U" && best === "N")) { best = t; bestEntry = e; }
        if (best === "Y") break;
      }
      if (best === "Y") yRes.push({ resId: rid, tri: "Y", channel: repChannel(bestEntry, bit, "Y") });
      else if (best === "U") uRes.push({ resId: rid, tri: "U", channel: repChannel(bestEntry, bit, "U") });
    }
    const list = yRes.length ? yRes : uRes;
    if (list.length) byFn[fn] = list;
    if (!((anyPossible >> bit) & 1)) gaps.push(fn);
  }
  return {
    villageId, mode, set: [...set].sort(cmpStr),
    L: L / sw / wtot * (W[core] ? 1 : 0), U: U / sw / wtot * (W[core] ? 1 : 0),
    countY: cY / sw, countU: cU / sw, countN: cN / sw,
    byFn, gaps, truncated: extra?.truncated ?? false, nCandidates: extra?.nCandidates ?? 0,
  };
}

/** Optimise one (village, mode). */
export function solveVM(region: Region, cells: Cells, villageId: string, mode: Mode): PlanVM {
  const idx = indexRegion(region);
  const pts = idx.pointsOf.get(villageId) ?? [];
  const raw = candidatesFor(cells, pts, mode);
  let cands = removeDominated(raw);
  let truncated = false;
  if (cands.length > P.MAX_CANDIDATES) {
    cands = [...cands].sort((a, b) => a.burden - b.burden || cmpStr(a.id, b.id)).slice(0, P.MAX_CANDIDATES);
    cands.sort((a, b) => cmpStr(a.id, b.id));
    truncated = true;
  }
  const best = searchBest(cands, pts.map((p) => p.weight), cells);
  return vmFromSet(cells, region, villageId, mode, best.idx.map((i) => cands[i].id), { truncated, nCandidates: raw.length });
}

/** Scope villages: the store's village + villages whose node lies within SCOPE_KM of the store (id order). */
export function scopeOf(region: Region, store: StoreLoc): string[] {
  const ids = new Set<string>([store.villageId]);
  for (const v of region.villages) if (haversineKm(store.lat, store.lon, v.lat, v.lon) <= P.SCOPE_KM + P.EPS) ids.add(v.id);
  return [...ids].filter((id) => region.villages.some((v) => v.id === id)).sort(cmpStr);
}

export function summarize(region: Region, cells: Cells, byVM: PlanVM[], scope: string[]): Record<Mode, ModeSummary> {
  const idx = indexRegion(region);
  const nCore = popcount(cells.coreMask);
  const out = {} as Record<Mode, ModeSummary>;
  for (const m of MODES) {
    let sw = 0, L = 0, U = 0, cY = 0, cU = 0, cN = 0;
    for (const vid of scope) {
      const vm = byVM.find((x) => x.villageId === vid && x.mode === m);
      if (!vm) continue;
      const w = idx.village.get(vid)?.pop ?? 1;
      sw += w; L += w * vm.L; U += w * vm.U; cY += w * vm.countY; cU += w * vm.countU; cN += w * vm.countN;
    }
    sw = sw || 1;
    out[m] = { L: L / sw, U: U / sw, countY: cY / sw, countU: cU / sw, countN: cN / sw, nCore };
  }
  return out;
}

function commonOf(region: Region, byVM: PlanVM[]): Partial<Record<FnCode, string[]>> {
  const idx = indexRegion(region);
  const out: Partial<Record<FnCode, string[]>> = {};
  for (const fn of FN_CODES) {
    const freq = new Map<string, number>();
    for (const vm of byVM) {
      const w = idx.village.get(vm.villageId)?.pop ?? 1;
      for (const a of vm.byFn[fn] ?? []) freq.set(a.resId, (freq.get(a.resId) ?? 0) + w);
    }
    if (!freq.size) continue;
    out[fn] = [...freq.entries()].sort((a, b) => b[1] - a[1] || cmpStr(a[0], b[0])).slice(0, 2).map((x) => x[0]);
  }
  return out;
}

export function planScope(region: Region, cells: Cells, store: StoreLoc, fns: FunctionPiece[]): Plan {
  void fns; // enabled functions/importance are already baked into `cells`
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const scope = scopeOf(region, store);
  const idx = indexRegion(region);
  const byVM: PlanVM[] = [];
  for (const vid of scope) for (const m of MODES) byVM.push(solveVM(region, cells, vid, m));
  const points = scope.flatMap((vid) => (idx.pointsOf.get(vid) ?? []).map((p) => p.id));
  const socialHubs = (cells.enabledMask & SOCIAL_MASK)
    ? region.resources.filter((r) => r.cls === "hub" && r.villageId && scope.includes(r.villageId)).map((r) => r.id).sort(cmpStr)
    : [];
  const plan: Plan = {
    scope, points, byVM, summary: summarize(region, cells, byVM, scope), common: commonOf(region, byVM),
    socialHubs, voi: [], ms: 0,
  };
  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  plan.ms = Math.round((t1 - t0) * 100) / 100;
  return plan;
}
