// K8 — confirmed Korean copy in one place (spec section 8). Other bundles import from here (S5 = A, S6 = B).
// `{ }` slots are filled by functions with engine / results.json values. Never type numbers by hand here
// except cited public facts (S0 면 현황) that carry their source line.
import type { FnCode, Mode, Tri } from "./types";

export const COPY = {
  // 8.1 common -------------------------------------------------------------
  logo: "이어받는 마을 — 가게가 닫혀도",
  logoSub: "아이디어 챌린지 4번 「기능상속」 구현작",
  serviceName: "이어받는 마을",
  oneLiner:
    "마을의 마지막 가게가 닫혀도 장보기·택배·배달이 끊기지 않도록, AI가 그 가게가 하던 일을 찾아 농협·우체국·마을회관에 나눠 맡기는 계획을 짭니다.",
  topBand: "가상 시나리오 — 실존 가게의 폐업이 아닙니다. 지역·인구·시설은 실제 공공데이터입니다.",
  footer:
    "AI가 만든 결과는 참고용 초안이며 최종 판단은 담당자가 합니다 · © OpenStreetMap contributors · 소상공인시장진흥공단 상가정보(2026-06) · 행정안전부 주민등록 인구(2026-09)",

  modeBadge: {
    live: "실시간 AI",
    precomputed: (model: string, ymd: string) => `사전계산 · ${model} · ${ymd}`,
    rules: "데모 모드(규칙)",
    template: "템플릿 문장",
  },
  badge: {
    assumed: "가정",
    synth: "합성",
    virtualPerson: "가상 인물",
    demoValue: "시연 입력값 — 실제 운행 정보 아님",
    phoneChecked: (ymd: string) => `전화 확인값(${ymd})`,
    thisBrowser: "이 브라우저에서 입력한 값",
    residentReport: "주민 제보",
    judgeUnknown: "자원 판별 미검수 — 담당자 확인 필요",
    popAssumed: "리 인구 미확정 — 면 인구 균등 배분(가정)",
    hubAssumed: "거점 소속 리는 거리로 추정(가정)",
    sbizUnverified: "공공데이터 등록 정보 · 실제 영업 여부 미확인",
    mock: "목업 데이터 — 실데이터 반영 전",
    tempScenario: "임시 시나리오 — 사전계산 반영 전",
  },
  tri: { Y: "확실", U: "확인 중", N: "없음" } as Record<Tri, string>,
  /** resident screens and counts use 「끊김」 for N */
  triResident: { Y: "확실", U: "확인 중", N: "끊김" } as Record<Tri, string>,
  modeOfficer: { car: "차량", walk: "도보", homebound: "거동 곤란" } as Record<Mode, string>,
  modeResident: { car: "차 있어요", walk: "걸어서만 다녀요", homebound: "집 밖에 나서기 어려워요" } as Record<Mode, string>,
  fnName: {
    F01: "장보기", F02: "신선식품", F03: "고기·생선", F04: "급할 때", F05: "생활용품",
    F06: "택배", F07: "배달", F08: "돈 찾기", F09: "사랑방", F10: "안부",
  } as Record<FnCode, string>,
  gate: {
    g1: "기능 분해 확인",
    g2: "계획 확정",
    g3: "승인(기록만)",
    locked: "담당자가 확인해야 다음 단계로 갑니다",
    record: (hhmm: string) => `${hhmm} 담당자 확인`,
    approveRecord: (hhmm: string) => `${hhmm} 담당자 승인 기록`,
  },
  fallback: {
    noAi: "지금은 AI 연결이 어려워 규칙으로 나눴어요(데모 모드)",
    limit: "오늘 체험 횟수를 넘어 규칙으로 보여 드려요",
  },
  steps: ["시설 중단 등록", "생활기능 분석", "대체자원 탐색", "대안 조합·추천", "실제 이용 또는 기관 연계", "결과 피드백"],
  nav: { s0: "처음", s1: "시설 중단 등록", s2: "생활기능 분해", s3: "이어받기 계획", s4: "주민별 대안·안내", s5: "평가", s6: "데이터·원칙" },
  next: { s3: "이어받기 계획 보기", s4: "주민별 대안·안내 보기" },

  // 8.2 S0 -------------------------------------------------------------------
  s0: {
    heroCard: (name: string, age: number, modeR: string, place: string) => `${name} 어르신 · ${age}세 · ${modeR} · ${place}`,
    afterClose: (n: string, m: string, k: string) => `마을 가게가 닫힌 뒤: 확실 ${n} · 확인 중 ${m} · 끊김 ${k}`,
    start: "체험 시작",
    title: "이어받는 마을 — 가게가 닫혀도",
    stats: {
      national: { value: "73.5%", label: "전국 행정리 중 마을 안에 식료품 소매점이 없는 곳 (2020 농림어업총조사, 농식품부 보도자료 2024-07-29)" },
      elderly: { value: "45.9%", label: "화산면 주민 중 65세 이상 (행정안전부 주민등록 인구 2026-09)" },
      noFood: {
        value: (total: number, zero: number) => `${total}곳 중 ${zero}곳`,
        label: "화산면 리 가운데 식료품 업소가 없는 곳 — 면 소재지엔 하나로마트 1곳 (상가정보 2026-06 등록 기준·OSM 대조, 등록 누락이 있을 수 있음)",
      },
    },
    scenarioTitles: {
      sc1_seungchi: "승치리 — 걸어서 갈 곳이 없는 마을",
      sc2_waryong: "와룡리 — 남은 작은 가게와 면 소재지 사이",
      sc3_ungok: "운곡리 — 이어받을 곳이 없는 마을",
    } as Record<string, string>,
    tryScenario: "이 시나리오로 체험",
    register: "직접 등록해 보기",
    flowNote: "제안자 답변서 4쪽의 흐름 그대로",
  },

  // 8.3 S1 -------------------------------------------------------------------
  s1: {
    title: "시설 중단 등록",
    legend: "● 리 대표점 · ○ 마을회관·경로당 · ■ 하나로마트·농협·우체국 · ◇ 등록 업소(영업 여부 미확인) · 회색 = 식료품 업소 0곳 리",
    village: "어느 마을인가요?",
    sbizSub: "업종",
    items: "팔던 물건",
    itemsHint: "쉼표로 구분",
    hours: "운영 시간",
    memo: "이장·담당자 메모",
    memoPlaceholder: "가게가 주민에게 해 주던 일을 적어 주세요. 예: 택배를 맡아 줬음, 전화하면 배달해 줬음, 가게 앞에 모여 앉았음",
    privacy: "이름·전화번호는 쓰지 마세요. 전화번호는 자동으로 가립니다.",
    count: (n: number) => `${n}/600자`,
    submit: "생활기능 나누기",
    working: "AI가 메모를 읽고 있어요…",
    fillFrom: "시나리오로 채우기",
  },

  // 8.4 S2 -------------------------------------------------------------------
  s2: {
    title: (store: string) => `${store}이 하던 일`,
    rowLiving: "생활 일",
    rowSocial: "마을 관계 — 이어받는 일 개수에서 빼고, 마을회관 연결을 제안합니다",
    importance: "중요도",
    evidence: (e: string) => `근거: “${e}”`,
    needsCheck: "확인 필요 — 메모에서 그대로 찾지 못했어요",
    off: "끄기",
    on: "켜기",
    typeOnlyToggle: "업종 표만 쓰면",
    typeOnly: (a: number, b: number) => `업종 표만 쓰면 ${a}가지, AI는 ${b}가지를 찾았어요`,
    unknowns: "AI가 모른다고 한 것",
  },

  // 8.5 S3 -------------------------------------------------------------------
  s3: {
    barsRight: (a: string, b: string, c: string) => `확실 ${a} · 확인 중 ${b} · 끊김 ${c}`,
    barsOf: (n: number) => `생활 일 ${n}가지 중 평균`,
    barsSmall: (L: string, U: string) => `확실 몫 ${L}% · 확인되면 최대 ${U}% · 리 평균(리 인구 자료 반영 전)`,
    mini: {
      title: "선택한 주민",
      line: (name: string, age: number, mode: string, place: string) => `${name} · ${age}세 · ${mode} · ${place}`,
      counts: (n: number | string, m: number | string, k: number | string) => `확실 ${n} · 확인 중 ${m} · 끊김 ${k}`,
      b1: (d: string, a: number) => `가장 가까운 가게 한 곳(${d} km)만 알려 주면: 확실 ${a}가지`,
      notWalkable: "— 걸어서 갈 수 없어요",
      steps: (n: number, a: number, b: number, c: number | null) =>
        `폐업 전 ${n} → 가까운 가게 한 곳 ${a} → 이어받기 계획 ${b} → 확인 후 ${c === null ? "—" : c}`,
      noResidents: "이 시나리오에는 가상 주민이 없어요",
    },
    mapLegend: "실선 = 확실 · 점선 = 확인 중",
    noLocation: "위치 없이 찾아오는 곳",
    table: { title: "누가 어떤 일을 이어받나", legend: "● 확실 ◐ 확인 중 — 없음" },
    voi: {
      title: "먼저 전화할 곳",
      note: "(확인 가치 순 · 세 이동 유형의 상승을 같은 무게로 더함 — 가정)",
      ifYes: (walk: string, home: string, car: string) => `확인되면: 도보 +${walk}가지 · 거동 곤란 +${home}가지 · 차량 +${car}가지`,
      ifNo: (w: string) => `아니면: 확인되면 가능한 몫 −${w}%p`,
      yes: "확실",
      no: "아님",
      unknown: "아직 모름",
      memoPlaceholder: "요일·시간 (예: 화요일 오전)",
      realNamed: "실제로 확인한 값만 넣어 주세요",
      demo: (note: string) => `시연 값 넣기(${note})`,
      demoCell: "시연 칸",
      more: (n: number) => `다른 확인 대상 ${n}칸`,
      top30: "상위 30칸만 계산",
      current: (v: string) => `지금 입력: ${v}`,
      confirmedTitle: "확인 입력",
    },
    optimal: {
      ok: "최대 3곳 조건과 지금 기준값 안에서는 더 나은 조합이 없습니다",
      truncated: "후보가 많아 가까운 25곳만 따졌습니다",
    },
    common: { title: "마을 공통 대안", line: (fn: string, r1: string, r2?: string) => `${fn}: ${r2 ? `${r1}, ${r2}` : r1}` },
    gaps: { title: "아직 이어받을 곳이 없는 일", line: (fn: string, mode: string) => `${fn} — ${mode}`, none: "없음" },
    social: {
      title: "마을회관으로 연결 제안",
      line: (hubs: string) => `사랑방·안부: ${hubs}과 이장·노인회에 연결을 제안합니다`,
    },
    reports: {
      title: (n: number) => `주민 제보 ${n}건`,
      line: (who: string, res: string, fn: string, why: string) => `${who}: ${res} ${fn} — 안 됐어요(${why})`,
      usedLine: (who: string, res: string, fn: string) => `${who}: ${res} ${fn} — 이용해 봤어요`,
      apply: "담당자 확인으로 반영",
      none: "아직 제보가 없어요",
    },
    lost: {
      title: "사라진 기능 기록",
      body: (fns: string, items: string, hours: string, gaps: string) =>
        `이 가게가 하던 일: ${fns} · 팔던 물건: ${items} · 운영 시간: ${hours} · 지금 남는 공백: ${gaps}`,
      download: "기록 내려받기(JSON)",
      note: "재창업·재유치를 판단할 때 쓸 수 있는 기록입니다(제안자 답변서 4쪽)",
    },
    params: { title: "기준값(가정) — 지역 사정에 맞게 담당자가 조정" },
  },

  // 8.6 S4 -------------------------------------------------------------------
  s4: {
    myCond: "내 조건",
    livePlace: "사는 마을",
    badDays: "안 되는 요일",
    card: (name: string, age: number, mode: string, place: string) =>
      `${age >= 65 ? `${name} 어르신` : `${name} 씨`} · ${age}세 · ${mode} · ${place}`,
    rank: (i: number, res: string, fns: string, tri: string) => `${i}순위 ${res} — ${fns} (${tri})`,
    socialLine: "마을회관으로 연결 제안: 사랑방·안부",
    fb: { used: "이용해 봤어요", failed: "안 됐어요", reasons: ["안 왔어요", "물건이 없어요", "너무 멀어요", "기타"], toast: "주민 제보로 담당자에게 올렸어요(이 브라우저에만 저장)" },
    bigText: { title: "큰 글씨 안내문", note: "시골 부모님께 그대로 보여 드릴 수 있는 안내문" },
    agency: {
      title: "연계 요청문",
      hanaro: "하나로마트(화산)",
      tour: "이동장터 운영 주체",
      hub: (hub: string) => `${hub} (이장·노인회)`,
      care: "생활지원 수행기관",
      tourHead: "완주군 이동장터 담당 부서를 통해 운영 주체에 확인",
      careHead: "화산면 행정복지센터를 통해 수행기관에 확인",
    },
    grounding: {
      pass: (n: number) => `틀린 내용 거르기: 통과 · 맞춰 본 항목 ${n}개`,
      blocked: "틀린 내용 거르기: 확인 안 된 내용을 막고 템플릿 문장으로 바꿨어요",
    },
    filtered: { title: "거른 예시", testBadge: "시험 문장" },
    approveNote: "실제 발송은 담당자가 기관 채널로 합니다",
  },

  // 8.7 S5 (A) ---------------------------------------------------------------
  s5: {
    title: "평가 — 모든 수치는 data/eval/results.json에서 읽습니다",
    meta: (runAt: string, models: string, commit: string) => `실행 ${runAt} · 모델 ${models} · 커밋 ${commit} · 시드 42`,
    t1: {
      title: "생활기능 분해(E1) — 합성 60건 · 실제 기사 문장 20건(따로)",
      cols: ["업종 표만", "규칙(키워드)", "규칙+부정어", "AI(claude-haiku-5-5)"],
      rows: ["F1(합성)", "F1(실문장)", "택배 재현율", "배달 재현율", "사랑방 재현율", "안부 재현율", "함정 오탐"],
      realNote: (n: number) => `실문장 라벨: 개발팀 작성, 사람 검수 ${n}건`,
    },
    t2: {
      title: "이어받기 계획(E2) — 화산면 11개 리 × 3유형 = 33건",
      cols: ["가까운 가게 한 곳", "가까운 순 세 곳", "기능마다 가까운 곳(탐욕)", "AI 혼자(자원 목록만)", "AI 혼자(3값 표 제공)", "이어받는 마을 엔진"],
      rows: ["확실 개수 평균", "확인 중", "끊김", "확실 몫 %"],
      errRows: ["없는 곳 언급", "갈 수 없는 곳 배정", "그 일을 안 하는 곳 배정", "확인 중을 확실로 씀", "3곳 초과"],
      errCell: (cases: number) => `${cases}/33건`,
      note: "엔진은 같은 칸 위에서 최적화하므로 확실 몫이 기준선보다 낮을 수 없습니다. 수치는 '얼마나 더'를 뜻하며, 사례들은 자원을 공유해 서로 독립이 아닙니다.",
    },
    t3: {
      title: "먼저 전화할 곳(확인 가치, VOI) — 설계 검증",
      cols: ["무작위", "가까운 순", "확인 가치 순"],
      ratio: "배수(확인 가치 ÷ 무작위)",
      note: "설계 검증 — 같은 기준으로 고르고 채점하므로 VOI가 유리한 것은 거의 정의상 당연",
    },
    t4: {
      title: "틀린 내용 거르기(E4) — 생성 30건 · 단위 시험 40문장",
      cols: ["첫 생성 통과", "다시 쓰기", "템플릿 대체", "최종 통과", "단위 시험 탐지율", "잘못 막음"],
      unitBadge: "단위 시험(같은 팀 작성)",
    },
    engine: (n: number, x: string, planMs: string, voiMs: string) =>
      `브루트포스 대조 ${n}건 일치율 ${x} · 계획 계산 ${planMs} ms · 먼저 전화할 곳 계산 ${voiMs} ms`,
    limits:
      "폐업은 실제 지역 위의 가상 시나리오입니다. 기능 분해 시험 세트 60건과 확인 결과 확률은 합성·가정이며, 실제 기사 문장 20건은 개발팀이 라벨을 붙였습니다. 리 인구는 리 단위 자료 반영 전까지 면 인구 균등 배분 가정이고, 거점의 소속 리는 거리로 추정했습니다. 이동장터 정차·배송·생활지원 제공 여부는 공개 자료가 없어 「확인 중」으로 계산했으며, 시연의 이동장터 정차 값은 실제 운행 정보가 아닙니다. 상가정보는 등록 자료(2026-06)로 실제 영업 여부를 보장하지 않습니다. 평가의 엔진 우위는 같은 기준 위의 최적화라 정의상 생기는 몫이 있습니다.",
  },

  // 8.8 S6 (B) ---------------------------------------------------------------
  s6: {
    aiNotice:
      "생활기능 분해와 문서 초안은 Anthropic Claude(claude-haiku-5-5)가 씁니다. 누가 어떤 일을 이어받을지와 모든 숫자는 직접 만든 결정 엔진이 계산하며, 학습한 AI 모델은 쓰지 않습니다. 근거 대조기는 규칙으로 동작합니다.",
    privacy: "주민·담당자가 입력한 내용은 서버에 저장하지 않습니다. 확인 결과·승인 기록·주민 제보는 이 브라우저에만 남습니다.",
    clear: "이 브라우저 기록 지우기",
    checkedOrg: (kind: string, ymd: string, what: string) => `${kind} · ${ymd} · ${what}`,
    notChecked: "아직 실제 기관 확인 전입니다. 운영 정보는 모두 '확인 중'으로 계산했습니다.",
    refresh: "상가정보 분기 · 주민등록 인구 월간 · 운영 정보는 담당자가 확인할 때",
    odbl: "© OpenStreetMap contributors. data/region_hwasan.json은 OpenStreetMap 파생 데이터로 ODbL 1.0을 따릅니다.",
    riList: (verified: boolean) => `리 목록: 위키백과·OSM 기준${verified ? ", 법정동코드 대조 완료" : ", 대조 미완"}`,
    judge: (acc: string | null) => `자원 판별: ${acc === null ? "미검수" : `표본 30행 검수 정확도 ${acc}%`}`,
    proposer: "제안자: 2026 AI 라이프 아이디어 챌린지 4번 「기능상속」 구현작",
  },

  /** §13 「쓰지 말 것」 5 lines — README 「쓰지 않은 것」 and S6, verbatim. */
  notUsed: [
    "전력·AMI 신호로 폐업을 감지하지 않습니다 — 전력·AMI 데이터를 쓰지 않는다.",
    "다른 작품(음식점 생존분석 등)의 코드·데이터를 다시 쓰지 않는다 — 이 저장소의 코드는 새로 작성했다.",
    "폐업 지원·재취업·졸업장 같은 상인 쪽 장치는 다루지 않는다 — 남은 주민의 생활 일만 다룬다.",
    "취약수요 × 저접근성 점수 산식·격자 도달권 모델을 쓰지 않는다 — 실제 자원과 이동 유형별 거리 칸으로 계산한다.",
    "특정 민간 배송 플랫폼(배민·쿠팡 등) 전제·데이터·연동(답변서 3쪽).",
  ],

  // 8.9 poster ---------------------------------------------------------------
  poster: {
    left: "가까운 가게 한 곳만 알려 주면",
    right: "이어받는 마을",
    foot: "가상 인물·가상 시나리오 · 지역·시설은 실제 공공데이터 · © OpenStreetMap contributors",
  },
} as const;

/** §5.2 parameter labels for the S3 「기준값」 panel and S6. */
export const PARAM_LABELS: Record<string, string> = {
  ROAD_FACTOR_WALK: "도보 도로 계수(직선거리 ×)",
  ROAD_FACTOR_CAR: "차량 도로 계수(직선거리 ×)",
  WALK_MAX_KM: "걸어서 갈 수 있는 거리(km, 도로 추정)",
  CAR_MAX_KM: "차로 갈 수 있는 거리(km, 도로 추정)",
  F04_CAR_MAX_KM: "「급할 때」 차량 거리(km)",
  TOUR_CAR_MAX_KM: "이동장터 차량 접근 거리(km)",
  HOMEBOUND_NEAR_KM: "거동 곤란 — 자기 수요점 판정 거리(km)",
  SCOPE_KM: "이용권 — 가게 위치에서 리 대표점까지(km)",
  MERGE_M: "같은 자원으로 합치는 거리(m)",
  RI_FILTER_KM: "리 대표점 — 행정복지센터에서(km)",
  MAX_SET: "이어받는 곳 최대 개수",
  MAX_CANDIDATES: "따지는 후보 최대 개수",
  VOI_P: "확인 확률(표시용)",
  BUS_STOP_M: "버스 정류장 거리(m, 선택 조건)",
  HUB_ASSIGN_RULE: "거점 소속 리 규칙",
  EPS: "실수 비교 허용 오차",
};

export const DAYS = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"] as const;

/** 1-decimal number for averages (spec: 소수 1자리). */
export const f1 = (x: number) => (Math.round(x * 10) / 10).toFixed(1);
/** percent with no decimals from a 0..1 share. */
export const pct = (x: number) => String(Math.round(x * 100));
export const hhmm = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "--:--" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
export const ymd = (iso: string | undefined | null) => (iso ? String(iso).slice(0, 10) : "");
