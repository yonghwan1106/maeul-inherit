"use client";
// SVG map of 화산면 on a ruled notice-board ground — no map library (spec 2). ● 리 대표점, ○ 마을회관·경로당,
// ■ 하나로마트·농협·우체국, ◇ 등록 업소, grey = 식료품 업소 0곳 리. Optional lines from the closed store to the resources that take
// over its work (solid = 확실, dashed = 확인 중).
import { useMemo, useState } from "react";
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
  // Lines are drawn at full strength from the first paint (nothing on S3 moves by itself). Only a line that appears
  // later — after a confirmation or a mode switch, i.e. a user action — fades in once (.line-in).
  const [firstKeys] = useState(() => new Set(lines.map((l) => `${l.resId}-${l.tri}`)));
  const isNew = (k: string) => !firstKeys.has(k);

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
    return { proj: makeProjector(bb, W, h, 34), H: h };
  }, [region, lines, store, resById]);

  const located = region.resources.filter((r) => typeof r.lat === "number" && typeof r.lon === "number");
  const storeXY = store ? proj(store.lat, store.lon) : null;
  const unlocatedLines = lines.filter((l) => {
    const r = resById.get(l.resId);
    return !r || !locOf(region, r);
  });
  // located line ends get a numbered badge on the map; their names and functions are listed below the map
  // as HTML text (on-map text overlapped other labels and shrank to ~8 px at 390 px width)
  const locatedLines = lines.filter((l) => {
    const r = resById.get(l.resId);
    return !!r && !!locOf(region, r);
  });
  const clampX = (x: number) => Math.min(Math.max(x, 30), W - 30);

  return (
    <figure className="m-0 min-w-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={ariaLabel ?? "화산면 지도"}
        className="map-board block h-auto w-full border border-rule"
      >
        {/* resources: squares (hanaro/bank/post), diamonds (registered stores) */}
        {located.map((r) => {
          if (r.cls === "hubdrop" || r.cls === "hub") return null;
          const { x, y } = proj(r.lat as number, r.lon as number);
          if (x < 8 || y < 8 || x > W - 8 || y > H - 8) return null; // only markers drawn whole (no cut-off at the edges)
          if (SQUARE_CLS.has(r.cls)) {
            return (
              <g key={r.id}>
                <rect x={x - 6} y={y - 6} width={12} height={12} fill="var(--ink)" stroke="var(--paper)" strokeWidth={1.5}>
                  <title>{r.name}</title>
                </rect>
              </g>
            );
          }
          if (DIAMOND_CLS.has(r.cls)) {
            return (
              <path key={r.id} d={`M${x} ${y - 7}L${x + 7} ${y}L${x} ${y + 7}L${x - 7} ${y}Z`} fill="var(--paper)" stroke="var(--pencil-ink)" strokeWidth={1.8}>
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
              <circle key={p.id} cx={x} cy={y} r={sel ? 8 : 5} fill="var(--paper)" stroke="var(--ink)" strokeWidth={sel ? 3.5 : 1.6}>
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
                <g key={`${l.resId}-${l.tri}`} className={isNew(`${l.resId}-${l.tri}`) ? "line-in" : undefined} data-line={l.resId} data-line-tri={l.tri}>
                  <line
                    x1={storeXY.x}
                    y1={storeXY.y}
                    x2={e.x}
                    y2={e.y}
                    stroke={l.tri === "Y" ? "var(--ink)" : "var(--pencil-ink)"}
                    strokeWidth={l.tri === "Y" ? 3.2 : 2.6}
                    strokeDasharray={l.tri === "Y" ? undefined : "7 6"}
                    strokeLinecap="round"
                  />

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
              {v.isSeat ? <circle cx={x} cy={y} r={13} fill="none" stroke="var(--slate)" strokeWidth={2} strokeDasharray="2 3" /> : null}
              <circle
                cx={x}
                cy={y}
                r={focus ? 9 : 7}
                fill={grey ? "var(--shutter)" : "var(--slate)"}
                stroke={focus || sel ? "var(--ink)" : "var(--paper)"}
                strokeWidth={focus || sel ? 3 : 1.5}
              />
              <text x={clampX(x)} y={Math.max(y - 12, 14)} textAnchor="middle" fontSize={focus ? 17 : 14} fontWeight={focus ? 800 : 600} fill={grey ? "var(--pencil-ink)" : "var(--ink)"}>
                {v.name}
              </text>
            </g>
          );
        })}

        {/* closed store */}
        {storeXY && store ? (
          <g data-store="closed">
            <rect x={storeXY.x - 9} y={storeXY.y - 9} width={18} height={18} rx={1} fill="var(--ink)" stroke="var(--paper)" strokeWidth={2} />
            <path d={`M${storeXY.x - 5} ${storeXY.y - 5}L${storeXY.x + 5} ${storeXY.y + 5}M${storeXY.x + 5} ${storeXY.y - 5}L${storeXY.x - 5} ${storeXY.y + 5}`} stroke="var(--paper)" strokeWidth={2.2} />
            <text x={Math.min(Math.max(storeXY.x, 64), W - 64)} y={storeXY.y + 27} textAnchor="middle" fontSize={17} fontWeight={600} fill="var(--ink)" stroke="var(--paper)" strokeWidth={4} paintOrder="stroke">
              {store.name}
            </text>
          </g>
        ) : null}
        {/* numbered badges at located line ends (drawn above village labels) */}
        {storeXY
          ? locatedLines.map((l, i) => {
              const r = resById.get(l.resId);
              const loc = r ? locOf(region, r) : null;
              if (!loc) return null;
              const e = proj(loc.lat, loc.lon);
              // badge goes down-right of the end, or to the first corner that keeps clear of the closed-store marker/label
              const offs: [number, number][] = [[11, 11], [-14, -14], [11, -14], [-14, 11]];
              const far = (d: [number, number]) =>
                storeXY ? Math.min(Math.hypot(e.x + d[0] - storeXY.x, e.y + d[1] - storeXY.y), Math.hypot(e.x + d[0] - storeXY.x, e.y + d[1] - storeXY.y - 22)) : 99;
              const [ox, oy] = offs.find((d) => far(d) >= 30) ?? offs.reduce((m, d) => (far(d) > far(m) ? d : m));
              return (
                <g key={`n-${l.resId}-${l.tri}`} className={isNew(`${l.resId}-${l.tri}`) ? "line-in" : undefined}>
                  <circle cx={e.x + ox} cy={e.y + oy} r={10} fill={l.tri === "Y" ? "var(--ink)" : "var(--paper)"} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray={l.tri === "Y" ? undefined : "3 2"} />
                  <text x={e.x + ox} y={e.y + oy + 4.5} textAnchor="middle" fontSize={14} fontWeight={600} fill={l.tri === "Y" ? "var(--paper)" : "var(--ink)"}>
                    {i + 1}
                  </text>
                </g>
              );
            })
          : null}

      </svg>
      {storeXY && locatedLines.length > 0 ? (
        <ol className="m-0 mt-2 flex list-none flex-col p-0 text-[14px]" data-map-legend="1">
          {locatedLines.map((l, i) => (
            <li key={`lg-${l.resId}-${l.tri}`} className="flex items-start gap-2 border-b border-rule py-1.5" data-line-label={l.resId}>
              <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink text-[14px] font-semibold ${l.tri === "Y" ? "bg-ink text-paper" : "border-dashed bg-paper text-ink"}`}>{i + 1}</span>
              <span className="flex min-w-0 flex-wrap gap-x-2">
                <b className="font-semibold">{resById.get(l.resId)?.name ?? l.resId}</b>
                <span>{l.fns.map((f) => COPY.fnName[f]).join("·")}</span>
                <span className="text-pencil-ink">({l.tri === "Y" ? COPY.tri.Y : COPY.tri.U})</span>
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      {unlocatedLines.length > 0 ? (
        <figcaption className="mt-2 flex flex-wrap items-center gap-2 text-[14px]">
          <span className="text-pencil-ink">{COPY.s3.noLocation}:</span>
          {unlocatedLines.map((l) => (
            <span
              key={`${l.resId}-${l.tri}`}
              className={`max-w-full rounded-[2px] px-2 py-0.5 ${l.tri === "Y" ? "border-2 border-ink" : "border border-dashed border-pencil"}`}
              data-line={l.resId}
              data-line-tri={l.tri}
            >
              {resById.get(l.resId)?.name ?? l.resId} ({l.fns.map((f) => COPY.fnName[f]).join("·")}, {l.tri === "Y" ? COPY.tri.Y : COPY.tri.U})
            </span>
          ))}
        </figcaption>
      ) : null}
    </figure>
  );
}
