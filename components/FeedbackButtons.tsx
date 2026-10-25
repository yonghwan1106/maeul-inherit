"use client";
// S4 resident feedback per resource row: 「이용해 봤어요」 / 「안 됐어요」 → reason chips → toast.
// Saved in this browser only (mi.v1.fb.{sid}); it shows up in the S3 queue and never changes the 3 values.
import { useState } from "react";
import type { FnCode } from "@/lib/types";
import { COPY } from "@/lib/copy";

export function FeedbackButtons({
  onSend,
  sent,
}: {
  onSend: (kind: "used" | "failed", reason?: string) => void;
  sent?: "used" | "failed";
}) {
  const [asking, setAsking] = useState(false);
  const chip = "min-h-11 rounded-[3px] border-2 px-3 text-[17px] font-semibold";
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5" data-fb-buttons="1">
      <button type="button" onClick={() => { setAsking(false); onSend("used"); }} className={`${chip} ${sent === "used" ? "border-slate-deep bg-slate text-paper" : "border-slate bg-paper text-slate hover:bg-cell"}`} data-fb="used">
        {COPY.s4.fb.used}
      </button>
      <button type="button" onClick={() => setAsking((v) => !v)} className={`${chip} ${sent === "failed" ? "border-slate-deep bg-slate text-paper" : "border-slate bg-paper text-slate hover:bg-cell"}`} data-fb="failed" aria-expanded={asking}>
        {COPY.s4.fb.failed}
      </button>
      {asking
        ? COPY.s4.fb.reasons.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setAsking(false);
                onSend("failed", r);
              }}
              className={`${chip} border-dashed border-ink bg-paper text-ink hover:bg-cell`}
              data-fb-reason={r}
            >
              {r}
            </button>
          ))
        : null}
    </div>
  );
}

export type { FnCode };
