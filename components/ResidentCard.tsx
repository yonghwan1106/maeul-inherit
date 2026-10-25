// Resident card (S0 hero, S3 mini card, S4 cards, poster): name line, 「가상 인물」, 6 function cells,
// 「확실 N · 확인 중 M · 끊김 K」. Extra lines (B1, 4-step line, ranks, feedback) go in `children`.
import type { FnCode } from "@/lib/types";
import { COPY, f1 } from "@/lib/copy";
import type { FnRow } from "@/lib/compute";
import { Badge } from "./Badge";
import { FnTriCell } from "./FnIcons";

export function fnSub(r: FnRow): string | undefined {
  if (r.tri === "N" || !r.resName) return undefined;
  return r.note ? `${r.resName} · ${r.note}` : r.resName;
}

export function countsText(y: number, u: number, n: number): string {
  const fmt = (x: number) => (Number.isInteger(x) ? String(x) : f1(x));
  return COPY.s3.mini.counts(fmt(y), fmt(u), fmt(n));
}

export function ResidentCard({
  title,
  rows,
  countY,
  countU,
  countN,
  flashCodes,
  children,
  className = "",
  headerExtra,
  testId,
  virtual = true,
  narrow = false,
  countsLine,
}: {
  title: string;
  rows: FnRow[];
  countY: number;
  countU: number;
  countN: number;
  flashCodes?: Set<FnCode>;
  children?: React.ReactNode;
  className?: string;
  headerExtra?: React.ReactNode;
  testId?: string;
  virtual?: boolean;
  narrow?: boolean;
  /** replaces the default 「확실 N · 확인 중 M · 끊김 K」 line (S0 uses 「마을 가게가 닫힌 뒤: …」) */
  countsLine?: string;
}) {
  return (
    <section className={`rounded-2xl border border-line bg-card p-4 shadow-sm ${className}`} data-card={testId}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="m-0 text-[17px] font-bold leading-snug">{title}</h3>
        {virtual ? <Badge tone="assumed">{COPY.badge.virtualPerson}</Badge> : null}
        {headerExtra}
      </div>
      <div className={`mt-3 grid gap-1.5 ${narrow ? "grid-cols-3" : rows.length > 4 ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-2 sm:grid-cols-4"}`}>
        {rows.map((r) => (
          <FnTriCell key={r.code} code={r.code} tri={r.tri} sub={fnSub(r)} flash={flashCodes?.has(r.code)} />
        ))}
      </div>
      <p className="num mt-3 mb-0 text-[17px] font-bold" data-counts="1">
        {countsLine ?? countsText(countY, countU, countN)}
      </p>
      {children}
    </section>
  );
}
