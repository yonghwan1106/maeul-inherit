// POST /api/decompose (L1, spec 6.2). Always 200 JSON; 400 + Korean message only for input format errors.
import type { DecomposeResponse } from "@/lib/apiTypes";
import { LIMITS } from "@/lib/apiTypes";
import { localDecompose } from "@/lib/fallback/rules";
import { getCached, getPrecomputed, inputHash, setCached } from "@/lib/guard/cache";
import { clientIp, takeToken } from "@/lib/guard/ratelimit";
import { hasKey } from "@/lib/llm/client";
import { decomposeLive, parseDecomposeRequest } from "@/lib/llm/decompose";

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
  const parsed = parseDecomposeRequest(body);
  if (!parsed.ok) return bad(parsed.message);
  const req = parsed.req;

  try {
    const hash = inputHash("decompose", req);
    const pre = getPrecomputed(hash) as DecomposeResponse | undefined;
    if (pre) return Response.json({ ...pre, mode: "precomputed", inputHash: hash });
    const hit = getCached(hash) as DecomposeResponse | undefined;
    if (hit) return Response.json({ ...hit, mode: "cache" });

    let out: DecomposeResponse;
    if (!hasKey()) out = localDecompose(req, "no_key", hash);
    else if (!takeToken(clientIp(request))) out = localDecompose(req, "limit", hash);
    else {
      out = (await decomposeLive(req, hash)).response;
      if (out.mode === "live") setCached(hash, out);
    }
    console.log(`[route] decompose mode=${out.mode} ms=${Date.now() - t0}`);
    return Response.json(out);
  } catch {
    return Response.json(localDecompose(req, "http_5xx"));
  }
}
