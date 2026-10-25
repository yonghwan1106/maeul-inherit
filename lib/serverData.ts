// Static data used by API routes and scripts (bundle B). Imported statically so Vercel bundles the JSON.
// TEMP (B1): region = data/fixtures/region_mock.json until A2 lands data/region_hwasan.json;
//            SCENARIOS = [] until B4 writes data/scenarios/*.json.
import regionJson from "../data/fixtures/region_mock.json";
import type { Region, Scenario } from "./types";

export const REGION: Region = regionJson as unknown as Region;
export const REGION_IS_MOCK = true;

export const SCENARIOS: Scenario[] = [];

export function scenarioById(id: string | null | undefined): Scenario | null {
  if (!id) return null;
  return SCENARIOS.find((s) => s.id === id) ?? null;
}

export function regionBuiltAt(): string | null {
  const g = (REGION.meta as Record<string, unknown>).generatedAt;
  return typeof g === "string" ? g : null;
}
