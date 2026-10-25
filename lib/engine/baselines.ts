// Baselines B1 / B1b / B1g (spec 5.9) — shared by evaluation and the S3 mini card.
// A1 = STUB: signatures frozen (K2), return a PlanVM-shaped mock. A3 implements.
import type { FunctionPiece, Mode, PlanVM, Region } from "../types";
import type { Cells } from "./cells";
import { mockBaseline } from "./mock";

/** B1: nearest (straight-line) food resource (hanaro, store_daily) to the village node. */
export function b1(region: Region, cells: Cells, villageId: string, mode: Mode, fns: FunctionPiece[]): PlanVM {
  void region; void cells; void fns;
  return { ...mockBaseline(), villageId, mode };
}

/** B1b: 3 nearest located resources (visit/hub family) with at least one non-N core cell. */
export function b1b(region: Region, cells: Cells, villageId: string, mode: Mode, fns: FunctionPiece[]): PlanVM {
  void region; void cells; void fns;
  return { ...mockBaseline(), villageId, mode };
}

/** B1g: greedy — per core function (importance desc, code asc) add the nearest Y (else U) provider, |S| <= 3. */
export function b1g(region: Region, cells: Cells, villageId: string, mode: Mode, fns: FunctionPiece[]): PlanVM {
  void region; void cells; void fns;
  return { ...mockBaseline(), villageId, mode };
}
