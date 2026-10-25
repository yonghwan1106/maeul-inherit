# 계약 변경 기록 (K1~K8)

바꾸는 쪽이 여기 한 줄을 적고 다른 묶음에 알린다. 형식: `날짜 시각 | 계약 | 묶음 | 변경 내용 | 영향`.

## A1 동결 (2026-10-25)
- **K1** `lib/types.ts` = 구현명세 §5.1 그대로.
- **K2** 엔진 시그니처(`lib/engine/index.ts`에서만 export), A1 시점은 스텁(`ENGINE_STUB = true`, `data/fixtures/plan_mock.json` 반환):
  - `makeCells(region, fns, conf, opts?) → Cells`
  - `planScope(region, cells, store: StoreLoc, fns) → Plan` (`StoreLoc = { lat, lon, villageId }`, `Store`도 그대로 넘길 수 있음)
  - `computeVoi(region, cells, plan, store: StoreLoc, fns) → VoiItem[]`
  - `personal(region, cells, pointId, mode, fns) → PersonalResult`
  - `b1 / b1b / b1g(region, cells, villageId, mode, fns) → PlanVM` (기준선 결과도 PlanVM 모양 — 채점·미니 카드 공용)
  - `digestFor(region, plan, target: PersonalResult | PlanVM, scenario: Scenario | null, conf) → PlanDigest`
- `Cells`(engine/cells.ts)는 B·C가 만들어 넘기기만 하는 불투명 값이다. 내부 필드는 A3가 늘릴 수 있다(시그니처는 고정).
- 보조 export(계약 아님, 편의): `triAnd`, `triOr`, `cellValue`, `P`.
- 온톨로지(`lib/ontology.ts`): `FN_CODES`, `FNS`(화면 이름·정의), `CORE_FNS`, `SOCIAL_FNS`, `FN_BIT`, `fnMask`, `CLASS_TABLE`, `routeCapsFor`, `channelsOf`, `cellKey.{cap,open,stop,area,hubdrop,bus}`(§5.6 키 형식).

## id 규칙(A2가 따름, 목업도 같은 모양)
- 리 id: 로마자 소문자 — `hwapyeong 화평 · hwawol 화월 · chunsan 춘산 · ungok 운곡 · unsan 운산 · waryong 와룡 · jong 종 · seungchi 승치 · seongbuk 성북 · unje 운제 · uwol 우월`.
- 수요점 id: 리 대표점 `p_{villageId}_node`, 거점 `p_{villageId}_{hubResId}`.
- 자원 id: 명세 §4.3-4 그대로(`hanaro_hwasan`·`bank_nh_hwasan`·`post_hwasan`·`tour_A`·`care_link`·`osm_{type}{id}`·`sbiz_{상가업소번호}`·`hub_{osmId}`·`hubdrop_hanaro_hwasan_{hubOsmId}`). 목업은 `hub_mock_*`·`sbiz_MOCK0001`.

## 변경
(아직 없음)
