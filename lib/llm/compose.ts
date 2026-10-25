// L4 core (shared by /api/compose, precompute and E4 eval). Never throws.
// The server rebuilds the digest from the region: names come from the region only, unknown resIds are dropped,
// function names / weekdays / numbers are filtered to their vocabularies (blocks prompt injection and fake names).
import type { ComposeRequest, ComposeResponse, FallbackReason, GroundingBlock, GroundingResult } from "../apiTypes";
import type { Mode, PlanDigest, Region, Resource } from "../types";
import { MODES } from "../types";
import { FN_CODES, FNS } from "../ontology";
import { templateText, MODE_RESIDENT_KO, MODE_KO } from "../fallback/templates";
import { groundText, type NameEntry } from "../validate/grounding";
import { callClaude } from "./client";
import { L4_MAX_TOKENS, L4_SYSTEM, l4User, type L4Payload } from "./prompts";

const FN_NAMES = new Set(FN_CODES.map((c) => FNS[c].name));
const DAY_WORDS = new Set(["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"]);

export function parseComposeRequest(body: unknown): { ok: true; req: ComposeRequest } | { ok: false; message: string } {
  if (!body || typeof body !== "object") return { ok: false, message: "요청 형식이 올바르지 않아요(JSON 객체가 필요해요)." };
  const b = body as Record<string, unknown>;
  if (b.docType !== "resident" && b.docType !== "agency") return { ok: false, message: "문서 종류(docType)는 resident 또는 agency예요." };
  const aud = b.audience as Record<string, unknown> | undefined;
  if (!aud || typeof aud.villageId !== "string" || !MODES.includes(aud.mode as Mode))
    return { ok: false, message: "대상(audience)의 마을과 이동 유형을 보내 주세요." };
  const d = b.digest as Record<string, unknown> | undefined;
  if (!d || !Array.isArray(d.items)) return { ok: false, message: "계획 요약(digest)을 보내 주세요." };
  if (d.items.length > 30) return { ok: false, message: "계획 요약 항목이 너무 많아요." };
  return {
    ok: true,
    req: {
      docType: b.docType,
      agencyResId: typeof b.agencyResId === "string" ? b.agencyResId : null,
      audience: { villageId: aud.villageId, mode: aud.mode as Mode, ...(typeof aud.pointId === "string" ? { pointId: aud.pointId } : {}) },
      scenarioId: typeof b.scenarioId === "string" ? b.scenarioId : null,
      digest: d as unknown as PlanDigest,
    },
  };
}

const strs = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : []);

/** Agency display name and confirmation route (spec 8.6 tabs). */
export function agencyLabel(region: Region, resId: string | null): { name: string; route?: string } | null {
  if (!resId) return null;
  const r = region.resources.find((x) => x.id === resId);
  if (!r) return null;
  if (r.cls === "tour") return { name: "이동장터 운영 주체", route: "완주군 이동장터 담당 부서를 통해 운영 주체에 확인" };
  if (r.cls === "care_link") return { name: "생활지원 수행기관", route: "화산면 행정복지센터를 통해 수행기관에 확인" };
  if (r.cls === "hub") return { name: `${r.name} (이장·노인회)` };
  if (r.cls === "hubdrop" && r.deliverer) {
    const d = region.resources.find((x) => x.id === r.deliverer);
    return { name: d?.name ?? r.name };
  }
  return { name: r.name };
}

/** Rebuild the digest server-side (names from region, vocab filters, agency resource always present). */
export function sanitizeDigest(region: Region, req: ComposeRequest): PlanDigest {
  const byId = new Map<string, Resource>(region.resources.map((r) => [r.id, r]));
  const d = req.digest as unknown as Record<string, unknown>;
  const items: PlanDigest["items"] = [];
  const seen = new Set<string>();
  for (const raw of (d.items as unknown[]) ?? []) {
    const it = raw as Record<string, unknown>;
    const r = typeof it.resId === "string" ? byId.get(it.resId) : undefined;
    if (!r) continue;
    const status: "확실" | "확인 중" = it.status === "확실" ? "확실" : "확인 중";
    // one item per (resource, status): a resource may appear twice (sure functions / functions being checked)
    if (items.some((x) => x.resId === r.id && x.status === status)) continue;
    seen.add(r.id);
    const days = strs(it.days).filter((x) => DAY_WORDS.has(x));
    items.push({
      resId: r.id,
      name: r.name,
      fns: strs(it.fns).filter((f) => FN_NAMES.has(f)),
      status,
      ...(days.length ? { days } : {}),
    });
  }
  if (req.docType === "agency" && req.agencyResId && !seen.has(req.agencyResId)) {
    const r = byId.get(req.agencyResId);
    if (r) items.push({ resId: r.id, name: r.name, fns: [], status: "확인 중" });
  }
  const village = region.villages.find((v) => v.id === req.audience.villageId);
  const nums = Array.isArray(d.numbersAllowed) ? (d.numbersAllowed as unknown[]) : [];
  const counts = (d.counts ?? {}) as Record<string, unknown>;
  const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);
  return {
    scenarioId: req.scenarioId,
    villageName: village?.name ?? (typeof d.villageName === "string" ? d.villageName.slice(0, 10) : ""),
    mode: req.audience.mode,
    items,
    gaps: strs(d.gaps).filter((g) => FN_NAMES.has(g)),
    counts: { Y: n(counts.Y), U: n(counts.U), N: n(counts.N) },
    numbersAllowed: nums.filter((x): x is number => typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= 100000).slice(0, 60),
  };
}

export function regionNames(region: Region): NameEntry[] {
  return region.resources.map((r) => ({ name: r.name }));
}

/** Digest item the agency would take over (hubdrop items for a deliverer count as its own). */
function agencyItemName(region: Region, resId: string | null, digest: PlanDigest): string | undefined {
  if (!resId) return undefined;
  const own = digest.items.find((i) => i.resId === resId);
  if (own) return own.name;
  const viaHubdrop = digest.items.find((i) => region.resources.find((r) => r.id === i.resId)?.deliverer === resId);
  return viaHubdrop?.name;
}

export function l4Payload(region: Region, req: ComposeRequest, digest: PlanDigest): L4Payload {
  const ag = req.docType === "agency" ? agencyLabel(region, req.agencyResId) : null;
  return {
    문서: req.docType === "agency" ? "연계 요청문" : "주민 안내문",
    ...(ag ? { 받는_곳: ag.name, ...(ag.route ? { 확인_경로: ag.route } : {}) } : {}),
    ...(ag ? { 받는_곳_항목: agencyItemName(region, req.agencyResId, digest) } : {}),
    마을: digest.villageName,
    이동_조건: `${MODE_RESIDENT_KO[digest.mode]} 주민(${MODE_KO[digest.mode]})`,
    이어받는_곳: digest.items.map((i) => ({ 이름: i.name, 맡는_일: i.fns, 상태: i.status, ...(i.days ? { 요일: i.days } : {}) })),
    아직_없는_일: digest.gaps,
    쓸_수_있는_숫자: digest.numbersAllowed,
  };
}

export function composeTemplate(region: Region, req: ComposeRequest, digest: PlanDigest, hash: string, reason: FallbackReason | null, attempts = 0): ComposeResponse {
  const text = templateText({ docType: req.docType, agencyResId: req.agencyResId, digest });
  const g = groundText(text, digest, regionNames(region), attempts);
  return { mode: "template", model: null, text, grounding: g, template: true, inputHash: hash, generatedAt: new Date().toISOString(), fallbackReason: reason };
}

/** Deterministic tidy-up of model text: drop a bare title line, collapse blank lines (resident: one sentence per line). */
export function cleanText(text: string, docType: ComposeRequest["docType"]): string {
  const lines = (text ?? "").split(/\r?\n/).map((l) => l.trim());
  const body = lines.filter((l, i) => !(i <= 1 && /^\[?(주민 안내문|연계 요청문|안내문|요청문)\]?$/.test(l)));
  void docType; // same tidy-up for both document types
  return body.filter((l) => l.length > 0).join("\n").trim();
}

export interface LiveCompose {
  response: ComposeResponse;
  firstPass: boolean | null;
  regenerated: boolean;
  firstBlocked: GroundingBlock[];
  texts: string[];
}

/** LLM write -> grounding -> (blocked) one regeneration with the error list -> (blocked) template. */
export async function composeLive(
  region: Region,
  req: ComposeRequest,
  digest: PlanDigest,
  hash: string,
  opts: { model?: string; noFallback?: boolean } = {},
): Promise<LiveCompose> {
  const names = regionNames(region);
  const payload = l4Payload(region, req, digest);
  const texts: string[] = [];
  const call = (blocked?: GroundingBlock[]) =>
    callClaude({ system: L4_SYSTEM, user: l4User(payload, blocked), maxTokens: L4_MAX_TOKENS, tag: `compose-${req.docType}`, ...opts });

  const r1 = await call();
  if (!r1.ok) return { response: composeTemplate(region, req, digest, hash, r1.reason as FallbackReason, 0), firstPass: null, regenerated: false, firstBlocked: [], texts };
  const text1 = cleanText(r1.text, req.docType);
  texts.push(r1.text);
  const g1: GroundingResult = groundText(text1, digest, names, 1);
  const base = { model: r1.model, template: false, inputHash: hash, generatedAt: new Date().toISOString(), fallbackReason: null };
  if (g1.pass) return { response: { mode: "live", text: text1, grounding: g1, ...base }, firstPass: true, regenerated: false, firstBlocked: [], texts };

  const r2 = await call(g1.blocked);
  if (r2.ok) {
    const text2 = cleanText(r2.text, req.docType);
    texts.push(r2.text);
    const g2 = groundText(text2, digest, names, 2);
    if (g2.pass)
      return { response: { mode: "live", text: text2, grounding: { ...g2, blocked: [] }, ...base, model: r2.model }, firstPass: false, regenerated: true, firstBlocked: g1.blocked, texts };
    const t = composeTemplate(region, req, digest, hash, null, 2);
    return { response: { ...t, grounding: { ...t.grounding, blocked: g2.blocked } }, firstPass: false, regenerated: true, firstBlocked: g1.blocked, texts };
  }
  const t = composeTemplate(region, req, digest, hash, r2.reason as FallbackReason, 1);
  return { response: { ...t, grounding: { ...t.grounding, blocked: g1.blocked } }, firstPass: false, regenerated: false, firstBlocked: g1.blocked, texts };
}
