// Server-side loaders for screens (bundle C). Reads repository JSON at build/render time with fs so a
// missing file (before A2/B4 land) falls back to the A1 fixtures / temporary scenarios instead of
// breaking the build. Client screens get the loaded objects as props.
import fs from "node:fs";
import path from "node:path";
import type { Region, Scenario } from "./types";
import { TEMP_SCENARIOS, resolveTempScenario } from "./temp-scenarios";

export const SCENARIO_IDS = ["sc1_seungchi", "sc2_waryong", "sc3_ungok"] as const;

// Paths are scoped to data/ subfolders so build tracing stays narrow (pages are prerendered; no runtime fs).
function readJson<T>(p: string): T | null {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

export interface LoadedRegion {
  region: Region;
  /** true = A1 fixture (region_mock.json) — screens show the 「목업 데이터」 badge. */
  mock: boolean;
}

export function loadRegion(): LoadedRegion {
  const real = readJson<Region>(path.join(process.cwd(), "data", "region_hwasan.json"));
  if (real && Array.isArray(real.villages) && real.villages.length > 0) return { region: real, mock: false };
  const mock = readJson<Region>(path.join(process.cwd(), "data", "fixtures", "region_mock.json"));
  return { region: mock as Region, mock: true };
}

export interface LoadedScenario {
  scenario: Scenario;
  /** true = temporary scenario built in lib/temp-scenarios.ts until B4 writes data/scenarios/{id}.json */
  temp: boolean;
}

export function loadScenario(id: string, region: Region): LoadedScenario | null {
  const s = readJson<Scenario>(path.join(process.cwd(), "data", "scenarios", `${id}.json`));
  if (s && s.id === id) return { scenario: s, temp: false };
  const t = TEMP_SCENARIOS.find((x) => x.id === id);
  return t ? { scenario: resolveTempScenario(t, region), temp: true } : null;
}

export function loadAllScenarios(region: Region): LoadedScenario[] {
  return SCENARIO_IDS.map((id) => loadScenario(id, region)).filter((x): x is LoadedScenario => !!x);
}

/** data/eval/results.json (spec 7.5) or null before A5. */
export function loadResults(): Record<string, unknown> | null {
  return readJson<Record<string, unknown>>(path.join(process.cwd(), "data", "eval", "results.json"));
}
