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
  const chip = "min-h-10 rounded-full border-2 px-3 text-[15px] font-semibold";
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5" data-fb-buttons="1">
      <button type="button" onClick={() => { setAsking(false); onSend("used"); }} className={`${chip} ${sent === "used" ? "border-brand bg-brand-soft text-brand" : "border-line bg-white"}`} data-fb="used">
        {COPY.s4.fb.used}
      </button>
      <button type="button" onClick={() => setAsking((v) => !v)} className={`${chip} ${sent === "failed" ? "border-warn bg-[#fbe9e4] text-warn" : "border-line bg-white"}`} data-fb="failed" aria-expanded={asking}>
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
              className={`${chip} border-dashed border-warn bg-white text-warn`}
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
