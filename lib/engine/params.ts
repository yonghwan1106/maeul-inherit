// Spec section 5.2. Every value is an assumption ("가정"); shown as-is on the S3 params panel and S6.
export const P = {
  ROAD_FACTOR_WALK: 1.2, ROAD_FACTOR_CAR: 1.3,     // 직선거리 × 계수 = 도로 추정
  WALK_MAX_KM: 1.0, CAR_MAX_KM: 20, F04_CAR_MAX_KM: 5, TOUR_CAR_MAX_KM: 5,
  HOMEBOUND_NEAR_KM: 0.2,                           // 거동 곤란: 자기 수요점 판정
  SCOPE_KM: 2.0,                                    // 이용권: 가게 위치 ~ 리 대표점
  MERGE_M: 100, RI_FILTER_KM: 8.0,                  // 파이프라인과 같은 값(문서용)
  MAX_SET: 3, MAX_CANDIDATES: 25,
  VOI_P: 0.5,                                       // 확인 확률(표시용 기대값, 순위와 무관)
  BUS_STOP_M: 500,                                  // 선택 조건 「버스」 전용
  HUB_ASSIGN_RULE: "이름에 리 이름 → 그 리, 아니면 가장 가까운 place 노드가 화산면 리일 때 그 리",
  EPS: 1e-9,
} as const;

export type Params = typeof P;
