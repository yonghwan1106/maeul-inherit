// POST /api/compose (L4 + grounding, spec 6.3). Always 200 JSON; 400 + Korean message only for input format errors.
import type { ComposeResponse } from "@/lib/apiTypes";
import { LIMITS } from "@/lib/apiTypes";
import { getCached, getPrecomputed, inputHash, setCached } from "@/lib/guard/cache";
import { clientIp, takeToken } from "@/lib/guard/ratelimit";
import { hasKey } from "@/lib/llm/client";
import { composeLive, composeTemplate, parseComposeRequest, sanitizeDigest } from "@/lib/llm/compose";
import { REGION } from "@/lib/serverData";

export const runtime = "nodejs";
export const maxDuration = 30;

const bad = (message: string) => Response.json({ message }, { status: 400 });

export async function POST(request: Request) {
  const t0 = Date.now();
  let text = "";
  try {
    text = await request.text();
  } catch {
    return bad("요청 본문을 읽지 못했어요.");
  }
  if (new TextEncoder().encode(text).length > LIMITS.BODY_BYTES) return bad("요청이 너무 커요(8 KB까지).");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return bad("요청 형식이 올바르지 않아요(JSON이 아니에요).");
  }
  const parsed = parseComposeRequest(body);
  if (!parsed.ok) return bad(parsed.message);
  const req = parsed.req;

  const digest = sanitizeDigest(REGION, req);
  const hash = inputHash("compose", { ...req, digest });
  try {
    const pre = getPrecomputed(hash) as ComposeResponse | undefined;
    if (pre) return Response.json({ ...pre, mode: pre.mode === "template" ? "template" : "precomputed", inputHash: hash });
    const hit = getCached(hash) as ComposeResponse | undefined;
    if (hit) return Response.json({ ...hit, mode: hit.mode === "template" ? "template" : "cache" });

    let out: ComposeResponse;
    if (!hasKey()) out = composeTemplate(REGION, req, digest, hash, "no_key");
    else if (!takeToken(clientIp(request))) out = composeTemplate(REGION, req, digest, hash, "limit");
    else {
      out = (await composeLive(REGION, req, digest, hash)).response;
      if (out.mode === "live") setCached(hash, out);
    }
    console.log(`[route] compose mode=${out.mode} pass=${out.grounding.pass} ms=${Date.now() - t0}`);
    return Response.json(out);
  } catch {
    return Response.json(composeTemplate(REGION, req, digest, hash, "http_5xx"));
  }
}
