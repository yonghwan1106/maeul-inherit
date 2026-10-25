"use client";
// localStorage wrapper (spec 6.6 / 14): every read and write in try/catch, memory fallback when storage
// is missing or blocked (private window, capture, preview). Screens must render correctly with it empty.
import { useCallback, useSyncExternalStore } from "react";
import type { Confirmation, FnCode } from "../types";

const mem = new Map<string, string>();
const listeners = new Set<() => void>();
/** Parsed-value cache so useSyncExternalStore gets a stable snapshot per raw string. */
const parsed = new Map<string, { raw: string | null; value: unknown }>();

function readRaw(key: string): string | null {
  try {
    const v = window.localStorage.getItem(key);
    if (v !== null) return v;
  } catch {
    /* storage blocked -> memory */
  }
  return mem.has(key) ? (mem.get(key) as string) : null;
}

function writeRaw(key: string, raw: string | null): void {
  if (raw === null) mem.delete(key);
  else mem.set(key, raw);
  try {
    if (raw === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, raw);
  } catch {
    /* memory only */
  }
  parsed.delete(key);
  listeners.forEach((l) => l());
}

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = readRaw(key);
  const hit = parsed.get(key);
  if (hit && hit.raw === raw) return (hit.value as T) ?? fallback;
  let value: unknown = fallback;
  if (raw !== null) {
    try {
      value = JSON.parse(raw);
    } catch {
      value = fallback;
    }
  }
  parsed.set(key, { raw, value });
  return value as T;
}

export function writeJson<T>(key: string, value: T | null): void {
  if (typeof window === "undefined") return;
  writeRaw(key, value === null ? null : JSON.stringify(value));
}

/** Remove every key of this app (`mi.v1.*`) — used by the S6 「이 브라우저 기록 지우기」 button. */
export function clearAll(): void {
  const keys = new Set<string>(Array.from(mem.keys()).filter((k) => k.startsWith("mi.v1.")));
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("mi.v1.")) keys.add(k);
    }
  } catch {
    /* ignore */
  }
  keys.forEach((k) => writeRaw(k, null));
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key && e.key.startsWith("mi.v1.")) {
      parsed.delete(e.key);
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * React hook over one key. Server render and the first client render use `fallback`
 * (no hydration mismatch); the stored value arrives right after.
 * `fallback` must be referentially stable (module constant or memoised).
 */
export function useLocal<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T) | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readJson<T>(key, fallback),
    () => fallback,
  );
  const set = useCallback(
    (next: T | ((prev: T) => T) | null) => {
      if (next === null) return writeJson(key, null);
      const prev = readJson<T>(key, fallback);
      const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      writeJson(key, v);
    },
    [key, fallback],
  );
  return [value, set];
}

// ---------------------------------------------------------------------------
// Keys (spec 6.6) and stored shapes
// ---------------------------------------------------------------------------
export const keys = {
  conf: (sid: string) => `mi.v1.conf.${sid}`,
  fn: (sid: string) => `mi.v1.fn.${sid}`,
  gate: (sid: string) => `mi.v1.gate.${sid}`,
  fb: (sid: string) => `mi.v1.fb.${sid}`,
  ui: "mi.v1.ui",
  /** 「직접 등록해 보기」 result for /s/custom/* — browser only, never sent anywhere but /api/decompose. */
  custom: "mi.v1.custom",
} as const;

/** Officer edit of one function piece (S2): on/off and importance. */
export interface FnEdit { code: FnCode; enabled: boolean; importance: 1 | 2 | 3 }

/** Gate records (확인·승인 기록: 시각·역할). */
export interface GateRecord { at: string; role: "담당자" }
export interface Gates { g1?: GateRecord; g2?: GateRecord; g3?: GateRecord }

/** Resident feedback (주민 제보) — queued for the officer on S3; never changes the 3 values by itself. */
export interface Feedback {
  id: string;
  residentId: string;
  residentName: string;
  pointId: string;
  mode: string;
  resId: string;
  fns: FnCode[];
  kind: "used" | "failed";
  reason?: string;
  at: string;
  /** set when the officer opened the confirmation input from this report */
  handledAt?: string;
}

export interface UiState { resident?: Record<string, string>; s3Mode?: string }

export const EMPTY_CONF: Confirmation[] = [];
export const EMPTY_FN: FnEdit[] = [];
export const EMPTY_GATES: Gates = {};
export const EMPTY_FB: Feedback[] = [];
export const EMPTY_UI: UiState = {};
