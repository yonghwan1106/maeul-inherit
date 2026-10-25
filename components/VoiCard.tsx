"use client";
// 「먼저 전화할 곳」 card + generic confirmation input (S3). 확실 / 아님 / 아직 모름 + 요일·시간 메모.
// 「시연 값 넣기」 only on realNamed=false cells that have a scenario demo value (spec 5.6, 8.5).
import { useState } from "react";
import type { Confirmation, Tri, VoiItem } from "@/lib/types";
import { COPY, f1 } from "@/lib/copy";
import { Badge } from "./Badge";

export interface ConfirmControlsProps {
  cellKey: string;
  realNamed: boolean;
  current?: Confirmation;
  demo?: Confirmation;
  onSet: (value: Tri | null, note: string, by: Confirmation["by"]) => void;
}

export function ConfirmControls({ cellKey, realNamed, current, demo, onSet }: ConfirmControlsProps) {
  const [note, setNote] = useState(current?.note ?? "");
  const btn = (on: boolean) =>
    `min-h-11 rounded-xl border-2 px-3 text-[16px] font-bold ${on ? "border-ink bg-ink text-white" : "border-line bg-white"}`;
  return (
    <div className="mt-3 flex flex-col gap-2" data-confirm={cellKey}>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn(current?.value === "Y")} onClick={() => onSet("Y", note, "이 브라우저")} data-set="Y">
          ● {COPY.s3.voi.yes}
        </button>
        <button type="button" className={btn(current?.value === "N")} onClick={() => onSet("N", note, "이 브라우저")} data-set="N">
          — {COPY.s3.voi.no}
        </button>
        <button type="button" className={btn(!current)} onClick={() => onSet(null, "", "이 브라우저")} data-set="U">
          ◐ {COPY.s3.voi.unknown}
        </button>
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 60))}
        placeholder={COPY.s3.voi.memoPlaceholder}
        className="w-full rounded-xl border-2 border-line bg-white px-3 py-2 text-[16px]"
        aria-label={COPY.s3.voi.memoPlaceholder}
      />
      {realNamed ? <p className="m-0 text-[14px] font-semibold text-warn">{COPY.s3.voi.realNamed}</p> : null}
      {!realNamed && demo ? (
        <button
          type="button"
          onClick={() => {
            setNote(demo.note ?? "");
            onSet(demo.value, demo.note ?? "", "시연 입력값");
          }}
          className="min-h-11 self-start rounded-xl border-2 border-dashed border-warn bg-[#fbe9e4] px-3 text-[15px] font-bold text-warn"
          data-demo={cellKey}
        >
          {COPY.s3.voi.demo(demo.note ?? "")}
        </button>
      ) : null}
    </div>
  );
}

export function VoiCard({
  item,
  rank,
  current,
  demo,
  onSet,
  compact = false,
}: {
  item: VoiItem;
  rank?: number;
  current?: Confirmation;
  demo?: Confirmation;
  onSet: ConfirmControlsProps["onSet"];
  compact?: boolean;
}) {
  const w = ((item.uDropIfNo.car + item.uDropIfNo.walk + item.uDropIfNo.homebound) / 3) * 100;
  return (
    <article className={`rounded-2xl border-2 bg-card p-4 ${rank ? "border-brand/50" : "border-line"}`} data-voi={item.cellKey}>
      <div className="flex items-start gap-2">
        {rank ? (
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-[16px] font-extrabold text-white">{rank}</span>
        ) : null}
        <h3 className={`m-0 font-bold leading-snug ${compact ? "text-[16px]" : "text-[18px]"}`}>{item.label}</h3>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {!item.realNamed ? <Badge tone="assumed">{COPY.badge.assumed}</Badge> : null}
      </div>
      <p className="num mt-2 mb-0 text-[16px]">
        {COPY.s3.voi.ifYes(f1(item.dCount.walk), f1(item.dCount.homebound), f1(item.dCount.car))}
      </p>
      <p className="num mt-1 mb-0 text-[15px] text-muted">{COPY.s3.voi.ifNo(f1(w))}</p>
      <ConfirmControls cellKey={item.cellKey} realNamed={item.realNamed} current={current} demo={demo} onSet={onSet} />
    </article>
  );
}
