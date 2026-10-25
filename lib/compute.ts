// Bundle C glue between screens and the engine (lib/engine/index.ts is the only engine import, K2).
// Everything shown as a number on S0/S3/S4/poster comes from these engine calls.
import type { Confirmation, FnCode, FunctionPiece, Mode, PersonalResult, Plan, Region, Resident, Scenario, Tri, VoiItem } from "./types";
import { b1, computeVoi, makeCells, personal, planScope, type Cells } from "./engine";
import { CORE_FNS } from "./ontology";
import { confNoteFor, resName } from "./view";

export interface FnRow {
  code: FnCode;
  tri: Tri;
  resId?: string;
  resName?: string;
  note?: string | null;
}

export interface ResidentView {
  resident: Resident;
  mode: Mode;
  pointId: string;
  rows: FnRow[];
  countY: number;
  countU: number;
  countN: number;
  ordered: PersonalResult["ordered"];
  b1: PersonalResult["b1"] & { name: string };
}

export function coreCodes(fns: FunctionPiece[]): FnCode[] {
  return fns.filter((f) => f.enabled && CORE_FNS.includes(f.code)).map((f) => f.code);
}

export function residentView(
  region: Region,
  cells: Cells,
  resident: Resident,
  fns: FunctionPiece[],
  opts?: { mode?: Mode; pointId?: string },
): ResidentView {
  const mode = opts?.mode ?? resident.mode;
  const pointId = opts?.pointId ?? resident.pointId;
  const pr = personal(region, cells, pointId, mode, fns);
  const rows: FnRow[] = coreCodes(fns).map((code) => {
    const e = pr.perFn[code];
    const tri: Tri = e?.tri ?? "N";
    const id = tri === "N" ? undefined : e?.resId;
    return {
      code,
      tri,
      resId: id,
      resName: id ? resName(region, id) : undefined,
      note: id && tri === "Y" ? confNoteFor(id, cells.applied, cells.registry) : null,
    };
  });
  return {
    resident,
    mode,
    pointId,
    rows,
    countY: pr.countY,
    countU: pr.countU,
    countN: pr.countN,
    ordered: pr.ordered,
    b1: { ...pr.b1, name: resName(region, pr.b1.resId) },
  };
}

export interface PlanBundle {
  cells: Cells;
  plan: Plan;
  voi: VoiItem[];
  ms: number;
}

/** Full S3 recompute: cells -> plan -> VOI. `ms` = wall time of this recompute. */
export function computePlan(region: Region, scenario: Scenario, fns: FunctionPiece[], conf: Confirmation[]): PlanBundle {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const cells = makeCells(region, fns, conf);
  const store = { lat: scenario.store.lat, lon: scenario.store.lon, villageId: scenario.store.villageId };
  const plan = planScope(region, cells, store, fns);
  const voi = computeVoi(region, cells, plan, store, fns);
  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  return { cells, plan, voi, ms: t1 - t0 };
}

export function baseCells(region: Region, fns: FunctionPiece[]): Cells {
  return makeCells(region, fns, []);
}

/** B1 for the S3 mini card / poster: count from engine personal().b1 (same function as evaluation). */
export { b1 };
