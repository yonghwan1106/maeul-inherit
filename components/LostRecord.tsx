"use client";
// 「사라진 기능 기록」 as a form sheet (항목 | 내용) + JSON download (제안자 답변서 4쪽: 재창업·재유치 판단용 기록).
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
  const F = COPY.s3.lost.fields;
  const rows: [string, string][] = [
    [F.fns, fnText],
    [F.items, store.items.join("·")],
    [F.hours, store.hours],
    [F.gaps, gapText],
  ];
  return (
    <section className="min-w-0 border-t-2 border-ink pt-3" data-lost="1">
      <h2 className="m-0 text-[20px] font-semibold">{COPY.s3.lost.title}</h2>
      <dl className="m-0 mt-2 grid grid-cols-[minmax(0,8.5em)_minmax(0,1fr)] border-t border-rule text-[17px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="border-b border-rule py-1.5 pr-2 text-[14px] font-semibold text-pencil-ink">{k}</dt>
            <dd className="m-0 border-b border-l border-rule py-1.5 pl-3">{v}</dd>
          </div>
        ))}
      </dl>
      <button type="button" onClick={download} className="mt-3 min-h-11 rounded-[3px] border-2 border-slate px-4 text-[17px] font-semibold text-slate hover:bg-cell">
        {COPY.s3.lost.download}
      </button>
      <p className="mt-2 mb-0 text-[14px] text-pencil-ink">{COPY.s3.lost.note}</p>
    </section>
  );
}
