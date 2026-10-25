// 「누가 어떤 일을 이어받나」 — function × resource table for one (village, mode) of the plan.
import type { FnCode, PlanVM, Region, Tri } from "@/lib/types";
import { COPY } from "@/lib/copy";
import { srcLabel } from "@/lib/view";
import { Badge, TriMark } from "./Badge";
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

export function FnResourceTable({ region, vm, fns, flash }: { region: Region; vm: PlanVM | undefined; fns: FnCode[]; flash: Set<string> }) {
  const cols = tableColumns(vm);
  const res = new Map(region.resources.map((r) => [r.id, r]));
  return (
    <section className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-[20px] font-bold">{COPY.s3.table.title}</h2>
        <span className="text-[14px] text-muted">{COPY.s3.table.legend}</span>
      </div>
      {cols.length > 2 ? <p className="m-0 mt-1 text-[13px] font-semibold text-muted sm:hidden">{COPY.s3.table.scrollHint}</p> : null}
      <div className="mt-2 max-w-full overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full border-collapse text-[15px]" data-table="fn-res">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-line bg-card p-2 text-left text-[14px] font-semibold text-muted">생활 일</th>
              {cols.map((id) => {
                const r = res.get(id);
                return (
                  <th key={id} className="min-w-[96px] border-b border-l border-line p-2 text-left align-top font-semibold" data-col={id}>
                    <span className="block text-[14px] leading-snug">{r?.name ?? id}</span>
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
            {fns.map((fn) => (
              <tr key={fn}>
                <th scope="row" className="sticky left-0 z-10 border-b border-line bg-card p-2 text-left font-semibold">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <FnIcon code={fn} size={18} />
                    {COPY.fnName[fn]}
                  </span>
                </th>
                {cols.map((id) => {
                  const t = cellTri(vm, fn, id);
                  const k = `${fn}|${id}`;
                  return (
                    <td key={id} className="flash-host border-b border-l border-line p-2 text-center text-[18px]" data-flash={flash.has(k) ? "1" : "0"} data-cell={k} data-tri={t}>
                      <TriMark tri={t} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
