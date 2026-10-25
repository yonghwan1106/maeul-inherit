// E2 LLM-only baselines (spec 7.2-2, bundle B5 — prompt written by a worker who did not write the engine).
// `npm run eval:e2llm`: for each of the 33 cases in data/eval/e2_cases.json, claude-haiku-5-5 is called twice:
//   b2a = village, demand points (name, coords), resource list (id, name, class, coords, channels, default status
//         text), parameters, mobility mode
//   b2b = b2a + the per-point Y/U/N table computed by the engine's cell function
// Output (K6): data/eval/e2_llm_outputs.json = { meta, outputs: [{ caseId, variant, raw, parsed }] }. Raw text kept.
// No fallback model (the measured model stays pure), no retries, max_tokens 1,200.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { callClaude, extractJson, hasKey } from "../../lib/llm/client";

const ROOT = path.resolve(path.dirname(process.argv[1]), "..", "..");
const MODEL = "claude-haiku-5-5";
export const E2_PROMPT_VERSION = "b2-v1";

interface CaseRes { id: string; name: string; cls: string; lat?: number; lon?: number; villageId?: string; channels: string[]; status: string }
interface CasePoint { id: string; name: string; villageId: string; kind: string; lat: number; lon: number; weight: number }
interface E2Case {
  caseId: string; villageId: string; villageName: string; mode: "car" | "walk" | "homebound";
  scope: string[]; points: CasePoint[]; resources: CaseRes[]; table: Record<string, Record<string, string>>;
}
interface CasesFile { meta: { fns: { code: string; name: string; importance: number }[]; tableFnOrder: string[]; params: Record<string, unknown> }; cases: E2Case[] }

const MODE_KO = { car: "차량(자가용 이용 가능)", walk: "도보(걸어서만 다님)", homebound: "거동 곤란(집 밖에 나서기 어려움)" } as const;

export const B2_SYSTEM = `너는 농촌 면사무소 담당자를 돕는 생활 지원 계획가다. 어느 마을의 마지막 가게가 문을 닫았다. 그 가게가 하던 생활 일을 주변 자원(농협 하나로마트·우체국·마을회관·경로당·이동장터·생활지원 연계 등)에 나눠 맡기는 계획을 세운다.

## 할 일
- "이용권"에 든 리마다 따로 계획을 하나씩 세운다.
- 리마다 자원을 최대 3곳 고른다(set). 자원 id는 주어진 목록에 있는 것만 쓴다.
- 생활 일 6가지(F01 장보기, F02 신선식품, F04 급할 때, F05 생활용품, F06 택배, F07 배달) 각각에 대해, 고른 자원 가운데 어디가 맡는지와 상태를 적는다(assign). 6가지 모두 한 줄씩 적는다.
  - "확실": 그 자원이 그 일을 하고, 주어진 이동 조건의 주민이 실제로 이용할 수 있다고 주어진 정보로 확실히 말할 수 있을 때
  - "확인 필요": 할 가능성은 있지만 배송 권역·정차 여부·운영 여부 등 확인되지 않은 정보에 달려 있을 때
  - "없음": 고른 자원 가운데 그 일을 맡을 곳이 없을 때(resId는 빈 문자열 "")
- 이동 조건과 거리 기준값(도로 추정 = 직선거리 × 계수)을 지켜, 그 주민이 갈 수 없는 곳에 방문 일을 맡기지 않는다. 그 일을 하지 않는 곳에 맡기지 않는다.
- 중요도가 높은 일이 확실히 이어지도록 고르는 것을 우선한다.

## 출력
JSON만 출력한다(설명·코드 블록 표시 없이).
{"plans":[{"villageId":"리 id","set":["자원 id", "…(최대 3개)"],"assign":[{"fn":"F01","resId":"자원 id 또는 빈 문자열","status":"확실"|"확인 필요"|"없음"}]}]}`;

const PARAM_KEYS = ["ROAD_FACTOR_WALK", "ROAD_FACTOR_CAR", "WALK_MAX_KM", "CAR_MAX_KM", "F04_CAR_MAX_KM", "TOUR_CAR_MAX_KM", "HOMEBOUND_NEAR_KM", "MAX_SET"];
const PARAM_KO: Record<string, string> = {
  ROAD_FACTOR_WALK: "도보 도로 계수(직선거리에 곱함)",
  ROAD_FACTOR_CAR: "차량 도로 계수(직선거리에 곱함)",
  WALK_MAX_KM: "도보로 갈 수 있는 도로 추정 거리 상한(km)",
  CAR_MAX_KM: "차량으로 다니는 도로 추정 거리 상한(km)",
  F04_CAR_MAX_KM: "차량 주민의 '급할 때'(F04) 가게 도로 추정 거리 상한(km)",
  TOUR_CAR_MAX_KM: "차량 주민이 이동장터 정차 지점까지 가는 도로 추정 거리 상한(km)",
  HOMEBOUND_NEAR_KM: "거동 곤란 주민이 자기 마을 거점(경로당 등)을 이용할 수 있는 직선거리 상한(km)",
  MAX_SET: "리마다 고를 수 있는 자원 수 상한",
};

const r5 = (x: number | undefined) => (typeof x === "number" ? Math.round(x * 100000) / 100000 : undefined);

export function b2User(c: E2Case, meta: CasesFile["meta"], withTable: boolean): string {
  const params = Object.fromEntries(PARAM_KEYS.filter((k) => k in meta.params).map((k) => [k, { 값: meta.params[k], 뜻: PARAM_KO[k] }]));
  const body: Record<string, unknown> = {
    가게가_닫힌_리: { id: c.villageId, 이름: c.villageName },
    이동_조건: MODE_KO[c.mode],
    이용권_리: c.scope,
    수요점: c.points.map((p) => ({ id: p.id, 이름: p.name, 리: p.villageId, 종류: p.kind === "hub" ? "마을회관·경로당" : "리 대표점", 위도: r5(p.lat), 경도: r5(p.lon) })),
    생활_일: meta.fns.map((f) => ({ 코드: f.code, 이름: f.name, 중요도: f.importance })),
    기준값: params,
    자원: c.resources.map((r) => ({
      id: r.id, 이름: r.name, 종류: r.cls, ...(r.villageId ? { 리: r.villageId } : {}),
      ...(typeof r.lat === "number" ? { 위도: r5(r.lat), 경도: r5(r.lon) } : { 위치: "없음(배송·순회형)" }),
      경로: r.channels, 상태: r.status,
    })),
  };
  if (withTable) {
    body.칸_표_설명 = `table[수요점 id][자원 id] = 생활 일 ${meta.tableFnOrder.join(" ")} 순서대로 한 글자씩. Y = 확실, U = 확인 필요, N = 없음(그 이동 조건에서 그 자원이 그 일을 못 함). 표에 없는 자원은 그 수요점에서 모든 일이 N. 이 표는 정확하다.`;
    body.table = c.table;
  }
  return `다음 사례의 계획을 세워 출력 형식의 JSON만 답하라.\n${JSON.stringify(body)}`;
}

async function main() {
  if (!hasKey()) {
    console.error("e2_llm: ANTHROPIC_API_KEY not set");
    process.exit(1);
  }
  const file = path.join(ROOT, "data", "eval", "e2_cases.json");
  if (!existsSync(file)) {
    console.error("e2_llm: data/eval/e2_cases.json missing (run npm run eval:e2cases)");
    process.exit(1);
  }
  const { meta, cases } = JSON.parse(readFileSync(file, "utf8")) as CasesFile;
  const only = process.argv.includes("--limit") ? Number(process.argv[process.argv.indexOf("--limit") + 1]) : cases.length;
  const jobs: { c: E2Case; variant: "b2a" | "b2b" }[] = [];
  for (const c of cases.slice(0, only)) for (const variant of ["b2a", "b2b"] as const) jobs.push({ c, variant });
  const outputs: { caseId: string; variant: string; raw: string | null; parsed: unknown; fail: string | null; usage?: { input: number; output: number } }[] = new Array(jobs.length);
  let next = 0, inTok = 0, outTok = 0, fails = 0;
  async function worker() {
    while (next < jobs.length) {
      const i = next++;
      const { c, variant } = jobs[i];
      const r = await callClaude({ system: B2_SYSTEM, user: b2User(c, meta, variant === "b2b"), maxTokens: 1200, model: MODEL, noFallback: true, tag: `e2-${variant}` });
      if (r.ok) {
        inTok += r.usage.input; outTok += r.usage.output;
        const parsed = extractJson(r.text);
        if (!parsed) fails++;
        outputs[i] = { caseId: c.caseId, variant, raw: r.text, parsed, fail: parsed ? null : "parse", usage: r.usage };
      } else {
        fails++;
        outputs[i] = { caseId: c.caseId, variant, raw: null, parsed: null, fail: r.reason };
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  const out = {
    meta: { model: MODEL, prompt: E2_PROMPT_VERSION, runAt: new Date().toISOString(), n: outputs.length, cases: Math.min(only, cases.length), maxTokens: 1200, usage: { input: inTok, output: outTok }, failures: fails, casesSha256: (meta as unknown as { regionSha256?: string }).regionSha256 ?? null },
    outputs,
  };
  writeFileSync(path.join(ROOT, "data", "eval", "e2_llm_outputs.json"), JSON.stringify(out, null, 1) + "\n", "utf8");
  console.log(`e2_llm: ${outputs.length} outputs (${fails} parse/call failures), tokens in ${inTok} out ${outTok} -> data/eval/e2_llm_outputs.json`);
}

main().catch((e) => {
  console.error("e2_llm failed:", (e as Error).message);
  process.exit(1);
});
