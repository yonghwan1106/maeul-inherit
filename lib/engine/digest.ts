// Plan digest for document generation (spec 5.10). A1 = STUB: signature frozen (K2). A3 implements.
import type { Confirmation, PersonalResult, Plan, PlanDigest, PlanVM, Region, Scenario } from "../types";
import { mockDigest } from "./mock";

export type DigestTarget = PersonalResult | PlanVM;

export function digestFor(
  region: Region,
  plan: Plan,
  target: DigestTarget,
  scenario: Scenario | null,
  conf: Confirmation[],
): PlanDigest {
  void region; void plan; void conf;
  return { ...mockDigest(), scenarioId: scenario?.id ?? null, mode: target.mode };
}
