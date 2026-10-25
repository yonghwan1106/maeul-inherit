// K5 — API request/response types (spec 6.2–6.4). Shared by routes (server) and lib/api.ts (client).
import type { FunctionPiece, Mode, PlanDigest } from "./types";

export type FallbackReason = "no_key" | "limit" | "timeout" | "http_4xx" | "http_5xx" | "parse" | "network" | "invalid";

export interface DecomposeRequest {
  sbizSub: string;
  items: string[];
  hours: string;
  villageId: string;
  memo: string;
}

export interface DecomposeValidatorInfo {
  droppedCodes: string[];
  demoted: number;
  retried: boolean;
  fallbackReason: FallbackReason | null;
}

export interface DecomposeResponse {
  mode: "precomputed" | "cache" | "live" | "rules";
  model: string | null;
  functions: FunctionPiece[];
  unknowns: string[];
  validator: DecomposeValidatorInfo;
  inputHash: string;
  generatedAt: string;
  /** Present only on 400 (input format error), Korean. */
  message?: string;
}

export interface ComposeAudience {
  villageId: string;
  mode: Mode;
  pointId?: string;
}

export interface ComposeRequest {
  docType: "resident" | "agency";
  agencyResId: string | null;
  audience: ComposeAudience;
  scenarioId: string | null;
  digest: PlanDigest;
}

export type GroundingKind = "resource" | "day" | "time" | "number" | "phone" | "assertive";

export interface GroundingCheck {
  kind: GroundingKind;
  value: string;
  ok: boolean;
}

export interface GroundingBlock {
  sentence: string;
  reason: string;
}

export interface GroundingResult {
  pass: boolean;
  attempts: number;
  checked: GroundingCheck[];
  blocked: GroundingBlock[];
}

export interface ComposeResponse {
  mode: "precomputed" | "cache" | "live" | "template";
  model: string | null;
  text: string;
  grounding: GroundingResult;
  template: boolean;
  inputHash: string;
  generatedAt?: string;
  fallbackReason?: FallbackReason | null;
  message?: string;
}

export interface HealthResponse {
  ok: boolean;
  hasKey: boolean;
  model: string | null;
  mode: "live" | "demo";
  usedToday?: number;
  dailyCap?: number;
  capScope?: "instance";
  commit?: string | null;
  regionBuiltAt?: string | null;
}

/** Input limits (spec 6.1 / 9.2). */
export const LIMITS = { BODY_BYTES: 8 * 1024, MEMO_CHARS: 600, ITEMS: 20 } as const;
