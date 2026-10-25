// Value of information — "먼저 전화할 곳" (spec 5.7). A1 = STUB: signature frozen (K2). A3 implements.
import type { FunctionPiece, Plan, Region, VoiItem } from "../types";
import type { Cells } from "./cells";
import type { StoreLoc } from "./cover";
import { mockPlan } from "./mock";

export function computeVoi(region: Region, cells: Cells, plan: Plan, store: StoreLoc, fns: FunctionPiece[]): VoiItem[] {
  void region; void cells; void plan; void store; void fns;
  return mockPlan().voi;
}
