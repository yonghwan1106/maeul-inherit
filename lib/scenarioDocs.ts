// Scenario document jobs (bundle B4): which /api/compose requests a scenario state produces.
// precompute.ts, check-scenarios.ts and the S4 screen use the SAME builders, so a screen request for a
// precomputed state hashes to the stored inputHash (=> LLM calls 0). Pure (engine only, no node APIs).
import type { ComposeRequest } from "./apiTypes";
import type { Confirmation, FunctionPiece, Mode, Plan, Region, Resident, Scenario, VoiItem } from "./types";
import { MODES } from "./types";
import { computeVoi, digestFor, makeCells, personal, planScope, type Cells } from "./engine";

export type DocState = "base" | "demo";

/** Function pieces of a scenario = its precomputed decomposition (enabled pieces only matter to the engine). */
export function scenarioFns(sc: Scenario): FunctionPiece[] {
  const resp = sc.precomputed?.decompose?.response as { functions?: FunctionPiece[] } | undefined;
  return Array.isArray(resp?.functions) ? resp!.functions : [];
}

export function stateConf(sc: Scenario, state: DocState): Confirmation[] {
  return state === "demo" ? sc.demoConfirmations : [];
}

export interface ScenarioState {
  state: DocState;
  fns: FunctionPiece[];
  conf: Confirmation[];
  cells: Cells;
  plan: Plan;
  voi: VoiItem[];
}

export function buildState(region: Region, sc: Scenario, state: DocState, fns = scenarioFns(sc), conf = stateConf(sc, state)): ScenarioState {
  const cells = makeCells(region, fns, conf);
  const plan = planScope(region, cells, sc.store, fns);
  const voi = computeVoi(region, cells, plan, sc.store, fns);
  return { state, fns, conf, cells, plan, voi };
}

/** Resident notice request for one resident (audience = the resident's point and mode). */
export function residentRequest(region: Region, sc: Scenario, st: ScenarioState, r: Resident): ComposeRequest {
  const pr = personal(region, st.cells, r.pointId, r.mode, st.fns);
  const villageId = region.points.find((p) => p.id === r.pointId)?.villageId ?? sc.store.villageId;
  return {
    docType: "resident",
    agencyResId: null,
    audience: { villageId, mode: r.mode, pointId: r.pointId },
    scenarioId: sc.id,
    digest: digestFor(region, st.plan, pr, sc, st.conf),
  };
}

/** Agency that would answer a confirmation cell (spec 5.6 key formats). bus cells have no agency. */
export function agencyOfCell(key: string): string | null {
  const [kind, a] = key.split(":");
  if (kind === "cap" || kind === "open" || kind === "stop" || kind === "area" || kind === "hubdrop") return a ?? null;
  return null;
}

/** Mode whose plan gains most if the cell is confirmed (ties -> MODES order). */
export function bestModeOf(v: VoiItem): Mode {
  let best: Mode = MODES[0];
  for (const m of MODES) if (v.dL[m] > v.dL[best] + 1e-12) best = m;
  return best;
}

/** Agency request drafts for the top-3 「먼저 전화할 곳」 cells (agency de-duplicated). */
export function agencyRequests(region: Region, sc: Scenario, st: ScenarioState, top = 3): ComposeRequest[] {
  const out: ComposeRequest[] = [];
  const seen = new Set<string>();
  for (const v of st.voi.slice(0, top)) {
    const ag = agencyOfCell(v.cellKey);
    if (!ag || seen.has(ag)) continue;
    seen.add(ag);
    out.push(agencyRequestFor(region, sc, st, ag, bestModeOf(v)));
  }
  return out;
}

export function agencyRequestFor(region: Region, sc: Scenario, st: ScenarioState, agencyResId: string, mode: Mode): ComposeRequest {
  const vm = st.plan.byVM.find((x) => x.villageId === sc.store.villageId && x.mode === mode) ?? st.plan.byVM[0];
  return {
    docType: "agency",
    agencyResId,
    audience: { villageId: vm.villageId, mode: vm.mode },
    scenarioId: sc.id,
    digest: digestFor(region, st.plan, vm, sc, st.conf),
  };
}

/** All compose requests of a scenario state: residents (3) + agencies (<= 3). */
export function stateRequests(region: Region, sc: Scenario, st: ScenarioState): ComposeRequest[] {
  return [...sc.residents.map((r) => residentRequest(region, sc, st, r)), ...agencyRequests(region, sc, st)];
}
