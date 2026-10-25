"use client";
// Officer gates 1~3 (spec 8.1): 「기능 분해 확인」 「계획 확정」 「승인(기록만)」. Records time + role in
// localStorage only (mi.v1.gate.{sid}). The next step stays locked until the gate is pressed.
import Link from "next/link";
import { COPY, hhmm } from "@/lib/copy";
import { EMPTY_GATES, keys, useLocal, type Gates } from "@/lib/store/local";

type Step = "g1" | "g2" | "g3";

export function useGates(sid: string) {
  return useLocal<Gates>(keys.gate(sid), EMPTY_GATES);
}

export function GateButton({ sid, step, note }: { sid: string; step: Step; note?: string }) {
  const [gates, setGates] = useGates(sid);
  const rec = gates[step];
  const label = COPY.gate[step];
  const recordText = rec ? (step === "g3" ? COPY.gate.approveRecord(hhmm(rec.at)) : COPY.gate.record(hhmm(rec.at))) : null;
  return (
    <div className="flex flex-wrap items-center gap-3" data-gate={step}>
      <button
        type="button"
        onClick={() => setGates((g) => ({ ...g, [step]: { at: new Date().toISOString(), role: "담당자" } }))}
        className={`inline-flex min-h-11 items-center gap-2 rounded-xl border-2 px-4 py-2 text-[16px] font-bold ${
          rec ? "border-brand bg-brand-soft text-brand" : "border-brand bg-brand text-white hover:opacity-90"
        }`}
        aria-pressed={!!rec}
      >
        <span aria-hidden="true">{rec ? "✓" : "□"}</span>
        <span>{label}</span>
      </button>
      {recordText ? (
        <span className="text-[14px] text-brand" data-gate-record={step}>
          {recordText}
        </span>
      ) : null}
      {note ? <span className="text-[14px] text-muted">{note}</span> : null}
    </div>
  );
}

/** Link to the next step; disabled with 「담당자가 확인해야 다음 단계로 갑니다」 until `step` is recorded. */
export function GatedLink({ sid, step, href, label }: { sid: string; step: Step; href: string; label: string }) {
  const [gates] = useGates(sid);
  const open = !!gates[step];
  if (!open) {
    return (
      <span className="flex flex-wrap items-center gap-2" data-next="locked">
        <span
          aria-disabled="true"
          className="inline-flex min-h-11 cursor-not-allowed items-center rounded-xl border-2 border-line px-4 py-2 text-[16px] font-semibold text-gone"
        >
          {label} →
        </span>
        <span className="text-[14px] text-muted">{COPY.gate.locked}</span>
      </span>
    );
  }
  return (
    <Link
      href={href}
      data-next="open"
      className="inline-flex min-h-11 items-center rounded-xl border-2 border-ink bg-ink px-4 py-2 text-[16px] font-semibold text-white no-underline hover:opacity-90"
    >
      {label} →
    </Link>
  );
}
