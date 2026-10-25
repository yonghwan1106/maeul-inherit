// Per-resident re-ranking (spec 5.8): the same exhaustive search on one demand point (max 3 places),
// then order = (Y core functions desc, U core functions desc, burden asc, id asc).
import type { FnCode, FunctionPiece, Mode, PersonalResult, Region, Tri } from "../types";
import { FN_BIT, FN_CODES } from "../ontology";
import type { Cells } from "./cells";
import { candidatesFor, removeDominated, searchBest } from "./cover";
import { P } from "./params";
import { cmpStr, indexRegion, popcount } from "./util";
import { haversineKm } from "../geo";

export function personal(region: Region, cells: Cells, pointId: string, mode: Mode, fns: FunctionPiece[]): PersonalResult {
  void fns;
  const idx = indexRegion(region);
  const p = idx.point.get(pointId);
  const core = cells.coreMask;
  const nCore = popcount(core);
  const empty: PersonalResult = {
    pointId, mode, ordered: [], perFn: {}, countY: 0, countU: 0, countN: nCore,
    b1: { resId: "", distKm: 0, countY: 0, walkable: false },
  };
  if (!p) return empty;
  let cands = removeDominated(candidatesFor(cells, [p], mode));
  if (cands.length > P.MAX_CANDIDATES) {
    cands = [...cands].sort((a, b) => a.burden - b.burden || cmpStr(a.id, b.id)).slice(0, P.MAX_CANDIDATES).sort((a, b) => cmpStr(a.id, b.id));
  }
  const best = searchBest(cands, [1], cells);
  const set = best.idx.map((i) => cands[i]);
  const inner = cells.masks[mode].get(p.id);
  const sorted = [...set].sort((a, b) =>
    popcount(b.y[0]) - popcount(a.y[0]) || popcount(b.u[0]) - popcount(a.u[0]) || a.burden - b.burden || cmpStr(a.id, b.id));

  // assign each core function to the first resource (in order) giving Y, else the first giving U
  const perFn: PersonalResult["perFn"] = {};
  const assigned = new Map<string, FnCode[]>();
  let Y = 0, YU = 0;
  for (const c of sorted) { Y |= c.y[0]; YU |= c.y[0] | c.u[0]; }
  for (const fn of FN_CODES) {
    const bit = FN_BIT[fn];
    if (!((core >> bit) & 1)) continue;
    let tri: Tri = "N";
    let resId: string | undefined;
    const yr = sorted.find((c) => (c.y[0] >> bit) & 1);
    const ur = sorted.find((c) => (c.u[0] >> bit) & 1);
    if (yr) { tri = "Y"; resId = yr.id; } else if (ur) { tri = "U"; resId = ur.id; }
    perFn[fn] = resId ? { tri, resId } : { tri };
    if (resId) assigned.set(resId, [...(assigned.get(resId) ?? []), fn]);
  }
  const ordered = sorted.map((c) => {
    const fnsOf = assigned.get(c.id) ?? [];
    const anyY = fnsOf.some((f) => perFn[f]?.tri === "Y");
    return { resId: c.id, fns: fnsOf, tri: (anyY ? "Y" : "U") as Tri };
  }).filter((o) => o.fns.length > 0);

  // B1: nearest (straight) hanaro/store_daily
  let b1Id = "", b1d = Infinity;
  for (const r of region.resources) {
    if ((r.cls !== "hanaro" && r.cls !== "store_daily") || typeof r.lat !== "number" || typeof r.lon !== "number") continue;
    const d = haversineKm(p.lat, p.lon, r.lat, r.lon);
    if (d < b1d - P.EPS || (Math.abs(d - b1d) <= P.EPS && r.id < b1Id)) { b1d = d; b1Id = r.id; }
  }
  const e1 = inner?.get(b1Id);
  const b1 = {
    resId: b1Id,
    distKm: Number.isFinite(b1d) ? Math.round(b1d * 10) / 10 : 0,
    countY: popcount((e1?.y ?? 0) & core),
    walkable: Number.isFinite(b1d) && b1d * P.ROAD_FACTOR_WALK <= P.WALK_MAX_KM + P.EPS,
  };
  const ny = popcount(Y), nu = popcount(YU & ~Y);
  return { pointId, mode, ordered, perFn, countY: ny, countU: nu, countN: nCore - ny - nu, b1 };
}
