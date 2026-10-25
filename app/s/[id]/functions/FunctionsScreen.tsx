"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FnCode, FunctionPiece, Scenario } from "@/lib/types";
import { COPY } from "@/lib/copy";
import { CORE_FNS, SOCIAL_FNS } from "@/lib/ontology";
import { typeFns } from "@/lib/fallback/rules";
import { useScenarioState } from "@/lib/store/scenario";
import type { FnEdit } from "@/lib/store/local";
import { Badge, ModeBadge } from "@/components/Badge";
import { FnIcon } from "@/components/FnIcons";
import { GateButton, GatedLink } from "@/components/GateButton";

export function FunctionsScreen({ sid, loaded, temp, mock }: { sid: string; loaded: Scenario | null; temp: boolean; mock: boolean }) {
  const st = useScenarioState(sid, loaded);
  const [typeOnly, setTypeOnly] = useState(false);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  const s = st.scenario;
  const d = st.decompose;
  const typeSet = useMemo(() => new Set<FnCode>(s ? typeFns(s.store.sbizSub) : []), [s]);

  if (!s || !d) {
    return (
      <div className="rounded-2xl border border-line bg-card p-5">
        <p className="m-0 text-[17px]">등록된 가게가 없어요.</p>
        <Link href="/register" className="mt-3 inline-block font-semibold text-brand underline">{COPY.s0.register} →</Link>
      </div>
    );
  }

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
  const active = st.fns.filter((f) => f.enabled).length;
  const fallbackNote =
    d.mode === "rules" && !temp ? (d.fallbackReason === "limit" ? COPY.fallback.limit : COPY.fallback.noAi) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <ModeBadge mode={d.mode} model={d.model} at={d.generatedAt} />
        {temp ? <Badge tone="warn">{COPY.badge.tempScenario}</Badge> : null}
        {mock ? <Badge tone="warn">{COPY.badge.mock}</Badge> : null}
      </div>
      <h1 className="m-0 text-[26px] font-extrabold leading-tight sm:text-[30px]">{COPY.s2.title(s.store.name)}</h1>
      {fallbackNote ? <p className="m-0 rounded-xl bg-unsure-soft px-3 py-2 text-[15px] text-unsure">{fallbackNote}</p> : null}

      {/* store card: memo with evidence highlighted */}
      <section className="rounded-2xl border border-line bg-card p-4">
        <p className="m-0 text-[15px] text-muted">
          {s.store.sbizSub} · {s.store.hours} · {s.store.items.join("·")}
        </p>
        <p className="mt-2 mb-0 text-[17px] leading-relaxed" data-memo="1">
          <Highlighted text={s.store.memo} phrases={st.fns.filter((f) => f.enabled).map((f) => f.evidence)} />
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={typeOnly}
          onClick={() => setTypeOnly((v) => !v)}
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl border-2 px-4 text-[16px] font-semibold ${typeOnly ? "border-ink bg-ink text-white" : "border-line bg-card"}`}
          data-toggle="type-only"
        >
          <span aria-hidden="true" className={`inline-block h-4 w-7 rounded-full border-2 ${typeOnly ? "border-white bg-white/40" : "border-muted"}`} />
          {COPY.s2.typeOnlyToggle}
        </button>
        {typeOnly ? (
          <p className="m-0 text-[17px] font-bold" data-type-only-text="1">
            {COPY.s2.typeOnly(typeSet.size, active)}
          </p>
        ) : null}
      </div>

      <PieceRow
        title={COPY.s2.rowLiving}
        pieces={living}
        typeOnly={typeOnly}
        typeSet={typeSet}
        shown={shown}
        onEdit={setEdit}
      />
      {social.length ? (
        <PieceRow title={COPY.s2.rowSocial} pieces={social} typeOnly={typeOnly} typeSet={typeSet} shown={shown} onEdit={setEdit} offset={living.length} />
      ) : null}

      {d.unknowns.length ? (
        <section className="rounded-2xl border border-dashed border-unsure bg-unsure-soft p-4">
          <h2 className="m-0 text-[16px] font-bold text-unsure">{COPY.s2.unknowns}</h2>
          <ul className="mt-1 mb-0 pl-5 text-[16px]">
            {d.unknowns.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
        <GateButton sid={sid} step="g1" />
        <GatedLink sid={sid} step="g1" href={`/s/${sid}/plan`} label={COPY.next.s3} />
      </div>
    </div>
  );
}

function PieceRow({
  title,
  pieces,
  typeOnly,
  typeSet,
  shown,
  onEdit,
  offset = 0,
}: {
  title: string;
  pieces: FunctionPiece[];
  typeOnly: boolean;
  typeSet: Set<FnCode>;
  shown: boolean;
  onEdit: (f: FunctionPiece, patch: Partial<FnEdit>) => void;
  offset?: number;
}) {
  return (
    <section>
      <h2 className="m-0 mb-2 text-[18px] font-bold">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {pieces.map((f, i) => {
          const hidden = typeOnly && !typeSet.has(f.code);
          return (
            <article
              key={f.code}
              className={`fx flex flex-col gap-2 rounded-2xl border-2 bg-card p-3 ${f.enabled ? "border-brand/40" : "border-line"}`}
              style={{
                opacity: !shown ? 0 : hidden ? 0.15 : f.enabled ? 1 : 0.55,
                transform: shown ? "none" : "translateY(10px) scale(0.97)",
                transitionDelay: shown ? `${(offset + i) * 70}ms` : "0ms",
              }}
              data-piece={f.code}
              data-enabled={f.enabled ? "1" : "0"}
              data-type-only-hidden={hidden ? "1" : "0"}
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <FnIcon code={f.code} size={26} />
                </span>
                <span className="text-[18px] font-bold">{COPY.fnName[f.code]}</span>
                <span className="ml-auto text-[12px] text-muted">{f.code}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[15px]">
                <span>
                  {COPY.s2.importance} <span aria-label={`${f.importance} / 3`} className="tracking-widest text-brand">{"●".repeat(f.importance)}{"○".repeat(3 - f.importance)}</span>
                </span>
                <span className="ml-auto flex gap-1">
                  {([1, 2, 3] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onEdit(f, { importance: n })}
                      className={`h-8 w-8 rounded-lg border text-[14px] font-bold ${f.importance === n ? "border-brand bg-brand text-white" : "border-line bg-white"}`}
                      aria-label={`${COPY.s2.importance} ${n}`}
                    >
                      {n}
                    </button>
                  ))}
                </span>
              </div>
              {f.evidence ? <p className="m-0 text-[15px] leading-snug">{COPY.s2.evidence(f.evidence)}</p> : null}
              {f.needsCheck ? <p className="m-0 text-[14px] font-semibold text-unsure">{COPY.s2.needsCheck}</p> : null}
              <button
                type="button"
                onClick={() => onEdit(f, { enabled: !f.enabled })}
                className="mt-auto min-h-10 rounded-xl border-2 border-line bg-white text-[15px] font-semibold"
              >
                {f.enabled ? COPY.s2.off : COPY.s2.on}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Highlighted({ text, phrases }: { text: string; phrases: string[] }) {
  const ranges: [number, number][] = [];
  for (const p of phrases) {
    const q = p.trim();
    if (q.length < 2) continue;
    const i = text.indexOf(q);
    if (i >= 0) ranges.push([i, i + q.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  const out: React.ReactNode[] = [];
  let pos = 0;
  merged.forEach(([a, b], k) => {
    if (a > pos) out.push(text.slice(pos, a));
    out.push(
      <mark key={k} className="rounded bg-[#f5e3a8] px-0.5 text-ink">
        {text.slice(a, b)}
      </mark>,
    );
    pos = b;
  });
  if (pos < text.length) out.push(text.slice(pos));
  return <>{out}</>;
}
