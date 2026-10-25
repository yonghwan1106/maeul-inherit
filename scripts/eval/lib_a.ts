// Shared helpers for bundle A scripts (bench, E2, E3). Deterministic; reads repo files relative to the repo root.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FnCode, FunctionPiece, Region, Scenario } from "../../lib/types";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const rel = (...p: string[]) => path.join(ROOT, ...p);

export function readJson<T>(p: string): T {
  return JSON.parse(readFileSync(rel(p), "utf8")) as T;
}

export function writeJson(p: string, data: unknown): void {
  const full = rel(p);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, JSON.stringify(data, null, 1) + "\n", "utf8");
}

export function sha256File(p: string): string {
  return createHash("sha256").update(readFileSync(rel(p))).digest("hex");
}

export function sha256Text(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export const loadRegion = (): Region => readJson<Region>("data/region_hwasan.json");

export function piece(code: FnCode, importance: 1 | 2 | 3): FunctionPiece {
  return { code, importance, evidence: "", needsCheck: false, source: "manual", enabled: true };
}

/** E2/E3 fixed function set = SC1 life functions (spec 7.2), social excluded. */
export const E2_FNS: FunctionPiece[] = [
  piece("F01", 3), piece("F02", 2), piece("F04", 1), piece("F05", 2), piece("F06", 2), piece("F07", 2),
];

export interface ScDef { id: string; store: { lat: number; lon: number; villageId: string }; fns: FunctionPiece[] }

/**
 * Scenario stores and expected functions (spec 9.1 table). If data/scenarios/{id}.json exists (bundle B),
 * its store location and decomposed functions (precomputed response) are used instead.
 */
export function scenarioDefs(): ScDef[] {
  const base: ScDef[] = [
    { id: "sc1_seungchi", store: { lat: 36.06006, lon: 127.22416, villageId: "seungchi" },
      fns: [...E2_FNS, piece("F09", 2), piece("F10", 2)] },
    { id: "sc2_waryong", store: { lat: 36.01425, lon: 127.21211, villageId: "waryong" },
      fns: [piece("F01", 3), piece("F02", 2), piece("F04", 2), piece("F05", 2), piece("F09", 2)] },
    { id: "sc3_ungok", store: { lat: 36.06435, lon: 127.18096, villageId: "ungok" },
      fns: [piece("F01", 3), piece("F04", 2), piece("F05", 2), piece("F10", 2)] },
  ];
  return base.map((d) => {
    const f = `data/scenarios/${d.id}.json`;
    if (!existsSync(rel(f))) return d;
    try {
      const sc = readJson<Scenario>(f);
      const resp = sc.precomputed?.decompose?.response as { functions?: FunctionPiece[] } | undefined;
      const fns = resp?.functions?.length ? resp.functions : d.fns;
      return { id: d.id, store: { lat: sc.store.lat, lon: sc.store.lon, villageId: sc.store.villageId }, fns };
    } catch {
      return d;
    }
  });
}

export const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export function gitCommit(): string {
  try {
    const head = readFileSync(rel(".git", "HEAD"), "utf8").trim();
    if (head.startsWith("ref: ")) {
      const ref = head.slice(5);
      const f = rel(".git", ref);
      if (existsSync(f)) return readFileSync(f, "utf8").trim().slice(0, 7);
      const packed = readFileSync(rel(".git", "packed-refs"), "utf8").split("\n").find((l) => l.endsWith(" " + ref));
      return packed ? packed.slice(0, 7) : "";
    }
    return head.slice(0, 7);
  } catch {
    return "";
  }
}
