// Cell computation (spec 5.4). Deterministic, no LLM.
//   c(r, p, m, f) = OR_channel [ cap_channel(r, f) AND acc(m, channel, p, r) AND open(r) ]
// Stored as two function bitmasks per (mode, point, resource): y (cell Y) and u (cell U, not Y).
import type { CellDef, Channel, Confirmation, FnCode, FunctionPiece, Mode, Point, Region, Resource, Tri } from "../types";
import { MODES } from "../types";
import { CLASS_TABLE, CORE_MASK, FN_BIT, FN_CODES, FNS, cellKey, channelsOf, routeCapsFor, type CapRule } from "../ontology";
import { haversineKm } from "../geo";
import { P } from "./params";
import { euro, eulreul, iga, indexRegion } from "./util";

/** Function bitmasks (bit i = FN_CODES[i]): y = cell Y, u = cell U (not Y). Possible = y | u. */
export interface FnMasks { y: number; u: number }

/** Per (resource, point, mode) entry: OR over channels, plus per-channel masks for representative channel. */
export interface ResPointCell extends FnMasks {
  byChannel: Partial<Record<Channel, FnMasks>>;
  /** Travel burden km of the cheapest contributing channel (visit/hubdrop: road est., tour: nearest live stop, deliver: 0). */
  burden: number;
}

type Entry = readonly [Mode, string, string]; // mode, pointId, resId

interface Ctx {
  region: Region;
  /** precomputed per-resource channel rules restricted to enabled functions */
  rules: Map<string, { ch: Channel; caps: { bit: number; fn: FnCode; rule: CapRule }[] }[]>;
  /** cellKey -> entries whose value depends on that cell (value-independent) */
  deps: Map<string, Entry[]>;
  /** bus stops near each point / located resource (opts.bus only) */
  busNear: Map<string, boolean>;
}

export interface Cells {
  /** Confirmation-cell registry: cellKey -> definition (spec 5.6). */
  registry: Map<string, CellDef>;
  /** Effective value of each registered cell (confirmation if accepted, else default U). */
  values: Map<string, Tri>;
  /** Confirmations actually applied (demo values on realNamed cells are dropped). */
  applied: Confirmation[];
  /** Confirmations ignored at entry (e.g. "시연 입력값" on realNamed cell), with reason. */
  ignored: { conf: Confirmation; reason: string }[];
  /** masks[mode].get(pointId).get(resId) — only non-zero entries are stored. */
  masks: Record<Mode, Map<string, Map<string, ResPointCell>>>;
  /** Impact index: cellKey -> set of "villageId|mode" it touches (incremental recompute). */
  affects: Map<string, Set<string>>;
  /** Travel burden in km (visit/hub/hubdrop: road estimate, tour: nearest stop, deliver: 0). */
  burden: (resId: string, pointId: string, mode: Mode) => number;
  /** Enabled function pieces and derived lookup tables. */
  fns: FunctionPiece[];
  enabledMask: number;
  /** Enabled core (non-social) functions mask. */
  coreMask: number;
  /** importance-sum lookup over core functions, length 1024 (index = mask). */
  weightTable: Float64Array;
  opts: { bus: boolean };
  /** true while this is the A1 stub. */
  stub?: boolean;
  /** internal (engine only) */
  _ctx?: Ctx;
}

const roadFactor = (m: Mode) => (m === "car" ? P.ROAD_FACTOR_CAR : P.ROAD_FACTOR_WALK);
const RANK: Record<Tri, number> = { N: 0, U: 1, Y: 2 };
const and2 = (a: Tri, b: Tri): Tri => (RANK[a] <= RANK[b] ? a : b);
const or2 = (a: Tri, b: Tri): Tri => (RANK[a] >= RANK[b] ? a : b);

function dist(a: { lat?: number; lon?: number }, b: { lat?: number; lon?: number }): number {
  if (typeof a.lat !== "number" || typeof b.lat !== "number" || typeof a.lon !== "number" || typeof b.lon !== "number") return Infinity;
  return haversineKm(a.lat, a.lon, b.lat, b.lon);
}

/** Static access for "go there" channels (visit, hub, hubdrop) — spec 4.4.3. */
function goAcc(m: Mode, d: number, hubLike: boolean): Tri {
  if (m === "car") return d * P.ROAD_FACTOR_CAR <= P.CAR_MAX_KM + P.EPS ? "Y" : "N";
  if (m === "walk") return d * P.ROAD_FACTOR_WALK <= P.WALK_MAX_KM + P.EPS ? "Y" : "N";
  return hubLike && d <= P.HOMEBOUND_NEAR_KM + P.EPS ? "U" : "N";
}

/** F04 distance rule (*) — walk road ≤ WALK_MAX_KM, car road ≤ F04_CAR_MAX_KM, homebound N. */
function f04(m: Mode, d: number): Tri {
  if (m === "car") return d * P.ROAD_FACTOR_CAR <= P.F04_CAR_MAX_KM + P.EPS ? "Y" : "N";
  if (m === "walk") return d * P.ROAD_FACTOR_WALK <= P.WALK_MAX_KM + P.EPS ? "Y" : "N";
  return "N";
}

// ---------------------------------------------------------------------------------------------
// Registry (spec 5.6)
// ---------------------------------------------------------------------------------------------
const CAP_PHRASE: Partial<Record<FnCode, string>> = {
  F02: "신선식품을 살 수 있는지",
  F03: "고기·생선을 살 수 있는지",
  F05: "생활용품을 살 수 있는지",
  F06: "택배를 대신 받아 줄 수 있는지",
  F08: "돈 찾기(현금·공과금)가 되는지",
  F10: "안부 확인을 해 줄 수 있는지",
};

function buildRegistry(region: Region, enabledMask: number, bus: boolean): Map<string, CellDef> {
  const reg = new Map<string, CellDef>();
  const idx = indexRegion(region);
  const add = (d: CellDef) => { if (!reg.has(d.key)) reg.set(d.key, d); };
  for (const r of region.resources) {
    const spec = CLASS_TABLE[r.cls];
    for (const ch of channelsOf(r)) {
      const caps = routeCapsFor(r, ch) ?? {};
      for (const [fn, rule] of Object.entries(caps) as [FnCode, CapRule][]) {
        if (rule !== "cap" || !((enabledMask >> FN_BIT[fn]) & 1)) continue;
        const phrase = CAP_PHRASE[fn] ?? `${iga(FNS[fn].name)} 되는지`;
        add({ key: cellKey.cap(r.id, fn), kind: "cap", resId: r.id, fn, label: `${r.name}에서 ${phrase}`, realNamed: !r.anonymized });
      }
      if (ch === "deliver") {
        for (const v of region.villages) {
          let label: string;
          if (r.cls === "care_link") label = `${v.name} 어르신이 생활지원 연계(식료품 배달)를 받을 수 있는지`;
          else if (r.cls === "hanaro") label = `${r.name} 배송이 ${v.name}까지 오는지`;
          else label = `${r.name} 배달이 ${v.name}까지 되는지`;
          add({ key: cellKey.area(r.id, v.id), kind: "area", resId: r.id, villageId: v.id, label, realNamed: true });
        }
      }
      if (ch === "tour") {
        for (const p of region.points) {
          const where = p.kind === "village_node" ? `${idx.village.get(p.villageId)?.name ?? p.name} 마을 안에` : `${p.name} 앞에`;
          add({ key: cellKey.stop(r.id, p.id), kind: "stop", resId: r.id, pointId: p.id, villageId: p.villageId,
            label: `${iga(r.name)} ${where} 서는지(요일)`, realNamed: !r.anonymized ? true : false });
        }
      }
      if (ch === "hubdrop" && r.deliverer && r.hubId) {
        const d = idx.res.get(r.deliverer);
        const h = idx.res.get(r.hubId);
        add({ key: cellKey.hubdrop(r.deliverer, r.hubId), kind: "hubdrop", resId: r.id, villageId: r.villageId,
          label: `${iga(d?.name ?? r.deliverer)} ${euro(h?.name ?? r.hubId)} 모아 보내고 주민이 거기서 받을 수 있는지`, realNamed: true });
      }
    }
    if (spec.open === "open") {
      const reg2 = r.src.includes("sbiz") ? "등록 정보 2026-06" : "OSM 등록 정보 2026-10";
      add({ key: cellKey.open(r.id), kind: "open", resId: r.id, label: `${iga(r.name)} 지금도 문을 여는지(${reg2})`, realNamed: true });
    }
  }
  if (bus) {
    for (const v of region.villages) {
      add({ key: cellKey.bus(v.id), kind: "bus", villageId: v.id,
        label: `${v.name}에서 버스로 면 소재지 왕복 ${eulreul("장보기")} 할 수 있는지(운행 횟수·시간)`, realNamed: false });
    }
  }
  return reg;
}

// ---------------------------------------------------------------------------------------------
// Entry evaluation
// ---------------------------------------------------------------------------------------------
type Val = (key: string) => Tri;

function evalEntry(ctx: Ctx, r: Resource, p: Point, m: Mode, val: Val, opts: { bus: boolean }): ResPointCell | null {
  const idx = indexRegion(ctx.region);
  const chans = ctx.rules.get(r.id);
  if (!chans || chans.length === 0) return null;
  const spec = CLASS_TABLE[r.cls];
  let y = 0, u = 0;
  let burden = Infinity;
  const byChannel: Partial<Record<Channel, FnMasks>> = {};
  for (const { ch, caps } of chans) {
    if (caps.length === 0) continue;
    // --- static access part
    let accStatic: Tri = "N";
    let accKeys: string[] = []; // cells OR-ed into acc (tour stops, bus)
    let homeCapU = false; // tour homebound: Y becomes U
    let gateKey: string | null = null;
    let chBurden = 0;
    const d = dist(p, r);
    if (ch === "visit") {
      accStatic = goAcc(m, d, r.cls === "hub");
      chBurden = d * roadFactor(m);
      if (opts.bus && m === "walk" && accStatic === "N" && ctx.busNear.get("p:" + p.id) && ctx.busNear.get("r:" + r.id)) {
        accKeys = [cellKey.bus(p.villageId)];
      }
    } else if (ch === "hubdrop") {
      accStatic = goAcc(m, d, true);
      chBurden = d * roadFactor(m);
      if (r.deliverer && r.hubId) gateKey = cellKey.hubdrop(r.deliverer, r.hubId);
    } else if (ch === "deliver") {
      accStatic = "N";
      accKeys = [cellKey.area(r.id, p.villageId)];
      chBurden = 0;
    } else if (ch === "tour") {
      const lim = m === "car" ? P.TOUR_CAR_MAX_KM / P.ROAD_FACTOR_CAR : m === "walk" ? P.WALK_MAX_KM / P.ROAD_FACTOR_WALK : P.HOMEBOUND_NEAR_KM;
      for (const q of ctx.region.points) {
        const dq = dist(p, q);
        if (dq <= lim + P.EPS) accKeys.push(cellKey.stop(r.id, q.id));
      }
      homeCapU = m === "homebound";
      chBurden = 0;
    }
    if (accStatic === "N" && accKeys.length === 0) continue;
    // --- per function static rule
    const items: { bit: number; rule: Tri | string }[] = [];
    for (const c of caps) {
      let rule: Tri | string;
      if (c.rule === "Y") rule = "Y";
      else if (c.rule === "F04") rule = f04(m, d);
      else rule = cellKey.cap(r.id, c.fn);
      if (rule === "N") continue;
      items.push({ bit: c.bit, rule });
    }
    if (items.length === 0) continue;
    // --- dynamic (cell) part
    let acc: Tri = accStatic;
    let tourBurden = Infinity;
    for (const k of accKeys) {
      const v = val(k);
      acc = or2(acc, v);
      if (ch === "tour" && v !== "N") {
        const q = idx.point.get(k.slice(k.lastIndexOf(":") + 1));
        if (q) tourBurden = Math.min(tourBurden, dist(p, q) * roadFactor(m));
      }
    }
    if (ch === "tour") chBurden = Number.isFinite(tourBurden) ? tourBurden : 0;
    if (homeCapU && acc === "Y") acc = "U";
    if (gateKey) acc = and2(acc, val(gateKey));
    const open: Tri = spec.open === "Y" ? "Y" : val(cellKey.open(r.id));
    const base = and2(acc, open);
    let cy = 0, cu = 0;
    for (const it of items) {
      const capV: Tri = it.rule === "Y" || it.rule === "U" ? (it.rule as Tri) : val(it.rule as string);
      const t = and2(capV, base);
      if (t === "Y") cy |= 1 << it.bit;
      else if (t === "U") cu |= 1 << it.bit;
    }
    if (cy | cu) {
      byChannel[ch] = { y: cy, u: cu & ~cy };
      burden = Math.min(burden, chBurden);
    }
    y |= cy;
    u |= cu;
  }
  u &= ~y;
  if (!(y | u)) return null;
  return { y, u, byChannel, burden: Number.isFinite(burden) ? burden : 0 };
}

// ---------------------------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------------------------
export function makeCells(
  region: Region,
  fns: FunctionPiece[],
  conf: Confirmation[],
  opts?: { bus?: boolean },
): Cells {
  const bus = opts?.bus ?? false;
  const enabled = fns.filter((f) => f.enabled);
  let enabledMask = 0;
  const imp = new Map<FnCode, number>();
  for (const f of enabled) {
    enabledMask |= 1 << FN_BIT[f.code];
    imp.set(f.code, Math.max(imp.get(f.code) ?? 0, f.importance));
  }
  const coreMask = enabledMask & CORE_MASK;
  const weightTable = new Float64Array(1024);
  for (let mask = 0; mask < 1024; mask++) {
    let s = 0;
    for (const c of FN_CODES) if (((mask & coreMask) >> FN_BIT[c]) & 1) s += imp.get(c) ?? 0;
    weightTable[mask] = s;
  }

  const registry = buildRegistry(region, enabledMask, bus);
  const values = new Map<string, Tri>();
  for (const k of registry.keys()) values.set(k, "U");
  const applied: Confirmation[] = [];
  const ignored: { conf: Confirmation; reason: string }[] = [];
  for (const c of conf) {
    const def = registry.get(c.cellKey);
    if (!def) { ignored.push({ conf: c, reason: "알 수 없는 칸" }); continue; }
    if (c.by === "시연 입력값" && def.realNamed) {
      ignored.push({ conf: c, reason: "실명 칸에는 시연 입력값을 넣을 수 없음" });
      if (typeof console !== "undefined") console.warn(`[engine] 시연 입력값 무시(실명 칸): ${c.cellKey}`);
      continue;
    }
    values.set(c.cellKey, c.value);
    applied.push(c);
  }

  // per-resource enabled channel rules
  const rules: Ctx["rules"] = new Map();
  for (const r of region.resources) {
    const list: { ch: Channel; caps: { bit: number; fn: FnCode; rule: CapRule }[] }[] = [];
    for (const ch of channelsOf(r)) {
      const caps = routeCapsFor(r, ch) ?? {};
      const arr: { bit: number; fn: FnCode; rule: CapRule }[] = [];
      for (const fn of FN_CODES) {
        const rule = caps[fn];
        if (!rule || !((enabledMask >> FN_BIT[fn]) & 1)) continue;
        arr.push({ bit: FN_BIT[fn], fn, rule });
      }
      list.push({ ch, caps: arr });
    }
    rules.set(r.id, list);
  }

  // bus proximity (opts.bus only)
  const busNear = new Map<string, boolean>();
  if (bus) {
    const stops = (region.meta.busStops as [number, number][] | undefined) ?? [];
    const near = (lat?: number, lon?: number) =>
      typeof lat === "number" && typeof lon === "number" && stops.some(([a, b]) => haversineKm(lat, lon, a, b) * 1000 <= P.BUS_STOP_M);
    for (const p of region.points) busNear.set("p:" + p.id, near(p.lat, p.lon));
    for (const r of region.resources) busNear.set("r:" + r.id, near(r.lat, r.lon));
  }

  const ctx: Ctx = { region, rules, deps: new Map(), busNear };
  const masks: Cells["masks"] = { car: new Map(), walk: new Map(), homebound: new Map() };
  const affects = new Map<string, Set<string>>();
  const o = { bus };
  for (const m of MODES) {
    for (const p of region.points) {
      const inner = new Map<string, ResPointCell>();
      for (const r of region.resources) {
        const used: string[] = [];
        const val: Val = (k) => { used.push(k); return values.get(k) ?? "U"; };
        const e = evalEntry(ctx, r, p, m, val, o);
        if (e) inner.set(r.id, e);
        if (used.length) {
          const vm = p.villageId + "|" + m;
          for (const k of new Set(used)) {
            let d = ctx.deps.get(k);
            if (!d) { d = []; ctx.deps.set(k, d); }
            d.push([m, p.id, r.id]);
            let s = affects.get(k);
            if (!s) { s = new Set(); affects.set(k, s); }
            s.add(vm);
          }
        }
      }
      masks[m].set(p.id, inner);
    }
  }

  const cells: Cells = {
    registry, values, applied, ignored, masks, affects,
    burden: (resId, pointId, mode) => burdenOf(cells, resId, pointId, mode),
    fns: enabled, enabledMask, coreMask, weightTable, opts: { bus }, _ctx: ctx,
  };
  return cells;
}

function burdenOf(cells: Cells, resId: string, pointId: string, mode: Mode): number {
  const e = cells.masks[mode].get(pointId)?.get(resId);
  if (e) return e.burden;
  const ctx = cells._ctx;
  if (!ctx) return 0;
  const idx = indexRegion(ctx.region);
  const d = dist(idx.point.get(pointId) ?? {}, idx.res.get(resId) ?? {});
  return Number.isFinite(d) ? d * roadFactor(mode) : 0;
}

/**
 * New Cells with some cell values overridden (incremental: only entries depending on those cells are
 * recomputed; registry, affects and lookup tables are shared). Used by VOI and evaluation.
 */
export function withOverrides(cells: Cells, ov: Map<string, Tri> | Record<string, Tri>): Cells {
  const ctx = cells._ctx;
  if (!ctx) return cells;
  const entries = ov instanceof Map ? [...ov.entries()] : (Object.entries(ov) as [string, Tri][]);
  const values = new Map(cells.values);
  for (const [k, v] of entries) if (values.has(k)) values.set(k, v);
  const masks: Cells["masks"] = { car: new Map(cells.masks.car), walk: new Map(cells.masks.walk), homebound: new Map(cells.masks.homebound) };
  const copied = new Set<string>();
  const idx = indexRegion(ctx.region);
  const val: Val = (k) => values.get(k) ?? "U";
  for (const [k] of entries) {
    for (const [m, pid, rid] of ctx.deps.get(k) ?? []) {
      const ck = m + "|" + pid;
      if (!copied.has(ck)) { masks[m].set(pid, new Map(masks[m].get(pid))); copied.add(ck); }
      const p = idx.point.get(pid)!;
      const r = idx.res.get(rid)!;
      const e = evalEntry(ctx, r, p, m, val, cells.opts);
      const inner = masks[m].get(pid)!;
      if (e) inner.set(rid, e); else inner.delete(rid);
    }
  }
  const next: Cells = { ...cells, values, masks };
  next.burden = (resId, pointId, mode) => burdenOf(next, resId, pointId, mode);
  return next;
}

/** Convenience: value of one registered cell (default U). */
export function cellValue(cells: Cells, key: string): Tri {
  return cells.values.get(key) ?? "U";
}

/** (v|m) pairs a cell touches, as [villageId, mode]. */
export function affectedVM(cells: Cells, key: string): [string, Mode][] {
  return [...(cells.affects.get(key) ?? [])].sort().map((s) => s.split("|") as [string, Mode]);
}

export type { FnCode };
