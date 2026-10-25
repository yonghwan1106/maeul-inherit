// Logo + site header (spec 8.1: 「이어받는 마을 — 가게가 닫혀도」 / 「아이디어 챌린지 4번 「기능상속」 구현작」).
import Link from "next/link";
import { COPY } from "@/lib/copy";

export function LogoMark({ size = 36 }: { size?: number }) {
  // A house roof whose ridge continues into three branches — the shop's work passed on.
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="9" fill="var(--brand)" />
      <path d="M9 21l11-9 11 9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 20v9h14v-9" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="20" cy="25" r="2.2" fill="#f5c84c" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2.5 no-underline">
      <LogoMark />
      <span className="min-w-0">
        <span className="block text-[17px] font-bold leading-tight text-ink">{COPY.logo}</span>
        <span className="block text-[12px] leading-tight text-muted">{COPY.logoSub}</span>
      </span>
    </Link>
  );
}

/** Header used by every screen. `right` = mode badge etc. */
export function SiteHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Logo />
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-muted">
          <Link href="/register" className="hover:text-ink">{COPY.nav.s1}</Link>
          <Link href="/eval" className="hover:text-ink">{COPY.nav.s5}</Link>
          <Link href="/about" className="hover:text-ink">{COPY.nav.s6}</Link>
          {right}
        </nav>
      </div>
    </header>
  );
}
