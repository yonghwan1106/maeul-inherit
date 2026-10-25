// Anthropic call wrapper (spec 6.1). Written fresh for this repo. NEVER throws.
// - default model: ANTHROPIC_MODEL ?? claude-haiku-5-5, on failure ONE retry with claude-haiku-4-5
// - 20 s AbortController timeout, no temperature parameter (sonnet-5 returns 400 when it is sent),
//   thinking explicitly disabled (see once())
// - request/response bodies are never logged (only tag, model, ms, token counts)
import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_MODEL = "claude-haiku-5-5";
export const FALLBACK_MODEL = "claude-haiku-4-5";
export const TIMEOUT_MS = 20_000;

export type LlmFailReason = "no_key" | "timeout" | "http_4xx" | "http_5xx" | "parse";
export type LlmOk = { ok: true; text: string; model: string; usage: { input: number; output: number } };
export type LlmFail = { ok: false; reason: LlmFailReason };
export type LlmResult = LlmOk | LlmFail;

export interface CallArgs {
  system: string;
  user: string;
  maxTokens: number;
  /** Explicit model (offline eval). Defaults to primaryModel(). */
  model?: string;
  /** Offline eval: do not retry with the fallback model (keeps the measured model pure). */
  noFallback?: boolean;
  /** Log tag, e.g. "decompose". */
  tag?: string;
}

export function hasKey(): boolean {
  const k = process.env.ANTHROPIC_API_KEY;
  return typeof k === "string" && k.trim().length > 0;
}

export function primaryModel(): string {
  const m = process.env.ANTHROPIC_MODEL;
  return m && m.trim() ? m.trim() : DEFAULT_MODEL;
}

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!hasKey()) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: TIMEOUT_MS });
  return client;
}

function classify(e: unknown): LlmFailReason {
  const err = e as { status?: number; name?: string } | null;
  const status = typeof err?.status === "number" ? err.status : undefined;
  if (status !== undefined) return status >= 500 ? "http_5xx" : "http_4xx";
  const name = err?.name ?? "";
  if (name.includes("Timeout") || name.includes("Abort")) return "timeout";
  // Connection errors without status are treated like a server-side failure.
  return "http_5xx";
}

async function once(c: Anthropic, model: string, a: CallArgs): Promise<LlmResult> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await c.messages.create(
      {
        model,
        max_tokens: a.maxTokens,
        system: a.system,
        messages: [{ role: "user", content: a.user }],
        // haiku-5-5 thinks adaptively by default and can spend the whole max_tokens budget on thinking
        // (measured 2026-10-25: 699/700 thinking tokens, no text block) -> disable thinking explicitly.
        thinking: { type: "disabled" },
      },
      { signal: ac.signal },
    );
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    const usage = { input: res.usage?.input_tokens ?? 0, output: res.usage?.output_tokens ?? 0 };
    console.log(`[llm] ${a.tag ?? "call"} model=${res.model ?? model} ms=${Date.now() - t0} in=${usage.input} out=${usage.output}`);
    if (!text) return { ok: false, reason: "parse" };
    return { ok: true, text, model: res.model ?? model, usage };
  } catch (e) {
    const reason = ac.signal.aborted ? "timeout" : classify(e);
    console.log(`[llm] ${a.tag ?? "call"} model=${model} ms=${Date.now() - t0} fail=${reason}`);
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}

/** Call Claude once (plus one fallback retry). Never throws. */
export async function callClaude(a: CallArgs): Promise<LlmResult> {
  try {
    const c = getClient();
    if (!c) return { ok: false, reason: "no_key" };
    const model = a.model ?? primaryModel();
    const first = await once(c, model, a);
    if (first.ok || a.noFallback || model === FALLBACK_MODEL) return first;
    return await once(c, FALLBACK_MODEL, a);
  } catch {
    return { ok: false, reason: "http_5xx" };
  }
}

/** Pull the first JSON object out of a model reply (tolerates ```json fences and leading prose). */
export function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}
