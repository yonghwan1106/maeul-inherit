// Notation badges (가정·합성·가상 인물·시연 입력값 …), mode badge and 3-value text mark (spec 8.1).
import { COPY, ymd } from "@/lib/copy";
import type { Tri } from "@/lib/types";

type Tone = "neutral" | "assumed" | "demo" | "browser" | "report" | "mode" | "warn";

const TONE: Record<Tone, string> = {
  neutral: "border-line bg-card text-muted",
  assumed: "border-unsure/60 bg-unsure-soft text-unsure",
  demo: "border-warn/60 bg-[#fbe9e4] text-warn",
  browser: "border-[#6b7fb0]/60 bg-[#e9eef9] text-[#33466f]",
  report: "border-[#7a5aa6]/60 bg-[#f1eaf9] text-[#4d3270]",
  mode: "border-brand/50 bg-brand-soft text-brand",
  warn: "border-warn/60 bg-[#fbe9e4] text-warn",
};

export function Badge({ tone = "neutral", children, title }: { tone?: Tone; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[12px] font-medium leading-snug ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

export type AiMode = "live" | "precomputed" | "cache" | "rules" | "template";

/** 「실시간 AI」 / 「사전계산 · {model} · {YYYY-MM-DD}」 / 「데모 모드(규칙)」 / 「템플릿 문장」 */
export function ModeBadge({ mode, model, at }: { mode: AiMode | string | null | undefined; model?: string | null; at?: string | null }) {
  let text: string;
  if (mode === "live" || mode === "cache") text = COPY.modeBadge.live;
  else if (mode === "precomputed") text = COPY.modeBadge.precomputed(model ?? "", ymd(at));
  else if (mode === "template") text = COPY.modeBadge.template;
  else text = COPY.modeBadge.rules;
  return (
    <Badge tone="mode">
      <span data-mode={mode ?? "rules"}>{text}</span>
    </Badge>
  );
}

/** Text + symbol 3-value mark (● 확실 / ◐ 확인 중 / — 없음|끊김). */
export function TriMark({ tri, resident = false, className = "" }: { tri: Tri; resident?: boolean; className?: string }) {
  const word = (resident ? COPY.triResident : COPY.tri)[tri];
  const cls = tri === "Y" ? "text-sure font-bold" : tri === "U" ? "text-unsure font-semibold" : "text-gone";
  return (
    <span className={`${cls} ${className}`} data-tri={tri}>
      {tri === "Y" ? "●" : tri === "U" ? "◐" : "—"}
      <span className="sr-only"> {word}</span>
    </span>
  );
}
