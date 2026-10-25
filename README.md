# 이어받는 마을 — 가게가 닫혀도

아이디어 챌린지 4번 「기능상속」 구현작 · 2026 AI 라이프 솔루션 챌린지 응모 시제품

> 마을의 마지막 가게가 닫혀도 장보기·택배·배달이 끊기지 않도록, AI가 그 가게가 하던 일을 찾아 농협·우체국·마을회관에 나눠 맡기는 계획을 짭니다.

- 배포: https://maeul-inherit.vercel.app
- 지역: 전북특별자치도 완주군 화산면(법정리 11개)
- 스택: Next.js 16.3.4 (App Router) · React 19.2.8 · TypeScript 5.9.3 · Tailwind CSS 4.3.3 · @anthropic-ai/sdk 0.124.0 · Node 22

## 구조
- `lib/types.ts` — 계약 타입(K1)
- `lib/ontology.ts` — 생활기능 F01~F10, 클래스 × 경로 기본 칸 표
- `lib/engine/` — 결정 엔진(3값 칸·피복 최적화·확인 가치·개인 재정렬·기준선·요약). 함수는 `lib/engine/index.ts`에서만 export(K2)
- `lib/geo.ts` — 하버사인 거리·SVG 투영
- `data/fixtures/` — 화면 개발용 목업(`region_mock.json`, `plan_mock.json`) — 화면·보고서 수치의 출처가 아님
- `docs/CONTRACT_CHANGES.md` — 계약 변경 기록

## 실행
```
npm --prefix <repo> run dev
npm --prefix <repo> run build
npm --prefix <repo> run typecheck
```

## 배포 기록
| 일시(KST) | 커밋 | 내용 |
|---|---|---|
| 2026-10-25 18:56 | 51dbb1c | 첫 배포(A1 골격, 키 없음) — 짧은 URL 200 확인 |
| 2026-10-25 20:04 | 851dc10 | 최종 배포(키 있음, `-e` 4개) — https://maeul-inherit.vercel.app 쿠키 없이 200, `/api/health` `hasKey:true`·`mode:live`·`model:claude-haiku-5-5`·`commit:851dc10`, `capture.py --check` 37/37 PASS(운영), 키 없는 로컬 `next start`에서도 37/37 PASS·`/api/decompose` `mode:rules` |
| 2026-10-25 20:36 | f4e65ff | 검수 수정 재배포(키 있음, `-e` 4개, GitHub 연동 끊은 뒤 CLI 배포) — 20:06 GitHub 자동배포(4d317c8, 키 없음)가 키 배포를 덮었던 것을 20:22 `vercel promote`로 되돌리고 다시 배포. 짧은 URL 쿠키 없이 200, `/api/health` `hasKey:true`·`mode:live`·`commit:f4e65ff`, 운영 `/api/decompose` live claude-haiku-5-5, `capture.py --check` 운영 37/37 PASS |
| 2026-10-25 20:56 | 155403b | 마무리 재배포(키 있음, `-e` 4개, CLI) dpl_4j3Lnsfxy9LzuZNUWYJ96VWyZpNM — 근거 대조 l4-v2(면사무소 별칭·약속 표현 차단)·사전계산 문서 재생성·E4 재측정. 짧은 URL 쿠키 없이 200, `/api/health` `hasKey:true`·`mode:live`·`commit:155403b`, 운영 `/api/decompose` live claude-haiku-5-5, `capture.py --check` 운영 37/37 PASS. 20:43 공개 저장소 이력 재작성(옛 커밋의 실명·다른 작품명 줄 교체, 위 표의 해시는 새 해시) |
| 2026-10-25 22:06 | 4ac93bf | 화면 디자인 「마을 인수인계 장부」 2차(키 있음, `-e` 4개, CLI) dpl_3JymNyz3LEujBra3ikDzii6JNEUU — 640 px 미만 S3 장부를 2열 줄 목록으로 접음, 주민 안내문 20 px, 비평 수정. 짧은 URL 쿠키 없이 200, `/api/health` `hasKey:true`·`mode:live`·`commit:4ac93bf`, 운영 `/api/decompose` live claude-haiku-5-5, `capture.py --check` 운영 37/37 PASS, `docs/capture` 10장 운영에서 다시 찍음 |
| 2026-10-25 22:20 | 4c5d58b | S0 마무리(키 있음, `-e` 4개, CLI) dpl_FhJkStxsHs76Rba9FAM6jao3G3dJ — 합계 줄은 크기 변화 없이 투명도로만 나타남(「확인 후」 합계가 장부 끝에서 잘리지 않음), 640 px 미만 「체험 시작」을 한 줄 소개 바로 아래로. 짧은 URL 쿠키 없이 200, `/api/health` `hasKey:true`·`mode:live`·`commit:4c5d58b`, `capture.py --check` 운영 37/37 PASS, `docs/capture` 10장 운영에서 다시 찍음 |

## 배포 메모
- 운영 환경변수(`ANTHROPIC_API_KEY` 등)는 `vercel --prod -e ...` 방식으로 배포마다 넣는다. **`-e`는 그 배포에만 붙으므로 재배포할 때마다 다시 넣어야 한다.** 키 값은 저장소·로그·`.env.local`에 남기지 않는다.
- Vercel 프로젝트의 GitHub 연동은 끊었다(2026-10-25 20:22, `vercel git disconnect`). 연동이 있으면 `git push`마다 키 없는 운영 배포가 생겨 `-e`로 넣은 키 배포를 덮는다(20:06 실제 발생). 배포는 CLI `vercel --prod -e ...`로만 한다.
- 키가 없으면 모든 화면이 사전계산·규칙·템플릿으로 동작한다(「데모 모드(규칙)」).

## 데이터·원칙
화면 S6(`/about`)과 같은 내용이다.

**데이터 출처**
| # | 자료 | 기준 | 쓰는 곳 |
|---|---|---|---|
| D1 | 소상공인시장진흥공단 상가(상권)정보 (data.go.kr 15083033, 5개 면 필터본 580행) | 2026-06-30 | 대체자원 후보 업소, 「식료품 업소 0곳 리」 집계 |
| D2 | 행정안전부 지역별(행정동) 성별 연령별 주민등록 인구수 (15097972) | 2026-09-30 | 면 인구·65세 이상 비율, 리 균등 배분 총량 |
| D3 | 행정안전부 법정동별(리명 포함) 주민등록 인구·세대 (오픈API 15108071) | — | **쓰지 않음**(활용 신청 전) → 리 인구는 면 인구 균등 배분(가정) |
| D4 | OpenStreetMap (Overpass, bbox 35.87,127.12,36.10,127.34) | 2026-10-25T09:08:36Z | 리 대표점·수요점(마을회관·경로당)·공공·농협 자원 |
| D5 | MTN 2026-08-06 완주군 농촌 이동장터 기사 | 2026-08-06 | 「이동장터 A」(운영 주체를 특정하지 않은 익명 자원) 근거 |
| D6 | 복지로 노인맞춤돌봄서비스 안내 | 2021-04-22 | 「생활지원 연계」 근거 |
| D7 | 농림축산식품부 보도자료(2024-07-29, 2020 농림어업총조사 인용) | 2024-07-29 | 처음 화면 「73.5%」 |
| D8 | 위키백과 「화산면 (완주군)」 법정리 목록 | — | 법정리 11개(사실만) |

**원칙**
- AI 사용: 생활기능 분해와 문서 초안은 Anthropic Claude(claude-haiku-5-5)가 쓴다. 누가 어떤 일을 이어받을지와 모든 숫자는 직접 만든 결정 엔진(`lib/engine/`)이 계산하며, 학습한 AI 모델은 쓰지 않는다. 근거 대조기(`lib/validate/grounding.ts`)는 규칙으로 동작한다 — 계획에 없는 곳·요일·시각·숫자·전화번호, 확인 중인 곳의 단정, 약속·확정 표현(「맡기로 했어요」「다시 알려 드릴게요」 등, l4-v2부터)을 막고, 「면사무소」는 「화산면 행정복지센터」의 옛 이름으로 같은 기관으로 본다(문서에는 현재 이름을 쓰도록 프롬프트가 지시). E4 l4-v2 첫 실행(대조기에 「말씀드릴게요」가 빠져 있던 상태)은 `data/eval/raw/e4_run1_l4v2_checker_gap.json`에 그대로 남겼다.
- LLM 호출: 기본 `claude-haiku-5-5`, 실패 시 `claude-haiku-4-5` 1회, 20초 제한, 사고(thinking) 끔, temperature 보내지 않음. 요청·응답 본문은 로그에 남기지 않는다. IP당 분당 6회·인스턴스당 하루 300회(`AI_RPM_PER_IP`·`AI_DAILY_CAP`)를 넘으면 규칙·템플릿으로 답한다(**인스턴스당 상한** — 진짜 상한은 Anthropic 콘솔 지출 한도).
- 사전계산: 시나리오 3개의 분해·안내문·요청문은 `npm run precompute`로 실제 호출해 `data/scenarios/*.json`에 저장(모델·생성 일시 포함). 시나리오만 누르면 LLM 호출 0. `npm run check:scenarios`가 입력 해시·id·가상 가게명·시연 입력값 위치를 검사한다(빌드 전 필수).
- 개인정보: 서버 저장 없음, DB 없음. 확인 결과·승인 기록·주민 제보는 이 브라우저(localStorage `mi.v1.*`)에만 남고 S6에서 지울 수 있다. 메모의 전화번호는 보내기 전·서버에서 두 번 가린다.
- 가정·합성: 리 인구(면 인구 균등 배분), 수요점 무게, 거점 소속 리(거리 추정), 이동장터 정차·배송 권역·생활지원 제공 여부(전부 「확인 중」), 가상 폐업·가상 인물, 시험 세트(합성 60·개발 15·단위 시험 40). 기준값은 `lib/engine/params.ts` 한 곳.
- 「시연 입력값」은 실명이 아닌 칸(이동장터 A 정차)에만 넣을 수 있다. 실존 업소에 「폐업」을 붙이지 않는다.
- 런타임 외부 데이터 호출은 Anthropic뿐(공공데이터는 빌드 때 JSON).

## 쓰지 않은 것
1. 전력·AMI 신호로 폐업을 감지하지 않습니다 — 전력·AMI 데이터를 쓰지 않는다.
2. 다른 작품(음식점 생존분석 등)의 코드·데이터를 다시 쓰지 않는다 — 이 저장소의 코드는 새로 작성했다.
3. 폐업 지원·재취업·졸업장 같은 상인 쪽 장치는 다루지 않는다 — 남은 주민의 생활 일만 다룬다.
4. 취약수요 × 저접근성 점수 산식·격자 도달권 모델을 쓰지 않는다 — 실제 자원과 이동 유형별 거리 칸으로 계산한다.
5. 특정 민간 배송 플랫폼(배민·쿠팡 등) 전제·데이터·연동(답변서 3쪽).

## 화면 점검·캡처
- `python -I scripts/capture.py --check <URL>` — 시나리오 3개 × S0→S1→S2(확인)→S3(시연 확인 1건)→S4(피드백 1건·승인) 전 경로, 콘솔 오류 0, 360·1920 px 가로 넘침 없음, S3 갱신 시간, `/poster` 1200×675.
- `python -I scripts/capture.py <URL>` — `docs/capture/`에 화면 10장(S0·S1·S2·S3 확인 전·S3 확인 후·S4·S4 거른 예시·S5·S6·포스터).
- Playwright는 헤드리스 크로미움(`--disable-gpu`), 대기는 `load` + 고정 대기(운영 빌드에서 `networkidle`이 끝나지 않음).

## 데이터·라이선스
- 코드: MIT (`LICENSE`)
- data/region_hwasan.json은 OpenStreetMap 파생 데이터(ODbL 1.0, © OpenStreetMap contributors), 상가정보·주민등록 인구는 공공데이터포털 자료.
