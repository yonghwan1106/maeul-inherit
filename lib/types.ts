// K1 contract (spec section 5.1). Frozen at A1. Changes: docs/CONTRACT_CHANGES.md + notify B, C.
export type Tri = "Y" | "U" | "N";
export type Mode = "car" | "walk" | "homebound";
export const MODES: Mode[] = ["car", "walk", "homebound"];
export type FnCode = "F01"|"F02"|"F03"|"F04"|"F05"|"F06"|"F07"|"F08"|"F09"|"F10";
export type Channel = "visit" | "deliver" | "tour" | "hubdrop";
export type ResClass = "hanaro"|"bank"|"post"|"store_daily"|"store_fresh"|"tour"|"care_link"|"hub"|"hubdrop";

export interface Village { id: string; name: string; lat: number; lon: number; pop: number; popAssumed: boolean;
  isSeat: boolean; foodStores: number; codeVerified: boolean }
export interface Point { id: string; villageId: string; name: string; lat: number; lon: number;
  kind: "village_node" | "hub"; hubResId?: string; weight: number }
export interface Resource { id: string; name: string; cls: ResClass; src: string[]; lat?: number; lon?: number;
  myeon?: string; villageId?: string; anonymized?: boolean; deliverer?: string; hubId?: string;
  sbizNo?: string; sbizSub?: string; supplierClass?: string; judgeUnknown?: boolean; note: string; evidenceUrl?: string }
export interface Region { meta: Record<string, unknown>; villages: Village[]; points: Point[]; resources: Resource[] }

export type CellKind = "cap" | "open" | "stop" | "area" | "hubdrop" | "bus";
export interface CellDef { key: string; kind: CellKind; resId?: string; fn?: FnCode; pointId?: string;
  villageId?: string; label: string; realNamed: boolean }
export interface Confirmation { cellKey: string; value: Tri; note?: string;
  by: "담당자" | "시연 입력값" | "전화 확인" | "이 브라우저"; at: string }

export interface FunctionPiece { code: FnCode; importance: 1|2|3; evidence: string; needsCheck: boolean;
  source: "llm" | "rules" | "manual"; enabled: boolean }
export interface Store { name: string; villageId: string; lat: number; lon: number; sbizSub: string;
  items: string[]; hours: string; memo: string }
export interface Resident { id: string; name: string; age: number; mode: Mode; pointId: string; note: string }
export interface PrecomputedCompose { state: "base" | "demo"; docType: "resident" | "agency"; agencyResId: string | null;
  audience: { villageId: string; mode: Mode; pointId?: string }; inputHash: string; response: unknown }
export interface Scenario { id: string; title: string; officer: string; store: Store; residents: Resident[];
  demoConfirmations: Confirmation[];
  precomputed: { decompose: { inputHash: string; response: unknown }; compose: PrecomputedCompose[] } }

export interface Assignment { resId: string; tri: Tri; channel: Channel }
export interface PlanVM { villageId: string; mode: Mode; set: string[]; L: number; U: number;
  countY: number; countU: number; countN: number; byFn: Partial<Record<FnCode, Assignment[]>>;
  gaps: FnCode[]; truncated: boolean; nCandidates: number }
export interface ModeSummary { L: number; U: number; countY: number; countU: number; countN: number; nCore: number }
export interface VoiItem { cellKey: string; label: string; realNamed: boolean; key: number;
  dL: Record<Mode, number>; dCount: Record<Mode, number>; uDropIfNo: Record<Mode, number> }
export interface Plan { scope: string[]; points: string[]; byVM: PlanVM[]; summary: Record<Mode, ModeSummary>;
  common: Partial<Record<FnCode, string[]>>; socialHubs: string[]; voi: VoiItem[]; ms: number }
export interface PersonalResult { pointId: string; mode: Mode; ordered: { resId: string; fns: FnCode[]; tri: Tri }[];
  perFn: Partial<Record<FnCode, { tri: Tri; resId?: string }>>; countY: number; countU: number; countN: number;
  b1: { resId: string; distKm: number; countY: number; walkable: boolean } }
export interface PlanDigest { scenarioId: string | null; villageName: string; mode: Mode;
  items: { resId: string; name: string; fns: string[]; status: "확실" | "확인 중"; days?: string[] }[];
  gaps: string[]; counts: { Y: number; U: number; N: number }; numbersAllowed: number[] }
