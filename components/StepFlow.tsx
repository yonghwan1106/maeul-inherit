// 6-step flow strip (답변서 4쪽) with the current screen's steps highlighted.
import Link from "next/link";
import { COPY } from "@/lib/copy";

/** steps per screen: S1 = [0], S2 = [1], S3 = [2,3], S4 = [4,5] */
export function StepFlow({ active, sid }: { active: number[]; sid?: string }) {
  const href = (i: number) => {
    if (i === 0) return "/register";
    if (!sid) return null;
    if (i === 1) return `/s/${sid}/functions`;
    if (i === 2 || i === 3) return `/s/${sid}/plan`;
    return `/s/${sid}/residents`;
  };
  return (
    <nav aria-label="6단계 흐름" className="mb-4">
      <ol className="m-0 flex list-none flex-wrap gap-1.5 p-0 text-[13px]">
        {COPY.steps.map((s, i) => {
          const on = active.includes(i);
          const h = href(i);
          const cls = `inline-block rounded-lg border px-2 py-1 no-underline ${on ? "border-brand bg-brand text-white font-bold" : "border-line bg-card text-muted"}`;
          return (
            <li key={s}>
              {h && !on ? (
                <Link href={h} className={cls}>
                  {i + 1}. {s}
                </Link>
              ) : (
                <span className={cls} aria-current={on ? "step" : undefined}>
                  {i + 1}. {s}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
