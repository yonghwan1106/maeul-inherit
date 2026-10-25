// S3 합계 lines (replace the bar chart): one ledger line per mode (차량/도보/거동 곤란) with the averages of
// stamp cells (확실), pencil cells (확인 중) and blank cells (끊김), plus 확실 몫 / 확인되면 최대. The chosen
// mode's line is marked. Values come from plan.summary (engine).
import type { Mode, ModeSummary } from "@/lib/types";
import { COPY, f1, pct } from "@/lib/copy";
import { GoneWord, PencilWord, Stamp } from "./Badge";

export function Bars({ summary, order, flash, active }: { summary: Record<Mode, ModeSummary>; order: Mode[]; flash: Set<string>; active?: Mode }) {
  const nCore = Math.max(...order.map((m) => summary[m].nCore), 0);
  const num = "sign num text-[30px] leading-none";
  return (
    <section className="min-w-0" data-bars="1" aria-labelledby="tally-title">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 id="tally-title" className="sign m-0 text-[24px] font-normal">{COPY.s3.tallyTitle}</h2>
        <p className="m-0 text-[14px] text-pencil-ink">
          {COPY.s3.barsOf(nCore)}, {COPY.s3.tallyDesc}
        </p>
      </div>
      <div className="mt-2 max-w-full overflow-x-auto">
        <table className="ledger min-w-[520px] text-[15px]">
          <thead>
            <tr>
              <th className="py-1.5 pr-2 text-[14px] text-pencil-ink">이동 유형</th>
              <th className="vr px-2 py-1.5"><Stamp size="sm" tilt={-6} /></th>
              <th className="vr hatch px-2 py-1.5"><PencilWord /></th>
              <th className="vr slash px-2 py-1.5"><GoneWord /></th>
              <th className="vr px-2 py-1.5 text-[14px] text-pencil-ink">몫</th>
            </tr>
          </thead>
          <tbody>
            {order.map((m) => {
              const s = summary[m];
              const on = m === active;
              return (
                <tr
                  key={m}
                  className={`flash-host ${on ? "bg-cell" : ""}`}
                  data-flash={flash.has(m) ? "1" : "0"}
                  data-bar={m}
                  aria-label={`${COPY.modeOfficer[m]}: ${COPY.s3.barsRight(f1(s.countY), f1(s.countU), f1(s.countN))}`}
                >
                  <th scope="row" className={`py-2 pr-2 text-left text-[17px] ${on ? "font-semibold" : "font-medium"}`}>
                    {COPY.modeOfficer[m]}
                  </th>
                  <td className="vr px-2 py-2 text-right" data-bar-text={m}>
                    <span className={num}>{f1(s.countY)}</span>
                  </td>
                  <td className="vr px-2 py-2 text-right">
                    <span className={num}>{f1(s.countU)}</span>
                  </td>
                  <td className="vr px-2 py-2 text-right">
                    <span className={num}>{f1(s.countN)}</span>
                  </td>
                  <td className="vr num px-2 py-2 text-[14px] leading-snug">
                    <span className="block">{COPY.s3.shareL(pct(s.L))}</span>
                    <span className="block text-pencil-ink">{COPY.s3.shareU(pct(s.U))}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
