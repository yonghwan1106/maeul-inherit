// Resident ledger (S3 「선택한 주민」, S4 cards): head line laid out as parts (name, age, mode, place) +
// 「가상 인물」, one ledger line per 생활 일 (stamp / pencil hatch / blank diagonal + who carries it) and the
// 합계 line. Extra lines (B1, 4-step line, ranks, feedback) go in `children`.
import type { FnCode } from "@/lib/types";
import { COPY, f1 } from "@/lib/copy";
import type { FnRow } from "@/lib/compute";
import { Badge, TriMark, cellBg, tiltOf } from "./Badge";
import { FnIcon } from "./FnIcons";

export function countsText(y: number, u: number, n: number): string {
  const fmt = (x: number) => (Number.isInteger(x) ? String(x) : f1(x));
  return COPY.s3.mini.counts(fmt(y), fmt(u), fmt(n));
}

const fmtN = (x: number) => (Number.isInteger(x) ? String(x) : f1(x));

/** 합계 line: three cells, each with its mark, the count in 간판 글씨. */
export function Tally({
  y,
  u,
  n,
  size = 30,
  label,
  className = "",
  testAttr = true,
  stack = false,
}: {
  y: number;
  u: number;
  n: number;
  size?: number;
  label?: string;
  className?: string;
  testAttr?: boolean;
  stack?: boolean;
}) {
  const attrs = testAttr ? { "data-counts": "1" } : {};
  if (stack) {
    // narrow ledger foot: one line per value; the 끊김 line keeps its diagonal
    const row = "flex items-center justify-between gap-2 px-1.5 py-1";
    const numCls = "sign num leading-none";
    return (
      <div className={`flex flex-col ${className}`} {...attrs} aria-label={countsText(y, u, n)}>
        <span className={row}>
          <TriMark tri="Y" resident />
          <span className={numCls} style={{ fontSize: size }}>{fmtN(y)}</span>
        </span>
        <span className={`${row} border-t border-rule`}>
          <TriMark tri="U" resident />
          <span className={numCls} style={{ fontSize: size }}>{fmtN(u)}</span>
        </span>
        <span className={`${row} slash border-t border-rule`}>
          <TriMark tri="N" resident />
          <span className={`${numCls} bg-paper px-0.5`} style={{ fontSize: size }}>{fmtN(n)}</span>
        </span>
      </div>
    );
  }
  const cell = "flex min-w-0 items-center gap-2 px-2 py-1.5";
  return (
    <div className={`flex flex-wrap items-stretch ${className}`} {...attrs} aria-label={countsText(y, u, n)}>
      {label ? <span className="flex items-center pr-3 text-[14px] font-semibold text-pencil-ink">{label}</span> : null}
      <span className={`${cell} border-l border-rule`}>
        <TriMark tri="Y" resident />
        <span className="sign num leading-none" style={{ fontSize: size }}>{fmtN(y)}</span>
      </span>
      <span className={`${cell} border-l border-rule`}>
        <TriMark tri="U" resident />
        <span className="sign num leading-none" style={{ fontSize: size }}>{fmtN(u)}</span>
      </span>
      <span className={`${cell} slash border-x border-rule`}>
        <TriMark tri="N" resident />
        <span className="sign num bg-paper px-0.5 leading-none" style={{ fontSize: size }}>{fmtN(n)}</span>
      </span>
    </div>
  );
}

/** Head line made of parts (no 「A · B · C」 string): first part bold, the rest in pencil separated by space. */
export function PartsLine({ parts, as: Tag = "h3", className = "" }: { parts: readonly string[]; as?: "h2" | "h3" | "p"; className?: string }) {
  const [first, ...rest] = parts;
  return (
    <Tag className={`m-0 flex flex-wrap items-baseline gap-x-3 gap-y-0 leading-snug ${className}`}>
      <span className="text-[20px] font-semibold text-ink">{first}</span>
      {rest.map((p) => (
        <span key={p} className="text-[14px] font-medium text-pencil-ink">
          {p}
        </span>
      ))}
    </Tag>
  );
}

export function LedgerRows({ rows, flashCodes, compact = false }: { rows: FnRow[]; flashCodes?: Set<FnCode>; compact?: boolean }) {
  return (
    <table className="ledger text-[14px]">
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.code} data-fn={r.code} data-tri={r.tri}>
            <th scope="row" className={`w-[38%] py-1.5 pr-2 text-left align-middle font-semibold ${compact ? "text-[14px]" : "text-[17px]"}`}>
              <span className="inline-flex items-center gap-1.5">
                <FnIcon code={r.code} size={20} className="shrink-0 text-pencil-ink" />
                {COPY.fnName[r.code]}
              </span>
            </th>
            <td className={`vr flash-host py-1.5 pl-2 align-middle ${cellBg(r.tri)}`} data-flash={flashCodes?.has(r.code) ? "1" : "0"}>
              <span className="flex min-w-0 items-center gap-2">
                <TriMark tri={r.tri} resident land={!!flashCodes?.has(r.code) && r.tri === "Y"} tilt={tiltOf(i)} />
                {r.tri !== "N" && r.resName ? (
                  <span className="min-w-0 bg-paper/80 leading-tight">
                    <span className="block text-[14px] font-medium">{r.resName}</span>
                    {r.note ? <span className="block text-[14px] text-pencil-ink">{r.note}</span> : null}
                  </span>
                ) : null}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
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
}: {
  title: readonly string[];
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
}) {
  return (
    <section className={`min-w-0 overflow-hidden border border-rule bg-paper ${className}`} data-card={testId}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-ink px-3 py-2">
        <PartsLine parts={title} />
        {virtual ? <Badge tone="assumed">{COPY.badge.virtualPerson}</Badge> : null}
        {headerExtra}
      </div>
      <div className="px-3">
        <LedgerRows rows={rows} flashCodes={flashCodes} compact={narrow} />
      </div>
      <div className="border-t-[3px] border-double border-rule px-3 py-1">
        <Tally y={countY} u={countU} n={countN} size={narrow ? 24 : 28} label={COPY.s0.tallyLabel} />
      </div>
      {children ? <div className="px-3 pb-3">{children}</div> : null}
    </section>
  );
}
