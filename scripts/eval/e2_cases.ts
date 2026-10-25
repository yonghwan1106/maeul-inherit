// npm run eval:e2cases — E2 cases (spec 7.2-1): 11 ri x 3 modes = 33. Virtual closure point = ri node,
// functions = SC1 life functions (F01 3, F02 2, F04 1, F05 2, F06 2, F07 2), no confirmations.
// Per case: scope, demand points, candidate resources (any non-N core cell in scope) with a default-status
// text, and the per-point tri table (B2b input). Writes data/eval/e2_cases.json (K6).
import type { Channel, FnCode, Mode, Resource } from "../../lib/types";
import { MODES } from "../../lib/types";
import { CLASS_TABLE, FN_BIT, FNS, channelsOf } from "../../lib/ontology";
import { makeCells, scopeOf, P } from "../../lib/engine";
import { E2_FNS, loadRegion, sha256File, writeJson } from "./lib_a";

const CH_KO: Record<Channel, string> = { visit: "방문", deliver: "배송", tour: "순회(이동장터)", hubdrop: "거점 일괄배송 수령" };

function statusText(r: Resource): string {
  const parts: string[] = [];
  const chs = channelsOf(r);
  if (chs.includes("visit")) {
    if (CLASS_TABLE[r.cls].open === "open") parts.push("방문: 등록 정보 업소, 지금 영업 여부 미확인");
    else parts.push("방문: 운영 중인 공공·농협 시설(OSM)");
    if (r.judgeUnknown) parts.push("파는 물건 미검수");
  }
  if (chs.includes("deliver")) parts.push(r.cls === "care_link" ? "배송: 리별 제공 여부·대상 자격 미확인" : "배송: 배송 권역 미확인");
  if (chs.includes("tour")) parts.push("순회: 정차 마을·요일 미확인");
  if (chs.includes("hubdrop")) parts.push("거점 일괄배송: 운영 여부 미확인");
  if (r.cls === "hub") parts.push("마을회관·경로당: 택배 대신 받기·안부는 확인 필요");
  return parts.join(" · ");
}

const region = loadRegion();
const cells = makeCells(region, E2_FNS, []);
const core: FnCode[] = E2_FNS.map((f) => f.code);
const triStr = (y: number, u: number) => core.map((f) => ((y >> FN_BIT[f]) & 1 ? "Y" : (u >> FN_BIT[f]) & 1 ? "U" : "N")).join("");

const cases = [];
for (const v of [...region.villages].sort((a, b) => (a.id < b.id ? -1 : 1))) {
  const store = { lat: v.lat, lon: v.lon, villageId: v.id };
  const scope = scopeOf(region, store);
  const pts = region.points.filter((p) => scope.includes(p.villageId)).sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const m of MODES as Mode[]) {
    const ids = new Set<string>();
    const table: Record<string, Record<string, string>> = {};
    for (const p of pts) {
      const row: Record<string, string> = {};
      for (const [rid, e] of cells.masks[m].get(p.id) ?? []) {
        if (!((e.y | e.u) & cells.coreMask)) continue;
        row[rid] = triStr(e.y, e.u);
        ids.add(rid);
      }
      table[p.id] = row;
    }
    const resources = [...ids].sort().map((id) => {
      const r = region.resources.find((x) => x.id === id)!;
      return {
        id: r.id, name: r.name, cls: r.cls,
        ...(typeof r.lat === "number" ? { lat: r.lat, lon: r.lon } : {}),
        ...(r.villageId ? { villageId: r.villageId } : {}),
        channels: channelsOf(r).map((c) => CH_KO[c]),
        status: statusText(r),
      };
    });
    cases.push({
      caseId: `e2-${v.id}-${m}`, villageId: v.id, villageName: v.name, mode: m, store, scope,
      points: pts.map((p) => ({ id: p.id, name: p.name, villageId: p.villageId, kind: p.kind, lat: p.lat, lon: p.lon, weight: p.weight })),
      resources, table,
    });
  }
}

writeJson("data/eval/e2_cases.json", {
  meta: {
    n: cases.length, seed: 42, generatedAt: new Date().toISOString(),
    regionSha256: sha256File("data/region_hwasan.json"),
    fns: E2_FNS.map((f) => ({ code: f.code, name: FNS[f.code].name, importance: f.importance })),
    tableFnOrder: core,
    params: P,
    note: "가상 폐업 지점 = 리 대표점(이름 없음). 후보 = 이용권 수요점 중 하나에서라도 생활 일 칸이 N이 아닌 자원. table[수요점][자원] = 기능 순서(tableFnOrder)대로 Y/U/N.",
  },
  cases,
});
console.log(`e2_cases: ${cases.length} cases -> data/eval/e2_cases.json (resources/case: min ${Math.min(...cases.map((c) => c.resources.length))}, max ${Math.max(...cases.map((c) => c.resources.length))})`);
