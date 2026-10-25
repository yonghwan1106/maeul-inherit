// /poster — representative image (spec 8.9, 디자인 계획 §4 poster), 1200 x 675, noindex. Server component.
// Every number comes from the engine (lib/compute -> lib/engine): SC1, 김순자, after the scenario's demo confirmation
// (marked 「확인 후, 시연 입력값 기준」 on the ledger head).
import type { Metadata } from "next";
import type { FnCode } from "@/lib/types";
import { COPY } from "@/lib/copy";
import { loadRegion, loadScenario } from "@/lib/data";
import { residentView } from "@/lib/compute";
import { makeCells } from "@/lib/engine";
import { applyFnEdits, parseDecompose, pointName } from "@/lib/view";
import { FnIcon } from "@/components/FnIcons";
import { Badge, TriMark, cellBg, tiltOf } from "@/components/Badge";
import { Tally } from "@/components/ResidentCard";

export const metadata: Metadata = {
  title: `${COPY.serviceName} — 대표 이미지`,
  robots: { index: false, follow: false },
};

const SHUTTER_FNS: FnCode[] = ["F01", "F06", "F07", "F09"];

export default function Poster() {
  const { region } = loadRegion();
  const sc = loadScenario("sc1_seungchi", region)?.scenario ?? null;
  const kim = sc?.residents.find((r) => r.name === "김순자") ?? sc?.residents[0] ?? null;
  const fns = sc ? applyFnEdits(parseDecompose(sc.precomputed.decompose.response).functions, []) : [];
  const cells = sc ? makeCells(region, fns, sc.demoConfirmations) : null;
  const view = sc && kim && cells ? residentView(region, cells, kim, fns) : null;
  const who = kim ? COPY.s0.heroCard(kim.name, kim.age, COPY.modeResident[kim.mode], pointName(region, kim.pointId)) : [];
  const [sign1, sign2] = COPY.sign;

  return (
    <div data-poster="1" className="relative overflow-hidden bg-paper text-ink" style={{ width: 1200, height: 675, padding: "26px 40px 0" }}>
      {/* signboard */}
      <div className="flex items-end gap-6" style={{ height: 92 }}>
        <span className="inline-flex items-center rounded-[2px] border-2 border-slate-deep bg-slate px-4 text-paper" style={{ height: 92, boxShadow: "inset 0 0 0 3px var(--slate), inset 0 0 0 4px rgba(246,247,243,0.55)" }}>
          <span className="sign leading-none" style={{ fontSize: 74 }}>{sign1}</span>
        </span>
        <span className="sign pb-1 leading-none" style={{ fontSize: 46 }}>{sign2}</span>
      </div>

      <div className="grid items-stretch" style={{ gridTemplateColumns: "290px 64px 1fr", height: 362, marginTop: 16 }}>
        {/* left: the closed shop — sign + shutter down + what it used to do (grey) */}
        <div className="flex flex-col border-2 border-ink">
          <div className="sign border-b-2 border-ink bg-cell px-3 py-1.5 text-center leading-tight" style={{ fontSize: 26 }}>
            {sc?.store.name ?? ""}
          </div>
          <div className="shutter flex-1" aria-hidden="true" />
          <div className="grid grid-cols-4 gap-1 border-t-2 border-ink px-2 py-2">
            {SHUTTER_FNS.map((c) => (
              <div key={c} className="flex flex-col items-center text-pencil-ink">
                <FnIcon code={c} size={28} />
                <span className="text-[15px] font-medium">{COPY.fnName[c]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* arrow */}
        <div className="flex items-center justify-center" aria-hidden="true">
          <svg width="44" height="24" viewBox="0 0 44 24">
            <path d="M2 12h36M28 3l11 9-11 9" fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* right: the ledger */}
        {view ? (
          <section className="flex min-w-0 flex-col border-2 border-ink" data-poster-card="engine">
            <div className="flex items-baseline justify-between gap-3 border-b-2 border-ink px-3 py-1.5">
              <span className="flex items-baseline gap-3">
                <span className="sign leading-none" style={{ fontSize: 24 }}>{COPY.s0.ledgerTitle(kim?.name ?? "")}</span>
                <span className="text-[15px] font-medium text-pencil-ink">{who.slice(1).join(", ")}</span>
              </span>
              <Badge tone="assumed">{COPY.badge.virtualPerson}</Badge>
            </div>
            <table className="ledger text-[15px]">
              <thead>
                <tr>
                  <th className="w-[34%] px-3 py-1 text-[14px] text-pencil-ink">{COPY.s0.colFn}</th>
                  <th className="vr px-3 py-1 text-[14px]">
                    {COPY.poster.ledgerHead} <span className="font-medium text-pencil-ink">({COPY.poster.afterNote})</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((r, i) => (
                  <tr key={r.code} data-tri={r.tri}>
                    <th scope="row" className="px-3 text-left text-[18px] font-semibold" style={{ height: 38 }}>
                      <span className="inline-flex items-center gap-2">
                        <FnIcon code={r.code} size={20} className="text-pencil-ink" />
                        {COPY.fnName[r.code]}
                      </span>
                    </th>
                    <td className={`vr px-3 ${cellBg(r.tri)}`}>
                      <span className="flex items-center gap-3">
                        <TriMark tri={r.tri} resident tilt={tiltOf(i)} className="[&_.stamp]:h-[2.2em] [&_.stamp]:w-[2.2em]" />
                        {r.tri !== "N" && r.resName ? (
                          <span className="bg-paper/85 text-[16px] font-medium">
                            {r.resName}
                            {r.note ? <span className="text-pencil-ink"> {r.note}</span> : null}
                          </span>
                        ) : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-auto flex items-center justify-between gap-3 border-t-[3px] border-double border-rule px-2">
              <Tally y={view.countY} u={view.countU} n={view.countN} size={26} label={COPY.s0.tallyLabel} />
              <p className="m-0 max-w-[420px] py-1 text-right text-[15px] leading-snug text-pencil-ink" data-poster-card="b1">
                {COPY.poster.left} {COPY.tri.Y} {view.b1.countY}
                {!view.b1.walkable && view.mode !== "car" ? `, ${COPY.s3.mini.notWalkable.replace(/^—\s*/, "")}` : ""}
              </p>
            </div>
          </section>
        ) : (
          <div />
        )}
      </div>

      <p className="m-0 font-medium" style={{ fontSize: 36, lineHeight: 1.3, letterSpacing: "-0.02em", marginTop: 20 }}>
        {COPY.oneLiner}
      </p>

      <p className="absolute m-0 text-[15px] text-pencil-ink" style={{ right: 40, bottom: 12 }}>
        {COPY.poster.foot}
      </p>
    </div>
  );
}
