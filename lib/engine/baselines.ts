// Baselines B1 / B1b / B1g (spec 5.9) — shared by evaluation and the S3 mini card. Results are PlanVM-shaped
// (evaluated on all demand points of the village with the same cells as the engine).
import type { FnCode, FunctionPiece, Mode, PlanVM, Region, Resource } from "../types";
import { FN_BIT, FN_CODES } from "../ontology";
import { haversineKm } from "../geo";
import type { Cells } from "./cells";
import { vmFromSet } from "./cover";
import { P } from "./params";
import { cmpStr, indexRegion } from "./util";

function nodeDist(region: Region, villageId: string, r: Resource): number {
  const node = indexRegion(region).nodeOf.get(villageId);
  if (!node || typeof r.lat !== "number" || typeof r.lon !== "number") return Infinity;
  return haversineKm(node.lat, node.lon, r.lat, r.lon);
}

function nearestFirst(region: Region, villageId: string, list: Resource[], unlocatedZero = false): Resource[] {
  const d = (r: Resource) => {
    const x = nodeDist(region, villageId, r);
    return !Number.isFinite(x) && unlocatedZero ? 0 : x;
  };
  return [...list].sort((a, b) => {
    const da = d(a), db = d(b);
    if (Math.abs(da - db) > P.EPS) return da - db;
    return cmpStr(a.id, b.id);
  });
}

/** B1: nearest (straight-line) food resource (hanaro, store_daily) to the village node. */
export function b1(region: Region, cells: Cells, villageId: string, mode: Mode, fns: FunctionPiece[]): PlanVM {
  void fns;
  const food = region.resources.filter((r) => (r.cls === "hanaro" || r.cls === "store_daily") && typeof r.lat === "number");
  const pick = nearestFirst(region, villageId, food)[0];
  return vmFromSet(cells, region, villageId, mode, pick ? [pick.id] : []);
}

/** B1b: 3 nearest located resources (visit/hub family) with at least one non-N core cell at the village node. */
export function b1b(region: Region, cells: Cells, villageId: string, mode: Mode, fns: FunctionPiece[]): PlanVM {
  void fns;
  const node = indexRegion(region).nodeOf.get(villageId);
  const inner = node ? cells.masks[mode].get(node.id) : undefined;
  const ok = region.resources.filter((r) => {
    if (typeof r.lat !== "number") return false;
    const e = inner?.get(r.id);
    return !!e && ((e.y | e.u) & cells.coreMask) !== 0;
  });
  const pick = nearestFirst(region, villageId, ok).slice(0, P.MAX_SET);
  return vmFromSet(cells, region, villageId, mode, pick.map((r) => r.id));
}

/** B1g: greedy — per core function (importance desc, code asc) add the nearest Y (else U) provider, |S| <= 3. */
export function b1g(region: Region, cells: Cells, villageId: string, mode: Mode, fns: FunctionPiece[]): PlanVM {
  const node = indexRegion(region).nodeOf.get(villageId);
  const inner = node ? cells.masks[mode].get(node.id) : undefined;
  const imp = new Map<FnCode, number>();
  for (const f of fns) if (f.enabled) imp.set(f.code, Math.max(imp.get(f.code) ?? 0, f.importance));
  const order = FN_CODES.filter((c) => (cells.coreMask >> FN_BIT[c]) & 1)
    .sort((a, b) => (imp.get(b) ?? 0) - (imp.get(a) ?? 0) || cmpStr(a, b));
  const set: string[] = [];
  const has = (rid: string, bit: number, kind: "y" | "u") => {
    const e = inner?.get(rid);
    return !!e && (((kind === "y" ? e.y : e.u) >> bit) & 1) === 1;
  };
  for (const fn of order) {
    if (set.length >= P.MAX_SET) break;
    const bit = FN_BIT[fn];
    if (set.some((rid) => has(rid, bit, "y"))) continue;
    const yList = region.resources.filter((r) => has(r.id, bit, "y"));
    const uList = region.resources.filter((r) => has(r.id, bit, "u"));
    const pick = nearestFirst(region, villageId, yList, true)[0] ?? nearestFirst(region, villageId, uList, true)[0];
    if (pick && !set.includes(pick.id)) set.push(pick.id);
  }
  return vmFromSet(cells, region, villageId, mode, set);
}
