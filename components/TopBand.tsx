// Scenario band (S1~S4 + poster): 「가상 시나리오 — 실존 가게의 폐업이 아닙니다. …」
import { COPY } from "@/lib/copy";

export function TopBand() {
  return (
    <div role="note" className="bg-band px-4 py-2 text-center text-[14px] font-medium leading-snug text-white" data-band="scenario">
      {COPY.topBand}
    </div>
  );
}
