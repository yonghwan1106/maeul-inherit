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
- 2026-10-25 19:20 | K5 | B | API 타입은 `lib/apiTypes.ts`(라우트·클라이언트 공용), 클라이언트는 `lib/api.ts`의 `apiDecompose`·`apiCompose`·`apiHealth`(never-throw, 네트워크 실패 시 B0+·템플릿으로 같은 모양). `fallbackReason`: `no_key|limit|timeout|http_4xx|http_5xx|parse|network|invalid` — 화면 안내 「데모 모드」/「체험 횟수 초과」(limit) 구분용 | C
- 2026-10-25 19:20 | E1 시험 세트 형식 | B → A(A8) | **시험 분할 문구 은행** `data/eval/bank_e1_test.json`은 개발 은행 `data/eval/bank_e1_dev.json`과 같은 스키마(`split`·`items{F01,F02,F03,F05}`·`phrases{F01..F10}`·`traps{fn:[{text,kind:neg|other|past}]}`·`fillers`, 스키마·라벨 규칙은 `scripts/eval/e1_gen.ts` 머리 주석). 기능마다 문구 4개 이상, 문구 하나는 기능 하나만 말하게. 합성 60건 생성: `npx tsx scripts/eval/e1_gen.ts --bank data/eval/bank_e1_test.json --out data/eval/testset_e1_synth.json --mix 20,25,15 --prefix syn`(A가 돌려도 되고 B6이 돌림) | A
- 2026-10-25 19:20 | E1 실문장 형식 | B → A(A8) | `data/eval/testset_e1_real.json` = `{ "meta": {…}, "cases": [ { "id": "real-01", "kind": "real", "input": { "sbizSub": "<기사에 나온 업종, 없으면 슈퍼마켓>", "items": [<기사에 나온 물건>], "hours": "", "villageId": "", "memo": "<인용 1~2문장, 사람 이름·상호 ○○>" }, "gold": ["F06", …], "traps": [ { "fn": "F07", "kind": "neg|other|past" } ], "source": { "url": "…", "accessed": "2026-10-2x" }, "humanChecked": false } ] }` — `e1_decompose.ts`는 `input`·`gold`·`trap|traps`·`humanChecked`만 읽음 | A
- 2026-10-25 19:20 | L1 | B | **L1 프롬프트 동결**(`lib/llm/prompts.ts` `L1_VERSION = "l1-v1"`, B2 커밋). 개발 세트 15건만 보고 다듬음 | A·C
- 2026-10-25 19:13 | K3 | A | `data/region_hwasan.json` 첫 실데이터(A2). 거점 id = `hub_{osmNodeId}`(웨이면 `hub_w{id}`), 그 밖 OSM 자원 `osm_n{id}`/`osm_w{id}`, 결합 자원 `hubdrop_hanaro_hwasan_{osmNodeId}`. Resource에 계약 밖 필드 `mergedFrom?: string[]`(병합 출처)가 더 있다(무시해도 됨). `meta` 키: `sources`(D1·D2·D4·D5·D6, url·asOf)·`osmBaseTime`·`odbl`·`assumptions`·`myeonPop`(2479)·`pop65`·`pop65Share`(0.4595)·`popAsOf`·`villageBjdCodes`·`codeVerified`(false)·`generatedAt`·`inputSha256`·`busStops`([lat,lon][])·`seat`·`bbox` | B·C: S0 「45.9%」·S6 출처표는 meta에서 읽을 수 있음
- 2026-10-25 19:13 | K2 | A | 엔진 실구현(A3), `ENGINE_STUB = false`, `lib/engine/mock.ts` 삭제(아무도 안 씀). 시그니처 그대로. 보조 export 추가: `withOverrides(cells, {key: Tri})`(증분 재계산), `affectedVM`, `scopeOf`, `solveVM(region, cells, villageId, mode)`, `vmFromSet`, `daysFromNotes`. `planScope`는 `plan.voi = []`로 돌려준다 → 화면은 `plan.voi = computeVoi(region, cells, plan, store, fns)`를 따로 부른다(상위 3개 = 먼저 전화할 곳). `ResPointCell`에 `burden` 필드 추가 | C: S3 확인 입력 → makeCells(conf 새로) → planScope → computeVoi(실측 SC1 ≈ 25 + 0.4 + 260 ms)
- 2026-10-25 19:13 | 온톨로지 | A | `hanaro`의 배송(deliver) 경로도 화산면 점포만(설계서 4.4.2 표의 「농협 하나로마트(화산)」 행) — 다른 면 하나로마트는 방문만 | 다른 면 하나로마트에 area 칸이 생기지 않음
- 2026-10-25 19:13 | §5.6 라벨 | A | cap 라벨은 기능마다 자연스러운 서술(F02·F03·F05 「…을 살 수 있는지」, F06 「택배를 대신 받아 줄 수 있는지」(고정), F08 「돈 찾기(현금·공과금)가 되는지」, F10 「안부 확인을 해 줄 수 있는지」), 조사(이/가·으로/로)는 받침 판정. open 라벨의 기준일은 상가정보 업소 「등록 정보 2026-06」, OSM 점포 「OSM 등록 정보 2026-10」 | 화면은 `label`을 그대로 표시
- 2026-10-25 19:20 | K6 | A → B(B5) | `data/eval/e2_cases.json` = `{ meta: { n: 33, fns[{code,name,importance}], tableFnOrder: ["F01","F02","F04","F05","F06","F07"], params, regionSha256 }, cases: [ { caseId: "e2-{villageId}-{mode}", villageId, villageName, mode, store{lat,lon,villageId}, scope[villageId], points[{id,name,villageId,kind,lat,lon,weight}], resources[{id,name,cls,lat?,lon?,villageId?,channels[한국어 경로],status(기본 상태 설명)}], table{pointId:{resId:"YUNNUY"(tableFnOrder 순 Y/U/N)}} } ] }`. 후보 자원 = 이용권 수요점 하나에서라도 생활 일 칸이 N이 아닌 자원(최대 145개/사례, 차량 사례가 큼). B2a는 `table`을 빼고, B2b는 넣는다. `e2_llm_outputs.json`은 배열 `[{caseId, variant:"b2a"|"b2b", raw, parsed:{plans:[{villageId,set,assign:[{fn,resId,status:"확실"|"확인 필요"|"없음"}]}]}|null}]`(또는 `{outputs:[…]}`) — `e2_plan.ts`가 읽어 채점 | B5
