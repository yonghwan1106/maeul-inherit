"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Confirmation, FnCode, Mode, Region, Scenario, Tri } from "@/lib/types";
import { COPY } from "@/lib/copy";
import { CORE_FNS, SOCIAL_FNS } from "@/lib/ontology";
import { baseCells, computePlan, coreCodes, residentView } from "@/lib/compute";
import { useScenarioState } from "@/lib/store/scenario";
import { EMPTY_UI, keys, useLocal, type UiState } from "@/lib/store/local";
import { useFlashSet } from "@/lib/useFlash";
import { MODE_ORDER, pointName, resName, villageName } from "@/lib/view";
import { Badge, ModeBadge } from "@/components/Badge";
import { Bars } from "@/components/Bars";
import { VillageMap, type MapLine } from "@/components/Map";
import { FnResourceTable, cellTri, tableColumns } from "@/components/FnResourceTable";
import { VoiCard } from "@/components/VoiCard";
import { FeedbackQueue } from "@/components/FeedbackQueue";
import { LostRecord } from "@/components/LostRecord";
import { ParamsPanel } from "@/components/ParamsPanel";
import { ResidentCard } from "@/components/ResidentCard";
import { GateButton, GatedLink } from "@/components/GateButton";

export function PlanScreen({ sid, region, loaded, temp, mock }: { sid: string; region: Region; loaded: Scenario | null; temp: boolean; mock: boolean }) {
  const st = useScenarioState(sid, loaded);
  const [ui, setUi] = useLocal<UiState>(keys.ui, EMPTY_UI);
  const s = st.scenario;
  const fns = st.fns;
  const conf = st.conf;

  const bundle = useMemo(() => (s ? computePlan(region, s, fns, conf) : null), [region, s, fns, conf]);
  const cells0 = useMemo(() => (s ? baseCells(region, fns) : null), [region, s, fns]);

  // measure input -> committed re-render (spec 8.5: < 1 s)
  const clickAt = useRef<number | null>(null);
  const [recalcMs, setRecalcMs] = useState<number | null>(null);
  const [planMs, setPlanMs] = useState<number | null>(null);
  useEffect(() => {
    if (bundle) requestAnimationFrame(() => setPlanMs(Math.round(bundle.ms)));
  }, [bundle]);
  useEffect(() => {
    if (clickAt.current !== null) {
      const t = clickAt.current;
      clickAt.current = null;
      requestAnimationFrame(() => setRecalcMs(Math.round(performance.now() - t)));
    }
  }, [bundle]);

  const residents = s?.residents ?? [];
  const selId = ui.resident?.[sid] ?? residents[0]?.id;
  const sel = residents.find((r) => r.id === selId) ?? residents[0];
  const mapMode = (MODE_ORDER as string[]).includes(ui.s3Mode ?? "") ? (ui.s3Mode as Mode) : (sel?.mode ?? "walk");

  const core = coreCodes(fns);
  const view = bundle && sel ? residentView(region, bundle.cells, sel, fns) : null;
  const view0 = cells0 && sel ? residentView(region, cells0, sel, fns) : null;

  const storeVillage = s?.store.villageId ?? "";
  const vmOf = (m: Mode) => bundle?.plan.byVM.find((v) => v.villageId === storeVillage && v.mode === m);
  const vm = vmOf(mapMode);

  // flash maps
  const flashBars = useFlashSet(
    bundle ? Object.fromEntries(MODE_ORDER.map((m) => [m, JSON.stringify(bundle.plan.summary[m])])) : {},
  );
  const cols = tableColumns(vm);
  const flashTable = useFlashSet(
    Object.fromEntries(core.flatMap((fn) => cols.map((id) => [`${fn}|${id}`, cellTri(vm, fn, id)]))),
  );
  const flashMini = useFlashSet(view ? Object.fromEntries(view.rows.map((r) => [r.code, `${r.tri}|${r.resId ?? ""}|${r.note ?? ""}`])) : {});

  if (!s || !bundle) {
    return (
      <div className="rounded-2xl border border-line bg-card p-5">
        <p className="m-0 text-[17px]">등록된 가게가 없어요.</p>
        <Link href="/register" className="mt-3 inline-block font-semibold text-brand underline">{COPY.s0.register} →</Link>
      </div>
    );
  }

  const { plan, voi, cells } = bundle;
  const setCell = (cellKey: string, value: Tri | null, note: string, by: Confirmation["by"]) => {
    clickAt.current = performance.now();
    st.setConf((prev) => {
      const rest = prev.filter((c) => c.cellKey !== cellKey);
      if (value === null) return rest;
      const c: Confirmation = { cellKey, value, by, at: new Date().toISOString() };
      if (note.trim()) c.note = note.trim();
      return [...rest, c];
    });
  };
  const confOf = (k: string) => conf.find((c) => c.cellKey === k);
  const demoOf = (k: string) => s.demoConfirmations.find((c) => c.cellKey === k);

  const top = voi.slice(0, 3);
  const demoCells = s.demoConfirmations
    .filter((d) => !top.some((t) => t.cellKey === d.cellKey))
    .map((d) => voi.find((v) => v.cellKey === d.cellKey))
    .filter((v): v is NonNullable<typeof v> => !!v);
  const rest = voi.slice(3).filter((v) => !demoCells.some((d) => d.cellKey === v.cellKey));

  // map lines from the store village plan of the chosen mode
  const lines: MapLine[] = [];
  if (vm) {
    const acc = new Map<string, MapLine>();
    for (const fn of core) {
      for (const a of vm.byFn[fn] ?? []) {
        if (a.tri === "N") continue;
        const k = `${a.resId}|${a.tri}`;
        const cur = acc.get(k) ?? { resId: a.resId, tri: a.tri, fns: [] };
        cur.fns.push(fn);
        acc.set(k, cur);
      }
    }
    lines.push(...acc.values());
  }

  const gaps = MODE_ORDER.flatMap((m) => (vmOf(m)?.gaps ?? []).filter((f) => core.includes(f)).map((f) => ({ fn: COPY.fnName[f], mode: COPY.modeOfficer[m] })));
  const truncated = plan.byVM.some((v) => v.truncated);
  const socialOn = fns.some((f) => f.enabled && SOCIAL_FNS.includes(f.code));
  const commonRows = (Object.entries(plan.common) as [FnCode, string[]][]).filter(([f, ids]) => CORE_FNS.includes(f) && core.includes(f) && ids.length);

  return (
    <div className="flex flex-col gap-6" data-plan-ms={planMs ?? ""} data-recalc-ms={recalcMs ?? ""} data-conf-n={conf.length}>
      <div className="flex flex-wrap items-center gap-2">
        {st.decompose ? <ModeBadge mode={st.decompose.mode} model={st.decompose.model} at={st.decompose.generatedAt} /> : null}
        {temp ? <Badge tone="warn">{COPY.badge.tempScenario}</Badge> : null}
        {mock ? <Badge tone="warn">{COPY.badge.mock}</Badge> : null}
        <Badge tone="assumed">{COPY.badge.popAssumed}</Badge>
        <Badge tone="assumed">{COPY.badge.hubAssumed}</Badge>
      </div>
      <h1 className="m-0 text-[26px] font-extrabold leading-tight sm:text-[30px]">
        {s.store.name} — {COPY.nav.s3}
      </h1>

      {/* bars + mini card */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-line bg-card p-4">
          <Bars summary={plan.summary} order={MODE_ORDER} flash={flashBars} />
          <p className="mt-4 mb-0 text-[15px] font-semibold text-brand" data-optimal={truncated ? "truncated" : "ok"}>
            {truncated ? COPY.s3.optimal.truncated : COPY.s3.optimal.ok}
          </p>
        </section>

        <section className="rounded-2xl border-2 border-ink/80 bg-card p-4" data-mini="1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 text-[18px] font-bold">{COPY.s3.mini.title}</h2>
            {residents.length ? (
              <select
                value={sel?.id}
                onChange={(e) => setUi((u) => ({ ...u, resident: { ...(u.resident ?? {}), [sid]: e.target.value } }))}
                className="min-h-11 rounded-xl border-2 border-line bg-white px-2 text-[16px]"
                aria-label={COPY.s3.mini.title}
              >
                {residents.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {COPY.modeOfficer[r.mode]}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          {sel && view && view0 ? (
            <ResidentCard
              className="mt-3 border-0 p-0 shadow-none"
              testId="mini"
              title={COPY.s3.mini.line(sel.name, sel.age, COPY.modeOfficer[sel.mode], pointName(region, sel.pointId))}
              rows={view.rows}
              countY={view.countY}
              countU={view.countU}
              countN={view.countN}
              flashCodes={flashMini as Set<FnCode>}
            >
              <p className="num mt-2 mb-0 text-[16px]" data-b1="1">
                {COPY.s3.mini.b1(view.b1.distKm.toFixed(1), view.b1.countY)}
                {!view.b1.walkable && sel.mode !== "car" ? <strong className="text-warn"> {COPY.s3.mini.notWalkable}</strong> : null}
              </p>
              <p className="num mt-2 mb-0 rounded-xl bg-paper px-3 py-2 text-[15px] font-semibold" data-steps="1">
                {COPY.s3.mini.steps(core.length, view.b1.countY, view0.countY, conf.length ? view.countY : null)}
              </p>
            </ResidentCard>
          ) : (
            <p className="mt-2 mb-0 text-[16px] text-muted">{COPY.s3.mini.noResidents}</p>
          )}
        </section>
      </div>

      {/* map + table for one mode */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="이동 유형">
          {MODE_ORDER.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={m === mapMode}
              onClick={() => setUi((u) => ({ ...u, s3Mode: m }))}
              className={`min-h-11 rounded-xl border-2 px-4 text-[16px] font-bold ${m === mapMode ? "border-ink bg-ink text-white" : "border-line bg-card"}`}
            >
              {COPY.modeOfficer[m]}
            </button>
          ))}
          <span className="self-center text-[14px] text-muted">{villageName(region, storeVillage)}</span>
        </div>
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <div className="min-w-0">
            <VillageMap region={region} store={s.store} lines={lines} focusVillageId={storeVillage} pointId={sel?.pointId} ariaLabel="이어받는 곳 지도" />
            <p className="mt-1 mb-0 text-[14px] text-muted">{COPY.s3.mapLegend}</p>
          </div>
          <FnResourceTable region={region} vm={vm} fns={core} flash={flashTable} />
        </div>
      </section>

      {/* 먼저 전화할 곳 */}
      <section className="flex flex-col gap-3" data-voi-list={voi.length}>
        <div>
          <h2 className="m-0 text-[22px] font-extrabold">{COPY.s3.voi.title}</h2>
          <p className="m-0 text-[14px] text-muted">{COPY.s3.voi.note}</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {top.map((v, i) => (
            <VoiCard key={v.cellKey} item={v} rank={i + 1} current={confOf(v.cellKey)} demo={demoOf(v.cellKey)} onSet={(val, note, by) => setCell(v.cellKey, val, note, by)} />
          ))}
        </div>
        {demoCells.length ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {demoCells.map((v) => (
              <div key={v.cellKey}>
                <p className="m-0 mb-1 text-[14px] font-semibold text-warn">{COPY.s3.voi.demoCell}</p>
                <VoiCard item={v} current={confOf(v.cellKey)} demo={demoOf(v.cellKey)} onSet={(val, note, by) => setCell(v.cellKey, val, note, by)} />
              </div>
            ))}
          </div>
        ) : null}
        {conf.length ? (
          <ConfirmedList region={region} conf={conf} registry={cells.registry} onUndo={(k) => setCell(k, null, "", "이 브라우저")} />
        ) : null}
        {rest.length ? (
          <details className="rounded-2xl border border-line bg-card p-4">
            <summary className="cursor-pointer text-[16px] font-semibold">{COPY.s3.voi.more(rest.length)}</summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {rest.map((v) => (
                <VoiCard key={v.cellKey} compact item={v} current={confOf(v.cellKey)} demo={demoOf(v.cellKey)} onSet={(val, note, by) => setCell(v.cellKey, val, note, by)} />
              ))}
            </div>
          </details>
        ) : null}
      </section>

      {/* common / gaps / social / reports / lost record */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-card p-4" data-common="1">
          <h2 className="m-0 text-[18px] font-bold">{COPY.s3.common.title}</h2>
          <ul className="mt-2 mb-0 flex list-none flex-col gap-1 p-0 text-[16px]">
            {commonRows.map(([f, ids]) => (
              <li key={f}>{COPY.s3.common.line(COPY.fnName[f], resName(region, ids[0]), ids[1] ? resName(region, ids[1]) : undefined)}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-line bg-card p-4" data-gaps={gaps.length}>
          <h2 className="m-0 text-[18px] font-bold">{COPY.s3.gaps.title}</h2>
          <ul className="mt-2 mb-0 flex list-none flex-wrap gap-2 p-0 text-[16px]">
            {gaps.length ? (
              gaps.map((g) => (
                <li key={`${g.fn}-${g.mode}`} className="tri-n rounded-lg px-2 py-0.5 text-ink">
                  {COPY.s3.gaps.line(g.fn, g.mode)}
                </li>
              ))
            ) : (
              <li className="text-muted">{COPY.s3.gaps.none}</li>
            )}
          </ul>
        </section>
        {socialOn && plan.socialHubs.length ? (
          <section className="rounded-2xl border border-line bg-card p-4" data-social="1">
            <h2 className="m-0 text-[18px] font-bold">{COPY.s3.social.title}</h2>
            <p className="mt-2 mb-0 text-[16px]">{COPY.s3.social.line(plan.socialHubs.map((h) => resName(region, h)).join("·"))}</p>
          </section>
        ) : null}
        <FeedbackQueue
          region={region}
          registry={cells.registry}
          fb={st.fb}
          conf={conf}
          onSet={setCell}
          onHandled={(id) => st.setFb((p) => p.map((f) => (f.id === id ? { ...f, handledAt: new Date().toISOString() } : f)))}
        />
        <LostRecord sid={sid} store={s.store} fns={fns} gaps={gaps} />
        <ParamsPanel />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
        <GateButton sid={sid} step="g2" />
        <GatedLink sid={sid} step="g2" href={`/s/${sid}/residents`} label={COPY.next.s4} />
      </div>
    </div>
  );
}

function ConfirmedList({
  region,
  conf,
  registry,
  onUndo,
}: {
  region: Region;
  conf: Confirmation[];
  registry: Map<string, { label: string; realNamed: boolean }>;
  onUndo: (cellKey: string) => void;
}) {
  void region;
  return (
    <section className="rounded-2xl border border-line bg-card p-4" data-confirmed={conf.length}>
      <h3 className="m-0 text-[17px] font-bold">{COPY.s3.voi.confirmedTitle}</h3>
      <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
        {conf.map((c) => {
          const def = registry.get(c.cellKey);
          const word = c.value === "Y" ? COPY.tri.Y : c.value === "N" ? COPY.tri.N : COPY.tri.U;
          const badge =
            c.by === "시연 입력값" ? (
              <Badge tone="demo">{COPY.badge.demoValue}</Badge>
            ) : c.by === "전화 확인" ? (
              <Badge tone="mode">{COPY.badge.phoneChecked(c.at.slice(0, 10))}</Badge>
            ) : (
              <Badge tone="browser">{COPY.badge.thisBrowser}</Badge>
            );
          return (
            <li key={c.cellKey} className="flex flex-wrap items-center gap-2 text-[16px]" data-confirmed-cell={c.cellKey}>
              <span className="font-semibold">{def?.label ?? c.cellKey}</span>
              <span>→ {word}{c.note ? ` · ${c.note}` : ""}</span>
              {badge}
              <button type="button" onClick={() => onUndo(c.cellKey)} className="min-h-9 rounded-lg border border-line px-2 text-[14px]">
                {COPY.s3.voi.unknown}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
