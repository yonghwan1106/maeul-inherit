// 「누가 어떤 일을 이어받나」 — the S3 ledger: one line per 생활 일, one column per place that takes over work.
// 확실 = 인주 stamp, 확인 중 = pencil hatch + 「확인 중」, 빈칸 = that place does not take it; a line with no
// place at all is 끊김 (every cell crossed by a thin diagonal + 「끊김」 at the line head).
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
    <ul className="m-0 flex list-none flex-wrap items-center gap-x-5 gap-y-2 p-0 text-[14px] text-ink">
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
      <li className="flex items-center gap-2">
        <span className="swatch" aria-hidden="true" />
        <span>{L.blank}</span>
      </li>
    </ul>
  );
}

export function FnResourceTable({ region, vm, fns, flash }: { region: Region; vm: PlanVM | undefined; fns: FnCode[]; flash: Set<string> }) {
  const cols = tableColumns(vm);
  const res = new Map(region.resources.map((r) => [r.id, r]));
  return (
    <section className="min-w-0" aria-labelledby="fn-res-title">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <h2 id="fn-res-title" className="sign m-0 text-[30px] font-normal leading-tight">{COPY.s3.table.title}</h2>
        <TableLegend />
      </div>
      {cols.length > 2 ? <p className="m-0 mt-2 text-[14px] font-semibold text-pencil-ink sm:hidden">{COPY.s3.table.scrollHint}</p> : null}
      <div className="mt-3 max-w-full overflow-x-auto border-y-2 border-ink">
        <table className="ledger text-[15px]" data-table="fn-res">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[112px] bg-paper px-2 py-2 text-[14px] text-pencil-ink">{COPY.s3.table.colFn}</th>
              {cols.map((id) => {
                const r = res.get(id);
                return (
                  <th key={id} className="vr min-w-[120px] px-2 py-2 align-bottom" data-col={id}>
                    <span className="block text-[15px] leading-snug">{r?.name ?? id}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      <Badge>{srcLabel(r)}</Badge>
                      {r?.judgeUnknown ? <Badge tone="warn">{COPY.badge.judgeUnknown}</Badge> : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {fns.map((fn, ri) => {
              const gone = cols.every((id) => cellTri(vm, fn, id) === "N");
              return (
                <tr key={fn} data-row={fn} data-row-gone={gone ? "1" : "0"}>
                  <th scope="row" className="sticky left-0 z-10 bg-paper px-2 py-2 text-left">
                    <span className="flex flex-col items-start gap-0.5">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[17px] font-semibold">
                        <FnIcon code={fn} size={20} className="text-pencil-ink" />
                        {COPY.fnName[fn]}
                      </span>
                      {gone ? <GoneWord className="border border-ink">{COPY.s3.table.gone}</GoneWord> : null}
                    </span>
                  </th>
                  {cols.map((id, ci) => {
                    const t = cellTri(vm, fn, id);
                    const k = `${fn}|${id}`;
                    const fl = flash.has(k);
                    return (
                      <td
                        key={id}
                        className={`vr flash-host h-[64px] px-2 py-1 text-center align-middle ${t === "U" ? "hatch" : gone ? "slash" : ""}`}
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
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
