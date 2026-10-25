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
  const decompose = useMemo(() => (scenario ? parseDecompose(scenario.precomputed.decompose.response) : null), [scenario]);
  const fns = useMemo(() => (decompose ? applyFnEdits(decompose.functions, edits) : []), [decompose, edits]);
  return { sid, scenario, decompose, fns, edits, setEdits, conf, setConf, fb, setFb };
}
