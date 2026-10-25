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
        className="min-h-11 rounded-[3px] border-2 border-slate bg-paper px-4 py-2 text-[17px] font-semibold text-slate hover:bg-cell"
      >
        {COPY.s6.clear}
      </button>
      {done ? (
        <span role="status" className="text-[14px] text-pencil-ink">
          지웠어요. 이 브라우저에 남은 확인 결과·승인 기록·주민 제보가 없습니다.
        </span>
      ) : null}
    </div>
  );
}
