"use client";
// Per-scenario client state for S2~S4: decomposition (+ officer edits), confirmations, feedback.
// `custom` = 「직접 등록해 보기」 result kept in this browser only (mi.v1.custom).
import { useMemo } from "react";
import type { Confirmation, FunctionPiece, Scenario } from "../types";
import { applyFnEdits, parseDecompose, type DecomposeView } from "../view";
import {
  EMPTY_CONF,
  EMPTY_FB,
  EMPTY_FN,
  keys,
  useLocal,
  type Feedback,
  type FnEdit,
} from "./local";

export interface CustomRecord {
  scenario: Scenario;
}

const NO_CUSTOM: CustomRecord | null = null;

export interface ScenarioState {
  sid: string;
  scenario: Scenario | null;
  decompose: DecomposeView | null;
  /** functions after officer edits (S2) */
  fns: FunctionPiece[];
  edits: FnEdit[];
  setEdits: (next: FnEdit[] | ((p: FnEdit[]) => FnEdit[]) | null) => void;
  conf: Confirmation[];
  setConf: (next: Confirmation[] | ((p: Confirmation[]) => Confirmation[]) | null) => void;
  fb: Feedback[];
  setFb: (next: Feedback[] | ((p: Feedback[]) => Feedback[]) | null) => void;
}

export function useScenarioState(sid: string, loaded: Scenario | null): ScenarioState {
  const [custom] = useLocal<CustomRecord | null>(keys.custom, NO_CUSTOM);
  const scenario = sid === "custom" ? custom?.scenario ?? null : loaded;
  const [edits, setEdits] = useLocal<FnEdit[]>(keys.fn(sid), EMPTY_FN);
  const [conf, setConf] = useLocal<Confirmation[]>(keys.conf(sid), EMPTY_CONF);
  const [fb, setFb] = useLocal<Feedback[]>(keys.fb(sid), EMPTY_FB);
  // built-in scenarios carry the answer `npm run precompute` stored (generated live once) — the visitor makes no
  // LLM call, so the badge must say 「사전계산」, not 「실시간 AI」. Custom records keep the mode of their real call.
  const decompose = useMemo(() => {
    if (!scenario) return null;
    const d = parseDecompose(scenario.precomputed.decompose.response);
    return sid !== "custom" && d.mode === "live" ? { ...d, mode: "precomputed" } : d;
  }, [scenario, sid]);
  const fns = useMemo(() => (decompose ? applyFnEdits(decompose.functions, edits) : []), [decompose, edits]);
  return { sid, scenario, decompose, fns, edits, setEdits, conf, setConf, fb, setFb };
}
