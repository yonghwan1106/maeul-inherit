// S5 평가 /eval (spec 8.7, bundle A). Every number on this page is read from data/eval/results.json —
// nothing is typed by hand. Blocks another bundle has not produced yet are shown as 「아직 실행 전」.
// Tables scroll inside their own box (min-w-0 on grid/section) so the page never scrolls sideways at 360 px.
import type { Metadata } from "next";
import { COPY } from "@/lib/copy";
import { loadResults } from "@/lib/data";
import type { Mode } from "@/lib/types";
import { SiteHeader } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/Badge";

export const metadata: Metadata = { title: `${COPY.nav.s5} — ${COPY.serviceName}` };

type J = Record<string, unknown>;
const MODES: Mode[] = ["car", "walk", "homebound"];
// Local labels not in COPY (structure only, no numbers).
const L = {
  pending: "아직 실행 전",
  pair: "합성 / 실문장",
  lUnit: "L 상승 기대값(%p, 이용권 리 평균) — 3번 확인 뒤",
  sum: "세 유형 합",
  pCol: "확인될 확률 p(가정)",
  examples: "차단 사례 원문",
  noData: "results.json이 아직 없습니다",
};

const get = (o: unknown, ...path: (string | number)[]): unknown => {
  let x: unknown = o;
  for (const k of path) {
    if (x === null || x === undefined || typeof x !== "object") return undefined;
    x = (x as J)[k as string];
  }
  return x;
};
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
// round half up with a small epsilon (0.595 is stored as 0.59499… and toFixed alone shows 0.59); + 0 drops -0
const rnd = (n: number, d: number) => (Math.round(n * 10 ** d + 1e-9) / 10 ** d + 0).toFixed(d);
const fx = (v: unknown, d = 2) => { const n = num(v); return n === null ? "—" : rnd(n, d); };
const pc = (v: unknown, d = 1) => { const n = num(v); return n === null ? "—" : `${rnd(n * 100, d)}%`; };
const kst = (iso: unknown) => {
  if (typeof iso !== "string") return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  const d = new Date(t + 9 * 3600 * 1000).toISOString();
  return `${d.slice(0, 10)} ${d.slice(11, 16)} KST`;
};

function Table({ head, rows, testId }: { head: React.ReactNode[]; rows: React.ReactNode[][]; testId: string }) {
  return (
    <div className="min-w-0">
    {/^s5-t[12]/.test(testId) ? <p className="m-0 mb-1 text-[14px] font-semibold text-pencil-ink sm:hidden" data-scroll-hint={testId}>{COPY.s5.t1.scrollHint}</p> : null}
    <div className="max-w-full overflow-x-auto">
      <table data-testid={testId} className="ledger min-w-[520px] text-[15px] sm:min-w-[560px]">
        <thead>
          <tr>{head.map((h, i) => <th key={i} className={`px-2 py-2 align-bottom text-[14px] leading-snug ${i ? "vr text-right" : "sticky left-0 z-10 bg-paper"}`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => <td key={j} className={`px-2 py-1.5 align-top ${j ? "vr num text-right" : "sticky left-0 z-10 bg-paper font-medium text-ink"}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}

function Section({ title, desc, children, pending, testId }: { title: string; desc?: string; children: React.ReactNode; pending?: boolean; testId: string }) {
  return (
    <section data-testid={testId} className="min-w-0 border-t-2 border-ink pt-3">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="m-0 text-[22px] font-semibold leading-snug">{title}</h2>
        {desc ? <span className="text-[15px] text-pencil-ink">{desc}</span> : null}
        {pending ? <Badge tone="warn">{L.pending}</Badge> : null}
      </div>
      {children}
    </section>
  );
}

export default function EvalPage() {
  const R = loadResults();
  const meta = (get(R, "meta") ?? {}) as J;
  const models = Array.isArray(meta.models) && meta.models.length ? (meta.models as string[]).join(", ") : "—";
  const c = COPY.s5;

  // --- E1
  const e1 = get(R, "e1") as J | undefined;
  const e1Pending = !e1 || e1.pending === true;
  const e1Sys = ["b0_type", "b0", "b0plus", "haiku55"];
  const pair = (s: string, ...p: string[]) => `${fx(get(e1, "systems", s, "synth", ...p))} / ${fx(get(e1, "systems", s, "real", ...p))}`;
  const pairInt = (s: string, ...p: string[]) => `${fx(get(e1, "systems", s, "synth", ...p), 0)} / ${fx(get(e1, "systems", s, "real", ...p), 0)}`;
  const e1Rows: React.ReactNode[][] = [
    [c.t1.rows[0], ...e1Sys.map((s) => fx(get(e1, "systems", s, "synth", "microF1")))],
    [c.t1.rows[1], ...e1Sys.map((s) => fx(get(e1, "systems", s, "real", "microF1")))],
    ...(["F06", "F07", "F09", "F10"] as const).map((f, i) => [<span key={f}>{c.t1.rows[2 + i]} <small className="text-[14px] text-pencil-ink">({L.pair})</small></span>, ...e1Sys.map((s) => pair(s, "recall", f))]),
    [<span key="trap">{c.t1.rows[6]} <small className="text-[14px] text-pencil-ink">({L.pair})</small></span>, ...e1Sys.map((s) => pairInt(s, "trapFP"))],
  ];
  const humanChecked = num(get(e1, "sets", "real", "humanChecked")) ?? 0;

  // --- E2
  const e2 = get(R, "e2") as J | undefined;
  const e2Pending = !e2 || e2.pending === true;
  const e2Sys = ["b1", "b1b", "b1g", "b2a", "b2b", "engine"];
  const e2Val = (s: string, m: Mode, k: string): unknown =>
    s === "b2a" || s === "b2b" ? get(e2, "systems", s, "byMode", m, k) : get(e2, "systems", s, m, k);
  const e2Blocks = MODES.map((m) => ({
    m,
    rows: [
      [c.t2.rows[0], ...e2Sys.map((s) => fx(e2Val(s, m, "countY")))],
      [c.t2.rows[1], ...e2Sys.map((s) => fx(e2Val(s, m, "countU")))],
      [c.t2.rows[2], ...e2Sys.map((s) => fx(e2Val(s, m, "countN")))],
      [c.t2.rows[3], ...e2Sys.map((s) => pc(e2Val(s, m, "L")))],
    ] as React.ReactNode[][],
  }));
  const errKeys = ["unknownRes", "accessN", "capN", "assertU", "over3"];
  const errRows: React.ReactNode[][] = errKeys.map((k, i) => [
    c.t2.errRows[i],
    ...e2Sys.map((s) => {
      if (s !== "b2a" && s !== "b2b") return "—";
      const cases = num(get(e2, "systems", s, "errors", k, "cases"));
      const total = num(get(e2, "systems", s, "errors", k, "total"));
      return cases === null ? "—" : <span title={`총 ${total ?? "—"}건`}>{c.t2.errCell(cases)}</span>;
    }),
  ]);

  // --- E3
  const e3 = get(R, "e3") as J | undefined;
  const e3Pending = !e3 || e3.pending === true;
  const strat = ["random", "nearest", "voi"];
  const e3Cell = (p: string, s: string) => {
    const sum = get(e3, "byP", p, s, "sum");
    if (num(sum) === null) return "—";
    return (
      <span title={`${COPY.modeOfficer.car} ${fx(get(e3, "byP", p, s, "car"))}, ${COPY.modeOfficer.walk} ${fx(get(e3, "byP", p, s, "walk"))}, ${COPY.modeOfficer.homebound} ${fx(get(e3, "byP", p, s, "homebound"))}`}>
        {fx(sum)}%p
        <small className="block text-[14px] leading-snug text-pencil-ink">
          <span className="block">{COPY.modeOfficer.car} {fx(get(e3, "byP", p, s, "car"), 1)}</span>
          <span className="block">{COPY.modeOfficer.walk} {fx(get(e3, "byP", p, s, "walk"), 1)}</span>
          <span className="block">{COPY.modeOfficer.homebound} {fx(get(e3, "byP", p, s, "homebound"), 1)}</span>
        </small>
      </span>
    );
  };
  const e3Rows: React.ReactNode[][] = ["0.3", "0.5", "0.7"].map((p) => [
    `p = ${p}`, ...strat.map((s) => e3Cell(p, s)), (() => { const r = num(get(e3, "byP", p, "ratioVoiRandom")); return r === null ? "—" : `×${r.toFixed(1)}`; })(),
  ]);

  // --- E4
  const e4 = get(R, "e4") as J | undefined;
  const e4Pending = !e4 || e4.pending === true;
  const e4Rows: React.ReactNode[][] = [[
    `n = ${fx(get(e4, "n"), 0)}`,
    pc(get(e4, "firstPass")), pc(get(e4, "regenRate")), pc(get(e4, "templateRate")), pc(get(e4, "finalPass")),
    pc(get(e4, "unit", "recall")), pc(get(e4, "unit", "falseBlock")),
  ]];
  const examples = (Array.isArray(get(e4, "examples")) ? get(e4, "examples") : []) as { sentence?: string; reason?: string }[];

  // --- engine line
  const ms = (k: "planMs" | "voiMs") => {
    const xs = ["sc1", "sc2", "sc3"].map((s) => num(get(R, "engine", k, s))).filter((x): x is number => x !== null);
    if (!xs.length) return "—";
    const lo = Math.min(...xs), hi = Math.max(...xs);
    return lo === hi ? lo.toFixed(1) : `${lo.toFixed(1)}~${hi.toFixed(1)}`;
  };
  const bfN = num(get(R, "engine", "bruteForceCases"));
  const bfX = num(get(R, "engine", "bruteForceMatch"));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-14 sm:pt-10">
        <h1 className="m-0 border-b-2 border-ink pb-2 font-normal">
          <span className="sign block text-[34px] leading-tight sm:text-[38px]">{c.title}</span>
          <span className="mt-1 block text-[17px] font-medium text-pencil-ink">{c.titleDesc}</span>
        </h1>
        {R ? (
          <dl data-testid="s5-meta" className="m-0 mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[15px]">
            {([
              [c.metaFields.runAt, kst(meta.runAt)],
              [c.metaFields.models, models],
              [c.metaFields.commit, String(meta.commit ?? "—")],
              [c.metaFields.seed, c.seed],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex gap-1.5">
                <dt className="text-pencil-ink">{k}</dt>
                <dd className="num m-0 font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-[16px] font-semibold text-ink">{L.noData}</p>
        )}

        <div className="mt-8 grid min-w-0 grid-cols-1 gap-10">
          <Section testId="s5-t1" title={c.t1.title} desc={c.t1.desc} pending={e1Pending}>
            <Table testId="s5-t1-table" head={["", ...c.t1.cols]} rows={e1Rows} />
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[15px] text-pencil-ink">
              <Badge tone="assumed">{COPY.badge.synth}</Badge>
              <span>{c.t1.realNote(humanChecked)}</span>
            </div>
          </Section>

          <Section testId="s5-t2" title={c.t2.title} desc={c.t2.desc} pending={e2Pending}>
            {e2Blocks.map((b) => (
              <div key={b.m} className="mb-4">
                <h3 className="mb-1 mt-0 text-[17px] font-semibold">{COPY.modeOfficer[b.m]}</h3>
                <Table testId={`s5-t2-${b.m}`} head={["", ...c.t2.cols]} rows={b.rows} />
              </div>
            ))}
            <Table testId="s5-t2-errors" head={["", ...c.t2.cols]} rows={errRows} />
            <p className="measure mb-0 mt-3 text-[15px] leading-relaxed text-pencil-ink">{c.t2.note}</p>
          </Section>

          <Section testId="s5-t3" title={c.t3.title} desc={c.t3.desc} pending={e3Pending}>
            <p className="mb-2 mt-0 text-[15px] text-pencil-ink">{L.lUnit}</p>
            <Table testId="s5-t3-table" head={[L.pCol, ...c.t3.cols, c.t3.ratio]} rows={e3Rows} />
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[15px] text-pencil-ink">
              <Badge tone="assumed">{COPY.badge.assumed}</Badge>
              <span>{c.t3.note}</span>
            </div>
          </Section>

          <Section testId="s5-t4" title={c.t4.title} desc={c.t4.desc} pending={e4Pending}>
            <Table testId="s5-t4-table" head={["", ...c.t4.cols]} rows={e4Rows} />
            <div className="mt-3 flex flex-wrap items-center gap-2"><Badge tone="assumed">{c.t4.unitBadge}</Badge></div>
            {examples.length ? (
              <div className="mt-4">
                <h3 className="mb-1 mt-0 text-[17px] font-semibold">{L.examples}</h3>
                <ul className="m-0 grid list-none p-0">
                  {examples.slice(0, 3).map((x, i) => (
                    <li key={i} className="border-b border-rule py-2 text-[16px]">
                      <span className="text-ink line-through decoration-ink decoration-2">{x.sentence ?? ""}</span>
                      <span className="block text-[15px] font-semibold text-ink">{x.reason ?? ""}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Section>

          <section className="min-w-0 border-t-2 border-ink pt-3">
            <h2 className="m-0 mb-2 text-[22px] font-semibold">{c.engineTitle}</h2>
            <dl data-testid="s5-engine" className="m-0 grid grid-cols-1 border-t border-rule text-[16px] sm:grid-cols-3">
              {c.engine(bfN ?? 0, bfX === null ? "—" : bfX.toFixed(3), ms("planMs"), ms("voiMs")).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 border-b border-rule px-1 py-2 sm:border-r sm:px-3 sm:last:border-r-0">
                  <dt className="text-pencil-ink">{k}</dt>
                  <dd className="num m-0 font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <aside data-testid="s5-limits" className="measure border-2 border-pencil p-4 text-[16px] leading-relaxed sm:p-5" style={{ boxShadow: "inset 0 0 0 2px var(--paper), inset 0 0 0 3px var(--pencil)" }}>
            <h2 className="m-0 mb-1 text-[18px] font-semibold">{c.limitsTitle}</h2>
            {c.limits}
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
