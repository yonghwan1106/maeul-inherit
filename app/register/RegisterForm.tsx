"use client";
// S1 시설 중단 등록 as a 「시설 중단 신고서」: ruled form cells (item name left, input right), the map as a side
// board. Pressing 「생활기능 나누기」 brings a shutter down over the form (a response to the press; skipped
// with reduced motion). Logic (fill, redact, decompose API, custom record) unchanged.
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Region, Scenario } from "@/lib/types";
import { COPY } from "@/lib/copy";
import { apiDecompose } from "@/lib/api";
import { redactPhones } from "@/lib/guard/redact";
import { keys, writeJson } from "@/lib/store/local";
import type { CustomRecord } from "@/lib/store/scenario";
import { VillageMap } from "@/components/Map";
import { Badge } from "@/components/Badge";

const SUBS = ["슈퍼마켓", "편의점", "반찬/식료품 소매업", "채소/과일 소매업", "정육점", "수산물 소매업"];
const MEMO_MAX = 600;
const ITEMS_MAX = 20;
const SHUTTER_MS = 480;

const reducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
};

export function RegisterForm({ region, scenarios, mock }: { region: Region; scenarios: Scenario[]; mock: boolean }) {
  const router = useRouter();
  const [villageId, setVillageId] = useState(region.villages.find((v) => v.foodStores === 0)?.id ?? region.villages[0]?.id ?? "");
  const [sbizSub, setSub] = useState(SUBS[0]);
  const [items, setItems] = useState<string[]>([]);
  const [itemDraft, setItemDraft] = useState("");
  const [hours, setHours] = useState("");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [fromScenario, setFromScenario] = useState<string | null>(null);
  const [shutter, setShutter] = useState(false);

  const fill = (s: Scenario) => {
    setVillageId(s.store.villageId);
    setSub(s.store.sbizSub);
    setItems([...s.store.items]);
    setItemDraft("");
    setHours(s.store.hours);
    setMemo(s.store.memo);
    setFromScenario(s.id);
    setMsg(null);
  };

  const addItems = (raw: string) => {
    const parts = raw.split(/[,，、]/).map((x) => x.trim()).filter(Boolean);
    if (!parts.length) return;
    setItems((prev) => Array.from(new Set([...prev, ...parts])).slice(0, ITEMS_MAX));
    setItemDraft("");
  };

  const sameAs = (s: Scenario) =>
    s.store.villageId === villageId &&
    s.store.sbizSub === sbizSub &&
    s.store.hours === hours &&
    s.store.memo === memo &&
    s.store.items.join("|") === items.join("|");

  /** shutter comes down, then navigate (no wait with reduced motion) */
  const go = (href: string) => {
    if (reducedMotion()) {
      router.push(href);
      return;
    }
    setShutter(true);
    window.setTimeout(() => router.push(href), SHUTTER_MS);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allItems = itemDraft.trim() ? Array.from(new Set([...items, ...itemDraft.split(/[,，、]/).map((x) => x.trim()).filter(Boolean)])).slice(0, ITEMS_MAX) : items;
    const sc = scenarios.find((s) => s.id === fromScenario);
    if (sc && sameAs(sc) && !itemDraft.trim()) {
      go(`/s/${sc.id}/functions`);
      return;
    }
    setBusy(true);
    setMsg(null);
    const cleanMemo = redactPhones(memo).slice(0, MEMO_MAX);
    const res = await apiDecompose({ sbizSub, items: allItems, hours, villageId, memo: cleanMemo });
    setBusy(false);
    if (!Array.isArray(res.functions) || res.functions.length === 0) {
      setMsg(res.message ?? COPY.fallback.noAi);
      return;
    }
    const v = region.villages.find((x) => x.id === villageId);
    const rec: CustomRecord = {
      scenario: {
        id: "custom",
        title: COPY.s1.title,
        officer: "",
        store: {
          name: `${v?.name ?? ""} 가게(직접 등록)`,
          villageId,
          lat: v?.lat ?? 0,
          lon: v?.lon ?? 0,
          sbizSub,
          items: allItems,
          hours,
          memo: cleanMemo,
        },
        residents: [],
        demoConfirmations: [],
        precomputed: { decompose: { inputHash: res.inputHash, response: res }, compose: [] },
      },
    };
    writeJson(keys.custom, rec);
    // a new custom store starts with no edits / confirmations / reports
    writeJson(keys.fn("custom"), null);
    writeJson(keys.conf("custom"), null);
    writeJson(keys.fb("custom"), null);
    writeJson(keys.gate("custom"), null);
    go("/s/custom/functions");
  };

  const input = "min-h-11 w-full rounded-[3px] border-2 border-pencil bg-paper px-3 py-2 text-[17px] text-ink placeholder:text-pencil-ink focus:border-slate";
  const rowCls = "grid grid-cols-1 border-b border-rule sm:grid-cols-[9.5em_minmax(0,1fr)]";
  const labCls = "px-3 pt-3 pb-1 text-[17px] font-semibold text-ink sm:border-r sm:border-rule sm:py-3";
  const fieldCls = "min-w-0 px-3 pb-3 sm:py-2.5";

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section aria-label="화산면 지도" className="min-w-0">
        <h1 className="sign m-0 border-b-2 border-ink pb-2 text-[30px] leading-tight font-normal sm:text-[38px]">{COPY.s1.title}</h1>
        {mock ? <div className="mt-2"><Badge tone="warn">{COPY.badge.mock}</Badge></div> : null}
        <div className="mt-4">
          <VillageMap region={region} focusVillageId={villageId} onVillageClick={setVillageId} ariaLabel="화산면 리 대표점·마을회관·시설 지도" />
        </div>
        <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[14px] text-ink">
          {COPY.s1.legend.map(([sym, label]) => (
            <li key={label} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={sym === "회색" ? "inline-block h-3 w-3 rounded-full bg-shutter" : "text-[14px] leading-none"}>
                {sym === "회색" ? "" : sym}
              </span>
              {sym === "회색" ? <span className="text-pencil-ink">{sym}</span> : null}
              <span>{label}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="assumed">{COPY.badge.hubAssumed}</Badge>
          <Badge tone="neutral">{COPY.badge.sbizUnverified}</Badge>
        </div>
      </section>

      <section className="min-w-0">
        <div className="mb-4 flex flex-col gap-2">
          <span className="text-[14px] font-semibold text-pencil-ink">{COPY.s1.fillFrom}</span>
          <div className="flex flex-wrap gap-2">
            {scenarios.map((s) => {
              const t = COPY.s0.scenarioTitles[s.id];
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => fill(s)}
                  aria-pressed={fromScenario === s.id}
                  className={`min-h-11 rounded-[3px] border-2 px-3 py-1.5 text-left leading-tight ${fromScenario === s.id ? "border-slate-deep bg-slate text-paper" : "border-slate bg-paper text-slate hover:bg-cell"}`}
                  data-fill={s.id}
                >
                  <span className="sign block text-[20px]">{t?.name ?? s.title}</span>
                  {t ? <span className="block text-[14px] font-medium">{t.desc}</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={submit} className="relative border-2 border-ink bg-paper" aria-labelledby="form-title">
          {/* response to the press: a shutter comes down over the form, at most one screen tall and anchored at the
              button end, so it is seen where the person pressed (skipped with reduced motion) */}
          {shutter ? <span aria-hidden="true" className="shutter-drop shutter absolute inset-x-0 bottom-0 z-20 h-full max-h-[100vh]" /> : null}
          <div className="relative overflow-hidden border-b-2 border-ink bg-cell px-3 py-2.5">
            <h2 id="form-title" className="sign m-0 text-[24px] font-normal">{COPY.s1.formTitle}</h2>
          </div>

          <div className={rowCls}>
            <label htmlFor="f-village" className={labCls}>{COPY.s1.village}</label>
            <div className={fieldCls}>
              <select id="f-village" value={villageId} onChange={(e) => setVillageId(e.target.value)} className={input} name="villageId">
                {region.villages.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                    {v.foodStores === 0 ? " (식료품 업소 0곳)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={rowCls}>
            <label htmlFor="f-sub" className={labCls}>{COPY.s1.sbizSub}</label>
            <div className={fieldCls}>
              <select id="f-sub" value={sbizSub} onChange={(e) => setSub(e.target.value)} className={input} name="sbizSub">
                {SUBS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={rowCls}>
            <label htmlFor="items" className={labCls}>
              {COPY.s1.items}
              <span className="block text-[14px] font-normal text-pencil-ink">{COPY.s1.itemsHint}</span>
            </label>
            <div className={`${fieldCls} flex flex-col gap-2`}>
              {items.length ? (
                <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                  {items.map((it) => (
                    <li key={it}>
                      <button
                        type="button"
                        onClick={() => setItems((p) => p.filter((x) => x !== it))}
                        className="min-h-11 rounded-[3px] border border-pencil bg-paper px-3 text-[17px] hover:bg-cell"
                        aria-label={`${it} 빼기`}
                      >
                        {it} <span aria-hidden="true" className="text-pencil-ink">×</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <input
                id="items"
                value={itemDraft}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/[,，、]/.test(v)) addItems(v);
                  else setItemDraft(v);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItems(itemDraft);
                  }
                }}
                onBlur={() => addItems(itemDraft)}
                className={input}
                placeholder="라면, 쌀, 두부"
              />
            </div>
          </div>

          <div className={rowCls}>
            <label htmlFor="f-hours" className={labCls}>{COPY.s1.hours}</label>
            <div className={fieldCls}>
              <input id="f-hours" value={hours} onChange={(e) => setHours(e.target.value)} className={`${input} num`} placeholder="06:30-20:00" name="hours" />
            </div>
          </div>

          <div className={rowCls}>
            <label htmlFor="f-memo" className={labCls}>{COPY.s1.memo}</label>
            <div className={`${fieldCls} flex flex-col gap-1.5`}>
              <textarea
                id="f-memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value.slice(0, MEMO_MAX))}
                onBlur={() => setMemo((m) => redactPhones(m))}
                rows={6}
                maxLength={MEMO_MAX}
                placeholder={COPY.s1.memoPlaceholder}
                className={`${input} note-paper`}
                name="memo"
              />
              <span className="flex flex-wrap justify-between gap-2 text-[14px] text-pencil-ink">
                <span>{COPY.s1.privacy}</span>
                <span className="num">{COPY.s1.count(memo.length)}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 px-3 py-3">
            <button
              type="submit"
              disabled={busy || shutter}
              className="min-h-12 rounded-[3px] border-2 border-slate-deep bg-slate px-6 text-[20px] font-semibold text-paper hover:bg-slate-deep disabled:opacity-70"
              data-submit="decompose"
            >
              {busy ? COPY.s1.working : COPY.s1.submit}
            </button>
            {msg ? <p className="m-0 text-[17px] font-semibold text-ink" role="status">{msg}</p> : null}
          </div>
        </form>
      </section>
    </div>
  );
}
