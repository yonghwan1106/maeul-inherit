"use client";
// S6 「이 브라우저 기록 지우기」 — removes every mi.v1.* key (confirmations, function edits, gate records, reports, UI).
import { useState } from "react";
import { clearAll } from "@/lib/store/local";
import { COPY } from "@/lib/copy";

export function ClearButton() {
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        data-testid="s6-clear"
        onClick={() => {
          clearAll();
          setDone(true);
        }}
        className="min-h-11 rounded-xl border border-line bg-card px-4 py-2 text-[16px] font-semibold text-ink hover:border-brand hover:text-brand"
      >
        {COPY.s6.clear}
      </button>
      {done ? (
        <span role="status" className="text-[15px] text-muted">
          지웠어요. 이 브라우저에 남은 확인 결과·승인 기록·주민 제보가 없습니다.
        </span>
      ) : null}
    </div>
  );
}
