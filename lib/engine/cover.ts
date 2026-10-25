// Coverage optimisation (spec 5.5). A1 = STUB: signature frozen (K2), returns plan_mock.json. A3 implements.
import type { FunctionPiece, Plan, Region } from "../types";
import type { Cells } from "./cells";
import { mockPlan } from "./mock";

export interface StoreLoc { lat: number; lon: number; villageId: string }

export function planScope(region: Region, cells: Cells, store: StoreLoc, fns: FunctionPiece[]): Plan {
  void region; void cells; void store; void fns;
  return mockPlan();
}
