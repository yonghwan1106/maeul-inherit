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

test("templates always pass grounding", () => {
  const d = unit.digest;
  assert.equal(groundText(residentTemplate(d), d, names).pass, true, residentTemplate(d));
  for (const it of d.items) {
    const t = agencyTemplate(d, it.resId);
    assert.equal(groundText(t, d, names).pass, true, t);
  }
});
