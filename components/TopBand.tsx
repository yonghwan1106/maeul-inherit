// Scenario notice (S1~S4 + poster): a pencil-bordered rectangular stamp-like note on the ledger paper.
// 「가상 시나리오입니다. 실존 가게가 문을 닫은 것이 아니며, 지역·인구·시설은 실제 공공데이터입니다.」 — no red.
import { COPY } from "@/lib/copy";

export function TopBand() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-4">
      <p
        role="note"
        className="m-0 inline-block max-w-full border-2 border-pencil px-3 py-1.5 text-[14px] font-medium leading-snug text-ink"
        style={{ boxShadow: "inset 0 0 0 2px var(--paper), inset 0 0 0 3px var(--pencil)" }}
        data-band="scenario"
      >
        {COPY.topBand}
      </p>
    </div>
  );
}
