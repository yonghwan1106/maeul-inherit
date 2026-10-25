// 「틀린 내용 거르기」 result above each generated document (spec 8.6).
import type { GroundingResult } from "@/lib/apiTypes";
import { COPY } from "@/lib/copy";

const KIND: Record<string, string> = { resource: "기관·장소", day: "요일", time: "시각", number: "숫자", phone: "전화번호", assertive: "단정 표현" };

/** `fallbackReason` set (no key, limit, network…) = template because AI was not called, not because text was blocked. */
export function GroundingPanel({ grounding, template, fallbackReason }: { grounding: GroundingResult | null | undefined; template: boolean; fallbackReason?: string | null }) {
  if (!grounding) return null;
  if (template && (grounding.blocked.length > 0 || !fallbackReason)) {
    return (
      <p className="m-0 rounded-xl border-2 border-dashed border-warn bg-[#fbe9e4] px-3 py-2 text-[15px] font-semibold text-warn" data-grounding="template">
        {COPY.s4.grounding.blocked}
      </p>
    );
  }
  return (
    <details className="rounded-xl border border-brand/40 bg-brand-soft px-3 py-2" data-grounding={grounding.pass ? "pass" : "blocked"}>
      <summary className="cursor-pointer text-[15px] font-semibold text-brand">{COPY.s4.grounding.pass(grounding.checked.length)}</summary>
      <ul className="mt-2 mb-0 flex list-none flex-wrap gap-1.5 p-0 text-[14px]">
        {grounding.checked.map((c, i) => (
          <li key={`${c.kind}-${c.value}-${i}`} className={`rounded-lg border px-2 py-0.5 ${c.ok ? "border-brand/40 bg-white" : "border-warn bg-[#fbe9e4] text-warn"}`}>
            {KIND[c.kind] ?? c.kind}: {c.value} {c.ok ? "✓" : "✕"}
          </li>
        ))}
      </ul>
    </details>
  );
}
