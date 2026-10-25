"use client";
// S2 생활기능 분해 as a ledger: the shop owner's memo is a 「가게 쪽지」 (ruled note, evidence phrases underlined in
// pencil with the same number tag as their line), and each 생활 일 is one ledger line: number · name · 중요도
// (stamp boxes 1~3) · 근거 · 끄기/켜기 · code in pencil. Logic (edits, type-only toggle) unchanged.
import { useMemo, useState } from "react";
import type { FnCode, FunctionPiece, Scenario } from "@/lib/types";
import { COPY } from "@/lib/copy";
import { CORE_FNS, SOCIAL_FNS } from "@/lib/ontology";
import { typeFns } from "@/lib/fallback/rules";
import { useScenarioState } from "@/lib/store/scenario";
import type { FnEdit } from "@/lib/store/local";
import { Badge, ModeBadge } from "@/components/Badge";
import { FnIcon } from "@/components/FnIcons";
import { GateButton, GatedLink } from "@/components/GateButton";
import { NoStore } from "@/components/NoStore";

export function FunctionsScreen({ sid, loaded, temp, mock }: { sid: string; loaded: Scenario | null; temp: boolean; mock: boolean }) {
  const st = useScenarioState(sid, loaded);
  const [typeOnly, setTypeOnly] = useState(false);

  const s = st.scenario;
  const d = st.decompose;
  const typeSet = useMemo(() => new Set<FnCode>(s ? typeFns(s.store.sbizSub) : []), [s]);

  if (!s || !d) return <NoStore />;

  const setEdit = (f: FunctionPiece, patch: Partial<FnEdit>) => {
    st.setEdits((prev) => {
      const base: FnEdit[] = st.fns.map((x) => ({ code: x.code, enabled: x.enabled, importance: x.importance }));
      const cur = prev.length ? prev : base;
      const merged = base.map((b) => cur.find((c) => c.code === b.code) ?? b);
      return merged.map((e) => (e.code === f.code ? { ...e, ...patch } : e));
    });
  };

  const living = st.fns.filter((f) => CORE_FNS.includes(f.code));
  const social = st.fns.filter((f) => SOCIAL_FNS.includes(f.code));
  const ordered = [...living, ...social];
  const tagOf = new Map<FnCode, number>(ordered.map((f, i) => [f.code, i + 1]));
  const active = st.fns.filter((f) => f.enabled).length;
  const fallbackNote =
    d.mode === "rules" && !temp ? (d.fallbackReason === "limit" ? COPY.fallback.limit : COPY.fallback.noAi) : null;
  const NF = COPY.s2.noteFields;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ModeBadge mode={d.mode} model={d.model} at={d.generatedAt} />
          {temp ? <Badge tone="warn">{COPY.badge.tempScenario}</Badge> : null}
          {mock ? <Badge tone="warn">{COPY.badge.mock}</Badge> : null}
        </div>
        <h1 className="sign m-0 border-b-2 border-ink pb-2 text-[32px] leading-[1.15] font-normal sm:text-[38px]">{COPY.s2.title(s.store.name)}</h1>
        {fallbackNote ? <p className="m-0 border-2 border-dashed border-pencil px-3 py-2 text-[16px] font-medium text-ink">{fallbackNote}</p> : null}
      </div>

      {/* 가게 쪽지 */}
      <section className="min-w-0 border border-rule bg-[#fbfcf9]" aria-labelledby="note-title">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b-2 border-ink px-4 py-2">
          <h2 id="note-title" className="m-0 text-[20px] font-semibold">{COPY.s2.note}</h2>
          <dl className="m-0 flex flex-wrap gap-x-5 gap-y-0 text-[15px]">
            <div className="flex gap-1.5"><dt className="text-pencil-ink">{NF.sbizSub}</dt><dd className="m-0 font-medium">{s.store.sbizSub}</dd></div>
            <div className="flex gap-1.5"><dt className="text-pencil-ink">{NF.hours}</dt><dd className="num m-0 font-medium">{s.store.hours}</dd></div>
            <div className="flex gap-1.5"><dt className="text-pencil-ink">{NF.items}</dt><dd className="m-0 font-medium">{s.store.items.join("·")}</dd></div>
          </dl>
        </div>
        <p className="note-paper measure m-0 px-4 pt-1 pb-3 text-[18px]" data-memo="1">
          <Highlighted text={s.store.memo} phrases={st.fns.filter((f) => f.enabled).map((f) => ({ q: f.evidence, no: tagOf.get(f.code) ?? 0 }))} />
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={typeOnly}
          onClick={() => setTypeOnly((v) => !v)}
          className={`inline-flex min-h-11 items-center gap-2 rounded-[3px] border-2 px-4 text-[16px] font-semibold ${typeOnly ? "border-slate-deep bg-slate text-paper" : "border-slate bg-paper text-slate hover:bg-cell"}`}
          data-toggle="type-only"
        >
          <span aria-hidden="true" className={`relative inline-block h-4 w-8 rounded-[2px] border-2 ${typeOnly ? "border-paper" : "border-slate"}`}>
            <span className={`absolute top-0 h-full w-3 ${typeOnly ? "right-0 bg-paper" : "left-0 bg-slate"}`} />
          </span>
          {COPY.s2.typeOnlyToggle}
        </button>
        {typeOnly ? (
          <p className="m-0 text-[18px] font-semibold" data-type-only-text="1">
            {COPY.s2.typeOnly(typeSet.size, active)}
          </p>
        ) : null}
      </div>

      <PieceRows title={COPY.s2.rowLiving} pieces={living} typeOnly={typeOnly} typeSet={typeSet} tagOf={tagOf} onEdit={setEdit} />
      {social.length ? (
        <PieceRows title={COPY.s2.rowSocial.title} desc={COPY.s2.rowSocial.desc} pieces={social} typeOnly={typeOnly} typeSet={typeSet} tagOf={tagOf} onEdit={setEdit} />
      ) : null}

      {d.unknowns.length ? (
        <section className="border-2 border-dashed border-pencil px-4 py-3">
          <h2 className="m-0 text-[18px] font-semibold">{COPY.s2.unknowns}</h2>
          <ul className="mt-1 mb-0 pl-5 text-[16px]">
            {d.unknowns.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 border-t-2 border-ink pt-3">
        <GateButton sid={sid} step="g1" />
        <GatedLink sid={sid} step="g1" href={`/s/${sid}/plan`} label={COPY.next.s3} />
      </section>
    </div>
  );
}

function PieceRows({
  title,
  desc,
  pieces,
  typeOnly,
  typeSet,
  tagOf,
  onEdit,
}: {
  title: string;
  desc?: string;
  pieces: FunctionPiece[];
  typeOnly: boolean;
  typeSet: Set<FnCode>;
  tagOf: Map<FnCode, number>;
  onEdit: (f: FunctionPiece, patch: Partial<FnEdit>) => void;
}) {
  return (
    <section className="min-w-0">
      <div className="border-b-2 border-ink pb-1.5">
        <h2 className="m-0 text-[22px] font-semibold">{title}</h2>
        {desc ? <p className="m-0 text-[15px] text-pencil-ink">{desc}</p> : null}
      </div>
      <ol className="m-0 list-none p-0">
        {pieces.map((f) => {
          const hidden = typeOnly && !typeSet.has(f.code);
          return (
            <li
              key={f.code}
              className="fx grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-rule py-3 md:grid-cols-[13rem_auto_minmax(0,1fr)_auto_3rem]"
              style={{ opacity: hidden ? 0.3 : f.enabled ? 1 : 0.55 }}
              data-piece={f.code}
              data-enabled={f.enabled ? "1" : "0"}
              data-type-only-hidden={hidden ? "1" : "0"}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="tag-no">{tagOf.get(f.code)}</span>
                <FnIcon code={f.code} size={24} className="shrink-0 text-pencil-ink" />
                <span className="sign text-[26px] leading-none">{COPY.fnName[f.code]}</span>
              </div>
              <span className="text-right text-[14px] text-pencil-ink md:order-last">{f.code}</span>
              <div className="flex items-center gap-2" role="group" aria-label={COPY.s2.importance}>
                <span className="text-[14px] font-semibold text-pencil-ink">{COPY.s2.importance}</span>
                <span className="flex">
                  {([1, 2, 3] as const).map((n) => {
                    const on = f.importance === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => onEdit(f, { importance: n })}
                        className={`-ml-[2px] h-11 w-11 border-2 text-[16px] font-semibold first:ml-0 first:rounded-l-[3px] last:rounded-r-[3px] ${
                          on ? "relative z-[1] border-slate-deep bg-slate text-paper" : n < f.importance ? "border-slate bg-cell text-slate" : "border-slate bg-paper text-slate hover:bg-cell"
                        }`}
                        aria-label={`${COPY.s2.importance} ${n}`}
                        aria-pressed={on}
                      >
                        {n}
                      </button>
                    );
                  })}
                </span>
              </div>
              <div className="col-span-2 min-w-0 md:col-span-1">
                {f.evidence ? <p className="m-0 text-[16px] leading-snug">{COPY.s2.evidence(f.evidence)}</p> : null}
                {f.needsCheck ? <p className="m-0 mt-0.5 text-[15px] font-semibold text-ink">{COPY.s2.needsCheck}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => onEdit(f, { enabled: !f.enabled })}
                className="min-h-11 justify-self-start rounded-[3px] border-2 border-slate bg-paper px-4 text-[16px] font-semibold text-slate hover:bg-cell md:justify-self-end"
                aria-pressed={!f.enabled}
              >
                {f.enabled ? COPY.s2.off : COPY.s2.on}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Highlighted({ text, phrases }: { text: string; phrases: { q: string; no: number }[] }) {
  const ranges: { a: number; b: number; nos: number[] }[] = [];
  for (const p of phrases) {
    const q = p.q.trim();
    if (q.length < 2) continue;
    const i = text.indexOf(q);
    if (i >= 0) ranges.push({ a: i, b: i + q.length, nos: [p.no] });
  }
  ranges.sort((x, y) => x.a - y.a || x.nos[0] - y.nos[0]);
  const merged: { a: number; b: number; nos: number[] }[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.a <= last.b) {
      last.b = Math.max(last.b, r.b);
      last.nos.push(...r.nos);
    } else merged.push({ ...r, nos: [...r.nos] });
  }
  const out: React.ReactNode[] = [];
  let pos = 0;
  merged.forEach(({ a, b, nos }, k) => {
    if (a > pos) out.push(text.slice(pos, a));
    out.push(
      <span key={k}>
        <mark className="pencil-underline bg-transparent text-ink">{text.slice(a, b)}</mark>
        {[...new Set(nos)].sort((x, y) => x - y).map((no) => (
          <span key={no} className="tag-no">{no}</span>
        ))}
      </span>,
    );
    pos = b;
  });
  if (pos < text.length) out.push(text.slice(pos));
  return <>{out}</>;
}
