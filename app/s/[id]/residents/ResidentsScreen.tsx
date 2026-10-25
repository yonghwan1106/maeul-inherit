"use client";
// S4 주민별 대안·안내: big mode tabs (주민 문구), 내 조건 as a form, resident ledgers with numbered 순위 lines
// (이용방법 | 연락처 as form cells), the 「마을 안내문」 sheet (engine groups 확실 / 확인 중 / 끊김 + the AI draft in big
// type), 연계 요청문 index tabs, 거른 예시, and the 결재란 승인 box. Logic (engine calls, documents, feedback) unchanged.
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
import { Badge, GoneWord, ModeBadge, PencilWord, Stamp } from "@/components/Badge";
import { ResidentCard } from "@/components/ResidentCard";
import { FeedbackButtons } from "@/components/FeedbackButtons";
import { GroundingPanel } from "@/components/GroundingPanel";
import { GateButton } from "@/components/GateButton";
import { NoStore } from "@/components/NoStore";

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

  if (!s || !bundle) return <NoStore />;

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
  const rankParts = (v: ResidentView, fnsOf: FnCode[]) => {
    const sure = (f: FnCode) => v.rows.find((r) => r.code === f)?.tri === "Y";
    const fy = fnsOf.filter(sure), fu = fnsOf.filter((f) => !sure(f));
    const j = (xs: FnCode[]) => xs.map((f) => COPY.fnName[f]).join("·");
    return { y: fy.length ? j(fy) : null, u: fu.length ? j(fu) : null };
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
    <ol className="m-0 mt-3 flex list-none flex-col p-0">
      {ordered.map((o, i) => {
        const note = confNoteFor(o.resId, cells.applied, cells.registry);
        const days = daysIn(note ?? "");
        const name = resName(region, o.resId) + (days.length ? `(${days.join("·")})` : "");
        const parts = rankParts(v, o.fns);
        const h = howTo(o.resId, o.fns);
        return (
          <li key={o.resId} className="border-t border-rule py-3" data-rank={o.resId}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="num inline-flex h-7 items-center border border-ink px-1.5 text-[14px] font-semibold">{COPY.s4.rankNo(i + 1)}</span>
              <span className="text-[17px] font-semibold">{name}</span>
              {tourBlocked(o.resId) && who.id === "me" ? <span className="text-[14px] text-pencil-ink">({COPY.s4.badDays})</span> : null}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[17px]">
              {parts.y ? (
                <span className="flex items-center gap-2">
                  <span>{parts.y}</span>
                  <Stamp size="sm" tilt={-6} />
                </span>
              ) : null}
              {parts.u ? (
                <span className="hatch flex items-center gap-2 px-1.5 py-1">
                  <span className="bg-paper px-1">{parts.u}</span>
                  <PencilWord />
                </span>
              ) : null}
            </div>
            {h ? (
              <dl className="m-0 mt-2 grid grid-cols-[5.5em_minmax(0,1fr)] border-t border-rule text-[14px] leading-snug" data-howto={o.resId}>
                {h.how ? (
                  <>
                    <dt className="border-b border-rule py-1 pr-2 font-semibold text-pencil-ink">{COPY.s4.howToLabel}</dt>
                    <dd className="m-0 border-b border-l border-rule py-1 pl-2">{h.how}</dd>
                  </>
                ) : null}
                <dt className="border-b border-rule py-1 pr-2 font-semibold text-pencil-ink">{COPY.s4.contactLabel}</dt>
                <dd className="m-0 border-b border-l border-rule py-1 pl-2 text-pencil-ink" data-contact="unconfirmed">{h.contact}</dd>
              </dl>
            ) : null}
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
  const seatName = (region.meta?.seat as { name?: unknown } | undefined)?.name;
  const regionNames = [...region.resources.map((r) => ({ name: r.name })), ...(typeof seatName === "string" && seatName ? [{ name: seatName }] : [])];
  const test = testDigest ? groundText(COPY.s4.testSentence, testDigest, regionNames) : null;

  const residentViews = residents.map((r) => residentView(region, cells, r, fns));
  const h2 = "m-0 text-[24px] font-semibold leading-snug";
  const groups = (["Y", "U", "N"] as const).map((t) => ({ t, rows: myView.rows.filter((r) => r.tri === t) })).filter((g) => g.rows.length);
  const groupTitle = { Y: COPY.s4.bigText.groupY, U: COPY.s4.bigText.groupU, N: COPY.s4.bigText.groupN };

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        {temp || mock || conf.some((c) => c.by === "시연 입력값") ? (
          <div className="flex flex-wrap items-center gap-2">
            {temp ? <Badge tone="warn">{COPY.badge.tempScenario}</Badge> : null}
            {mock ? <Badge tone="warn">{COPY.badge.mock}</Badge> : null}
            {conf.some((c) => c.by === "시연 입력값") ? <Badge tone="demo">{COPY.badge.demoValue}</Badge> : null}
          </div>
        ) : null}
        <h1 className="m-0 border-b-2 border-ink pb-2 font-normal">
          <span className="sign block text-[30px] leading-[1.1] sm:text-[38px]">{s.store.name}</span>
          <span className="sign mt-1 block text-[20px] leading-tight text-ink sm:text-[24px]">{COPY.nav.s4}</span>
        </h1>
      </div>

      {/* big mode tabs + my conditions */}
      <section className="flex min-w-0 flex-col gap-5" data-mycond="1">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={COPY.s4.modeTabs}>
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
              className={`min-h-14 rounded-[3px] border-2 px-4 text-left text-[20px] font-semibold ${m === myMode ? "border-ink bg-slate text-paper" : "border-slate bg-paper text-slate hover:bg-cell"}`}
              data-mode-btn={m}
            >
              {COPY.modeResident[m]}
            </button>
          ))}
        </div>
        <div className="border-t-2 border-ink pt-3">
          <h2 className={h2}>{COPY.s4.myCond}</h2>
          <div className="mt-2 grid grid-cols-1 border-t border-rule sm:grid-cols-[8em_minmax(0,1fr)]">
            <label htmlFor="my-point" className="border-b border-rule py-2 pr-3 text-[17px] font-semibold text-pencil-ink sm:py-3">{COPY.s4.livePlace}</label>
            <div className="border-b border-rule py-2 sm:border-l sm:py-2 sm:pl-3">
              <select id="my-point" value={myPoint} onChange={(e) => setMyPoint(e.target.value)} className="min-h-11 max-w-full rounded-[3px] border-2 border-slate bg-paper px-2 text-[17px] text-ink">
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
            </div>
            <span id="bad-days" className="border-b border-rule py-2 pr-3 text-[17px] font-semibold text-pencil-ink sm:py-3">{COPY.s4.badDays}</span>
            <div className="flex flex-wrap gap-1.5 border-b border-rule py-2 sm:border-l sm:pl-3" role="group" aria-labelledby="bad-days">
              {DAYS.map((d) => {
                const on = badDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    aria-label={d}
                    onClick={() => setBadDays((p) => (on ? p.filter((x) => x !== d) : [...p, d]))}
                    className={`h-11 w-11 rounded-[3px] border-2 text-[17px] font-semibold ${on ? "border-slate-deep bg-slate text-paper" : "border-slate bg-paper text-slate hover:bg-cell"}`}
                  >
                    {d.slice(0, 1)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <ResidentCard
          testId="me"
          virtual={false}
          title={[COPY.s4.myResult, COPY.modeResident[myMode], pointName(region, myPoint)]}
          rows={myView.rows}
          countY={myView.countY}
          countU={myView.countU}
          countN={myView.countN}
          headerExtra={<span className="text-[14px] text-pencil-ink">{COPY.s4.myResultNote}</span>}
        >
          {rankLines(myView, { id: "me", name: COPY.s4.myResult, pointId: myPoint, mode: myMode }, myOrdered)}
        </ResidentCard>
      </section>

      {/* 마을 안내문 — big-text notice */}
      <section className="min-w-0" data-bigtext="1">
        <div className="border-t-2 border-ink pt-3">
          <h2 className={h2}>{COPY.s4.bigText.title}</h2>
          <p className="m-0 text-[14px] text-pencil-ink">{COPY.s4.bigText.note}</p>
        </div>
        <article className="mt-3 max-w-3xl border-2 border-ink bg-paper" style={{ boxShadow: "inset 0 0 0 3px var(--paper), inset 0 0 0 4px var(--rule)" }}>
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-ink px-5 py-3">
            <span className="sign text-[30px] leading-none">{COPY.s4.bigText.sheet}</span>
            <span className="text-[14px] text-pencil-ink">
              {COPY.modeResident[myMode]}, {pointName(region, myPoint)}
            </span>
          </header>
          <div className="grid grid-cols-1 border-b border-rule sm:grid-cols-3">
            {groups.map((g) => (
              <div key={g.t} className={`border-b border-rule px-5 py-3 sm:border-b-0 sm:border-r last:border-r-0 ${g.t === "U" ? "hatch" : ""}`} data-notice-group={g.t}>
                <p className="m-0 mb-2 flex items-start gap-2">
                  {g.t === "Y" ? (
                    <Stamp size="sm" tilt={-6} className="mt-0.5" />
                  ) : g.t === "U" ? (
                    <PencilWord className="mt-1" />
                  ) : (
                    // 끊김: the diagonal crosses only this blank mark cell, never the words of the notice
                    <span className="slash mt-0.5 inline-flex h-9 w-12 shrink-0 items-center justify-center border border-ink">
                      <GoneWord />
                    </span>
                  )}
                  <span className="bg-paper px-1 text-[20px] font-semibold leading-snug [text-wrap:balance]">{groupTitle[g.t]}</span>
                </p>
                <ul className="m-0 list-none p-0 text-[20px] leading-snug">
                  {g.rows.map((r) => (
                    <li key={r.code} className="bg-paper/85 py-1">
                      <span className="font-semibold">{COPY.fnName[r.code]}</span>
                      {r.resName && r.tri !== "N" ? (
                        <span className="block text-[20px] text-ink">
                          {r.resName}
                          {r.note ? ` (${r.note})` : ""}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="m-0 px-5 pt-2 text-[17px] text-pencil-ink">{COPY.s4.bigText.groupNote}</p>
          <div className="px-5 pb-4">
            <DocBlock req={residentReq} pre={findPre(residentReq)} big />
          </div>
        </article>
      </section>

      {/* resident ledgers */}
      <section className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3" data-residents={residents.length}>
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
            {socialOn ? <p className="mt-2 mb-0 border-t border-rule pt-2 text-[17px] font-medium">{COPY.s4.socialLine}</p> : null}
          </ResidentCard>
        ))}
      </section>

      {/* agency request tabs */}
      {tabs.length ? (
        <section className="min-w-0" data-agency="1">
          <div className="border-t-2 border-ink pt-3">
            <h2 className={h2}>{COPY.s4.agency.title}</h2>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-1 border-b-2 border-ink" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={curTab?.id === t.id}
                onClick={() => setTab(t.id)}
                className={`-mb-[2px] min-h-11 rounded-t-[3px] border-2 px-3 text-[17px] font-semibold ${curTab?.id === t.id ? "border-ink border-b-slate bg-slate text-paper" : "border-rule border-b-ink bg-paper text-slate hover:bg-cell"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {curTab?.head ? <p className="mt-3 mb-0 text-[17px] font-semibold text-ink">{curTab.head}</p> : null}
          {agencyReq ? <DocBlock key={curTab?.id} req={agencyReq} pre={findPre(agencyReq)} /> : null}
        </section>
      ) : null}

      {/* filtered examples */}
      <section className="min-w-0" data-filtered="1">
        <div className="border-t-2 border-ink pt-3">
          <h2 className={h2}>{COPY.s4.filtered.title}</h2>
        </div>
        <ul className="m-0 mt-2 flex list-none flex-col p-0">
          {test ? (
            <li className="border-b border-rule py-3" data-test-sentence={test.pass ? "pass" : "blocked"}>
              <Badge tone="demo">{COPY.s4.filtered.testBadge}</Badge>
              <p className={`mt-1.5 mb-0 text-[20px] ${test.pass ? "" : "text-ink line-through decoration-ink decoration-2"}`}>{COPY.s4.testSentence}</p>
              {test.blocked.map((b, i) => (
                <p key={i} className="mt-1 mb-0 text-[17px] font-semibold text-ink">
                  {b.reason}
                </p>
              ))}
            </li>
          ) : null}
          {examples.length ? <li className="pt-3 text-[14px] font-semibold text-pencil-ink">{COPY.s4.e4Examples}</li> : null}
          {examples.map((e, i) => (
            <li key={i} className="border-b border-rule py-3">
              <p className="m-0 text-[17px] text-ink line-through decoration-ink decoration-2">{e.sentence}</p>
              <p className="mt-1 mb-0 text-[14px] font-semibold text-ink">{e.reason}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t-2 border-ink pt-3">
        <GateButton sid={sid} step="g3" note={COPY.s4.approveNote} />
      </section>

      {toast ? (
        <div role="status" className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-[3px] border-2 border-paper bg-ink px-4 py-3 text-center text-[17px] font-semibold text-paper outline outline-2 outline-ink" data-toast="1">
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
  if (!res) return <p className="mt-3 mb-0 text-[17px] text-pencil-ink">{COPY.s4.noDoc}</p>;
  return (
    <div className="mt-3 flex flex-col gap-2" data-doc={req.docType} data-doc-mode={res.mode}>
      <div className="flex flex-wrap items-center gap-2">
        <ModeBadge mode={res.template ? "template" : res.mode} model={res.model} at={res.generatedAt} />
      </div>
      <GroundingPanel grounding={res.grounding} template={res.template} fallbackReason={res.fallbackReason} />
      <div className={`whitespace-pre-line ${big ? "note-paper measure pt-[0.35em] text-[20px] font-medium sm:text-[24px]" : "border border-rule bg-paper p-4 text-[17px] leading-relaxed"}`}>{res.text}</div>
    </div>
  );
}
