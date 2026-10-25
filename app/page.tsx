// S0 처음 (spec 8.2, 디자인 계획 §4 S0). Server component: engine numbers computed at build from region + SC1.
// The one bold scene: 김순자 어르신의 장부 — the shop column's shutter comes down, then the marks land line by line
// (plan column = base state as on S3 before any confirmation; 「확인 후」 column = the scenario's 시연 입력값).
import Link from "next/link";
import type { CSSProperties } from "react";
import { COPY } from "@/lib/copy";
import { loadAllScenarios, loadRegion } from "@/lib/data";
import { baseCells, residentView, type FnRow } from "@/lib/compute";
import { makeCells } from "@/lib/engine";
import { applyFnEdits, parseDecompose, pointName } from "@/lib/view";
import { SiteHeader } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { Badge, TriMark, cellBg, tiltOf } from "@/components/Badge";
import { FnIcon } from "@/components/FnIcons";
import { Tally } from "@/components/ResidentCard";
import { StepFlow } from "@/components/StepFlow";

const SHUTTER_S = 0.6;
const ROW_S = 0.12;
const MARK_S = 0.34; // .scene-mark duration
/** 「승치 마을상회(가상)」 -> ["승치 마을상회", "(가상)"] for the two-line plate */
const splitStoreName = (name: string) => {
  const i = name.indexOf("(");
  return i > 0 ? [name.slice(0, i).trim(), name.slice(i)] : [name];
};
const delay = (s: number) => ({ "--delay": `${s.toFixed(2)}s` }) as CSSProperties;

function MarkCell({ r, i, d, mobileStack = true }: { r: FnRow; i: number; d: number; mobileStack?: boolean }) {
  return (
    <td className="vr p-0 align-middle" data-tri={r.tri}>
      <div className={`scene-mark flex min-h-[64px] items-center gap-x-2 gap-y-1 px-2 py-2 ${mobileStack ? "flex-col items-start sm:flex-row sm:items-center" : ""} ${cellBg(r.tri)}`} style={delay(d)}>
        <TriMark tri={r.tri} resident tilt={tiltOf(i)} />
        {r.tri !== "N" && r.resName ? (
          <span className="min-w-0 bg-paper/85 leading-tight">
            <span className="block text-[14px] font-medium">{r.resName}</span>
            {r.note ? <span className="block text-[14px] text-pencil-ink">{r.note}</span> : null}
          </span>
        ) : null}
      </div>
    </td>
  );
}

export default function Home() {
  const { region, mock } = loadRegion();
  const scenarios = loadAllScenarios(region);
  const sc1 = scenarios.find((s) => s.scenario.id === "sc1_seungchi") ?? scenarios[0];
  const kim = sc1?.scenario.residents.find((r) => r.name === "김순자") ?? sc1?.scenario.residents[0];
  const fns = sc1 ? applyFnEdits(parseDecompose(sc1.scenario.precomputed.decompose.response).functions, []) : [];
  const view = sc1 && kim ? residentView(region, baseCells(region, fns), kim, fns) : null;
  // after the demo value (이동장터 A 정차 1칸, 시연 입력값) — same engine call as the S3 mini card 4-step line
  const viewDemo = sc1 && kim && sc1.scenario.demoConfirmations.length ? residentView(region, makeCells(region, fns, sc1.scenario.demoConfirmations), kim, fns) : null;

  const total = region.villages.length;
  const zero = region.villages.filter((v) => v.foodStores === 0).length;
  const p65 = Number(region.meta.pop65);
  const pAll = Number(region.meta.myeonPop);
  const share = pAll > 0 ? p65 / pAll : NaN;
  const elderly = Number.isFinite(share) && share > 0 ? `${(Math.round(share * 1000) / 10).toFixed(1)}%` : COPY.s0.stats.elderly.value;
  const st = COPY.s0.stats;
  const town: { pre: string; value: string; post: string; source: string }[] = [
    { ...st.national },
    { ...st.elderly, value: elderly },
    { pre: st.noFood.pre, value: st.noFood.value(total, zero), post: st.noFood.post, source: st.noFood.source },
  ];
  const [l1, l2, l3] = COPY.oneLinerLines;
  const n = view?.rows.length ?? 0;
  const afterStart = SHUTTER_S + n * ROW_S + 0.15;
  const planTallyAt = SHUTTER_S + Math.max(n - 1, 0) * ROW_S + MARK_S;
  const afterTallyAt = afterStart + Math.max(n - 1, 0) * ROW_S + MARK_S;
  const store = sc1?.scenario.store;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-14 sm:pt-12">
        {mock || sc1?.temp ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {mock ? <Badge tone="warn">{COPY.badge.mock}</Badge> : null}
            {sc1?.temp ? <Badge tone="warn">{COPY.badge.tempScenario}</Badge> : null}
          </div>
        ) : null}

        <section className="grid items-start gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:grid-rows-[auto_1fr]">
          {/* 제목 + 한 줄 소개 (the official sentence, only broken into lines) */}
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <h1 className="sign m-0 text-[30px] leading-[1.18] font-normal min-[380px]:text-[38px] sm:text-[48px]">
              <span className="block [text-wrap:balance]">{l1}</span>
              <span className="block [text-wrap:balance]">{l2}</span>
            </h1>
            <p className="measure mt-5 mb-0 text-[20px] leading-[1.6]">{l3}</p>
          </div>

          {/* below 640 px the button sits right under the one-liner (inside the first screen); from 640 px it follows the ledger as before */}
          <div className="sm:order-1 lg:col-start-1 lg:row-start-2">
            <Link
              href="/s/sc1_seungchi/functions"
              className="inline-flex min-h-14 items-center rounded-[3px] border-2 border-slate-deep bg-slate px-7 text-[20px] font-semibold text-paper no-underline hover:bg-slate-deep"
              data-cta="start"
            >
              {COPY.s0.start}
            </Link>
          </div>

          {/* 김순자 어르신의 장부 */}
          {view && kim && store ? (
            <section className="min-w-0 overflow-hidden border-2 border-ink bg-paper lg:col-start-2 lg:row-span-2 lg:row-start-1" data-card="s0-hero" aria-label={COPY.s0.ledgerTitle(kim.name)}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-ink px-3 py-2.5 sm:px-4">
                <h2 className="sign m-0 text-[24px] leading-tight font-normal">{COPY.s0.ledgerTitle(kim.name)}</h2>
                <Badge tone="assumed">{COPY.badge.virtualPerson}</Badge>
                <p className="m-0 flex w-full flex-wrap gap-x-3 text-[14px] font-medium text-pencil-ink">
                  {COPY.s0.heroCard(kim.name, kim.age, COPY.modeResident[kim.mode], pointName(region, kim.pointId))
                    .slice(1)
                    .map((p) => (
                      <span key={p}>{p}</span>
                    ))}
                </p>
                {/* mobile: the shop column shrinks to one shutter picture in the head */}
                <div className="flex w-full items-center gap-2 pt-1 sm:hidden" aria-hidden="true">
                  <span className="relative inline-block h-8 w-12 overflow-hidden border border-ink">
                    <span className="scene-shutter shutter absolute inset-0" />
                  </span>
                  <span className="sign text-[17px]">{store.name}</span>
                </div>
              </div>
              <table className="ledger text-[14px]">
                <thead>
                  <tr>
                    <th className="w-[30%] px-2 py-2 text-[14px] text-pencil-ink sm:w-[21%] sm:px-3">{COPY.s0.colFn}</th>
                    <th className="vr hidden w-[20%] px-1.5 py-2 sm:table-cell">
                      {/* a small signboard plate over the shutter: the shop name in at most two lines */}
                      <span className="sign inline-flex flex-col rounded-[2px] border-2 border-slate-deep bg-slate px-1.5 py-0.5 text-[17px] leading-[1.1] font-normal text-paper">
                        {splitStoreName(store.name).map((part) => (
                          <span key={part} className="block whitespace-nowrap">
                            {part}
                          </span>
                        ))}
                      </span>
                    </th>
                    <th className="vr px-2 py-2">
                      <span className="block text-[14px]">{COPY.s0.colPlan}</span>
                      <span className="block text-[14px] font-medium text-pencil-ink">{COPY.s0.afterCloseLabel}</span>
                    </th>
                    {viewDemo ? (
                      <th className="vr px-2 py-2">
                        <span className="block text-[14px]">{COPY.s0.colAfter}</span>
                        <span className="block text-[14px] font-medium text-pencil-ink">{COPY.s0.colAfterNote}</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {view.rows.map((r, i) => {
                    const a = viewDemo?.rows.find((x) => x.code === r.code);
                    return (
                      <tr key={r.code} data-fn={r.code}>
                        <th scope="row" className="px-2 py-2 text-left text-[17px] font-semibold sm:px-3 sm:text-[17px]">
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <FnIcon code={r.code} size={20} className="hidden shrink-0 text-pencil-ink sm:block" />
                            {COPY.fnName[r.code]}
                          </span>
                        </th>
                        {i === 0 ? (
                          <td rowSpan={n} className="vr relative hidden p-0 align-top sm:table-cell" aria-hidden="true">
                            <span className="absolute inset-x-2 top-2 bottom-2 flex flex-col border-2 border-ink">
                              <span className="block h-3 border-b-2 border-ink bg-ink" />
                              <span className="relative block flex-1 overflow-hidden">
                                <span className="scene-shutter shutter absolute inset-0" />
                              </span>
                            </span>
                          </td>
                        ) : null}
                        <MarkCell r={r} i={i} d={SHUTTER_S + i * ROW_S} />
                        {a ? <MarkCell r={a} i={i + 3} d={afterStart + i * ROW_S} /> : null}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" className="sign px-2 py-2 text-left text-[24px] font-normal sm:px-3">
                      <span className="scene-fade block" style={delay(planTallyAt)}>{COPY.s0.tallyLabel}</span>
                    </th>
                    <td className="vr hidden sm:table-cell" />
                    {/* each total appears only after the last mark of its column (opacity only: a scaled total overshot the box edge) */}
                    <td className="vr px-1 py-1 align-top">
                      <div className="scene-fade" style={delay(planTallyAt)}>
                        <Tally y={view.countY} u={view.countU} n={view.countN} size={24} stack />
                      </div>
                    </td>
                    {viewDemo ? (
                      <td className="vr px-1 py-1 align-top">
                        <div className="scene-fade" style={delay(afterTallyAt)}>
                          <Tally y={viewDemo.countY} u={viewDemo.countU} n={viewDemo.countN} size={24} testAttr={false} stack />
                        </div>
                      </td>
                    ) : null}
                  </tr>
                </tfoot>
              </table>
              <div className="border-t border-rule px-3 py-2.5 sm:px-4">
                <p className="num m-0 text-[14px] font-medium" data-steps="s0">
                  {COPY.s3.mini.steps(view.rows.length, view.b1.countY, view.countY, viewDemo ? viewDemo.countY : null)}
                </p>
                {viewDemo ? <p className="mt-1 mb-0 text-[14px] text-pencil-ink">{COPY.s0.demoNote}</p> : null}
              </div>
            </section>
          ) : null}
        </section>

        {/* 이 마을의 형편 */}
        <section className="mt-16" aria-labelledby="town-title">
          <h2 id="town-title" className="sign m-0 border-b-2 border-ink pb-2 text-[30px] font-normal">{COPY.s0.townTitle}</h2>
          <ul className="m-0 list-none p-0">
            {town.map((t) => (
              <li key={t.source} className="flex flex-col gap-x-8 gap-y-1 border-b border-rule py-3 sm:flex-row sm:items-baseline sm:justify-between">
                <p className="m-0 text-[20px] leading-snug">
                  {t.pre}
                  <strong className="num font-semibold">{t.value}</strong>
                  {t.post}
                </p>
                <span className="text-[14px] text-pencil-ink sm:max-w-[22rem] sm:shrink-0 sm:text-right">{t.source}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 체험할 마을 — a ledger index, one line per village */}
        <section className="mt-16" aria-labelledby="index-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-ink pb-2">
            <h2 id="index-title" className="sign m-0 text-[30px] font-normal">{COPY.s0.indexTitle}</h2>
            <span className="text-[14px] text-pencil-ink">{COPY.s0.indexNote}</span>
          </div>
          <ol className="m-0 list-none p-0">
            {scenarios.map(({ scenario }) => {
              const t = COPY.s0.scenarioTitles[scenario.id];
              return (
                <li key={scenario.id} className="grid grid-cols-1 gap-x-6 gap-y-2 border-b border-rule py-4 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center" data-scenario={scenario.id}>
                  <h3 className="sign m-0 text-[30px] leading-none font-normal">{t?.name ?? scenario.title}</h3>
                  <div className="min-w-0">
                    {t ? <p className="m-0 text-[20px] font-semibold">{t.desc}</p> : null}
                    <p className="m-0 mt-0.5 flex flex-wrap gap-x-3 text-[14px] text-pencil-ink">
                      <span className="sign text-[17px] text-ink">{scenario.store.name}</span>
                      <span>{scenario.store.sbizSub}</span>
                      <span>{scenario.store.items.join("·")}</span>
                    </p>
                  </div>
                  <Link
                    href={`/s/${scenario.id}/functions`}
                    className="inline-flex min-h-12 items-center justify-self-start rounded-[3px] border-2 border-slate px-5 text-[17px] font-semibold text-slate no-underline hover:bg-cell sm:justify-self-end"
                  >
                    {COPY.s0.tryScenario}
                  </Link>
                </li>
              );
            })}
            <li className="grid grid-cols-1 gap-x-6 gap-y-2 border-b border-rule py-4 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center">
              <span className="text-[17px] font-semibold text-pencil-ink">{COPY.nav.s1}</span>
              <p className="m-0 text-[17px]">{COPY.s0.registerDesc}</p>
              <Link
                href="/register"
                className="inline-flex min-h-12 items-center justify-self-start rounded-[3px] border-2 border-dashed border-slate px-5 text-[17px] font-semibold text-slate no-underline hover:bg-cell sm:justify-self-end"
              >
                {COPY.s0.register}
              </Link>
            </li>
          </ol>
        </section>

        {/* 처리 경로 (6단계) */}
        <section className="mt-16" aria-labelledby="route-title">
          <h2 id="route-title" className="m-0 mb-3 text-[24px] font-semibold">{COPY.stepsTitle}</h2>
          <StepFlow active={[]} className="" />
          <p className="mt-2 mb-0 text-[14px] text-pencil-ink">{COPY.s0.flowNote}</p>
        </section>
      </main>
      <Footer />
    </>
  );
}
