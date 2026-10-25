"use client";
// 「사라진 기능 기록」 card + JSON download (제안자 답변서 4쪽: 재창업·재유치 판단용 기록).
import type { FunctionPiece, Store } from "@/lib/types";
import { COPY } from "@/lib/copy";

export interface LostGap { fn: string; mode: string }

export function LostRecord({ sid, store, fns, gaps }: { sid: string; store: Store; fns: FunctionPiece[]; gaps: LostGap[] }) {
  const on = fns.filter((f) => f.enabled);
  const fnText = on.map((f) => COPY.fnName[f.code]).join("·") || "—";
  const gapText = gaps.length ? gaps.map((g) => COPY.s3.gaps.line(g.fn, g.mode)).join(", ") : COPY.s3.gaps.none;
  const download = () => {
    const rec = {
      kind: "사라진 기능 기록",
      scenarioId: sid,
      virtual: true,
      store: { name: store.name, villageId: store.villageId, sbizSub: store.sbizSub, items: store.items, hours: store.hours },
      functions: on.map((f) => ({ code: f.code, name: COPY.fnName[f.code], importance: f.importance, evidence: f.evidence })),
      gapsNow: gaps,
      savedAt: new Date().toISOString(),
      note: COPY.s3.lost.note,
    };
    try {
      const blob = new Blob([JSON.stringify(rec, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lost-functions-${sid}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      /* download not available (preview) */
    }
  };
  return (
    <section className="rounded-2xl border border-line bg-card p-4" data-lost="1">
      <h2 className="m-0 text-[18px] font-bold">{COPY.s3.lost.title}</h2>
      <p className="mt-2 mb-0 text-[16px] leading-relaxed">{COPY.s3.lost.body(fnText, store.items.join("·"), store.hours, gapText)}</p>
      <button type="button" onClick={download} className="mt-3 min-h-11 rounded-xl border-2 border-ink px-4 text-[16px] font-semibold">
        {COPY.s3.lost.download}
      </button>
      <p className="mt-2 mb-0 text-[13px] text-muted">{COPY.s3.lost.note}</p>
    </section>
  );
}
