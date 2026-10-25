// Plan digest for document generation (spec 5.10). Names come from the region only; days come from
// confirmation notes; numbersAllowed lists every number a generated document may contain.
import type { Confirmation, FnCode, PersonalResult, Plan, PlanDigest, PlanVM, Region, Resource, Scenario } from "../types";
import { FNS } from "../ontology";
import { indexRegion } from "./util";

export type DigestTarget = PersonalResult | PlanVM;

const DAY_RE = /([월화수목금토일])요일/g;

function isPersonal(t: DigestTarget): t is PersonalResult {
  return (t as PersonalResult).pointId !== undefined && (t as PersonalResult).ordered !== undefined;
}

/** Confirmation keys that concern a resource (its own cells, and hubdrop gates for a hubdrop resource). */
function related(res: Resource, key: string): boolean {
  const parts = key.split(":");
  if (parts.includes(res.id)) return true;
  if (res.cls === "hubdrop" && res.deliverer && res.hubId) return key === `hubdrop:${res.deliverer}:${res.hubId}`;
  return false;
}

export function daysFromNotes(res: Resource, conf: Confirmation[]): string[] {
  const days = new Set<string>();
  for (const c of conf) {
    if (c.value !== "Y" || !c.note || !related(res, c.cellKey)) continue;
    for (const m of c.note.matchAll(DAY_RE)) days.add(m[0]);
  }
  const order = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"];
  return order.filter((d) => days.has(d));
}

export function digestFor(region: Region, plan: Plan, target: DigestTarget, scenario: Scenario | null, conf: Confirmation[]): PlanDigest {
  void plan;
  const idx = indexRegion(region);
  const items: PlanDigest["items"] = [];
  const gaps: string[] = [];
  let villageId: string;
  let counts: PlanDigest["counts"];
  const numbers = new Set<number>();
  if (isPersonal(target)) {
    villageId = idx.point.get(target.pointId)?.villageId ?? "";
    for (const o of target.ordered) {
      const r = idx.res.get(o.resId);
      if (!r) continue;
      // one item per (resource, status): a resource that carries some functions for sure and others still
      // unconfirmed (e.g. tour A: F01 F02 sure, F05 unconfirmed) must not list the unconfirmed ones as sure.
      const fY = o.fns.filter((f) => target.perFn[f]?.tri === "Y");
      const fU = o.fns.filter((f) => target.perFn[f]?.tri !== "Y");
      const days = daysFromNotes(r, conf);
      if (fY.length) items.push({ resId: r.id, name: r.name, fns: fY.map((f) => FNS[f].name), status: "확실", ...(days.length ? { days } : {}) });
      if (fU.length) items.push({ resId: r.id, name: r.name, fns: fU.map((f) => FNS[f].name), status: "확인 중" });
    }
    for (const [fn, v] of Object.entries(target.perFn) as [FnCode, { tri: string }][]) if (v.tri === "N") gaps.push(FNS[fn].name);
    counts = { Y: target.countY, U: target.countU, N: target.countN };
    if (target.b1.resId) numbers.add(target.b1.distKm);
  } else {
    villageId = target.villageId;
    const byRes = new Map<string, { fY: FnCode[]; fU: FnCode[] }>();
    for (const [fn, list] of Object.entries(target.byFn) as [FnCode, { resId: string; tri: string }[]][]) {
      for (const a of list) {
        const cur = byRes.get(a.resId) ?? { fY: [], fU: [] };
        (a.tri === "Y" ? cur.fY : cur.fU).push(fn);
        byRes.set(a.resId, cur);
      }
    }
    for (const rid of target.set) {
      const r = idx.res.get(rid);
      const v = byRes.get(rid);
      if (!r || !v) continue;
      const fU = v.fU.filter((f) => !v.fY.includes(f));
      const days = daysFromNotes(r, conf);
      if (v.fY.length) items.push({ resId: r.id, name: r.name, fns: v.fY.map((f) => FNS[f].name), status: "확실", ...(days.length ? { days } : {}) });
      if (fU.length) items.push({ resId: r.id, name: r.name, fns: fU.map((f) => FNS[f].name), status: "확인 중" });
    }
    for (const fn of target.gaps) gaps.push(FNS[fn].name);
    counts = { Y: Math.round(target.countY), U: Math.round(target.countU), N: Math.round(target.countN) };
  }
  const v = idx.village.get(villageId);
  numbers.add(counts.Y); numbers.add(counts.U); numbers.add(counts.N);
  numbers.add(counts.Y + counts.U + counts.N);
  for (let i = 1; i <= Math.max(items.length, 1); i++) numbers.add(i);
  if (v) numbers.add(Math.round(v.pop));
  const myeonPop = region.meta.myeonPop;
  if (typeof myeonPop === "number") numbers.add(myeonPop);
  for (const it of items) numbers.add(it.fns.length);
  return {
    scenarioId: scenario?.id ?? null,
    villageName: v?.name ?? "",
    mode: target.mode,
    items, gaps, counts,
    numbersAllowed: [...numbers].sort((a, b) => a - b),
  };
}
