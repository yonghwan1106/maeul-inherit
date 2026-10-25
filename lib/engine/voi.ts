// Value of information — "먼저 전화할 곳" (spec 5.7).
// For every U cell touching the scope: set it to Y, re-optimise only the touched (village, mode), and
// measure the scope-average gain of L (dL) and of the sure-count (dCount); setting it to N gives uDropIfNo.
// key = dL.car + dL.walk + dL.homebound [assumption: equal weight]. Sort key desc, cellKey asc.
import type { FunctionPiece, Mode, Plan, PlanVM, Region, Tri, VoiItem } from "../types";
import { MODES } from "../types";
import type { Cells } from "./cells";
import { withOverrides } from "./cells";
import type { StoreLoc } from "./cover";
import { solveVM } from "./cover";
import { P } from "./params";
import { cmpStr, indexRegion } from "./util";

export interface VoiOptions {
  /** restrict candidates (e.g. evaluation excludes bus cells) */
  filter?: (cellKey: string) => boolean;
}

/** Scope-average change of a PlanVM metric after replacing some (village, mode) results. */
function scopeDelta(region: Region, plan: Plan, changed: Map<string, PlanVM>, m: Mode, pick: (vm: PlanVM) => number): number {
  const idx = indexRegion(region);
  let sw = 0, d = 0;
  for (const vid of plan.scope) {
    const w = idx.village.get(vid)?.pop ?? 1;
    sw += w;
    const nv = changed.get(vid + "|" + m);
    if (!nv) continue;
    const ov = plan.byVM.find((x) => x.villageId === vid && x.mode === m);
    if (ov) d += w * (pick(nv) - pick(ov));
  }
  return sw ? d / sw : 0;
}

/** Re-solve the scope (village, mode) pairs whose masks actually changed under the override. */
export function resolveChanged(region: Region, cells: Cells, plan: Plan, key: string, value: Tri): Map<string, PlanVM> {
  const out = new Map<string, PlanVM>();
  const next = withOverrides(cells, new Map([[key, value]]));
  const idx = indexRegion(region);
  const scope = new Set(plan.scope);
  const dirty = new Set<string>();
  for (const [m, pid, rid] of cells._ctx?.deps.get(key) ?? []) {
    const p = idx.point.get(pid);
    if (!p || !scope.has(p.villageId)) continue;
    const vm = p.villageId + "|" + m;
    if (dirty.has(vm)) continue;
    const a = cells.masks[m].get(pid)?.get(rid);
    const b = next.masks[m].get(pid)?.get(rid);
    if ((a?.y ?? 0) !== (b?.y ?? 0) || (a?.u ?? 0) !== (b?.u ?? 0)) dirty.add(vm);
  }
  for (const vm of [...dirty].sort()) {
    const [vid, m] = vm.split("|") as [string, Mode];
    out.set(vm, solveVM(region, next, vid, m));
  }
  return out;
}

export function computeVoi(region: Region, cells: Cells, plan: Plan, store: StoreLoc, fns: FunctionPiece[],
  options?: VoiOptions): VoiItem[] {
  void store; void fns; // scope comes from `plan`, functions are baked into `cells`
  const scopeVM = new Set<string>();
  for (const vid of plan.scope) for (const m of MODES) scopeVM.add(vid + "|" + m);
  const items: VoiItem[] = [];
  for (const [key, def] of cells.registry) {
    if ((cells.values.get(key) ?? "U") !== "U") continue;
    if (def.kind === "bus" && !cells.opts.bus) continue;
    if (options?.filter && !options.filter(key)) continue;
    const aff = cells.affects.get(key);
    if (!aff || ![...aff].some((x) => scopeVM.has(x))) continue;
    const yes = resolveChanged(region, cells, plan, key, "Y");
    const no = resolveChanged(region, cells, plan, key, "N");
    const dL = {} as Record<Mode, number>, dCount = {} as Record<Mode, number>, uDrop = {} as Record<Mode, number>;
    for (const m of MODES) {
      dL[m] = scopeDelta(region, plan, yes, m, (v) => v.L);
      dCount[m] = scopeDelta(region, plan, yes, m, (v) => v.countY);
      uDrop[m] = -scopeDelta(region, plan, no, m, (v) => v.U);
    }
    const k = dL.car + dL.walk + dL.homebound;
    items.push({ cellKey: key, label: def.label, realNamed: def.realNamed, key: k, dL, dCount, uDropIfNo: uDrop });
  }
  items.sort((a, b) => (Math.abs(b.key - a.key) > P.EPS ? b.key - a.key : cmpStr(a.cellKey, b.cellKey)));
  return items;
}
