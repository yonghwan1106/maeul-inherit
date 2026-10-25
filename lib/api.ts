// K5 — client fetch wrapper (never throws). Screens call these instead of fetch().
// Network failure / non-JSON reply -> a local answer of the same shape:
//   decompose -> rules B0+ (mode "rules"), compose -> template text (mode "template").
import type {
  ComposeRequest,
  ComposeResponse,
  DecomposeRequest,
  DecomposeResponse,
  FallbackReason,
  HealthResponse,
} from "./apiTypes";
import { redactPhones } from "./guard/redact";
import { localDecompose } from "./fallback/rules";
import { localCompose } from "./fallback/templates";

export type * from "./apiTypes";

async function postJson<T>(url: string, body: unknown, timeoutMs = 32_000): Promise<T | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const json = (await res.json()) as T;
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** POST /api/decompose. Phone numbers are masked here first (and again on the server). */
export async function apiDecompose(req: DecomposeRequest): Promise<DecomposeResponse> {
  const clean: DecomposeRequest = { ...req, memo: redactPhones(req.memo ?? "") };
  const res = await postJson<DecomposeResponse>("/api/decompose", clean);
  if (res && Array.isArray(res.functions)) return res;
  if (res && res.message) return { ...localDecompose(clean, "invalid"), message: res.message };
  return localDecompose(clean, "network");
}

/** POST /api/compose. */
export async function apiCompose(req: ComposeRequest): Promise<ComposeResponse> {
  const res = await postJson<ComposeResponse>("/api/compose", req);
  if (res && typeof res.text === "string" && res.grounding) return res;
  const reason: FallbackReason = res && res.message ? "invalid" : "network";
  return { ...localCompose(req, reason), message: res?.message };
}

/** GET /api/health. null when unreachable. */
export async function apiHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    return (await res.json()) as HealthResponse;
  } catch {
    return null;
  }
}
