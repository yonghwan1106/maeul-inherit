// GET /api/health (spec 6.4). Never exposes the key, any part of it, or its length — only hasKey.
import { hasKey, primaryModel } from "@/lib/llm/client";
import { usage } from "@/lib/guard/ratelimit";
import { regionBuiltAt } from "@/lib/serverData";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

function commitSha(): string | null {
  const c = process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_SHA || "";
  return c ? c.slice(0, 7) : null;
}

export async function GET() {
  try {
    const key = hasKey();
    const u = usage();
    return Response.json({
      ok: true,
      hasKey: key,
      model: primaryModel(),
      mode: key ? "live" : "demo",
      usedToday: u.usedToday,
      dailyCap: u.dailyCap,
      capScope: "instance",
      commit: commitSha(),
      regionBuiltAt: regionBuiltAt(),
    });
  } catch {
    return Response.json({ ok: false, hasKey: false, model: null, mode: "demo" });
  }
}
