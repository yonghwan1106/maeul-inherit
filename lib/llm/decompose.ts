// L1 core (shared by /api/decompose, precompute and E1 eval). Never throws.
import type { DecomposeRequest, DecomposeResponse, FallbackReason } from "../apiTypes";
import { LIMITS } from "../apiTypes";
import { localDecompose } from "../fallback/rules";
import { redactPhones } from "../guard/redact";
import { validateDecompose, type DecomposeValidation } from "../validate/decompose";
import { callClaude, extractJson } from "./client";
import { L1_MAX_TOKENS, L1_SYSTEM, l1User } from "./prompts";

/** Shape check + limits. Returns a Korean message on error (route answers 400). */
export function parseDecomposeRequest(body: unknown): { ok: true; req: DecomposeRequest } | { ok: false; message: string } {
  if (!body || typeof body !== "object") return { ok: false, message: "요청 형식이 올바르지 않아요(JSON 객체가 필요해요)." };
  const b = body as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : null);
  const sbizSub = str(b.sbizSub), hours = str(b.hours), villageId = str(b.villageId), memo = str(b.memo);
  if (sbizSub === null || hours === null || villageId === null || memo === null)
    return { ok: false, message: "업종·운영 시간·마을·메모는 글자로 보내 주세요." };
  const items = b.items == null ? [] : b.items;
  if (!Array.isArray(items) || items.some((x) => typeof x !== "string"))
    return { ok: false, message: "팔던 물건은 글자 목록으로 보내 주세요." };
  if (items.length > LIMITS.ITEMS) return { ok: false, message: `팔던 물건은 ${LIMITS.ITEMS}개까지 적을 수 있어요.` };
  if (memo.length > LIMITS.MEMO_CHARS) return { ok: false, message: `메모는 ${LIMITS.MEMO_CHARS}자까지 적을 수 있어요.` };
  return {
    ok: true,
    req: {
      sbizSub: sbizSub.trim().slice(0, 40),
      items: (items as string[]).map((s) => redactPhones(s.trim()).slice(0, 30)).filter(Boolean),
      hours: hours.trim().slice(0, 40),
      villageId: villageId.trim().slice(0, 40),
      memo: redactPhones(memo),
    },
  };
}

export interface LiveDecompose {
  response: DecomposeResponse;
  /** Validation of the first parsed reply (null when the model gave nothing parseable). */
  firstValidation: DecomposeValidation | null;
  rawTexts: string[];
}

/** Calls the LLM (with one re-ask on parse failure); falls back to rules B0+. */
export async function decomposeLive(
  req: DecomposeRequest,
  inputHash: string,
  opts: { model?: string; noFallback?: boolean } = {},
): Promise<LiveDecompose> {
  const rawTexts: string[] = [];
  const call = (note?: string) =>
    callClaude({ system: L1_SYSTEM, user: l1User(req, note), maxTokens: L1_MAX_TOKENS, tag: "decompose", ...opts });

  const r1 = await call();
  if (!r1.ok) return { response: localDecompose(req, r1.reason as FallbackReason, inputHash), firstValidation: null, rawTexts };
  rawTexts.push(r1.text);
  let v = validateDecompose(extractJson(r1.text), req);
  const firstValidation = v.ok ? v : null;
  let model = r1.model;
  let retried = false;
  if (!v.ok) {
    retried = true;
    const r2 = await call("JSON 파싱 실패");
    if (!r2.ok) return { response: { ...localDecompose(req, r2.reason as FallbackReason, inputHash) }, firstValidation, rawTexts };
    rawTexts.push(r2.text);
    v = validateDecompose(extractJson(r2.text), req);
    model = r2.model;
    if (!v.ok) {
      const fb = localDecompose(req, "parse", inputHash);
      fb.validator.retried = true;
      return { response: fb, firstValidation, rawTexts };
    }
  }
  return {
    response: {
      mode: "live",
      model,
      functions: v.functions,
      unknowns: v.unknowns,
      validator: { droppedCodes: v.droppedCodes, demoted: v.demoted, retried, fallbackReason: null },
      inputHash,
      generatedAt: new Date().toISOString(),
    },
    firstValidation,
    rawTexts,
  };
}
