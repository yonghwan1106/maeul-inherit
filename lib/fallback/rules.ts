// Rule baselines for life-function decomposition (spec 7.1) — also the L1 fallback (B0+).
//   B0-type : business type -> functions table only (S2 "업종 표만 쓰면" toggle)
//   B0      : B0-type + keyword dictionary over items and memo
//   B0+     : B0, but keyword hits from a memo clause that contains a negation word or an
//             "other place" expression are not counted (clauses split on , . 지만 는데)
// Pure functions (no node APIs) so the client can use them when the network fails.
import type { DecomposeRequest, DecomposeResponse, FallbackReason } from "../apiTypes";
import type { FnCode, FunctionPiece } from "../types";
import { FN_CODES } from "../ontology";

export type RuleSystem = "b0_type" | "b0" | "b0plus";

/** Default importance for rule output (same values as the fixed E2 function bundle). */
export const DEFAULT_IMPORTANCE: Record<FnCode, 1 | 2 | 3> = {
  F01: 3, F02: 2, F03: 2, F04: 1, F05: 2, F06: 2, F07: 2, F08: 2, F09: 1, F10: 1,
};

/** B0-type table (spec 7.1). Matched by substring of sbizSub; first match wins. */
const TYPE_TABLE: { match: string[]; fns: FnCode[] }[] = [
  { match: ["슈퍼"], fns: ["F01", "F02", "F04", "F05"] },
  { match: ["편의점"], fns: ["F01", "F04", "F05"] },
  { match: ["반찬", "식료품"], fns: ["F01", "F02"] },
  { match: ["채소", "과일"], fns: ["F02"] },
  { match: ["정육", "수산"], fns: ["F03"] },
];

/**
 * Keyword dictionary (spec 7.1). Spec stems plus their common past/conjugated forms
 * (e.g. 갖다 주 -> 갖다 줬/갖다 줌, 챙기 -> 챙겼/챙겨) so the baseline is not a strawman.
 */
export const KEYWORDS: Record<FnCode, string[]> = {
  F01: ["쌀", "라면", "두부", "조미료"],
  F02: ["계란", "달걀", "채소", "야채", "과일", "우유"],
  F03: ["고기", "생선", "정육"],
  F04: ["급할 때", "급하면", "아침 일찍", "늦게까지"],
  F05: ["세제", "휴지", "파스", "밴드"],
  F06: ["택배", "맡기", "맡겨", "맡겼", "대신 받"],
  F07: ["배달", "갖다 주", "갖다 줬", "갖다 줌", "가져다 주", "가져다 줬", "전화 주문", "전화하면"],
  F08: ["현금", "공과금", "돈 찾"],
  F09: ["평상", "모여", "모였", "쉼터", "사랑방", "앉아", "앉으"],
  F10: ["안부", "소식", "챙기", "챙겼", "챙겨"],
};

const NEGATION = ["안 ", "않", "못", "없", "아니", "말고"];
const OTHER_PLACE = /\S+에서 받|\S+로 가서/;

export function splitClauses(memo: string): string[] {
  return (memo ?? "")
    .split(/[,.，。!?\n]|지만|는데/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function clauseIsNegated(clause: string): boolean {
  const c = clause + " ";
  return NEGATION.some((w) => c.includes(w)) || OTHER_PLACE.test(clause);
}

export function typeFns(sbizSub: string): FnCode[] {
  const s = sbizSub ?? "";
  for (const row of TYPE_TABLE) if (row.match.some((m) => s.includes(m))) return row.fns;
  return ["F01"];
}

function hits(text: string): { fn: FnCode; kw: string }[] {
  const out: { fn: FnCode; kw: string }[] = [];
  for (const fn of FN_CODES) {
    const kw = KEYWORDS[fn].find((k) => text.includes(k));
    if (kw) out.push({ fn, kw });
  }
  return out;
}

/** Function set + one evidence string per function for a rule system. */
export function ruleDecompose(req: DecomposeRequest, sys: RuleSystem): Map<FnCode, string> {
  const ev = new Map<FnCode, string>();
  for (const fn of typeFns(req.sbizSub)) ev.set(fn, req.sbizSub || "업종");
  if (sys === "b0_type") return ev;
  for (const item of req.items ?? []) for (const h of hits(item)) if (!ev.has(h.fn)) ev.set(h.fn, item);
  for (const clause of splitClauses(req.memo)) {
    if (sys === "b0plus" && clauseIsNegated(clause)) continue;
    for (const h of hits(clause)) if (!ev.has(h.fn) || ev.get(h.fn) === req.sbizSub) ev.set(h.fn, h.kw);
  }
  return ev;
}

export function ruleCodes(req: DecomposeRequest, sys: RuleSystem): FnCode[] {
  return FN_CODES.filter((c) => ruleDecompose(req, sys).has(c));
}

export function rulePieces(req: DecomposeRequest, sys: RuleSystem = "b0plus"): FunctionPiece[] {
  const ev = ruleDecompose(req, sys);
  return FN_CODES.filter((c) => ev.has(c)).map((code) => ({
    code,
    importance: DEFAULT_IMPORTANCE[code],
    evidence: ev.get(code) ?? "",
    needsCheck: false,
    source: "rules" as const,
    enabled: true,
  }));
}

/** Rules answer in the /api/decompose response shape (mode "rules"). */
export function localDecompose(req: DecomposeRequest, reason: FallbackReason, inputHash = ""): DecomposeResponse {
  return {
    mode: "rules",
    model: null,
    functions: rulePieces(req, "b0plus"),
    unknowns: [],
    validator: { droppedCodes: [], demoted: 0, retried: false, fallbackReason: reason },
    inputHash,
    generatedAt: new Date().toISOString(),
  };
}
