// Template documents (spec 6.3): used when the LLM is unavailable or its text is blocked twice.
// Built only from PlanDigest fields, so every name/day comes from the digest and no numbers are written.
// Pure (no node APIs) — the client uses it when the network fails.
import type { ComposeRequest, ComposeResponse, FallbackReason } from "../apiTypes";
import type { Mode, PlanDigest } from "../types";

export const MODE_KO: Record<Mode, string> = { car: "차량", walk: "도보", homebound: "거동 곤란" };
export const MODE_RESIDENT_KO: Record<Mode, string> = {
  car: "차가 있는",
  walk: "걸어서만 다니는",
  homebound: "집 밖에 나서기 어려운",
};

const joinKo = (xs: string[]) => xs.filter(Boolean).join("·");

function withTopic(name: string): string {
  // 받침 유무로 은/는 고르기 (한글 음절이 아니면 "는")
  const last = name.trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return `${name}는`;
  return code % 28 === 0 ? `${name}는` : `${name}은`;
}

export function residentTemplate(d: PlanDigest): string {
  const lines: string[] = [];
  lines.push(`${d.villageName} 가게가 닫힌 뒤 이용할 곳을 알려 드려요.`);
  const sure = d.items.filter((i) => i.status === "확실").slice(0, 2);
  const checking = d.items.filter((i) => i.status === "확인 중").slice(0, 1);
  for (const it of sure) {
    const days = it.days && it.days.length ? ` ${joinKo(it.days)}에` : "";
    lines.push(`${withTopic(it.name)}${days} ${joinKo(it.fns)}에 이용할 수 있어요.`);
  }
  for (const it of checking) lines.push(`${it.name}의 ${joinKo(it.fns)}는 확인하고 있어요.`);
  if (d.gaps.length && lines.length < 4) lines.push(`${joinKo(d.gaps.slice(0, 3))}는 아직 맡을 곳을 찾고 있어요.`);
  lines.push("궁금한 점은 이장님께 물어봐 주세요.");
  return lines.slice(0, 5).join("\n");
}

export function agencyTemplate(d: PlanDigest, agencyResId: string | null): string {
  const mine = d.items.filter((i) => i.resId === agencyResId);
  const agency = mine[0]?.name ?? "관계 기관";
  const fns = joinKo([...new Set(mine.flatMap((i) => i.fns))]) || "생활 일";
  const checking = mine.filter((i) => i.status === "확인 중");
  const ask = checking.length
    ? checking.map((i) => `${i.name}에서 ${joinKo(i.fns)}를 맡아 줄 수 있는지`).join(", ")
    : `${fns} 이용 방법과 연락 창구`;
  return [
    `[연계 요청 초안] ${agency} 담당자께`,
    `무엇을: ${d.villageName} 주민의 ${fns}를 이어받는 일을 함께 검토해 주시기를 요청합니다.`,
    `어느 리: ${d.villageName}`,
    `어떤 이동 조건 주민: ${MODE_RESIDENT_KO[d.mode]} 주민(${MODE_KO[d.mode]})`,
    `확인해 주실 사항: ${ask}`,
    "이 문서는 담당자가 검토하는 초안입니다.",
  ].join("\n");
}

export function templateText(req: Pick<ComposeRequest, "docType" | "agencyResId" | "digest">): string {
  return req.docType === "agency" ? agencyTemplate(req.digest, req.agencyResId) : residentTemplate(req.digest);
}

/** Template answer in the /api/compose response shape (client-side network fallback). */
export function localCompose(req: ComposeRequest, reason: FallbackReason, inputHash = ""): ComposeResponse {
  return {
    mode: "template",
    model: null,
    text: templateText(req),
    grounding: { pass: true, attempts: 0, checked: [], blocked: [] },
    template: true,
    inputHash,
    fallbackReason: reason,
  };
}
