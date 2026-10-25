// Site header: a slate signboard plate with the two-line name 「이어받는 마을 / 가게가 닫혀도」 (도현체),
// the sub line 「아이디어 챌린지 4번 「기능상속」 구현작」 and the three links, closed by a double ledger rule.
import Link from "next/link";
import { COPY } from "@/lib/copy";

export function Signboard({ size = "md" }: { size?: "md" | "lg" | "xl" }) {
  const [a, b] = COPY.sign;
  const big = size === "xl" ? "text-[72px]" : size === "lg" ? "text-[38px]" : "text-[24px] sm:text-[30px]";
  const small = size === "xl" ? "text-[34px]" : size === "lg" ? "text-[20px]" : "text-[17px]";
  return (
    <span className="inline-flex flex-col rounded-[2px] border-2 border-slate-deep bg-slate px-3 pt-1.5 pb-1 text-paper" style={{ boxShadow: "inset 0 0 0 2px var(--slate), inset 0 0 0 3px rgba(246,247,243,0.55)" }}>
      <span className={`sign block leading-[1.05] ${big}`}>{a}</span>
      <span className={`sign block leading-[1.15] opacity-95 ${small}`}>{b}</span>
    </span>
  );
}

export function Logo() {
  return (
    <Link href="/" className="inline-flex min-w-0 no-underline" aria-label={COPY.logo}>
      <Signboard />
    </Link>
  );
}

/** Header used by every screen. `right` = mode badge etc. */
export function SiteHeader({ right }: { right?: React.ReactNode }) {
  const nav = "inline-flex min-h-11 min-w-11 items-center justify-center px-1 text-[17px] font-medium text-slate underline-offset-4 hover:underline";
  return (
    <header className="rule-double bg-paper">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-end justify-between gap-x-6 gap-y-2 px-4 pt-4 pb-3">
        <div className="flex min-w-0 flex-wrap items-end gap-x-4 gap-y-1">
          <Logo />
          <span className="pb-1 text-[14px] leading-snug text-pencil-ink">{COPY.logoSub}</span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-0" aria-label="화면">
          <Link href="/register" className={nav}>{COPY.nav.s1}</Link>
          <Link href="/eval" className={nav}>{COPY.nav.s5}</Link>
          <Link href="/about" className={nav}>{COPY.nav.s6}</Link>
          {right}
        </nav>
      </div>
    </header>
  );
}
