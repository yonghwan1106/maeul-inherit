// 처리 경로 (답변서 4쪽 6단계): cells joined like a 결재 경로 strip. The current step = ballpen border on slate,
// past steps carry a small pencil check stamp. Numbers stay because the order is real.
import Link from "next/link";
import { COPY } from "@/lib/copy";

/** steps per screen: S1 = [0], S2 = [1], S3 = [2,3], S4 = [4,5]; `active` empty on S0 (whole route) */
export function StepFlow({ active, sid, className = "mb-5" }: { active: number[]; sid?: string; className?: string }) {
  const href = (i: number) => {
    if (i === 0) return "/register";
    if (!sid) return null;
    if (i === 1) return `/s/${sid}/functions`;
    if (i === 2 || i === 3) return `/s/${sid}/plan`;
    return `/s/${sid}/residents`;
  };
  const first = active.length ? Math.min(...active) : -1;
  return (
    <nav aria-label={COPY.stepsTitle} className={className}>
      <ol className="m-0 grid list-none grid-cols-3 border-t border-l border-rule p-0 sm:grid-cols-6">
        {COPY.steps.map((s, i) => {
          const on = active.includes(i);
          const past = first > 0 && i < first;
          const h = href(i);
          const cls = `flex h-full min-h-14 flex-col justify-between gap-0.5 border-r border-b px-2 py-1.5 no-underline ${
            on ? "relative z-[1] -m-px border-2 border-ink bg-slate text-paper" : "border-rule bg-paper text-ink hover:bg-cell"
          }`;
          const body = (
            <>
              <span className="flex items-center justify-between gap-1">
                <span className={`num text-[14px] font-semibold ${on ? "text-paper" : "text-pencil-ink"}`}>{i + 1}</span>
                {past ? (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-pencil text-[14px] leading-none text-pencil-ink" aria-label={COPY.pastStep}>
                    ✓
                  </span>
                ) : null}
              </span>
              <span className={`text-[14px] leading-snug ${on ? "font-semibold" : "font-medium"}`}>{s}</span>
            </>
          );
          return (
            <li key={s} className="min-w-0">
              {h && !on ? (
                <Link href={h} className={cls}>
                  {body}
                </Link>
              ) : (
                <span className={cls} aria-current={on ? "step" : undefined}>
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
