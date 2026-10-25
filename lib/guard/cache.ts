// Input normalisation + SHA-256 hash + caches (spec 6.1).
// Lookup order: (1) precomputed table from data/scenarios/*.json  (2) per-instance LRU (500).
// A hit means zero LLM calls. Server/scripts only (node:crypto).
import { createHash } from "node:crypto";
import { SCENARIOS } from "../serverData";

export type CacheKind = "decompose" | "compose";

/** trim strings, collapse runs of whitespace, sort arrays, sort object keys, drop undefined. */
export function normalize(x: unknown): unknown {
  if (typeof x === "string") return x.trim().replace(/\s+/g, " ");
  if (Array.isArray(x)) {
    return x.map(normalize).sort((a, b) => {
      const sa = stableStringify(a);
      const sb = stableStringify(b);
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    });
  }
  if (x && typeof x === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(x as Record<string, unknown>).sort()) {
      const v = (x as Record<string, unknown>)[k];
      if (v !== undefined) out[k] = normalize(v);
    }
    return out;
  }
  return x;
}

/** JSON with sorted keys (deterministic). */
export function stableStringify(x: unknown): string {
  if (Array.isArray(x)) return "[" + x.map(stableStringify).join(",") + "]";
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    return (
      "{" +
      Object.keys(o)
        .filter((k) => o[k] !== undefined)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + stableStringify(o[k]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(x ?? null);
}

/** sha256 hex of {kind, input} after normalisation. Same function in routes, precompute and check-scenarios. */
export function inputHash(kind: CacheKind, input: unknown): string {
  return createHash("sha256").update(stableStringify({ kind, input: normalize(input) })).digest("hex");
}

// ---------------------------------------------------------------------------
// (1) precomputed table
// ---------------------------------------------------------------------------
let table: Map<string, unknown> | null = null;
function precomputedTable(): Map<string, unknown> {
  if (table) return table;
  table = new Map();
  for (const sc of SCENARIOS) {
    const d = sc.precomputed?.decompose;
    if (d?.inputHash && d.response) table.set(d.inputHash, d.response);
    for (const c of sc.precomputed?.compose ?? []) if (c.inputHash && c.response) table.set(c.inputHash, c.response);
  }
  return table;
}

export function getPrecomputed(hash: string): unknown | undefined {
  return precomputedTable().get(hash);
}

// ---------------------------------------------------------------------------
// (2) instance LRU
// ---------------------------------------------------------------------------
const LRU_MAX = 500;
const lru = new Map<string, unknown>();

export function getCached(hash: string): unknown | undefined {
  if (!lru.has(hash)) return undefined;
  const v = lru.get(hash);
  lru.delete(hash);
  lru.set(hash, v);
  return v;
}

export function setCached(hash: string, value: unknown): void {
  if (lru.has(hash)) lru.delete(hash);
  lru.set(hash, value);
  while (lru.size > LRU_MAX) {
    const oldest = lru.keys().next().value as string;
    lru.delete(oldest);
  }
}
