// 「기준값(가정) — 지역 사정에 맞게 담당자가 조정」 — §5.2 values as they are in lib/engine/params.ts.
import { P } from "@/lib/engine";
import { COPY, PARAM_LABELS } from "@/lib/copy";
import { Badge } from "./Badge";

export function ParamsPanel() {
  const rows = Object.entries(P) as [string, string | number][];
  return (
    <details className="rounded-2xl border border-line bg-card p-4" data-params="1">
      <summary className="cursor-pointer text-[17px] font-bold">
        {COPY.s3.params.title} <Badge tone="assumed">{COPY.badge.assumed}</Badge>
      </summary>
      <dl className="mt-3 mb-0 grid gap-x-4 gap-y-1.5 text-[15px] sm:grid-cols-[minmax(0,1fr)_auto]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{PARAM_LABELS[k] ?? k}</dt>
            <dd className="num m-0 font-semibold sm:text-right">{String(v)}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
