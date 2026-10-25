// Static data used by API routes and scripts (bundle B). Imported statically so Vercel bundles the JSON.
import regionJson from "../data/region_hwasan.json";
import sc1 from "../data/scenarios/sc1_seungchi.json";
import sc2 from "../data/scenarios/sc2_waryong.json";
import sc3 from "../data/scenarios/sc3_ungok.json";
import type { Region, Scenario } from "./types";

export const REGION: Region = regionJson as unknown as Region;

/** Precomputed scenarios (B4). Their inputHash values feed the precomputed cache table (lib/guard/cache.ts). */
export const SCENARIOS: Scenario[] = [sc1, sc2, sc3] as unknown as Scenario[];

export function scenarioById(id: string | null | undefined): Scenario | null {
  if (!id) return null;
  return SCENARIOS.find((s) => s.id === id) ?? null;
}

export function regionBuiltAt(): string | null {
  const g = (REGION.meta as Record<string, unknown>).generatedAt;
  return typeof g === "string" ? g : null;
}
