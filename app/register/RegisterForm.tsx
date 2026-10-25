"use client";
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allItems = itemDraft.trim() ? Array.from(new Set([...items, ...itemDraft.split(/[,，、]/).map((x) => x.trim()).filter(Boolean)])).slice(0, ITEMS_MAX) : items;
    const sc = scenarios.find((s) => s.id === fromScenario);
    if (sc && sameAs(sc) && !itemDraft.trim()) {
      router.push(`/s/${sc.id}/functions`);
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
    router.push("/s/custom/functions");
  };

  const input = "w-full rounded-xl border-2 border-line bg-white px-3 py-2.5 text-[16px] focus:border-brand";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section aria-label="화산면 지도">
        <h1 className="m-0 text-[26px] font-extrabold">{COPY.s1.title}</h1>
        {mock ? <div className="mt-2"><Badge tone="warn">{COPY.badge.mock}</Badge></div> : null}
        <div className="mt-3">
          <VillageMap region={region} focusVillageId={villageId} onVillageClick={setVillageId} ariaLabel="화산면 리 대표점·마을회관·시설 지도" />
        </div>
        <p className="mt-2 mb-0 text-[14px] leading-relaxed text-muted">{COPY.s1.legend}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone="assumed">{COPY.badge.hubAssumed}</Badge>
          <Badge tone="neutral">{COPY.badge.sbizUnverified}</Badge>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-semibold text-muted">{COPY.s1.fillFrom}</span>
          {scenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => fill(s)}
              className={`min-h-11 rounded-xl border-2 px-3 py-1.5 text-left text-[15px] font-semibold ${fromScenario === s.id ? "border-brand bg-brand-soft text-brand" : "border-line bg-card"}`}
              data-fill={s.id}
            >
              {COPY.s0.scenarioTitles[s.id] ?? s.title}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[16px] font-bold">{COPY.s1.village}</span>
            <select value={villageId} onChange={(e) => setVillageId(e.target.value)} className={input} name="villageId">
              {region.villages.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.foodStores === 0 ? " (식료품 업소 0곳)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[16px] font-bold">{COPY.s1.sbizSub}</span>
            <select value={sbizSub} onChange={(e) => setSub(e.target.value)} className={input} name="sbizSub">
              {SUBS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="items" className="text-[16px] font-bold">
              {COPY.s1.items} <span className="text-[14px] font-normal text-muted">({COPY.s1.itemsHint})</span>
            </label>
            {items.length ? (
              <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                {items.map((it) => (
                  <li key={it}>
                    <button
                      type="button"
                      onClick={() => setItems((p) => p.filter((x) => x !== it))}
                      className="rounded-full border border-line bg-paper px-3 py-1 text-[15px]"
                      aria-label={`${it} 빼기`}
                    >
                      {it} ×
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

          <label className="flex flex-col gap-1.5">
            <span className="text-[16px] font-bold">{COPY.s1.hours}</span>
            <input value={hours} onChange={(e) => setHours(e.target.value)} className={input} placeholder="06:30-20:00" name="hours" />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[16px] font-bold">{COPY.s1.memo}</span>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value.slice(0, MEMO_MAX))}
              onBlur={() => setMemo((m) => redactPhones(m))}
              rows={5}
              maxLength={MEMO_MAX}
              placeholder={COPY.s1.memoPlaceholder}
              className={`${input} leading-relaxed`}
              name="memo"
            />
            <span className="flex flex-wrap justify-between gap-2 text-[14px] text-muted">
              <span>{COPY.s1.privacy}</span>
              <span className="num">{COPY.s1.count(memo.length)}</span>
            </span>
          </label>

          <button
            type="submit"
            disabled={busy}
            className="min-h-12 rounded-xl bg-brand px-5 text-[18px] font-bold text-white disabled:opacity-60"
            data-submit="decompose"
          >
            {busy ? COPY.s1.working : COPY.s1.submit}
          </button>
          {msg ? <p className="m-0 text-[15px] text-warn" role="status">{msg}</p> : null}
        </form>
      </section>
    </div>
  );
}
