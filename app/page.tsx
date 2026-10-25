// S0 처음 (spec 8.2). Server component: engine numbers computed at build from region + SC1 (base state).
import Link from "next/link";
import { COPY } from "@/lib/copy";
import { loadAllScenarios, loadRegion } from "@/lib/data";
import { baseCells, residentView } from "@/lib/compute";
import { applyFnEdits, parseDecompose, pointName } from "@/lib/view";
import { SiteHeader } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/Badge";
import { ResidentCard } from "@/components/ResidentCard";

export default function Home() {
  const { region, mock } = loadRegion();
  const scenarios = loadAllScenarios(region);
  const sc1 = scenarios.find((s) => s.scenario.id === "sc1_seungchi") ?? scenarios[0];
  const kim = sc1?.scenario.residents.find((r) => r.name === "김순자") ?? sc1?.scenario.residents[0];
  const fns = sc1 ? applyFnEdits(parseDecompose(sc1.scenario.precomputed.decompose.response).functions, []) : [];
  const view = sc1 && kim ? residentView(region, baseCells(region, fns), kim, fns) : null;

  const total = region.villages.length;
  const zero = region.villages.filter((v) => v.foodStores === 0).length;
  const p65 = Number(region.meta.pop65);
  const pAll = Number(region.meta.myeonPop);
  const share = pAll > 0 ? p65 / pAll : NaN;
  const elderly = Number.isFinite(share) && share > 0 ? `${(Math.round(share * 1000) / 10).toFixed(1)}%` : COPY.s0.stats.elderly.value;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-10">
        <div className="flex flex-wrap gap-2">
          {mock ? <Badge tone="warn">{COPY.badge.mock}</Badge> : null}
          {sc1?.temp ? <Badge tone="warn">{COPY.badge.tempScenario}</Badge> : null}
        </div>

        <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          {/* 1. 김순자 카드 */}
          {view && kim ? (
            <ResidentCard
              testId="s0-hero"
              title={COPY.s0.heroCard(kim.name, kim.age, COPY.modeResident[kim.mode], pointName(region, kim.pointId))}
              rows={view.rows}
              countY={view.countY}
              countU={view.countU}
              countN={view.countN}
              className="order-1"
            >
              <p className="mt-1 mb-0 text-[15px] text-muted">
                {COPY.s0.afterClose(String(view.countY), String(view.countU), String(view.countN))}
              </p>
              <Link
                href="/s/sc1_seungchi/functions"
                className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-brand px-5 text-[18px] font-bold text-white no-underline hover:opacity-90"
                data-cta="start"
              >
                {COPY.s0.start} →
              </Link>
            </ResidentCard>
          ) : null}

          {/* 2~3. 제목·한 줄 소개 */}
          <div className="order-2">
            <h1 className="m-0 text-[30px] font-extrabold leading-tight sm:text-[42px]">{COPY.s0.title}</h1>
            <p className="mt-4 mb-0 text-[18px] leading-relaxed sm:text-[20px]">{COPY.oneLiner}</p>
          </div>
        </section>

        {/* 4. 면 현황 */}
        <section className="mt-10 grid gap-3 sm:grid-cols-3" aria-label="면 현황">
          <Stat value={COPY.s0.stats.national.value} label={COPY.s0.stats.national.label} />
          <Stat value={elderly} label={COPY.s0.stats.elderly.label} />
          <Stat value={COPY.s0.stats.noFood.value(total, zero)} label={COPY.s0.stats.noFood.label} />
        </section>

        {/* 5~6. 시나리오 카드 + 직접 등록 */}
        <section className="mt-10">
          <div className="grid gap-3 md:grid-cols-3">
            {scenarios.map(({ scenario }) => (
              <article key={scenario.id} className="flex flex-col rounded-2xl border border-line bg-card p-4" data-scenario={scenario.id}>
                <h2 className="m-0 text-[18px] font-bold leading-snug">{COPY.s0.scenarioTitles[scenario.id] ?? scenario.title}</h2>
                <p className="mt-2 mb-0 text-[15px] text-muted">{scenario.store.name} · {scenario.store.sbizSub}</p>
                <p className="mt-1 mb-3 text-[15px] text-muted">{scenario.store.items.join("·")}</p>
                <Link
                  href={`/s/${scenario.id}/functions`}
                  className="mt-auto inline-flex min-h-11 items-center self-start rounded-xl border-2 border-brand px-4 text-[16px] font-semibold text-brand no-underline hover:bg-brand-soft"
                >
                  {COPY.s0.tryScenario} →
                </Link>
              </article>
            ))}
          </div>
          <Link href="/register" className="mt-4 inline-flex min-h-11 items-center text-[17px] font-semibold text-brand underline underline-offset-4">
            {COPY.s0.register} →
          </Link>
        </section>

        {/* 7. 6단계 흐름 */}
        <section className="mt-10" aria-label="6단계 흐름">
          <ol className="m-0 flex list-none flex-wrap items-stretch gap-2 p-0">
            {COPY.steps.map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <span className="rounded-xl border border-line bg-card px-3 py-2 text-[15px] font-semibold">
                  <span className="mr-1 text-brand">{i + 1}</span>
                  {s}
                </span>
                {i < COPY.steps.length - 1 ? <span aria-hidden="true" className="text-muted">→</span> : null}
              </li>
            ))}
          </ol>
          <p className="mt-2 mb-0 text-[13px] text-muted">{COPY.s0.flowNote}</p>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="num text-[34px] font-extrabold leading-none text-brand">{value}</div>
      <p className="mt-2 mb-0 text-[14px] leading-snug text-muted">{label}</p>
    </div>
  );
}
