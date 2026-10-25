// Static data used by API routes and scripts (bundle B). Imported statically so Vercel bundles the JSON.
// SCENARIOS = [] until B4 writes data/scenarios/*.json (then imported here).
import regionJson from "../data/region_hwasan.json";
import type { Region, Scenario } from "./types";

export const REGION: Region = regionJson as unknown as Region;

export const SCENARIOS: Scenario[] = [];

export function scenarioById(id: string | null | undefined): Scenario | null {
  if (!id) return null;
  return SCENARIOS.find((s) => s.id === id) ?? null;
}

export function regionBuiltAt(): string | null {
  const g = (REGION.meta as Record<string, unknown>).generatedAt;
  return typeof g === "string" ? g : null;
}
