"use client";
// Officer gates 1~3 (spec 8.1) drawn as a 결재란: 담당(g1 「기능 분해 확인」) · 확인(g2 「계획 확정」) · 승인(g3 「승인(기록만)」).
// Each screen presses its own box; the others show their state. Only the 승인 box gets the red 인주 stamp —
// 담당·확인 get a ballpen ring. Records time + role in localStorage only (mi.v1.gate.{sid}).
import Link from "next/link";
import { useState } from "react";
import { COPY, hhmm } from "@/lib/copy";
import { EMPTY_GATES, keys, useLocal, type Gates } from "@/lib/store/local";
import { Stamp } from "./Badge";

type Step = "g1" | "g2" | "g3";
const STEPS: Step[] = ["g1", "g2", "g3"];

export function useGates(sid: string) {
  return useLocal<Gates>(keys.gate(sid), EMPTY_GATES);
}

function DoneMark({ step, land }: { step: Step; land?: boolean }) {
  if (step === "g3") return <Stamp word={COPY.gate.stampWord} size="md" tilt={-8} land={land} />;
  return (
    <span className={`inline-flex h-[2.6em] w-[2.6em] -rotate-6 items-center justify-center rounded-full border-2 border-ink text-[14px] font-semibold text-ink ${land ? "stamp-land" : ""}`}>
      {COPY.gate.box[step]}
    </span>
  );
}

/** The 결재란 with this screen's box pressable. `note` is shown under the box. */
export function GateButton({ sid, step, note }: { sid: string; step: Step; note?: string }) {
  const [gates, setGates] = useGates(sid);
  const [pressed, setPressed] = useState(false); // the stamp lands only in answer to a press, not on reload
  const rec = gates[step];
  const recordText = rec ? (step === "g3" ? COPY.gate.approveRecord(hhmm(rec.at)) : COPY.gate.record(hhmm(rec.at))) : null;
  return (
    <div className="flex flex-col gap-2">
      <table className="w-max max-w-full border-collapse border-2 border-ink bg-paper" aria-label={COPY.gate.boxTitle}>
        <tbody>
          <tr>
            <th rowSpan={2} scope="row" className="w-9 border-r-2 border-ink px-1 text-center text-[15px] font-semibold" style={{ writingMode: "vertical-rl", letterSpacing: "0.4em" }}>
              {COPY.gate.boxTitle}
            </th>
            {STEPS.map((g) => (
              <th key={g} scope="col" className={`w-[92px] border-b border-l border-ink px-1 py-0.5 text-center text-[14px] font-semibold sm:w-[112px] ${g === step ? "bg-cell" : ""}`}>
                {COPY.gate.box[g]}
              </th>
            ))}
          </tr>
          <tr>
            {STEPS.map((g) => {
              const r = gates[g];
              if (g === step) {
                return (
                  <td key={g} className="h-[104px] border-l border-ink p-1 text-center align-middle" data-gate={step}>
                    <button
                      type="button"
                      onClick={() => {
                        setPressed(true);
                        setGates((x) => ({ ...x, [step]: { at: new Date().toISOString(), role: "담당자" } }));
                      }}
                      className={`inline-flex min-h-11 w-full flex-col items-center justify-center rounded-[3px] px-1 py-1 text-[15px] font-semibold leading-tight ${
                        rec ? "bg-transparent text-ink" : "border-2 border-slate-deep bg-slate text-paper hover:bg-slate-deep"
                      }`}
                      aria-pressed={!!rec}
                      aria-label={COPY.gate[step]}
                    >
                      {rec ? <DoneMark step={step} land={pressed} /> : <span>{COPY.gate[step]}</span>}
                    </button>
                  </td>
                );
              }
              return (
                <td key={g} className="h-[104px] border-l border-ink p-1 text-center align-middle" data-gate-view={g}>
                  {r ? <DoneMark step={g} /> : <span className="text-[14px] text-pencil-ink">{COPY.gate.waiting}</span>}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {recordText ? (
          <span className="text-[15px] font-medium text-ink" data-gate-record={step}>
            {recordText}
          </span>
        ) : null}
        {step === "g3" && !rec ? <span className="text-[15px] font-semibold text-ink">{COPY.gate.beforeApprove}</span> : null}
        {note ? <span className="text-[15px] text-pencil-ink">{note}</span> : null}
      </div>
    </div>
  );
}

/** Link to the next step; disabled with 「담당자가 확인해야 다음 단계로 갑니다」 until `step` is recorded. */
export function GatedLink({ sid, step, href, label }: { sid: string; step: Step; href: string; label: string }) {
  const [gates] = useGates(sid);
  const open = !!gates[step];
  if (!open) {
    return (
      <span className="flex flex-wrap items-center gap-3 self-start" data-next="locked">
        <span
          aria-disabled="true"
          className="inline-flex min-h-12 cursor-not-allowed items-center rounded-[3px] border-2 border-dashed border-pencil px-5 text-[17px] font-semibold text-pencil-ink"
        >
          {label}
        </span>
        <span className="text-[15px] text-pencil-ink">{COPY.gate.locked}</span>
      </span>
    );
  }
  return (
    <Link
      href={href}
      data-next="open"
      className="inline-flex min-h-12 items-center self-start rounded-[3px] border-2 border-slate-deep bg-slate px-5 text-[17px] font-semibold text-paper no-underline hover:bg-slate-deep"
    >
      {label}
    </Link>
  );
}
