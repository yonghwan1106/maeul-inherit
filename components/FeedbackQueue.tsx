"use client";
// S3 「주민 제보 {n}건」 queue. A report never changes the 3 values; 「담당자 확인으로 반영」 opens the
// confirmation input of the related cell, and only the officer's input changes the plan.
import { useState } from "react";
import type { CellDef, Confirmation, Region, Tri } from "@/lib/types";
import type { Feedback } from "@/lib/store/local";
import { COPY } from "@/lib/copy";
import { resName } from "@/lib/view";
import { Badge } from "./Badge";
import { ConfirmControls } from "./VoiCard";

/** The confirmation cell a report is about (stop at the resident's point > area of the village > hubdrop > cap > open). */
export function cellForFeedback(region: Region, registry: Map<string, CellDef>, fb: Feedback): CellDef | null {
  const village = region.points.find((p) => p.id === fb.pointId)?.villageId;
  const defs = Array.from(registry.values()).filter((d) => d.resId === fb.resId);
  return (
    defs.find((d) => d.kind === "stop" && d.pointId === fb.pointId) ??
    defs.find((d) => d.kind === "stop" && d.villageId === village) ??
    defs.find((d) => d.kind === "area" && d.villageId === village) ??
    defs.find((d) => d.kind === "hubdrop") ??
    defs.find((d) => d.kind === "cap" && d.fn && fb.fns.includes(d.fn)) ??
    defs.find((d) => d.kind === "open") ??
    null
  );
}

export function FeedbackQueue({
  region,
  registry,
  fb,
  conf,
  onSet,
  onHandled,
}: {
  region: Region;
  registry: Map<string, CellDef>;
  fb: Feedback[];
  conf: Confirmation[];
  onSet: (cellKey: string, value: Tri | null, note: string, by: Confirmation["by"]) => void;
  onHandled: (id: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="rounded-2xl border border-line bg-card p-4" data-reports={fb.length}>
      <h2 className="m-0 text-[18px] font-bold">{COPY.s3.reports.title(fb.length)}</h2>
      {fb.length === 0 ? <p className="mt-2 mb-0 text-[16px] text-muted">{COPY.s3.reports.none}</p> : null}
      <ul className="m-0 mt-2 flex list-none flex-col gap-3 p-0">
        {fb.map((f) => {
          const fnText = f.fns.map((c) => COPY.fnName[c]).join("·");
          const line =
            f.kind === "failed"
              ? COPY.s3.reports.line(f.residentName, resName(region, f.resId), fnText, f.reason ?? "기타")
              : COPY.s3.reports.usedLine(f.residentName, resName(region, f.resId), fnText);
          const def = cellForFeedback(region, registry, f);
          return (
            <li key={f.id} className="rounded-xl border border-line p-3" data-report={f.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="report">{COPY.badge.residentReport}</Badge>
                <span className="text-[16px]">{line}</span>
              </div>
              {f.kind === "failed" && def ? (
                open === f.id ? (
                  <div className="mt-2 rounded-xl bg-paper p-3">
                    <p className="m-0 text-[16px] font-semibold">{def.label}</p>
                    <ConfirmControls
                      cellKey={def.key}
                      realNamed={def.realNamed}
                      current={conf.find((c) => c.cellKey === def.key)}
                      onSet={(v, note, by) => {
                        onSet(def.key, v, note, by);
                        onHandled(f.id);
                      }}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpen(f.id)}
                    className="mt-2 min-h-11 rounded-xl border-2 border-brand px-3 text-[15px] font-semibold text-brand"
                    data-apply={f.id}
                  >
                    {COPY.s3.reports.apply}
                  </button>
                )
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
