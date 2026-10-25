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

## 배포 메모
- 운영 환경변수(`ANTHROPIC_API_KEY` 등)는 `vercel --prod -e ...` 방식으로 배포마다 넣는다. **`-e`는 그 배포에만 붙으므로 재배포할 때마다 다시 넣어야 한다.** 키 값은 저장소·로그·`.env.local`에 남기지 않는다.
- 키가 없으면 모든 화면이 사전계산·규칙·템플릿으로 동작한다(「데모 모드(규칙)」).

## 데이터·라이선스
- 코드: MIT (`LICENSE`)
- data/region_hwasan.json은 OpenStreetMap 파생 데이터(ODbL 1.0, © OpenStreetMap contributors), 상가정보·주민등록 인구는 공공데이터포털 자료.
