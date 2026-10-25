"use client";
// Changed-value highlight (spec 8.5: 바뀐 칸 0.8 s 강조). Pass a map of id -> rendered value; ids whose
// value changed since the previous render are returned for 800 ms. The first render never flashes.
import { useEffect, useRef, useState } from "react";

const EMPTY = new Set<string>();

export function useFlashSet(values: Record<string, string>): Set<string> {
  const prev = useRef<Record<string, string> | null>(null);
  const [flash, setFlash] = useState<Set<string>>(EMPTY);
  const sig = JSON.stringify(values);
  useEffect(() => {
    const cur = JSON.parse(sig) as Record<string, string>;
    const before = prev.current;
    prev.current = cur;
    if (!before) return;
    const changed = new Set<string>();
    for (const k of Object.keys(cur)) if (before[k] !== undefined && before[k] !== cur[k]) changed.add(k);
    if (!changed.size) return;
    setFlash(changed);
    const t = window.setTimeout(() => setFlash(EMPTY), 800);
    return () => window.clearTimeout(t);
  }, [sig]);
  return flash;
}
