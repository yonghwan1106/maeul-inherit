// E2 scorer (spec 7.2). Uses ONLY the cell computation (lib/engine/cells.ts) and the ontology — never the
// optimiser — so the engine, the baselines and the LLM-only plans are judged by the same cells.
import type { FnCode, Mode, Region, Tri } from "../../lib/types";
import { CLASS_TABLE, FN_BIT, routeCapsFor, channelsOf } from "../../lib/ontology";
import type { Cells } from "../../lib/engine/cells";

export interface SetScore { L: number; U: number; countY: number; countU: number; countN: number }

const pc = (x: number) => { let n = 0; let v = x >>> 0; while (v) { v &= v - 1; n++; } return n; };

function pointsOf(region: Region, villageId: string) {
  return region.points.filter((p) => p.villageId === villageId);
}

/** Score a set S for (village, mode): per demand point Y = OR y, possible = OR (y|u); weighted by point weight. */
export function scoreSet(region: Region, cells: Cells, villageId: string, mode: Mode, set: string[]): SetScore {
  const pts = pointsOf(region, villageId);
  const core = cells.coreMask;
  const nCore = pc(core);
  const W = cells.weightTable;
  const wtot = W[core];
  let sw = 0, L = 0, U = 0, cY = 0, cU = 0, cN = 0;
  for (const p of pts) {
    let Y = 0, YU = 0;
    for (const rid of set) {
      const e = cells.masks[mode].get(p.id)?.get(rid);
      if (!e) continue;
      Y |= e.y & core;
      YU |= (e.y | e.u) & core;
    }
    sw += p.weight;
    L += p.weight * (wtot ? W[Y] / wtot : 0);
    U += p.weight * (wtot ? W[YU] / wtot : 0);
    const ny = pc(Y), nu = pc(YU & ~Y);
    cY += p.weight * ny; cU += p.weight * nu; cN += p.weight * (nCore - ny - nu);
  }
  sw = sw || 1;
  return { L: L / sw, U: U / sw, countY: cY / sw, countU: cU / sw, countN: cN / sw };
}

/** Pop-weighted mean of set scores over the scope villages. */
export function scoreScope(region: Region, cells: Cells, mode: Mode, sets: Record<string, string[]>, scope: string[]): SetScore {
  let sw = 0;
  const acc: SetScore = { L: 0, U: 0, countY: 0, countU: 0, countN: 0 };
  for (const vid of scope) {
    const w = region.villages.find((v) => v.id === vid)?.pop ?? 1;
    const s = scoreSet(region, cells, vid, mode, sets[vid] ?? []);
    sw += w;
    for (const k of Object.keys(acc) as (keyof SetScore)[]) acc[k] += w * s[k];
  }
  sw = sw || 1;
  for (const k of Object.keys(acc) as (keyof SetScore)[]) acc[k] /= sw;
  return acc;
}

/** Cell value at the village node for (resource, function) under `mode`. */
export function nodeTri(region: Region, cells: Cells, villageId: string, mode: Mode, resId: string, fn: FnCode): Tri {
  const node = region.points.find((p) => p.villageId === villageId && p.kind === "village_node");
  const e = node ? cells.masks[mode].get(node.id)?.get(resId) : undefined;
  const bit = FN_BIT[fn];
  if (!e) return "N";
  if ((e.y >> bit) & 1) return "Y";
  if ((e.u >> bit) & 1) return "U";
  return "N";
}

/** Does the resource class have the function on any channel (capability ignoring access)? */
export function capAny(region: Region, resId: string, fn: FnCode): boolean {
  const r = region.resources.find((x) => x.id === resId);
  if (!r || !CLASS_TABLE[r.cls]) return false;
  return channelsOf(r).some((ch) => !!routeCapsFor(r, ch)?.[fn]);
}

export interface LlmPlan { villageId: string; set: string[]; assign: { fn: string; resId: string; status: string }[] }

export interface ErrorCount { unknownRes: number; accessN: number; capN: number; assertU: number; over3: number }

/** Errors ④~⑧ of one LLM plan, judged at the village node (spec 7.2). */
export function planErrors(region: Region, cells: Cells, mode: Mode, plan: LlmPlan, coreFns: FnCode[]): ErrorCount {
  const known = new Set(region.resources.map((r) => r.id));
  const err: ErrorCount = { unknownRes: 0, accessN: 0, capN: 0, assertU: 0, over3: 0 };
  const mentioned = new Set<string>([...plan.set, ...plan.assign.map((a) => a.resId)]);
  for (const id of mentioned) if (id && !known.has(id)) err.unknownRes++;
  if (plan.set.length > 3) err.over3 = 1;
  for (const a of plan.assign) {
    const fn = a.fn as FnCode;
    if (!coreFns.includes(fn) || !known.has(a.resId)) continue;
    if (a.status === "없음") continue;
    const t = nodeTri(region, cells, plan.villageId, mode, a.resId, fn);
    if (!capAny(region, a.resId, fn)) err.capN++;
    else if (t === "N") err.accessN++;
    else if (t === "U" && a.status === "확실") err.assertU++;
  }
  return err;
}
