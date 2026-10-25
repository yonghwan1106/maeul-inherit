// Function icons F01~F10 (inline SVG, no icon library) and the 3-value icon cell used on cards.
import type { FnCode, Tri } from "@/lib/types";
import { COPY } from "@/lib/copy";

const P: Record<FnCode, React.ReactNode> = {
  // 장보기 — basket
  F01: (
    <>
      <path d="M4 10h16l-1.6 9H5.6z" />
      <path d="M8 10l3-6M16 10l-3-6" />
      <path d="M9 14v2M12 14v2M15 14v2" />
    </>
  ),
  // 신선식품 — leaf
  F02: (
    <>
      <path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14z" />
      <path d="M5 19l8-8" />
    </>
  ),
  // 고기·생선 — fish
  F03: (
    <>
      <path d="M3 12c3-4 7-5 11-5 3 0 5 2 6 5-1 3-3 5-6 5-4 0-8-1-11-5z" />
      <path d="M3 12l-1-3M3 12l-1 3" />
      <circle cx="16" cy="11" r="0.8" />
    </>
  ),
  // 급할 때 — clock
  F04: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  // 생활용품 — bottle
  F05: (
    <>
      <path d="M10 3h4v3l2 3v11H8V9l2-3z" />
      <path d="M8 13h8" />
    </>
  ),
  // 택배 — parcel
  F06: (
    <>
      <path d="M3 8l9-4 9 4v9l-9 4-9-4z" />
      <path d="M3 8l9 4 9-4M12 12v9" />
    </>
  ),
  // 배달 — scooter
  F07: (
    <>
      <circle cx="6" cy="17" r="2.5" />
      <circle cx="18" cy="17" r="2.5" />
      <path d="M8.5 17h6l2-6h-4M14 5h3l1.5 6M4 12h5" />
    </>
  ),
  // 돈 찾기 — coin
  F08: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8 9l1.5 6 2.5-5 2.5 5 1.5-6M7.5 12h9" />
    </>
  ),
  // 사랑방 — bench
  F09: (
    <>
      <path d="M4 11h16M5 15h14M6 15v4M18 15v4M6 11V7h12v4" />
    </>
  ),
  // 안부 — speech bubble with heart
  F10: (
    <>
      <path d="M4 5h16v11H10l-4 4v-4H4z" />
      <path d="M12 13.5l-2.3-2.2a1.4 1.4 0 012-2l.3.3.3-.3a1.4 1.4 0 012 2z" />
    </>
  ),
};

export function FnIcon({ code, size = 24, className }: { code: FnCode; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {P[code]}
    </svg>
  );
}

const TRI_CLASS: Record<Tri, string> = { Y: "tri-y", U: "tri-u", N: "tri-n" };

/**
 * One function cell in a 3-value row: icon + name + state word (never colour-only).
 * `sub` = who carries it (e.g. 「이동장터 A · 화요일 오전」).
 */
export function FnTriCell({
  code,
  tri,
  sub,
  flash,
  resident = true,
}: {
  code: FnCode;
  tri: Tri;
  sub?: string;
  flash?: boolean;
  resident?: boolean;
}) {
  const word = (resident ? COPY.triResident : COPY.tri)[tri];
  return (
    <div
      className={`flash-host flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-center ${TRI_CLASS[tri]}`}
      data-flash={flash ? "1" : "0"}
      data-fn={code}
      data-tri={tri}
    >
      <FnIcon code={code} size={22} />
      <span className="text-[13px] font-semibold leading-tight">{COPY.fnName[code]}</span>
      <span className="text-[12px] leading-tight">{tri === "Y" ? "● " : tri === "U" ? "◐ " : "— "}{word}</span>
      {sub ? <span className="line-clamp-2 text-[11px] leading-tight opacity-90">{sub}</span> : null}
    </div>
  );
}
