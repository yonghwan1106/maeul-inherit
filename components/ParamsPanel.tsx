// 「기준값(가정)」 / 「지역 사정에 맞게 담당자가 조정」 — §5.2 values as they are in lib/engine/params.ts.
import { P } from "@/lib/engine";
import { COPY, PARAM_LABELS } from "@/lib/copy";
import { Badge } from "./Badge";

export function ParamsPanel() {
  const rows = Object.entries(P) as [string, string | number][];
  return (
    <details className="min-w-0 border-t-2 border-ink pt-3" data-params="1">
      <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[20px] font-semibold">{COPY.s3.params.title}</span>
        <Badge tone="assumed">{COPY.badge.assumed}</Badge>
        <span className="text-[14px] text-pencil-ink">{COPY.s3.params.desc}</span>
      </summary>
      <table className="ledger mt-2 text-[14px]">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th scope="row" className="py-1.5 pr-2 text-left font-medium text-pencil-ink">{PARAM_LABELS[k] ?? k}</th>
              <td className={`vr py-1.5 pl-3 font-semibold break-words ${typeof v === "number" ? "num text-right" : "text-left font-medium"}`}>{String(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
