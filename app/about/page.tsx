// S6 데이터·원칙 /about (spec 8.8, bundle B). Sources come from data/region_hwasan.json meta (D1·D2·D4·D5·D6)
// plus the design-doc sources the pipeline does not read (D3 not used, D7 statistic, D8 village list).
// Parameters are read from lib/engine/params.ts; nothing here is an evaluation number.
import type { Metadata } from "next";
import { COPY, PARAM_LABELS } from "@/lib/copy";
import { P } from "@/lib/engine";
import { REGION } from "@/lib/serverData";
import { SiteHeader } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/Badge";
import { ClearButton } from "./ClearButton";

export const metadata: Metadata = { title: `${COPY.nav.s6} — ${COPY.serviceName}` };

interface Src { id: string; name: string; url?: string; asOf?: string; use: string; status?: string }

const USE: Record<string, string> = {
  D1: "대체자원 후보(업소)·「식료품 업소 0곳 리」 집계",
  D2: "면 인구·65세 이상 비율, 리 균등 배분의 총량",
  D4: "리 대표점·수요점(마을회관·경로당)·공공·농협 자원",
  D5: "「이동장터 A」(운영 주체를 특정하지 않은 익명 자원) 근거",
  D6: "「생활지원 연계」 근거",
};

const EXTRA: Src[] = [
  { id: "D3", name: "행정안전부 법정동별(리명 포함) 주민등록 인구·세대(오픈API 15108071)", url: "https://www.data.go.kr/data/15108071/openapi.do", use: "쓰지 않음 — 활용 신청 전이라 리 인구 대신 면 인구 균등 배분(가정)", status: "미사용" },
  { id: "D7", name: "농림축산식품부 보도자료 「가가호호 농촌 이동장터」(2024-07-29) — 2020 농림어업총조사 인용", url: "https://www.mafra.go.kr/bbs/home/792/579452/download.do", asOf: "2024-07-29", use: "처음 화면 「73.5%」(마을 안에 식료품 소매점이 없는 행정리 비율) 수치 인용" },
  { id: "D8", name: "위키백과 「화산면 (완주군)」 법정리 목록", url: "https://ko.wikipedia.org/wiki/화산면_(완주군)", use: "화산면 법정리 11개(사실만 사용) — OSM 마을 노드와 대조" },
];

/** Design doc 5.3 synthetic / assumed data (rule · basis · on-screen label). */
function assumedRows(myeonPop: number | null): [string, string, string, string][] {
  return [
    ["가상 폐업 3건(승치·와룡·운곡)", "「○○ 마을상회(가상)」, 슈퍼마켓, 품목·운영 시간·메모는 사람이 씀", "세 리 모두 식료품 업소 0곳(상가정보 2026-06)", "상단 띠 「가상 시나리오」"],
    ["평가용 가상 폐업 11건", "리마다 리 대표점에 이름 없는 가상 폐업 지점, 기능 묶음 = 승치 시나리오의 생활 일 6가지·중요도 고정", "평가용", "평가 화면 「평가용 가상 폐업 지점」"],
    ["리 인구", myeonPop ? `면 인구 ${myeonPop.toLocaleString("ko-KR")}명을 11개 리에 균등 배분, 리 안 수요점끼리 다시 균등` : "면 인구를 11개 리에 균등 배분", "리 단위 인구 자료(D3) 반영 전", COPY.badge.popAssumed],
    ["거점 소속 리", String(P.HUB_ASSIGN_RULE), "리 경계 자료 없음", COPY.badge.hubAssumed],
    ["이동장터 A 정차", "전부 「확인 중」. 시연·사전계산 「시연 상태」에서만 정차 칸 하나에 「확실 · 요일」 입력", "공개 자료 없음", COPY.badge.demoValue],
    ["기준값", "lib/engine/params.ts 한 곳(아래 표)", "설계 가정", "「가정값 — 지역 사정에 맞게 담당자가 조정」"],
    ["시험 세트", "기능 분해 합성 60·개발 15, 확인 확률 p, 근거 대조 단위 시험 40문장", "평가 계획", "「합성 시험 세트」 · 「단위 시험(같은 팀 작성)」"],
    ["가상 인물", "흔한 이름의 가명, 나이·이동 조건만", "—", COPY.badge.virtualPerson],
  ];
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="m-0 mb-3 flex flex-wrap items-center gap-2 text-[22px] font-semibold leading-snug">{children}</h2>;
}

function Card({ children, testId }: { children: React.ReactNode; testId: string }) {
  return (
    <section data-testid={testId} className="min-w-0 border-t-2 border-ink pt-3">
      {children}
    </section>
  );
}

export default function AboutPage() {
  const meta = REGION.meta as Record<string, unknown>;
  const metaSources = (Array.isArray(meta.sources) ? meta.sources : []) as { id: string; name: string; url?: string; asOf?: string }[];
  const sources: Src[] = [...metaSources.map((s) => ({ ...s, use: USE[s.id] ?? "" })), ...EXTRA].sort((a, b) => (a.id < b.id ? -1 : 1));
  const myeonPop = typeof meta.myeonPop === "number" ? meta.myeonPop : null;
  const assumptions = (Array.isArray(meta.assumptions) ? meta.assumptions : []) as string[];
  const codeVerified = meta.codeVerified === true;
  const params = Object.entries(P) as [string, string | number][];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-14 sm:pt-10">
        <h1 className="m-0 border-b-2 border-ink pb-2 font-normal">
          <span className="sign block text-[34px] leading-tight sm:text-[38px]">{COPY.nav.s6}</span>
          <span className="mt-1 block text-[17px] font-medium text-pencil-ink">어떤 자료를 어떻게 썼는지, 무엇이 가정인지, 무엇을 쓰지 않았는지 적어 둡니다.</span>
        </h1>

        <div className="mt-8 grid min-w-0 grid-cols-1 gap-10">
          <Card testId="s6-sources">
            <H2>데이터 출처</H2>
            <ul className="m-0 list-none border-t border-rule p-0 text-[16px]">
              {sources.map((s) => (
                <li key={s.id} className="grid min-w-0 grid-cols-[3em_minmax(0,1fr)] border-b border-rule py-2.5">
                  <span className="num font-semibold">{s.id}</span>
                  <div className="min-w-0 border-l border-rule pl-3">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="min-w-0 break-words font-medium">{s.name}</span>
                      {s.status ? <Badge tone="warn">{s.status}</Badge> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 text-[15px] text-pencil-ink">
                      {s.asOf ? <span className="num">기준 {s.asOf}</span> : null}
                      <span>{s.use}</span>
                    </div>
                    {s.url ? (
                      <a href={s.url} className="inline-flex min-h-11 items-center break-all text-[14px] text-slate underline underline-offset-2" rel="noreferrer" target="_blank">
                        {s.url}
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card testId="s6-params">
            <H2>
              기준값(가정) <Badge tone="assumed">{COPY.badge.assumed}</Badge>
            </H2>
            <p className="mt-0 mb-3 text-[16px] text-pencil-ink">지역 사정에 맞게 담당자가 조정하는 값입니다. 계산은 모두 이 값으로 합니다.</p>
            <table className="ledger max-w-3xl text-[15px]">
              <tbody>
                {params.map(([k, v]) => (
                  <tr key={k}>
                    <th scope="row" className="py-1.5 pr-2 text-left font-medium text-pencil-ink">{PARAM_LABELS[k] ?? k}</th>
                    <td className="vr num py-1.5 pl-3 text-right font-semibold break-words">{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card testId="s6-assumed">
            <H2>
              합성·가정 목록 <Badge tone="assumed">{COPY.badge.assumed}</Badge> <Badge>{COPY.badge.synth}</Badge>
            </H2>
            <ul className="m-0 list-none border-t border-rule p-0 text-[16px]">
              {assumedRows(myeonPop).map(([item, rule, basis, label]) => (
                <li key={item} className="min-w-0 border-b border-rule py-2.5">
                  <div className="font-semibold">{item}</div>
                  <div className="mt-0.5">{rule}</div>
                  <dl className="m-0 mt-1 flex flex-wrap gap-x-5 text-[15px] text-pencil-ink">
                    <div className="flex gap-1.5"><dt>근거</dt><dd className="m-0 text-ink">{basis}</dd></div>
                    <div className="flex gap-1.5"><dt>화면 표기</dt><dd className="m-0 text-ink">{label}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
            {assumptions.length ? (
              <>
                <h3 className="mt-5 mb-2 text-[18px] font-semibold">데이터를 만들 때 둔 가정</h3>
                <ul className="measure m-0 list-disc pl-5 text-[16px] leading-relaxed">
                  {assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </Card>

          <Card testId="s6-ai">
            <H2>AI 사용 고지</H2>
            <p className="measure m-0 text-[17px] leading-relaxed">{COPY.s6.aiNotice}</p>
          </Card>

          <Card testId="s6-privacy">
            <H2>개인정보</H2>
            <p className="measure mt-0 mb-4 text-[17px] leading-relaxed">{COPY.s6.privacy}</p>
            <ClearButton />
          </Card>

          <Card testId="s6-checked">
            <H2>확인한 기관</H2>
            <p className="measure m-0 text-[17px] leading-relaxed">{COPY.s6.notChecked}</p>
          </Card>

          <Card testId="s6-refresh">
            <H2>갱신 주기</H2>
            <table className="ledger max-w-xl text-[16px]">
              <tbody>
                {COPY.s6.refresh.map(([k, v]) => (
                  <tr key={k}>
                    <th scope="row" className="py-1.5 pr-3 text-left font-medium text-pencil-ink">{k}</th>
                    <td className="vr py-1.5 pl-3">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card testId="s6-notused">
            <H2>쓰지 않은 것</H2>
            <ol className="measure m-0 grid gap-2 pl-5 text-[17px] leading-relaxed">
              {COPY.notUsed.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ol>
          </Card>

          <Card testId="s6-map">
            <H2>지도·데이터 고지</H2>
            <ul className="measure m-0 grid list-none gap-0 border-t border-rule p-0 text-[17px] leading-relaxed [&>li]:border-b [&>li]:border-rule [&>li]:py-1.5">
              <li>{COPY.s6.odbl}</li>
              <li>{COPY.s6.riList(codeVerified)}</li>
              <li>{COPY.s6.judge(null)}</li>
            </ul>
          </Card>

          <Card testId="s6-repo">
            <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-[17px] leading-relaxed">
              <span className="text-pencil-ink">GitHub</span>
              <a href="https://github.com/yonghwan1106/maeul-inherit" className="inline-flex min-h-11 items-center font-semibold text-slate underline underline-offset-4" rel="noreferrer" target="_blank">
                yonghwan1106/maeul-inherit
              </a>
            </p>
            <p className="mt-1 mb-0 text-[15px] text-pencil-ink">{COPY.s6.proposer}</p>
          </Card>
        </div>
      </main>
      <Footer />
    </>
  );
}
