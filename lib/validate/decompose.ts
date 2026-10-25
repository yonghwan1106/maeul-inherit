// L1 output validator (spec 6.2). Rules only, never throws.
// - code whitelist (F01..F10), importance fixed to 1..3, duplicate codes merged
// - evidence must appear verbatim in the input (memo + items + business type + hours); otherwise needsCheck=true (demoted)
// - schemaViolation reports whether the RAW reply broke the schema (E1 metric "스키마 위반율(검증기 전)")
import type { DecomposeRequest } from "../apiTypes";
import type { FnCode, FunctionPiece } from "../types";
import { FN_CODES } from "../ontology";

export interface DecomposeValidation {
  ok: boolean;
  functions: FunctionPiece[];
  unknowns: string[];
  droppedCodes: string[];
  demoted: number;
  schemaViolation: boolean;
  /** Evidence strings that were found verbatim / total pieces kept (E1 "evidence 실재율"). */
  evidenceFound: number;
}

const squash = (s: string) => s.replace(/\s+/g, "").replace(/[“”"'‘’「」]/g, "");

export function evidenceHaystack(input: DecomposeRequest): string {
  return squash([input.memo ?? "", ...(input.items ?? []), input.sbizSub ?? "", input.hours ?? ""].join("|"));
}

export function evidenceInInput(evidence: string, input: DecomposeRequest): boolean {
  const e = squash(evidence ?? "");
  return e.length > 0 && evidenceHaystack(input).includes(e);
}

export function validateDecompose(raw: unknown, input: DecomposeRequest): DecomposeValidation {
  const empty: DecomposeValidation = {
    ok: false, functions: [], unknowns: [], droppedCodes: [], demoted: 0, schemaViolation: true, evidenceFound: 0,
  };
  if (!raw || typeof raw !== "object") return empty;
  const obj = raw as { functions?: unknown; unknowns?: unknown };
  if (!Array.isArray(obj.functions)) return empty;

  let violation = !Array.isArray(obj.unknowns) && obj.unknowns !== undefined;
  const dropped: string[] = [];
  const merged = new Map<FnCode, FunctionPiece>();
  let demoted = 0;
  let found = 0;

  for (const it of obj.functions as unknown[]) {
    if (!it || typeof it !== "object") { violation = true; continue; }
    const f = it as { code?: unknown; importance?: unknown; evidence?: unknown; needsCheck?: unknown };
    const code = typeof f.code === "string" ? f.code.trim().toUpperCase() : "";
    if (!(FN_CODES as string[]).includes(code)) {
      violation = true;
      dropped.push(String(f.code ?? ""));
      continue;
    }
    const impNum = typeof f.importance === "number" ? f.importance : Number(f.importance);
    if (![1, 2, 3].includes(impNum as number)) violation = true;
    const importance = Math.min(3, Math.max(1, Math.round(Number.isFinite(impNum) ? impNum : 2))) as 1 | 2 | 3;
    if (typeof f.evidence !== "string") violation = true;
    if (f.needsCheck !== undefined && typeof f.needsCheck !== "boolean") violation = true;
    const evidence = typeof f.evidence === "string" ? f.evidence.trim().slice(0, 80) : "";
    const inInput = evidenceInInput(evidence, input);
    let needsCheck = f.needsCheck === true;
    if (!inInput) {
      if (!needsCheck) demoted += 1;
      needsCheck = true;
    }
    const piece: FunctionPiece = { code: code as FnCode, importance, evidence, needsCheck, source: "llm", enabled: true };
    const prev = merged.get(code as FnCode);
    if (prev) {
      violation = true;
      merged.set(code as FnCode, {
        ...prev,
        importance: Math.max(prev.importance, importance) as 1 | 2 | 3,
        evidence: prev.needsCheck && !needsCheck ? evidence : prev.evidence,
        needsCheck: prev.needsCheck && needsCheck,
      });
    } else {
      merged.set(code as FnCode, piece);
    }
  }

  const functions = FN_CODES.filter((c) => merged.has(c)).map((c) => merged.get(c)!);
  for (const p of functions) if (evidenceInInput(p.evidence, input)) found += 1;
  const unknowns = Array.isArray(obj.unknowns)
    ? (obj.unknowns as unknown[]).filter((u): u is string => typeof u === "string").map((u) => u.slice(0, 60)).slice(0, 8)
    : [];
  return { ok: true, functions, unknowns, droppedCodes: dropped, demoted, schemaViolation: violation, evidenceFound: found };
}
