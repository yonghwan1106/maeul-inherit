"use client";
// 「먼저 전화할 곳」 as a numbered phone memo (rank is a real order) + the generic confirmation input (S3):
// what to ask (the cell), how many 생활 일 rise if it is confirmed, 확실 / 아님 / 아직 모름 + 요일·시간 메모.
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
    `min-h-11 min-w-[5.5rem] rounded-[3px] border-2 px-3 text-[17px] font-semibold ${on ? "border-slate-deep bg-slate text-paper" : "border-slate bg-paper text-slate hover:bg-cell"}`;
  return (
    <div className="mt-3 flex flex-col gap-2" data-confirm={cellKey}>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn(current?.value === "Y")} aria-pressed={current?.value === "Y"} onClick={() => onSet("Y", note, "이 브라우저")} data-set="Y">
          {COPY.s3.voi.yes}
        </button>
        <button type="button" className={btn(current?.value === "N")} aria-pressed={current?.value === "N"} onClick={() => onSet("N", note, "이 브라우저")} data-set="N">
          {COPY.s3.voi.no}
        </button>
        <button type="button" className={btn(!current)} aria-pressed={!current} onClick={() => onSet(null, "", "이 브라우저")} data-set="U">
          {COPY.s3.voi.unknown}
        </button>
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 60))}
        placeholder={COPY.s3.voi.memoPlaceholder}
        className="min-h-11 w-full rounded-[3px] border-0 border-b-2 border-pencil bg-transparent px-1 py-2 text-[17px] placeholder:text-pencil-ink"
        aria-label={COPY.s3.voi.memoPlaceholder}
      />
      {realNamed ? <p className="m-0 text-[14px] font-semibold text-ink">{COPY.s3.voi.realNamed}</p> : null}
      {!realNamed && demo ? (
        <button
          type="button"
          onClick={() => {
            setNote(demo.note ?? "");
            onSet(demo.value, demo.note ?? "", "시연 입력값");
          }}
          className="min-h-11 self-start rounded-[3px] border-2 border-dashed border-ink bg-paper px-3 text-[17px] font-semibold text-ink hover:bg-cell"
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
  const gains: [string, number][] = [
    [COPY.modeOfficer.walk, item.dCount.walk],
    [COPY.modeOfficer.homebound, item.dCount.homebound],
    [COPY.modeOfficer.car, item.dCount.car],
  ];
  return (
    <article className="note-paper relative min-w-0 border border-rule py-3 pr-3 pl-12" data-voi={item.cellKey}>
      {/* memo-pad margin line */}
      <span aria-hidden="true" className="absolute top-0 bottom-0 left-9 border-l-2 border-rule" />
      {rank ? (
        <span className="sign num absolute top-2 left-2 w-7 text-center text-[30px] leading-none text-ink" aria-label={`${rank}`}>
          {rank}
        </span>
      ) : null}
      <h3 className={`m-0 font-semibold leading-snug ${compact ? "text-[17px]" : "text-[20px]"}`}>{item.label}</h3>
      {!item.realNamed ? (
        <div className="mt-1">
          <Badge tone="assumed">{COPY.badge.assumed}</Badge>
        </div>
      ) : null}
      <div className="num mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0 text-[17px]">
        <span className="text-[14px] font-semibold text-pencil-ink">{COPY.s3.voi.ifYesLabel}</span>
        {gains.map(([m, x]) => (
          <span key={m} className="font-medium">
            {COPY.s3.voi.gain(m, f1(x))}
          </span>
        ))}
      </div>
      <p className="num m-0 text-[14px] text-pencil-ink">{COPY.s3.voi.ifNo(f1(w))}</p>
      <ConfirmControls cellKey={item.cellKey} realNamed={item.realNamed} current={current} demo={demo} onSet={onSet} />
    </article>
  );
}
