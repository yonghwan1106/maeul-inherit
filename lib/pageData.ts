// Server helper for /s/[id]/* pages: region + scenario (null for `custom`, which lives in the browser).
import { SCENARIO_IDS, loadRegion, loadScenario } from "./data";
import type { Region, Scenario } from "./types";

export const SCENARIO_PARAMS = [...SCENARIO_IDS, "custom"].map((id) => ({ id }));

export interface ScenarioPageData {
  sid: string;
  region: Region;
  mock: boolean;
  scenario: Scenario | null;
  temp: boolean;
}

export function scenarioPageData(id: string): ScenarioPageData {
  const { region, mock } = loadRegion();
  if (id === "custom") return { sid: id, region, mock, scenario: null, temp: false };
  const s = loadScenario(id, region);
  return { sid: id, region, mock, scenario: s?.scenario ?? null, temp: s?.temp ?? false };
}
