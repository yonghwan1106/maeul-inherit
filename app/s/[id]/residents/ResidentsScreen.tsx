"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Confirmation, FnCode, Mode, PlanDigest, Region, Resident, Scenario } from "@/lib/types";
import type { ComposeRequest, ComposeResponse } from "@/lib/apiTypes";
import { apiCompose } from "@/lib/api";
import { groundText } from "@/lib/validate/grounding";
import { digestFor, makeCells, personal, planScope } from "@/lib/engine";
import { COPY, DAYS } from "@/lib/copy";
import { SOCIAL_FNS } from "@/lib/ontology";
import { computePlan, residentView, type ResidentView } from "@/lib/compute";
import { useScenarioState } from "@/lib/store/scenario";
import type { Feedback } from "@/lib/store/local";
import { MODE_ORDER, confNoteFor, daysIn, pointName, resName } from "@/lib/view";
import { Badge, ModeBadge } from "@/components/Badge";
import { ResidentCard } from "@/components/ResidentCard";
import { FeedbackButtons } from "@/components/FeedbackButtons";
import { GroundingPanel } from "@/components/GroundingPanel";
import { GateButton } from "@/components/GateButton";

export interface E4Example { sentence: string; reason: string }

type DocKey = string;
const stamp = () => Date.now().toString(36);

function sameConf(a: Confirmation[], b: Confirmation[]): boolean {
  if (a.length !== b.length) return false;
  const k = (x: Confirmation[]) => x.map((c) => `${c.cellKey}=${c.value}`).sort().join("|");
  return k(a) === k(b);
}

export function ResidentsScreen({
  sid,
  region,
  loaded,
  temp,
  mock,
  examples,
}: {
  sid: string;
  region: Region;
  loaded: Scenario | null;
  temp: boolean;
  mock: boolean;
  examples: E4Example[];
}) {
  const st = useScenarioState(sid, loaded);
  const s = st.scenario;
  const fns = st.fns;
  const conf = st.conf;
  const bundle = useMemo(() => (s ? computePlan(region, s, fns, conf) : null), [region, s, fns, conf]);

  const residents = useMemo(() => s?.residents ?? [], [s]);
  const [myMode, setMyMode] = useState<Mode>("walk");
  const defaultPoint = residents.find((r) => r.mode === myMode)?.pointId ?? region.points.find((p) => p.villageId === s?.store.villageId)?.id ?? region.points[0]?.id;
  const [myPointRaw, setMyPoint] = useState<string | null>(null);
  const myPoint = myPointRaw ?? defaultPoint ?? "";
  const [badDays, setBadDays] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<string | null>(null);

  if (!s || !bundle) {
    return (
      <div className="rounded-2xl border border-line bg-card p-5">
        <p className="m-0 text-[17px]">등록된 가게가 없어요.</p>
        <Link href="/register" className="mt-3 inline-block font-semibold text-brand underline">{COPY.s0.register} →</Link>
      </div>
    );
  }

  const { cells, plan } = bundle;
  const socialOn = fns.some((f) => f.enabled && SOCIAL_FNS.includes(f.code));
  const state: "base" | "demo" | null = conf.length === 0 ? "base" : sameConf(conf, s.demoConfirmations) ? "demo" : null;

  const me: Resident = { id: "me", name: COPY.s4.myResult, age: 0, mode: myMode, pointId: myPoint, note: "" };
  const myView = residentView(region, cells, me, fns);
  // day constraint: a tour whose confirmed days are all 「안 되는 요일」 goes to the back (spec 5.8)
  const tourBlocked = (resId: string) => {
    const r = region.resources.find((x) => x.id === resId);
    if (!r || r.cls !== "tour" || !badDays.length) return false;
    const d = daysIn(confNoteFor(resId, cells.applied, cells.registry) ?? "");
    return d.length > 0 && d.every((x) => badDays.includes(x));
  };
  const myOrdered = [...myView.ordered].sort((a, b) => Number(tourBlocked(a.resId)) - Number(tourBlocked(b.resId)));

  const sendFb = (who: { id: string; name: string; pointId: string; mode: Mode }, resId: string, fnsOf: Feedback["fns"], kind: "used" | "failed", reason?: string) => {
    const f: Feedback = {
      id: `${stamp()}-${who.id}-${resId}`,
      residentId: who.id,
      residentName: who.name,
      pointId: who.pointId,
      mode: who.mode,
      resId,
      fns: fnsOf,
      kind,
      reason,
      at: new Date().toISOString(),
    };
    st.setFb((prev) => [...prev, f]);
    setToast(COPY.s4.fb.toast);
    window.setTimeout(() => setToast(null), 2600);
  };
  const lastFb = (rid: string, resId: string) => [...st.fb].reverse().find((f) => f.residentId === rid && f.resId === resId)?.kind;

  // per-function status: a resource can carry some functions for sure and others still being checked
  const rankText = (v: ResidentView, rank: number, name: string, fns: FnCode[]) => {
    const sure = (f: FnCode) => v.rows.find((r) => r.code === f)?.tri === "Y";
    const fy = fns.filter(sure), fu = fns.filter((f) => !sure(f));
    const j = (xs: FnCode[]) => xs.map((f) => COPY.fnName[f]).join("·");
    if (fy.length && fu.length) return COPY.s4.rank(rank, name, j(fy), COPY.tri.Y) + COPY.s4.rankMore(j(fu), COPY.tri.U);
    return COPY.s4.rank(rank, name, j(fns), fy.length ? COPY.tri.Y : COPY.tri.U);
  };
  // step 5 (objection E3-②): how to use each place + contact line. No phone numbers are invented —
  // until an officer checks, the contact line says 「확인 중」 and names the channel to check through.
  const howTo = (resId: string, fnsOf: FnCode[]) => {
    const r = region.resources.find((x) => x.id === resId);
    if (!r) return null;
    const how = (r.cls === "hub" && fnsOf.includes("F06") ? COPY.s4.howTo.hubParcel : COPY.s4.howTo[r.cls]) ?? null;
    const via =
      r.cls === "tour" ? "완주군 이동장터 담당 부서"
      : r.cls === "care_link" ? "화산면 행정복지센터"
      : r.cls === "hubdrop" ? COPY.s4.agency.hanaro
      : r.cls === "hub" ? "이장·노인회"
      : null;
    return { how, contact: via ? COPY.s4.contactVia(via) : COPY.s4.contactUnknown };
  };
  const rankLines = (v: ResidentView, who: { id: string; name: string; pointId: string; mode: Mode }, ordered = v.ordered) => (
    <ol className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
      {ordered.map((o, i) => {
        const note = confNoteFor(o.resId, cells.applied, cells.registry);
        const days = daysIn(note ?? "");
        const name = resName(region, o.resId) + (days.length ? `(${days.join("·")})` : "");
        return (
          <li key={o.resId} className="rounded-xl border border-line bg-white p-2.5" data-rank={o.resId}>
            <span className="text-[16px] font-semibold">
              {rankText(v, i + 1, name, o.fns)}
            </span>
            {tourBlocked(o.resId) && who.id === "me" ? <span className="ml-1 text-[14px] text-muted">({COPY.s4.badDays})</span> : null}
            {(() => {
              const h = howTo(o.resId, o.fns);
              return h ? (
                <dl className="m-0 mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[14px] leading-snug" data-howto={o.resId}>
                  {h.how ? (
                    <>
                      <dt className="font-semibold text-muted">{COPY.s4.howToLabel}</dt>
                      <dd className="m-0">{h.how}</dd>
                    </>
                  ) : null}
                  <dt className="font-semibold text-muted">{COPY.s4.contactLabel}</dt>
                  <dd className="m-0 text-unsure" data-contact="unconfirmed">{h.contact}</dd>
                </dl>
              ) : null;
            })()}
            <FeedbackButtons sent={lastFb(who.id, o.resId)} onSend={(kind, reason) => sendFb(who, o.resId, o.fns, kind, reason)} />
          </li>
        );
      })}
    </ol>
  );

  // documents
  const myVillage = region.points.find((p) => p.id === myPoint)?.villageId ?? s.store.villageId;
  const myPersonal = personal(region, cells, myPoint, myMode, fns);
  const residentDigest = digestFor(region, plan, myPersonal, s, conf);
  const residentReq: ComposeRequest = {
    docType: "resident",
    agencyResId: null,
    audience: { villageId: myVillage, mode: myMode, pointId: myPoint },
    scenarioId: sid === "custom" ? null : s.id,
    digest: residentDigest,
  };

  // agency tabs: only those that appear in the plan (store village, all modes) or residents' sets
  const used = new Set<string>();
  for (const vm of plan.byVM) if (vm.villageId === s.store.villageId) vm.set.forEach((x) => used.add(x));
  for (const r of residents) personal(region, cells, r.pointId, r.mode, fns).ordered.forEach((o) => used.add(o.resId));
  const tabs: { id: string; label: string; head?: string }[] = [];
  const add = (id: string, label: string, head?: string) => {
    if (!tabs.some((t) => t.id === id)) tabs.push({ id, label, head });
  };
  for (const id of Array.from(used).sort()) {
    const r = region.resources.find((x) => x.id === id);
    if (!r) continue;
    if (r.cls === "hanaro" || (r.cls === "hubdrop" && r.deliverer === "hanaro_hwasan")) add("hanaro_hwasan", COPY.s4.agency.hanaro);
    if (r.cls === "tour") add(r.id, COPY.s4.agency.tour, COPY.s4.agency.tourHead);
    if (r.cls === "hub") add(r.id, COPY.s4.agency.hub(r.name));
    if (r.cls === "care_link") add(r.id, COPY.s4.agency.care, COPY.s4.agency.careHead);
  }
  const curTab = tabs.find((t) => t.id === tab) ?? tabs[0];
  const agencyVM = plan.byVM.find((v) => v.villageId === s.store.villageId && v.mode === myMode) ?? plan.byVM[0];
  const agencyReq: ComposeRequest | null =
    curTab && agencyVM
      ? {
          docType: "agency",
          agencyResId: curTab.id,
          audience: { villageId: s.store.villageId, mode: myMode },
          scenarioId: sid === "custom" ? null : s.id,
          digest: digestFor(region, plan, agencyVM, s, conf),
        }
      : null;

  const findPre = (req: ComposeRequest): ComposeResponse | null => {
    if (!state) return null;
    const hit = s.precomputed.compose.find(
      (c) =>
        c.state === state &&
        c.docType === req.docType &&
        (c.agencyResId ?? null) === (req.agencyResId ?? null) &&
        (req.docType === "agency" || (c.audience.villageId === req.audience.villageId && c.audience.mode === req.audience.mode && (c.audience.pointId ?? null) === (req.audience.pointId ?? null))),
    );
    return hit ? ({ ...(hit.response as ComposeResponse), mode: (hit.response as ComposeResponse)?.template ? "template" : "precomputed" } as ComposeResponse) : null;
  };

  // test sentence (영상 #14): checked against the SC demo-state digest of the first resident
  const demoCells = makeCells(region, fns, s.demoConfirmations);
  const demoPlan = planScope(region, demoCells, s.store, fns);
  const r0 = residents[0];
  const testDigest: PlanDigest | null = r0 ? digestFor(region, demoPlan, personal(region, demoCells, r0.pointId, r0.mode, fns), s, s.demoConfirmations) : null;
  const regionNames = region.resources.map((r) => ({ name: r.name }));
  const test = testDigest ? groundText(COPY.s4.testSentence, testDigest, regionNames) : null;

  const residentViews = residents.map((r) => residentView(region, cells, r, fns));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        {temp ? <Badge tone="warn">{COPY.badge.tempScenario}</Badge> : null}
        {mock ? <Badge tone="warn">{COPY.badge.mock}</Badge> : null}
        {conf.some((c) => c.by === "시연 입력값") ? <Badge tone="demo">{COPY.badge.demoValue}</Badge> : null}
      </div>
      <h1 className="m-0 text-[26px] font-extrabold leading-tight sm:text-[30px]">{COPY.nav.s4}</h1>

      {/* mode buttons + my conditions */}
      <section className="rounded-2xl border border-line bg-card p-4" data-mycond="1">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="이동 유형">
          {MODE_ORDER.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={m === myMode}
              onClick={() => {
                setMyMode(m);
                setMyPoint(residents.find((r) => r.mode === m)?.pointId ?? null);
              }}
              className={`min-h-12 rounded-xl border-2 px-4 text-[17px] font-bold ${m === myMode ? "border-ink bg-ink text-white" : "border-line bg-white"}`}
              data-mode-btn={m}
            >
              {COPY.modeResident[m]}
            </button>
          ))}
        </div>
        <h2 className="mt-4 mb-2 text-[18px] font-bold">{COPY.s4.myCond}</h2>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-[15px] font-semibold">{COPY.s4.livePlace}</span>
            <select value={myPoint} onChange={(e) => setMyPoint(e.target.value)} className="min-h-11 max-w-full rounded-xl border-2 border-line bg-white px-2 text-[16px]">
              {region.villages.map((v) => (
                <optgroup key={v.id} label={v.name}>
                  {region.points
                    .filter((p) => p.villageId === v.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {pointName(region, p.id)}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="mb-1 text-[15px] font-semibold">{COPY.s4.badDays}</legend>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => {
                const on = badDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setBadDays((p) => (on ? p.filter((x) => x !== d) : [...p, d]))}
                    className={`min-h-10 rounded-full border-2 px-3 text-[15px] font-semibold ${on ? "border-warn bg-[#fbe9e4] text-warn" : "border-line bg-white"}`}
                  >
                    {d.slice(0, 1)}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
        <ResidentCard
          className="mt-4"
          testId="me"
          virtual={false}
          title={`${COPY.s4.myResult} · ${COPY.modeResident[myMode]} · ${pointName(region, myPoint)}`}
          rows={myView.rows}
          countY={myView.countY}
          countU={myView.countU}
          countN={myView.countN}
          headerExtra={<span className="text-[13px] text-muted">{COPY.s4.myResultNote}</span>}
        >
          {rankLines(myView, { id: "me", name: COPY.s4.myResult, pointId: myPoint, mode: myMode }, myOrdered)}
        </ResidentCard>
      </section>

      {/* resident cards */}
      <section className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3" data-residents={residents.length}>
        {residentViews.map((v) => (
          <ResidentCard
            key={v.resident.id}
            testId={`resident-${v.resident.id}`}
            title={COPY.s4.card(v.resident.name, v.resident.age, COPY.modeResident[v.resident.mode], pointName(region, v.resident.pointId))}
            rows={v.rows}
            countY={v.countY}
            countU={v.countU}
            countN={v.countN}
            narrow
          >
            {rankLines(v, { id: v.resident.id, name: v.resident.name, pointId: v.resident.pointId, mode: v.resident.mode })}
            {socialOn ? <p className="mt-3 mb-0 text-[15px] font-semibold text-brand">{COPY.s4.socialLine}</p> : null}
          </ResidentCard>
        ))}
      </section>

      {/* big-text notice */}
      <section className="rounded-2xl border-2 border-ink/70 bg-card p-4" data-bigtext="1">
        <h2 className="m-0 text-[22px] font-extrabold">{COPY.s4.bigText.title}</h2>
        <p className="m-0 text-[14px] text-muted">{COPY.s4.bigText.note}</p>
        <DocBlock req={residentReq} pre={findPre(residentReq)} big />
      </section>

      {/* agency request tabs */}
      {tabs.length ? (
        <section className="rounded-2xl border border-line bg-card p-4" data-agency="1">
          <h2 className="m-0 text-[20px] font-bold">{COPY.s4.agency.title}</h2>
          <div className="mt-2 flex flex-wrap gap-2" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={curTab?.id === t.id}
                onClick={() => setTab(t.id)}
                className={`min-h-11 rounded-xl border-2 px-3 text-[15px] font-semibold ${curTab?.id === t.id ? "border-ink bg-ink text-white" : "border-line bg-white"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {curTab?.head ? <p className="mt-3 mb-0 text-[15px] font-semibold text-unsure">{curTab.head}</p> : null}
          {agencyReq ? <DocBlock key={curTab?.id} req={agencyReq} pre={findPre(agencyReq)} /> : null}
        </section>
      ) : null}

      {/* filtered examples */}
      <section className="rounded-2xl border border-line bg-card p-4" data-filtered="1">
        <h2 className="m-0 text-[20px] font-bold">{COPY.s4.filtered.title}</h2>
        <ul className="m-0 mt-2 flex list-none flex-col gap-3 p-0">
          {test ? (
            <li className="rounded-xl border border-warn/50 bg-[#fdf3f0] p-3" data-test-sentence={test.pass ? "pass" : "blocked"}>
              <Badge tone="demo">{COPY.s4.filtered.testBadge}</Badge>
              <p className={`mt-1.5 mb-0 text-[18px] ${test.pass ? "" : "text-warn line-through decoration-2"}`}>{COPY.s4.testSentence}</p>
              {test.blocked.map((b, i) => (
                <p key={i} className="mt-1 mb-0 text-[15px] font-semibold text-warn">
                  {b.reason}
                </p>
              ))}
            </li>
          ) : null}
          {examples.length ? <li className="text-[14px] text-muted">{COPY.s4.e4Examples}</li> : null}
          {examples.map((e, i) => (
            <li key={i} className="rounded-xl border border-line p-3">
              <p className="m-0 text-[17px] text-warn line-through decoration-2">{e.sentence}</p>
              <p className="mt-1 mb-0 text-[15px] font-semibold text-warn">{e.reason}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
        <GateButton sid={sid} step="g3" note={COPY.s4.approveNote} />
      </div>

      {toast ? (
        <div role="status" className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-xl bg-ink px-4 py-3 text-center text-[16px] font-semibold text-white shadow-lg" data-toast="1">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

const docCache = new Map<DocKey, ComposeResponse>();

function DocBlock({ req, pre, big = false }: { req: ComposeRequest; pre: ComposeResponse | null; big?: boolean }) {
  const key = JSON.stringify(req);
  const [fetched, setFetched] = useState<Record<DocKey, ComposeResponse>>({});
  const res = pre ?? fetched[key] ?? docCache.get(key) ?? null;
  const need = !res;
  useEffect(() => {
    if (!need) return;
    let alive = true;
    apiCompose(JSON.parse(key) as ComposeRequest).then((r) => {
      docCache.set(key, r);
      if (alive) setFetched((f) => ({ ...f, [key]: r }));
    });
    return () => {
      alive = false;
    };
  }, [key, need]);
  if (!res) return <p className="mt-3 mb-0 text-[16px] text-muted">{COPY.s4.noDoc}</p>;
  return (
    <div className="mt-3 flex flex-col gap-2" data-doc={req.docType} data-doc-mode={res.mode}>
      <div className="flex flex-wrap items-center gap-2">
        <ModeBadge mode={res.template ? "template" : res.mode} model={res.model} at={res.generatedAt} />
      </div>
      <GroundingPanel grounding={res.grounding} template={res.template} fallbackReason={res.fallbackReason} />
      <div className={`whitespace-pre-line rounded-xl bg-white p-4 leading-relaxed ${big ? "text-[22px] font-medium" : "text-[17px]"}`}>{res.text}</div>
    </div>
  );
}
