"use client";
// SVG map of 화산면 — no map library (spec 2). ● 리 대표점 · ○ 마을회관·경로당 · ■ 하나로마트·농협·우체국 ·
// ◇ 등록 업소 · grey = 식료품 업소 0곳 리. Optional lines from the closed store to the resources that take
// over its work (solid = 확실, dashed = 확인 중).
import { useEffect, useMemo, useState } from "react";
import type { FnCode, Region, Resource } from "@/lib/types";
import { bboxOf, makeProjector } from "@/lib/geo";
import { COPY } from "@/lib/copy";

export interface MapLine {
  resId: string;
  tri: "Y" | "U";
  fns: FnCode[];
}

export interface MapProps {
  region: Region;
  store?: { lat: number; lon: number; name: string } | null;
  lines?: MapLine[];
  /** village to emphasise (S1 selection / scenario village) */
  focusVillageId?: string | null;
  /** resident's demand point to mark */
  pointId?: string | null;
  onVillageClick?: (villageId: string) => void;
  ariaLabel?: string;
  /** "fit" = whole 면; "lines" = also include far line ends */
  height?: number;
}

const W = 480;
const SQUARE_CLS = new Set(["hanaro", "bank", "post"]);
const DIAMOND_CLS = new Set(["store_daily", "store_fresh"]);

function locOf(region: Region, r: Resource): { lat: number; lon: number } | null {
  if (typeof r.lat === "number" && typeof r.lon === "number") return { lat: r.lat, lon: r.lon };
  if (r.hubId) {
    const h = region.resources.find((x) => x.id === r.hubId);
    if (h && typeof h.lat === "number" && typeof h.lon === "number") return { lat: h.lat, lon: h.lon };
  }
  return null;
}

export function VillageMap({ region, store, lines = [], focusVillageId, pointId, onVillageClick, ariaLabel }: MapProps) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(true), 30);
    return () => window.clearTimeout(t);
  }, []);

  const resById = useMemo(() => new Map(region.resources.map((r) => [r.id, r])), [region]);

  const { proj, H } = useMemo(() => {
    const pts: Array<{ lat?: number; lon?: number }> = [...region.villages, ...region.points];
    for (const r of region.resources) if (r.myeon === "화산면" && typeof r.lat === "number") pts.push(r);
    for (const l of lines) {
      const r = resById.get(l.resId);
      const loc = r ? locOf(region, r) : null;
      if (loc) pts.push(loc);
    }
    if (store) pts.push(store);
    const bb = bboxOf(pts, 0.06);
    const kx = Math.cos(((bb.minLat + bb.maxLat) / 2) * (Math.PI / 180));
    const ratio = (bb.maxLat - bb.minLat) / Math.max((bb.maxLon - bb.minLon) * kx, 1e-9);
    const h = Math.round(Math.min(Math.max(W * ratio, W * 0.6), W * 1.25));
    return { proj: makeProjector(bb, W, h, 22), H: h };
  }, [region, lines, store, resById]);

  const located = region.resources.filter((r) => typeof r.lat === "number" && typeof r.lon === "number");
  const storeXY = store ? proj(store.lat, store.lon) : null;
  const unlocatedLines = lines.filter((l) => {
    const r = resById.get(l.resId);
    return !r || !locOf(region, r);
  });

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={ariaLabel ?? "화산면 지도"}
        className="block h-auto w-full rounded-xl border border-line bg-[#fbfaf5]"
      >
        {/* resources: squares (hanaro/bank/post), diamonds (registered stores) */}
        {located.map((r) => {
          if (r.cls === "hubdrop" || r.cls === "hub") return null;
          const { x, y } = proj(r.lat as number, r.lon as number);
          if (x < -10 || y < -10 || x > W + 10 || y > H + 10) return null;
          if (SQUARE_CLS.has(r.cls)) {
            return (
              <g key={r.id}>
                <rect x={x - 6} y={y - 6} width={12} height={12} fill="var(--brand)" stroke="#fff" strokeWidth={1.5}>
                  <title>{r.name}</title>
                </rect>
              </g>
            );
          }
          if (DIAMOND_CLS.has(r.cls)) {
            return (
              <path key={r.id} d={`M${x} ${y - 7}L${x + 7} ${y}L${x} ${y + 7}L${x - 7} ${y}Z`} fill="#fff" stroke="var(--unsure)" strokeWidth={1.8}>
                <title>{`${r.name} — ${COPY.badge.sbizUnverified}`}</title>
              </path>
            );
          }
          return null;
        })}

        {/* hub demand points: open circles */}
        {region.points
          .filter((p) => p.kind === "hub")
          .map((p) => {
            const { x, y } = proj(p.lat, p.lon);
            const sel = p.id === pointId;
            return (
              <circle key={p.id} cx={x} cy={y} r={sel ? 7 : 5} fill="#fff" stroke={sel ? "var(--warn)" : "var(--ink)"} strokeWidth={sel ? 3 : 1.6}>
                <title>{p.name}</title>
              </circle>
            );
          })}

        {/* lines store -> resource */}
        {storeXY
          ? lines.map((l) => {
              const r = resById.get(l.resId);
              const loc = r ? locOf(region, r) : null;
              if (!r || !loc) return null;
              const e = proj(loc.lat, loc.lon);
              return (
                <g key={`${l.resId}-${l.tri}`} className="fx-line" style={{ opacity: shown ? 1 : 0 }} data-line={l.resId} data-line-tri={l.tri}>
                  <line
                    x1={storeXY.x}
                    y1={storeXY.y}
                    x2={e.x}
                    y2={e.y}
                    stroke={l.tri === "Y" ? "var(--sure)" : "var(--unsure)"}
                    strokeWidth={l.tri === "Y" ? 3.2 : 2.6}
                    strokeDasharray={l.tri === "Y" ? undefined : "7 6"}
                    strokeLinecap="round"
                  />
                  <text x={e.x + 9} y={e.y + 16} fontSize={13} fill={l.tri === "Y" ? "var(--sure)" : "var(--unsure)"} fontWeight={700}>
                    {l.fns.map((f) => COPY.fnName[f]).join("·")}
                  </text>
                </g>
              );
            })
          : null}

        {/* village nodes: filled circles, grey when no food store */}
        {region.villages.map((v) => {
          const { x, y } = proj(v.lat, v.lon);
          const focus = v.id === focusVillageId;
          const grey = v.foodStores === 0;
          const sel = region.points.find((p) => p.villageId === v.id && p.kind === "village_node")?.id === pointId && !!pointId;
          return (
            <g
              key={v.id}
              onClick={onVillageClick ? () => onVillageClick(v.id) : undefined}
              style={onVillageClick ? { cursor: "pointer" } : undefined}
              data-village={v.id}
            >
              {v.isSeat ? <circle cx={x} cy={y} r={13} fill="none" stroke="var(--brand)" strokeWidth={2} strokeDasharray="2 3" /> : null}
              <circle
                cx={x}
                cy={y}
                r={focus ? 9 : 7}
                fill={grey ? "#a9ada9" : "var(--brand)"}
                stroke={focus || sel ? "var(--warn)" : "#fff"}
                strokeWidth={focus || sel ? 3 : 1.5}
              />
              <text x={x} y={y - 12} textAnchor="middle" fontSize={focus ? 16 : 14} fontWeight={focus ? 800 : 600} fill={grey ? "#6d726e" : "var(--ink)"}>
                {v.name}
              </text>
            </g>
          );
        })}

        {/* closed store */}
        {storeXY && store ? (
          <g data-store="closed">
            <rect x={storeXY.x - 9} y={storeXY.y - 9} width={18} height={18} rx={3} fill="var(--warn)" stroke="#fff" strokeWidth={2} />
            <path d={`M${storeXY.x - 5} ${storeXY.y - 5}L${storeXY.x + 5} ${storeXY.y + 5}M${storeXY.x + 5} ${storeXY.y - 5}L${storeXY.x - 5} ${storeXY.y + 5}`} stroke="#fff" strokeWidth={2.2} />
            <text x={storeXY.x} y={storeXY.y + 26} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--warn)">
              {store.name}
            </text>
          </g>
        ) : null}
      </svg>
      {unlocatedLines.length > 0 ? (
        <figcaption className="mt-2 flex flex-wrap items-center gap-2 text-[14px]">
          <span className="text-muted">{COPY.s3.noLocation}:</span>
          {unlocatedLines.map((l) => (
            <span
              key={`${l.resId}-${l.tri}`}
              className={`rounded-lg px-2 py-0.5 ${l.tri === "Y" ? "tri-y" : "tri-u"}`}
              data-line={l.resId}
              data-line-tri={l.tri}
            >
              {resById.get(l.resId)?.name ?? l.resId} · {l.fns.map((f) => COPY.fnName[f]).join("·")}
            </span>
          ))}
        </figcaption>
      ) : null}
    </figure>
  );
}
