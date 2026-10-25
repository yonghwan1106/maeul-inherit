// Small shared helpers for the engine (deterministic, no Math.random).
import type { Point, Region, Resource, Village } from "../types";

export function popcount(x: number): number {
  let n = 0;
  let v = x >>> 0;
  while (v) {
    v &= v - 1;
    n++;
  }
  return n;
}

/** String compare for deterministic tie-breaks (id ascending). */
export const cmpStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export interface RegionIndex {
  village: Map<string, Village>;
  point: Map<string, Point>;
  res: Map<string, Resource>;
  pointsOf: Map<string, Point[]>;
  nodeOf: Map<string, Point>;
}

const cache = new WeakMap<Region, RegionIndex>();

export function indexRegion(region: Region): RegionIndex {
  const hit = cache.get(region);
  if (hit) return hit;
  const village = new Map(region.villages.map((v) => [v.id, v]));
  const point = new Map(region.points.map((p) => [p.id, p]));
  const res = new Map(region.resources.map((r) => [r.id, r]));
  const pointsOf = new Map<string, Point[]>();
  const nodeOf = new Map<string, Point>();
  for (const p of region.points) {
    const arr = pointsOf.get(p.villageId) ?? [];
    arr.push(p);
    pointsOf.set(p.villageId, arr);
    if (p.kind === "village_node") nodeOf.set(p.villageId, p);
  }
  for (const arr of pointsOf.values()) arr.sort((a, b) => cmpStr(a.id, b.id));
  const idx = { village, point, res, pointsOf, nodeOf };
  cache.set(region, idx);
  return idx;
}

/** mulberry32 seeded PRNG (spec 14: seed 42, no Math.random in engine/eval). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Korean particles (josa) for labels -------------------------------------------------
const DIGIT_BATCHIM: Record<string, number> = { "0": 21, "1": 8, "3": 16, "6": 1, "7": 8, "8": 8 };
const LATIN_BATCHIM: Record<string, number> = { L: 8, M: 16, N: 4, R: 8 };

/** Final consonant index of the word's last spoken syllable (0 = none, 8 = ㄹ). Parenthetical tails are ignored. */
function finalOf(word: string): number {
  let w = word.trim();
  while (w.endsWith(")")) {
    const i = w.lastIndexOf("(");
    if (i <= 0) break;
    w = w.slice(0, i).trim();
  }
  const ch = w.slice(-1);
  const code = ch.charCodeAt(0) - 0xac00;
  if (code >= 0 && code < 11172) return code % 28;
  if (ch in DIGIT_BATCHIM) return DIGIT_BATCHIM[ch];
  const up = ch.toUpperCase();
  if (up in LATIN_BATCHIM) return LATIN_BATCHIM[up];
  return 0;
}

/** 이/가 */
export const iga = (w: string) => w + (finalOf(w) ? "이" : "가");
/** 을/를 */
export const eulreul = (w: string) => w + (finalOf(w) ? "을" : "를");
/** 으로/로 (ㄹ final takes 로) */
export const euro = (w: string) => {
  const f = finalOf(w);
  return w + (f && f !== 8 ? "으로" : "로");
};
