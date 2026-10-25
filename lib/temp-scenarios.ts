// TEMPORARY (bundle C, 임시안): scenario stubs with the §9.1 inputs so screens can be built before B4
// writes data/scenarios/*.json. Same `Scenario` schema. Removed from use automatically once the real
// files exist (lib/data.ts prefers them). The function list below is the spec's *expected* L1 output,
// marked mode "rules" — it is NOT an AI result and screens show the 「임시 시나리오」 badge.
import type { Confirmation, FnCode, Region, Resident, Scenario, Store } from "./types";

interface TempResident extends Omit<Resident, "pointId"> {
  /** point name (hub) or village id (village node) to resolve against the region */
  at: { hubName?: string; villageId: string };
}

interface TempScenario {
  id: string;
  title: string;
  officer: string;
  store: Store;
  residents: TempResident[];
  demo: { at: { hubName?: string; villageId: string }; note: string };
  fns: { code: FnCode; importance: 1 | 2 | 3; evidence: string }[];
}

export const TEMP_SCENARIOS: TempScenario[] = [
  {
    id: "sc1_seungchi",
    title: "승치리 — 걸어서 갈 곳이 없는 마을",
    officer: "이서연 주무관(가명)",
    store: {
      name: "승치 마을상회(가상)", villageId: "seungchi", lat: 36.06006, lon: 127.22416, sbizSub: "슈퍼마켓",
      items: ["라면", "쌀", "두부", "계란", "막걸리", "파스", "세제"], hours: "06:30-20:00",
      memo: "어르신들 택배를 다 여기 맡겼고, 전화하면 사장님이 오토바이로 갖다 줬음. 오후엔 가게 앞 평상에 모여 앉으심. 혼자 사는 어르신들 안부도 사장님이 챙겼음.",
    },
    residents: [
      { id: "r1", name: "김순자", age: 81, mode: "walk", note: "허리가 불편함", at: { hubName: "미남경로회관", villageId: "seungchi" } },
      { id: "r2", name: "박정호", age: 58, mode: "car", note: "", at: { villageId: "seungchi" } },
      { id: "r3", name: "이옥자", age: 77, mode: "homebound", note: "", at: { hubName: "원승경로회관", villageId: "seungchi" } },
    ],
    demo: { at: { hubName: "미서경로회관", villageId: "seungchi" }, note: "화요일 오전" },
    fns: [
      { code: "F01", importance: 3, evidence: "라면" },
      { code: "F02", importance: 2, evidence: "계란" },
      { code: "F04", importance: 1, evidence: "06:30-20:00" },
      { code: "F05", importance: 2, evidence: "파스" },
      { code: "F06", importance: 3, evidence: "택배를 다 여기 맡겼고" },
      { code: "F07", importance: 3, evidence: "전화하면 사장님이 오토바이로 갖다 줬음" },
      { code: "F09", importance: 2, evidence: "가게 앞 평상에 모여 앉으심" },
      { code: "F10", importance: 2, evidence: "안부도 사장님이 챙겼음" },
    ],
  },
  {
    id: "sc2_waryong",
    title: "와룡리 — 남은 작은 가게와 면 소재지 사이",
    officer: "이서연 주무관(가명)",
    store: {
      name: "와룡 마을상회(가상)", villageId: "waryong", lat: 36.01425, lon: 127.21211, sbizSub: "슈퍼마켓",
      items: ["라면", "과자", "음료", "막걸리", "계란", "세제", "건전지"], hours: "07:00-21:00",
      memo: "농번기엔 새참거리 사러 많이 왔음. 외상 장부가 있었음. 택배는 안 받았음. 버스 기다리는 사람들이 가게 앞 의자에서 쉬었음.",
    },
    residents: [
      { id: "r1", name: "정말순", age: 79, mode: "walk", note: "", at: { hubName: "연세경로회관", villageId: "jong" } },
      { id: "r2", name: "김영수", age: 62, mode: "car", note: "", at: { villageId: "waryong" } },
      { id: "r3", name: "최복례", age: 84, mode: "homebound", note: "", at: { hubName: "임전마을회관", villageId: "waryong" } },
    ],
    demo: { at: { hubName: "임전마을회관", villageId: "waryong" }, note: "금요일 오전" },
    fns: [
      { code: "F01", importance: 3, evidence: "새참거리 사러 많이 왔음" },
      { code: "F02", importance: 2, evidence: "계란" },
      { code: "F04", importance: 2, evidence: "07:00-21:00" },
      { code: "F05", importance: 1, evidence: "세제" },
      { code: "F09", importance: 2, evidence: "가게 앞 의자에서 쉬었음" },
    ],
  },
  {
    id: "sc3_ungok",
    title: "운곡리 — 이어받을 곳이 없는 마을",
    officer: "이서연 주무관(가명)",
    store: {
      name: "운곡 마을상회(가상)", villageId: "ungok", lat: 36.06435, lon: 127.18096, sbizSub: "슈퍼마켓",
      items: ["라면", "막걸리", "소주", "두부", "휴지", "파스"], hours: "07:00-19:00",
      memo: "막걸리랑 라면이 제일 많이 나갔음. 급하면 아침 일찍 문 두드려도 열어 줬음. 동네 소식은 다 이 가게에서 들었음.",
    },
    residents: [
      { id: "r1", name: "오금순", age: 80, mode: "walk", note: "", at: { villageId: "ungok" } },
      { id: "r2", name: "이상철", age: 66, mode: "car", note: "", at: { villageId: "chunsan" } },
      { id: "r3", name: "한순덕", age: 78, mode: "homebound", note: "", at: { villageId: "uwol" } },
    ],
    demo: { at: { villageId: "ungok" }, note: "수요일 오후" },
    fns: [
      { code: "F01", importance: 3, evidence: "막걸리랑 라면이 제일 많이 나갔음" },
      { code: "F04", importance: 3, evidence: "급하면 아침 일찍 문 두드려도 열어 줬음" },
      { code: "F05", importance: 1, evidence: "휴지" },
      { code: "F10", importance: 2, evidence: "동네 소식은 다 이 가게에서 들었음" },
    ],
  },
];

function resolvePoint(region: Region, at: { hubName?: string; villageId: string }): string {
  if (at.hubName) {
    const hub = region.points.find((p) => p.kind === "hub" && p.name === at.hubName);
    if (hub) return hub.id;
  }
  const node = region.points.find((p) => p.kind === "village_node" && p.villageId === at.villageId);
  if (node) return node.id;
  const any = region.points.find((p) => p.villageId === at.villageId) ?? region.points[0];
  return any?.id ?? `p_${at.villageId}_node`;
}

export function resolveTempScenario(t: TempScenario, region: Region): Scenario {
  const residents: Resident[] = t.residents.map(({ at, ...r }) => ({ ...r, pointId: resolvePoint(region, at) }));
  const demoConfirmations: Confirmation[] = [
    { cellKey: `stop:tour_A:${resolvePoint(region, t.demo.at)}`, value: "Y", note: t.demo.note, by: "시연 입력값", at: "2026-10-26T00:00:00+09:00" },
  ];
  return {
    id: t.id,
    title: t.title,
    officer: t.officer,
    store: t.store,
    residents,
    demoConfirmations,
    precomputed: {
      decompose: {
        inputHash: "temp",
        response: {
          mode: "rules",
          model: null,
          functions: t.fns.map((f) => ({ ...f, needsCheck: false, source: "rules", enabled: true })),
          unknowns: [],
          validator: { droppedCodes: [], demoted: 0, retried: false, fallbackReason: null },
          inputHash: "temp",
          generatedAt: null,
        },
      },
      compose: [],
    },
  };
}
