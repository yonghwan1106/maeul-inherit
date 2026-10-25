// 「누가 어떤 일을 이어받나」 — the S3 ledger: one line per 생활 일, one column per place that takes over work.
// 확실 = 인주 stamp, 확인 중 = pencil hatch + 「확인 중」, 빈칸 = that place does not take it; a line with no
// place at all is 끊김 (every cell crossed by a thin diagonal + 「끊김」 at the line head).
// Below 640 px the same table folds into a two-column line list 「생활 일 | 이어받을 곳(표시 + 기관 이름)」 (the S0
// mobile grammar): blank cells drop out, the places of one line stack inside it, and nothing scrolls sideways.
// The data-table / data-row / data-cell / data-tri hooks stay on the very same elements in both layouts.
import type { FnCode, PlanVM, Region, Tri } from "@/lib/types";
import { COPY } from "@/lib/copy";
import { srcLabel } from "@/lib/view";
import { Badge, GoneWord, PencilWord, Stamp, tiltOf } from "./Badge";
import { FnIcon } from "./FnIcons";

export function cellTri(vm: PlanVM | undefined, fn: FnCode, resId: string): Tri {
  const a = vm?.byFn[fn]?.find((x) => x.resId === resId);
  return a ? a.tri : "N";
}

export function tableColumns(vm: PlanVM | undefined): string[] {
  if (!vm) return [];
  const ids = new Set<string>(vm.set);
  for (const list of Object.values(vm.byFn)) for (const a of list ?? []) ids.add(a.resId);
  return Array.from(ids);
}

export function TableLegend() {
  const L = COPY.s3.table.legend;
  return (
    <ul className="m-0 flex list-none flex-wrap items-center gap-x-5 gap-y-2 p-0 text-[14px] text-ink max-sm:gap-x-3">
      <li className="flex items-center gap-2">
        <Stamp size="sm" word={L.Y} tilt={-6} />
      </li>
      <li className="flex items-center gap-2">
        <span className="hatch inline-flex items-center border border-rule px-1.5 py-1">
          <PencilWord>{L.U}</PencilWord>
        </span>
      </li>
      <li className="flex items-center gap-2">
        <span className="swatch slash" aria-hidden="true" />
        <span>{L.gone}</span>
      </li>
      {/* the folded list has no blank cells, so 「빈칸」 is explained only where the grid shows them */}
      <li className="flex items-center gap-2 max-sm:hidden">
        <span className="swatch" aria-hidden="true" />
        <span>{L.blank}</span>
      </li>
    </ul>
  );
}

const FOLD_CELL =
  "max-sm:col-start-2 max-sm:flex max-sm:h-auto max-sm:min-h-[52px] max-sm:items-center max-sm:gap-3 max-sm:border-b-0 max-sm:border-l max-sm:px-2 max-sm:py-1.5 max-sm:text-left";

export function FnResourceTable({ region, vm, fns, flash }: { region: Region; vm: PlanVM | undefined; fns: FnCode[]; flash: Set<string> }) {
  const cols = tableColumns(vm);
  const res = new Map(region.resources.map((r) => [r.id, r]));
  return (
    <section className="min-w-0" aria-labelledby="fn-res-title">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <h2 id="fn-res-title" className="sign m-0 text-[30px] font-normal leading-tight max-sm:text-[24px]">{COPY.s3.table.title}</h2>
        <TableLegend />
      </div>
      {/* between 640 px and 1024 px the grid can still be wider than the screen; below 640 px it folds instead */}
      {cols.length > 3 ? (
        <p className="m-0 mt-2 hidden text-[14px] font-semibold text-pencil-ink sm:block lg:hidden" data-scroll-hint="s3-table">
          {COPY.s3.table.scrollHint}
        </p>
      ) : null}
      <div className="mt-3 max-w-full overflow-x-auto border-y-2 border-ink max-sm:mt-2 max-sm:overflow-visible">
        <table className="ledger text-[14px] max-sm:block" data-table="fn-res">
          <thead className="max-sm:hidden">
            <tr>
              <th className="sticky left-0 z-10 min-w-[112px] bg-paper px-2 py-2 text-[14px] text-pencil-ink">{COPY.s3.table.colFn}</th>
              {cols.map((id) => {
                const r = res.get(id);
                return (
                  <th key={id} className="vr min-w-[120px] px-2 py-2 align-bottom" data-col={id}>
                    <span className="block text-[17px] leading-snug">{r?.name ?? id}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      <Badge>{srcLabel(r)}</Badge>
                      {r?.judgeUnknown ? <Badge tone="warn">{COPY.badge.judgeUnknown}</Badge> : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="max-sm:block">
            {fns.map((fn, ri) => {
              const gone = cols.every((id) => cellTri(vm, fn, id) === "N");
              return (
                <tr
                  key={fn}
                  data-row={fn}
                  data-row-gone={gone ? "1" : "0"}
                  className="max-sm:grid max-sm:grid-cols-[104px_minmax(0,1fr)] max-sm:border-b max-sm:border-rule max-sm:last:border-b-0"
                >
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-paper px-2 py-2 text-left max-sm:static max-sm:z-auto max-sm:border-b-0 max-sm:pl-0 max-sm:[grid-row:1/span_12]"
                  >
                    <span className="flex flex-col items-start gap-0.5">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[17px] font-semibold">
                        <FnIcon code={fn} size={20} className="text-pencil-ink" />
                        {COPY.fnName[fn]}
                      </span>
                      {gone ? <GoneWord className="border border-ink max-sm:hidden">{COPY.s3.table.gone}</GoneWord> : null}
                    </span>
                  </th>
                  {cols.map((id, ci) => {
                    const t = cellTri(vm, fn, id);
                    const k = `${fn}|${id}`;
                    const fl = flash.has(k);
                    const r = res.get(id);
                    return (
                      <td
                        key={id}
                        className={`vr flash-host h-[64px] px-2 py-1 text-center align-middle ${t === "U" ? "hatch" : gone ? "slash" : ""} ${
                          t === "N" ? "max-sm:hidden" : FOLD_CELL
                        }`}
                        data-flash={fl ? "1" : "0"}
                        data-cell={k}
                        data-tri={t}
                      >
                        {t === "Y" ? (
                          <Stamp size="sm" land={fl} tilt={tiltOf(ri + ci)} />
                        ) : t === "U" ? (
                          <PencilWord>{COPY.tri.U}</PencilWord>
                        ) : (
                          <span className="sr-only">{COPY.tri.N}</span>
                        )}
                        {t !== "N" ? (
                          <span className="bg-paper px-1 text-[17px] font-medium leading-snug sm:hidden" aria-hidden="true">
                            {r?.name ?? id}
                          </span>
                        ) : null}
                      </td>
                    );
                  })}
                  {gone ? (
                    // folded list only: one 끊김 cell instead of a row of crossed blanks
                    <td className={`slash hidden ${FOLD_CELL}`} aria-hidden="true">
                      <GoneWord className="border border-ink">{COPY.s3.table.gone}</GoneWord>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* folded list only: where each place comes from (출처·판별 표기 stay on screen, as in the grid head) */}
      <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-[14px] sm:hidden" aria-label={COPY.s3.table.placesTitle}>
        {cols.map((id) => {
          const r = res.get(id);
          return (
            <li key={id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-ink">{r?.name ?? id}</span>
              <Badge>{srcLabel(r)}</Badge>
              {r?.judgeUnknown ? <Badge tone="warn">{COPY.badge.judgeUnknown}</Badge> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
