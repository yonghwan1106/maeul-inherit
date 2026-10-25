// S3 bars, one row per mode (차량/도보/거동 곤란): filled = 확실, hatched+dashed = 확인 중, empty = 끊김.
import type { Mode, ModeSummary } from "@/lib/types";
import { COPY, f1, pct } from "@/lib/copy";

export function Bars({ summary, order, flash }: { summary: Record<Mode, ModeSummary>; order: Mode[]; flash: Set<string> }) {
  return (
    <div className="flex flex-col gap-4" data-bars="1">
      {order.map((m) => {
        const s = summary[m];
        const n = Math.max(s.nCore, 1);
        const wy = (s.countY / n) * 100;
        const wu = (s.countU / n) * 100;
        return (
          <div key={m} className="flash-host rounded-xl" data-flash={flash.has(m) ? "1" : "0"} data-bar={m}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-[18px] font-bold">{COPY.modeOfficer[m]}</span>
              <span className="num text-[17px] font-bold" data-bar-text={m}>
                {COPY.s3.barsRight(f1(s.countY), f1(s.countU), f1(s.countN))}
              </span>
            </div>
            <div className="mt-1.5 flex h-7 w-full overflow-hidden rounded-lg border-2 border-line bg-white" role="img"
              aria-label={`${COPY.modeOfficer[m]}: ${COPY.s3.barsRight(f1(s.countY), f1(s.countU), f1(s.countN))}`}>
              <div className="fx h-full bg-sure" style={{ width: `${wy}%` }} />
              <div
                className="fx h-full border-y-0 border-l-0"
                style={{
                  width: `${wu}%`,
                  background: "repeating-linear-gradient(135deg, var(--unsure-soft) 0 6px, #f0d29e 6px 9px)",
                  borderRight: wu > 0 ? "2px dashed var(--unsure)" : undefined,
                }}
              />
            </div>
            <p className="num mt-1 mb-0 text-[13px] text-muted">
              {COPY.s3.barsOf(s.nCore)} · {COPY.s3.barsSmall(pct(s.L), pct(s.U))}
            </p>
          </div>
        );
      })}
    </div>
  );
}
