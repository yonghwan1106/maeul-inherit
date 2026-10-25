// Notation badges (가정·합성·가상 인물·시연 입력값 …), mode badge and the 3-value ledger marks (spec 8.1).
// Ledger grammar (디자인 계획 §3): 확실 = round 인주 stamp, 확인 중 = pencil hatch + words, 끊김 = blank + diagonal.
// Red (--stamp) is used only by <Stamp>. Badges are small rectangular tags in pencil / ballpen / slate.
import { COPY, ymd } from "@/lib/copy";
import type { Tri } from "@/lib/types";

type Tone = "neutral" | "assumed" | "demo" | "browser" | "report" | "mode" | "warn";

const TONE: Record<Tone, string> = {
  neutral: "border border-pencil text-pencil-ink",
  assumed: "border border-dashed border-pencil text-pencil-ink",
  demo: "border-[1.5px] border-dashed border-ink text-ink font-semibold",
  browser: "border border-slate text-slate",
  report: "border border-ink text-ink",
  mode: "border border-slate text-slate",
  warn: "border-2 border-ink text-ink font-semibold",
};

export function Badge({ tone = "neutral", children, title }: { tone?: Tone; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center rounded-[2px] bg-paper px-1.5 py-px text-[14px] font-medium leading-snug ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

export type AiMode = "live" | "precomputed" | "cache" | "rules" | "template";

/** 「실시간 AI」 / 「사전계산한 답 ({model}, {M월 D일})」 / 「데모 모드(규칙)」 / 「템플릿 문장」 */
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

const TILTS = [-8, -4, -10, -6, -3, -9, -5, -7];
export const tiltOf = (i: number) => TILTS[((i % TILTS.length) + TILTS.length) % TILTS.length];

/** The 인주 stamp. The only element on any screen drawn in red. */
export function Stamp({
  word = COPY.tri.Y,
  size = "md",
  land = false,
  tilt,
  className = "",
  style,
}: {
  word?: string;
  size?: "sm" | "md" | "lg";
  land?: boolean;
  tilt?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const cls = size === "sm" ? "stamp stamp-sm" : size === "lg" ? "stamp stamp-lg" : "stamp";
  return (
    <span
      className={`${cls} ${land ? "stamp-land" : ""} ${className}`}
      style={{ ...(tilt !== undefined ? ({ "--tilt": `${tilt}deg` } as React.CSSProperties) : null), ...style }}
    >
      {word}
    </span>
  );
}

/** 「확인 중」 in pencil. */
export function PencilWord({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <span className={`pencil-word text-[14px] ${className}`}>{children ?? COPY.tri.U}</span>;
}

/** 「끊김」 / 「없음」 in ballpen on a blank cell. */
export function GoneWord({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <span className={`gone-word text-[14px] ${className}`}>{children ?? COPY.triResident.N}</span>;
}

/** Background class for a ledger cell holding a value. */
export const cellBg = (tri: Tri) => (tri === "U" ? "hatch" : tri === "N" ? "slash" : "");

/** 3-value mark with its word (never colour-only). `resident` uses 「끊김」 for N. */
export function TriMark({
  tri,
  resident = false,
  className = "",
  land = false,
  tilt,
  size = "sm",
}: {
  tri: Tri;
  resident?: boolean;
  className?: string;
  land?: boolean;
  tilt?: number;
  size?: "sm" | "md" | "lg";
}) {
  const word = (resident ? COPY.triResident : COPY.tri)[tri];
  return (
    <span className={`inline-flex items-center ${className}`} data-tri={tri}>
      {tri === "Y" ? <Stamp word={word} size={size} land={land} tilt={tilt} /> : tri === "U" ? <PencilWord>{word}</PencilWord> : <GoneWord>{word}</GoneWord>}
    </span>
  );
}
