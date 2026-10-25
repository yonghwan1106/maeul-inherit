// Ontology: F01~F10, screen names, class x channel default cells (spec section 5.3 = canonical rules).
// Rules live here (TS) only; the Python pipeline writes facts, not cells (spec 4.4).
import type { Channel, FnCode, ResClass, Resource } from "./types";

export const FN_CODES: FnCode[] = ["F01", "F02", "F03", "F04", "F05", "F06", "F07", "F08", "F09", "F10"];

/** Bit index of each function in the y/u bitmasks (bit i = FN_CODES[i]). */
export const FN_BIT: Record<FnCode, number> = Object.fromEntries(FN_CODES.map((c, i) => [c, i])) as Record<FnCode, number>;

export type FnGroup = "구매" | "거점" | "전달" | "금융" | "사회";

export interface FnDef {
  code: FnCode;
  /** Icon label / screen name (spec 8.1). */
  name: string;
  /** Definition used in the L1 prompt and S6. */
  definition: string;
  group: FnGroup;
  /** F09, F10: computed but excluded from objective and counts; output via socialHubs only. */
  social: boolean;
}

export const FNS: Record<FnCode, FnDef> = {
  F01: { code: "F01", name: "장보기", definition: "생필품·가공식품 사기(쌀·라면·두부·조미료, 대용량 포함 — 쌀 20 kg 등)", group: "구매", social: false },
  F02: { code: "F02", name: "신선식품", definition: "신선식품 사기(채소·과일·계란·우유)", group: "구매", social: false },
  F03: { code: "F03", name: "고기·생선", definition: "육류·수산 사기", group: "구매", social: false },
  F04: { code: "F04", name: "급할 때", definition: "급할 때 소량 바로 사기(가깝고 늘 여는 곳)", group: "구매", social: false },
  F05: { code: "F05", name: "생활용품", definition: "생활용품·의약외품 사기(세제·휴지·파스·밴드)", group: "구매", social: false },
  F06: { code: "F06", name: "택배", definition: "택배 맡기고 받기(보내기·대신 받아 두기)", group: "거점", social: false },
  F07: { code: "F07", name: "배달", definition: "전화 주문·배달", group: "전달", social: false },
  F08: { code: "F08", name: "돈 찾기", definition: "현금 찾기·공과금 내기", group: "금융", social: false },
  F09: { code: "F09", name: "사랑방", definition: "모여 앉는 자리", group: "사회", social: true },
  F10: { code: "F10", name: "안부", definition: "안부 확인·마을 소식", group: "사회", social: true },
};

/** Living functions (생활 일) — counted. */
export const CORE_FNS: FnCode[] = FN_CODES.filter((c) => !FNS[c].social);
/** Village-relation functions (마을 관계) — not counted, socialHubs only. */
export const SOCIAL_FNS: FnCode[] = FN_CODES.filter((c) => FNS[c].social);

export function fnMask(codes: Iterable<FnCode>): number {
  let m = 0;
  for (const c of codes) m |= 1 << FN_BIT[c];
  return m;
}

export function fnsOfMask(mask: number): FnCode[] {
  return FN_CODES.filter((c) => (mask >> FN_BIT[c]) & 1);
}

export const CORE_MASK = fnMask(CORE_FNS);
export const SOCIAL_MASK = fnMask(SOCIAL_FNS);

// ---------------------------------------------------------------------------
// Class x channel default cells (spec 5.3)
// ---------------------------------------------------------------------------

/**
 * "Y"   = fixed Y capability.
 * "cap" = confirmation cell `cap:{res}:{fn}` (default U).
 * "F04" = distance rule (*): walk road-est <= WALK_MAX_KM, car <= F04_CAR_MAX_KM -> Y, else N; homebound N.
 */
export type CapRule = "Y" | "cap" | "F04";
export type RouteCaps = Partial<Record<FnCode, CapRule>>;

/** Gate cell kind for each non-visit channel (key formats in `cellKey`). */
export const CHANNEL_GATE: Record<Channel, "area" | "stop" | "hubdrop" | null> = {
  visit: null,
  deliver: "area",
  tour: "stop",
  hubdrop: "hubdrop",
};

export interface ClassSpec {
  visit?: RouteCaps;
  deliver?: RouteCaps;
  tour?: RouteCaps;
  hubdrop?: RouteCaps;
  /** "Y" = open fixed; "open" = confirmation cell `open:{res}` (default U). */
  open: "Y" | "open";
  /** hanaro, store_daily: deliver channel only for businesses in 화산면. */
  deliverOnlyMyeon?: string;
}

export const HWASAN_MYEON = "화산면";

export const CLASS_TABLE: Record<ResClass, ClassSpec> = {
  hanaro: {
    visit: { F01: "Y", F02: "Y", F03: "cap", F04: "F04", F05: "Y" },
    deliver: { F01: "Y", F02: "Y", F05: "Y", F07: "Y" },
    // A3: deliver only for the 화산면 하나로마트 (design 4.4.2 row = 「농협 하나로마트(화산)」).
    deliverOnlyMyeon: HWASAN_MYEON,
    open: "Y",
  },
  bank: { visit: { F08: "Y" }, open: "Y" },
  post: { visit: { F06: "Y", F08: "cap" }, open: "Y" },
  store_daily: {
    visit: { F01: "Y", F02: "cap", F04: "F04", F05: "Y" },
    deliver: { F01: "Y", F05: "Y", F07: "Y" },
    deliverOnlyMyeon: HWASAN_MYEON,
    open: "open",
  },
  // store_fresh visit caps depend on sbizSub — see routeCapsFor().
  store_fresh: { visit: {}, open: "open" },
  tour: { tour: { F01: "Y", F02: "Y", F03: "cap", F05: "cap" }, open: "Y" },
  care_link: { deliver: { F01: "Y", F02: "Y", F07: "Y" }, open: "Y" },
  hub: { visit: { F06: "cap", F09: "Y", F10: "cap" }, open: "Y" },
  hubdrop: { hubdrop: { F01: "Y", F02: "Y", F05: "Y" }, open: "Y" },
};

/** store_fresh: 정육점·수산물 -> F03 Y / 채소·과일 -> F02 Y. */
function freshCaps(sbizSub: string | undefined): RouteCaps {
  const s = sbizSub ?? "";
  if (s.includes("정육") || s.includes("수산")) return { F03: "Y" };
  if (s.includes("채소") || s.includes("과일")) return { F02: "Y" };
  return {};
}

/**
 * Default capability rules of resource `res` on channel `ch`, or null when the class has no such channel.
 * Applies: store_fresh sub-type, store_daily deliver only in 화산면, judgeUnknown -> every visit Y becomes `cap`
 * (F04 keeps its distance rule; open U already caps it at U).
 */
export function routeCapsFor(res: Resource, ch: Channel): RouteCaps | null {
  const spec = CLASS_TABLE[res.cls];
  if (res.cls === "store_fresh" && ch === "visit") {
    const caps = freshCaps(res.sbizSub);
    return res.judgeUnknown ? judge(caps) : caps;
  }
  const caps = spec[ch];
  if (!caps) return null;
  if (ch === "deliver" && spec.deliverOnlyMyeon && res.myeon !== spec.deliverOnlyMyeon) return null;
  if (ch === "visit" && res.judgeUnknown) return judge(caps);
  return caps;
}

function judge(caps: RouteCaps): RouteCaps {
  const out: RouteCaps = {};
  for (const [fn, rule] of Object.entries(caps) as [FnCode, CapRule][]) out[fn] = rule === "Y" ? "cap" : rule;
  return out;
}

/** Channels a resource class can use. */
export function channelsOf(res: Resource): Channel[] {
  return (["visit", "deliver", "tour", "hubdrop"] as Channel[]).filter((ch) => routeCapsFor(res, ch) !== null);
}

// ---------------------------------------------------------------------------
// Confirmation cell keys (spec 5.6). Labels are built in engine/cells.ts.
// ---------------------------------------------------------------------------
export const cellKey = {
  cap: (resId: string, fn: FnCode) => `cap:${resId}:${fn}`,
  open: (resId: string) => `open:${resId}`,
  stop: (resId: string, pointId: string) => `stop:${resId}:${pointId}`,
  area: (resId: string, villageId: string) => `area:${resId}:${villageId}`,
  hubdrop: (delivererId: string, hubResId: string) => `hubdrop:${delivererId}:${hubResId}`,
  bus: (villageId: string) => `bus:${villageId}`,
} as const;
