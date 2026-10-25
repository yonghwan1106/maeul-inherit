// In-memory rate limit (spec 6.1), written fresh for this repo.
// - per IP (first x-forwarded-for value): AI_RPM_PER_IP calls per rolling minute (default 6)
// - per instance: AI_DAILY_CAP calls per KST day (default 300, resets at KST midnight)
// Limits are per serverless instance ("인스턴스당 상한"); the real ceiling is the Anthropic console spend limit.

const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();
let day = "";
let used = 0;

function envInt(name: string, def: number): number {
  const v = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : def;
}

export const rpmPerIp = () => envInt("AI_RPM_PER_IP", 6);
export const dailyCap = () => envInt("AI_DAILY_CAP", 300);

/** YYYY-MM-DD in KST (UTC+9, no DST). */
export function kstDay(now = Date.now()): string {
  return new Date(now + 9 * 3600_000).toISOString().slice(0, 10);
}

function rollDay(now: number) {
  const d = kstDay(now);
  if (d !== day) {
    day = d;
    used = 0;
  }
}

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

/**
 * Reserve one LLM call for `ip`. Returns false (and records nothing) when the IP minute window
 * or the instance daily cap is exhausted — the caller then answers with rules/templates.
 */
export function takeToken(ip: string, now = Date.now()): boolean {
  rollDay(now);
  if (used >= dailyCap()) return false;
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= rpmPerIp()) {
    hits.set(ip, arr);
    return false;
  }
  arr.push(now);
  hits.set(ip, arr);
  used += 1;
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
  return true;
}

export function usage(now = Date.now()): { usedToday: number; dailyCap: number } {
  rollDay(now);
  return { usedToday: used, dailyCap: dailyCap() };
}

/** Test helper. */
export function _resetLimits() {
  hits.clear();
  used = 0;
  day = "";
}
