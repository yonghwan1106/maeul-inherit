// Per-resident re-ranking (spec 5.8). A1 = STUB: signature frozen (K2). A3 implements.
import type { FunctionPiece, Mode, PersonalResult, Region } from "../types";
import type { Cells } from "./cells";
import { mockPersonal } from "./mock";

export function personal(region: Region, cells: Cells, pointId: string, mode: Mode, fns: FunctionPiece[]): PersonalResult {
  void region; void cells; void fns;
  return { ...mockPersonal(), pointId, mode };
}
