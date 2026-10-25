// A1 stub support: typed access to data/fixtures/plan_mock.json. Remove once A3 replaces all stubs.
import planMock from "../../data/fixtures/plan_mock.json";
import type { FunctionPiece, PersonalResult, Plan, PlanDigest, PlanVM, Store } from "../types";

interface PlanMockFile {
  store: Store;
  fns: FunctionPiece[];
  plan: Plan;
  personal: PersonalResult[];
  baseline: PlanVM;
  digest: PlanDigest;
}

const M = planMock as unknown as PlanMockFile;

/** Deep copy so callers may mutate freely. */
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export const mockPlan = (): Plan => clone(M.plan);
export const mockPersonal = (): PersonalResult => clone(M.personal[0]);
export const mockBaseline = (): PlanVM => clone(M.baseline);
export const mockDigest = (): PlanDigest => clone(M.digest);
export const mockFns = (): FunctionPiece[] => clone(M.fns);
export const mockStore = (): Store => clone(M.store);
