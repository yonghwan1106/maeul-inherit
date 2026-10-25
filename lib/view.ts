// Bundle C view helpers shared by server pages and client screens (no React here).
import type { Confirmation, FnCode, FunctionPiece, Mode, Region, Resource, Scenario } from "./types";
import type { FnEdit } from "./store/local";
import { CORE_FNS } from "./ontology";

/** What the screens need from a /api/decompose response (spec 6.2) or its precomputed copy. */
export interface DecomposeView {
  mode: string;
  model: string | null;
  functions: FunctionPiece[];
  unknowns: string[];
  generatedAt: string | null;
  fallbackReason: string | null;
}

const FN_SET = new Set<string>(["F01", "F02", "F03", "F04", "F05", "F06", "F07", "F08", "F09", "F10"]);

export function parseDecompose(resp: unknown): DecomposeView {
  const r = (resp && typeof resp === "object" ? resp : {}) as Record<string, unknown>;
  const fnsRaw = Array.isArray(r.functions) ? r.functions : [];
  const functions: FunctionPiece[] = [];
  for (const f of fnsRaw) {
    if (!f || typeof f !== "object") continue;
    const o = f as Record<string, unknown>;
    const code = String(o.code ?? "");
    if (!FN_SET.has(code) || functions.some((x) => x.code === code)) continue;
    const imp = Number(o.importance);
    functions.push({
      code: code as FnCode,
      importance: (imp === 1 || imp === 2 || imp === 3 ? imp : 2) as 1 | 2 | 3,
      evidence: String(o.evidence ?? ""),
      needsCheck: !!o.needsCheck,
      source: (o.source === "llm" || o.source === "manual" ? o.source : "rules") as FunctionPiece["source"],
      enabled: o.enabled === false ? false : true,
    });
  }
  functions.sort((a, b) => (a.code < b.code ? -1 : 1));
  const validator = (r.validator && typeof r.validator === "object" ? r.validator : {}) as Record<string, unknown>;
  return {
    mode: typeof r.mode === "string" ? r.mode : "rules",
    model: typeof r.model === "string" ? r.model : null,
    functions,
    unknowns: Array.isArray(r.unknowns) ? r.unknowns.map(String) : [],
    generatedAt: typeof r.generatedAt === "string" ? r.generatedAt : null,
    fallbackReason: typeof validator.fallbackReason === "string" ? validator.fallbackReason : null,
  };
}

/** Apply officer edits (S2) on top of the decomposition. */
export function applyFnEdits(base: FunctionPiece[], edits: FnEdit[]): FunctionPiece[] {
  if (!edits.length) return base;
  const byCode = new Map(edits.map((e) => [e.code, e]));
  return base.map((f) => {
    const e = byCode.get(f.code);
    return e ? { ...f, enabled: e.enabled, importance: e.importance, source: f.source } : f;
  });
}

export const coreEnabled = (fns: FunctionPiece[]) => fns.filter((f) => f.enabled && CORE_FNS.includes(f.code));

export function resName(region: Region, id: string | undefined | null): string {
  if (!id) return "";
  return region.resources.find((r) => r.id === id)?.name ?? id;
}

export function pointName(region: Region, pointId: string): string {
  const p = region.points.find((x) => x.id === pointId);
  if (!p) return pointId;
  const v = region.villages.find((x) => x.id === p.villageId);
  if (p.kind === "village_node") return v ? v.name : p.name;
  return v ? `${v.name} ${p.name.replace(/(경로당|경로회관|마을회관|새마을회관|경로회)$/, "")} 마을` : p.name;
}

export function villageName(region: Region, id: string): string {
  return region.villages.find((v) => v.id === id)?.name ?? id;
}

/** Source badge text for a resource column (OSM / 상가정보 / 파생). */
export function srcLabel(r: Resource | undefined): string {
  if (!r) return "";
  const s = r.src ?? [];
  const parts: string[] = [];
  if (s.includes("osm")) parts.push("OSM");
  if (s.includes("sbiz")) parts.push("상가정보");
  if (s.includes("derived")) parts.push(r.anonymized ? "익명·가정" : "파생");
  return parts.join("+") || "—";
}

/** Day words (월요일~일요일) found in a confirmation note. */
export function daysIn(note: string | undefined): string[] {
  if (!note) return [];
  const out: string[] = [];
  for (const d of ["월", "화", "수", "목", "금", "토", "일"]) if (note.includes(`${d}요일`)) out.push(`${d}요일`);
  return out;
}

/** Notes of applied Y confirmations touching resource `resId` (registry resId match). */
export function confNoteFor(
  resId: string,
  applied: Confirmation[],
  registry: Map<string, { resId?: string; pointId?: string }>,
  pointId?: string,
): string | null {
  for (const c of applied) {
    if (c.value !== "Y" || !c.note) continue;
    const def = registry.get(c.cellKey);
    if (def?.resId !== resId && !c.cellKey.includes(`:${resId}:`) && !c.cellKey.endsWith(`:${resId}`)) continue;
    if (pointId && def?.pointId && def.pointId !== pointId) continue;
    return c.note;
  }
  return null;
}

export const MODE_ORDER: Mode[] = ["car", "walk", "homebound"];
/** S3 shows bars in the officer order 차량 / 도보 / 거동 곤란 (spec 8.5). */

export type { Scenario };
