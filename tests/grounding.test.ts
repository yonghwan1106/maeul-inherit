// Grounding checker unit test (bundle B, spec 7.4 / 12-B). `npm run test`
// Pass bar: wrong 20 -> >= 18 blocked, right 20 -> <= 2 blocked. The pinned video sentence must be blocked on the weekday.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { groundText } from "../lib/validate/grounding";
import { residentTemplate, agencyTemplate } from "../lib/fallback/templates";
import type { PlanDigest, Region } from "../lib/types";

const ROOT = path.resolve(__dirname, "..");
const unit = JSON.parse(readFileSync(path.join(ROOT, "data/eval/testset_e4_unit.json"), "utf8")) as {
  meta: { pinned: string };
  digest: PlanDigest;
  cases: { id: string; expectBlock: boolean; category: string; sentence: string }[];
};
const region = JSON.parse(readFileSync(path.join(ROOT, "data/region_hwasan.json"), "utf8")) as Region;
const names = region.resources.map((r) => ({ name: r.name }));

test("unit set: wrong >= 18/20 blocked, right <= 2/20 blocked", () => {
  let tp = 0, fb = 0;
  const misses: string[] = [];
  for (const c of unit.cases) {
    const g = groundText(c.sentence, unit.digest, names);
    const blocked = !g.pass;
    if (c.expectBlock && blocked) tp += 1;
    if (!c.expectBlock && blocked) fb += 1;
    if (blocked !== c.expectBlock) misses.push(`${c.id} ${c.sentence} -> ${g.blocked.map((b) => b.reason).join("; ")}`);
  }
  if (misses.length) console.log("misses:\n  " + misses.join("\n  "));
  assert.ok(tp >= 18, `wrong detected ${tp}/20`);
  assert.ok(fb <= 2, `right blocked ${fb}/20`);
});

test("pinned video sentence is blocked on the weekday only", () => {
  const g = groundText(unit.meta.pinned, unit.digest, names);
  assert.equal(g.pass, false);
  assert.equal(g.blocked[0].reason, "목요일 — 확인된 요일(화요일)과 다름");
});

// l4-v2: 「면사무소」 = old name of the myeon office (region meta.seat) -> same institution, not 「계획에 없는 곳」
const seat = (region.meta as { seat?: { name?: string } }).seat?.name ?? "";
const namesWithSeat = [...names, { name: seat }];

test("office: 면사무소 / 화산면사무소 / current name are accepted as the myeon office", () => {
  assert.equal(seat, "화산면 행정복지센터");
  for (const s of ["궁금한 점은 면사무소에 물어보세요.", "궁금한 점은 화산면사무소에 물어보세요.", "궁금한 점은 화산면 행정복지센터에 물어보세요."]) {
    const g = groundText(s, unit.digest, namesWithSeat);
    assert.equal(g.pass, true, `${s} -> ${g.blocked.map((b) => b.reason).join("; ")}`);
    const office = g.checked.find((c) => c.kind === "resource" && (c.value.includes("사무소") || c.value.includes("행정복지센터")));
    assert.ok(office && office.ok, s);
  }
  const g = groundText("궁금한 점은 면사무소에 물어보세요.", unit.digest, namesWithSeat);
  assert.ok(g.checked.some((c) => c.value === "면사무소(= 화산면 행정복지센터)"));
  // a place that is not in the plan is still blocked next to the office
  const g2 = groundText("면사무소 옆 고산농협에서 택배를 맡아 줘요.", unit.digest, [...namesWithSeat, { name: "고산농협" }]);
  assert.equal(g2.pass, false);
});

test("promise / already-decided wording is blocked (l4-v2)", () => {
  const bad = [
    "택배는 미남경로회관에서 맡기로 했어요.",
    "생활용품은 확인해서 다시 알려 드릴게요.",
    "정해지면 안내해 드릴게요.",
    "결과는 연락드리겠습니다.",
    "장보기는 이동장터 A가 맡게 됐어요.",
    "확인이 끝나는 대로 말씀드릴게요.",
    "확인이 끝나면 그때 다시 자세히 말씀드리겠습니다.",
    "정해지면 알려드리도록 하겠습니다.",
  ];
  for (const s of bad) {
    const g = groundText(s, unit.digest, namesWithSeat);
    assert.equal(g.pass, false, s);
    assert.ok(g.blocked[0].reason.includes("약속·확정 표현"), `${s} -> ${g.blocked[0].reason}`);
    assert.ok(g.checked.some((c) => c.kind === "promise" && !c.ok), s);
  }
  const ok = ["생활용품은 확인하고 있어요.", "궁금한 점은 화산면 행정복지센터에 물어보세요.", "아직 정해지지 않았어요.", "확인을 부탁드립니다.", "승치리 어르신께 알려 드립니다.", "화산면 행정복지센터에서 안내드립니다.", "급할 때 도와줄 곳은 아직 찾고 있어요."];
  for (const s of ok) {
    const g = groundText(s, unit.digest, namesWithSeat);
    assert.equal(g.pass, true, `${s} -> ${g.blocked.map((b) => b.reason).join("; ")}`);
  }
});

test("templates always pass grounding", () => {
  const d = unit.digest;
  assert.equal(groundText(residentTemplate(d), d, names).pass, true, residentTemplate(d));
  for (const it of d.items) {
    const t = agencyTemplate(d, it.resId);
    assert.equal(groundText(t, d, names).pass, true, t);
  }
});
