// L1 validator + rule baselines (bundle B). `npm run test`
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateDecompose } from "../lib/validate/decompose";
import { ruleCodes, splitClauses, clauseIsNegated } from "../lib/fallback/rules";
import { redactPhones } from "../lib/guard/redact";
import { inputHash } from "../lib/guard/cache";
import type { DecomposeRequest } from "../lib/apiTypes";

const SC1: DecomposeRequest = {
  sbizSub: "슈퍼마켓",
  items: ["라면", "쌀", "두부", "계란", "막걸리", "파스", "세제"],
  hours: "06:30-20:00",
  villageId: "seungchi",
  memo: "어르신들 택배를 다 여기 맡겼고, 전화하면 사장님이 오토바이로 갖다 줬음. 오후엔 가게 앞 평상에 모여 앉으심. 혼자 사는 어르신들 안부도 사장님이 챙겼음.",
};
const SC2: DecomposeRequest = {
  sbizSub: "슈퍼마켓",
  items: ["라면", "과자", "음료", "막걸리", "계란", "세제", "건전지"],
  hours: "07:00-21:00",
  villageId: "waryong",
  memo: "농번기엔 새참거리 사러 많이 왔음. 외상 장부가 있었음. 택배는 안 받았음. 버스 기다리는 사람들이 가게 앞 의자에서 쉬었음.",
};

test("validator: whitelist, importance clamp, duplicate merge, evidence demotion", () => {
  const raw = {
    functions: [
      { code: "F06", importance: 3, evidence: "택배를 다 여기 맡겼고", needsCheck: false },
      { code: "F06", importance: 2, evidence: "택배", needsCheck: false },
      { code: "F11", importance: 2, evidence: "병원", needsCheck: false },
      { code: "f07", importance: 5, evidence: "전화하면 사장님이 오토바이로 갖다 줬음", needsCheck: false },
      { code: "F10", importance: 0, evidence: "사장님이 매일 안부 전화를 했음", needsCheck: false },
    ],
    unknowns: ["배달 가능 범위"],
  };
  const v = validateDecompose(raw, SC1);
  assert.equal(v.ok, true);
  assert.deepEqual(v.functions.map((f) => f.code), ["F06", "F07", "F10"]);
  assert.deepEqual(v.droppedCodes, ["F11"]);
  assert.equal(v.functions.find((f) => f.code === "F07")!.importance, 3);
  assert.equal(v.functions.find((f) => f.code === "F10")!.importance, 1);
  assert.equal(v.functions.find((f) => f.code === "F10")!.needsCheck, true); // evidence not in input
  assert.equal(v.functions.find((f) => f.code === "F06")!.importance, 3);
  assert.equal(v.demoted, 1);
  assert.equal(v.schemaViolation, true);
  assert.ok(v.functions.every((f) => f.source === "llm" && f.enabled));
});

test("validator: evidence match ignores whitespace and accepts items/hours", () => {
  const v = validateDecompose(
    { functions: [{ code: "F04", importance: 1, evidence: "06:30-20:00", needsCheck: false }, { code: "F01", importance: 3, evidence: "라 면", needsCheck: false }], unknowns: [] },
    SC1,
  );
  assert.equal(v.demoted, 0);
  assert.equal(v.schemaViolation, false);
});

test("validator: non-object / missing functions -> not ok", () => {
  assert.equal(validateDecompose(null, SC1).ok, false);
  assert.equal(validateDecompose({ unknowns: [] }, SC1).ok, false);
  assert.equal(validateDecompose("text", SC1).ok, false);
});

test("rules: B0-type / B0 / B0+ on SC1 and SC2", () => {
  assert.deepEqual(ruleCodes(SC1, "b0_type"), ["F01", "F02", "F04", "F05"]);
  assert.deepEqual(ruleCodes(SC1, "b0plus"), ["F01", "F02", "F04", "F05", "F06", "F07", "F09", "F10"]);
  // SC2: "택배는 안 받았음" -> B0 counts F06, B0+ removes it
  assert.ok(ruleCodes(SC2, "b0").includes("F06"));
  assert.ok(!ruleCodes(SC2, "b0plus").includes("F06"));
});

test("rules: clause split and negation", () => {
  assert.deepEqual(splitClauses("예전엔 배달했는데 요즘은 안 함. 택배는 우체국에서 받았음"), ["예전엔 배달했", "요즘은 안 함", "택배는 우체국에서 받았음"]);
  assert.equal(clauseIsNegated("택배는 우체국에서 받았음"), true);
  assert.equal(clauseIsNegated("혼자 사는 어르신들 안부도 사장님이 챙겼음"), false);
});

test("redact + hash: phone masked, hash stable under whitespace/order", () => {
  assert.equal(redactPhones("사장님 010-1234-5678 번"), "사장님 [전화번호 가림] 번");
  assert.equal(redactPhones("063 123 4567"), "[전화번호 가림]");
  const a = inputHash("decompose", SC1);
  const b = inputHash("decompose", { ...SC1, memo: "  " + SC1.memo.replace(/ /g, "  ") + " ", items: [...SC1.items].reverse() });
  assert.equal(a, b);
  assert.notEqual(a, inputHash("compose", SC1));
});
