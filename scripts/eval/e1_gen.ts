// E1 synthetic set generator (spec 7.1, bundle B code). The gold function set is chosen FIRST, then the
// input is assembled from a phrase bank. Dev and test banks are separate files written by different workers:
//   dev  : data/eval/bank_e1_dev.json  (bundle B, prompt author)  -> data/eval/testset_e1_dev.json   (15 = 5/6/4)
//   test : data/eval/bank_e1_test.json (bundle A, NOT the prompt author) -> data/eval/testset_e1_synth.json (60 = 20/25/15)
//
// Usage:
//   npx tsx scripts/eval/e1_gen.ts --bank data/eval/bank_e1_dev.json  --out data/eval/testset_e1_dev.json   --mix 5,6,4   --prefix dev
//   npx tsx scripts/eval/e1_gen.ts --bank data/eval/bank_e1_test.json --out data/eval/testset_e1_synth.json --mix 20,25,15 --prefix syn
//
// Bank schema (both splits):
//   { "split": "dev"|"test",
//     "items":   { "F01": [..], "F02": [..], "F03": [..], "F05": [..] },   // goods; lists must not share words
//     "phrases": { "F01": [..], ..., "F10": [..] },                        // memo sentences saying the shop DID f
//                                                                         // (each phrase must express only that f)
//     "traps":   { "F06": [{ "text": "...", "kind": "neg"|"other"|"past" }], ... },  // look like f but are NOT f
//     "fillers": [..] }                                                    // neutral sentences (no function)
// Labelling rules the generator applies (same rubric as spec 7.1-a):
//   - purchase functions F01/F02/F03/F05 are gold when their goods are listed or their phrase is in the memo
//   - F04 is gold when an F04 phrase is in the memo OR the hours start <= 07:00 / end >= 21:00
//     (the generator only uses long hours when F04 is gold, short hours otherwise)
//   - trap sentences never add their function to gold
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { FnCode } from "../../lib/types";
import { FN_CODES } from "../../lib/ontology";
import { makeRng, type Rng } from "./b_prng";

interface Bank {
  split: string;
  items: Partial<Record<FnCode, string[]>>;
  phrases: Partial<Record<FnCode, string[]>>;
  traps: Partial<Record<FnCode, { text: string; kind: "neg" | "other" | "past" }[]>>;
  fillers: string[];
}

export interface E1Case {
  id: string;
  kind: "items" | "rich" | "trap";
  input: { sbizSub: string; items: string[]; hours: string; villageId: string; memo: string };
  gold: FnCode[];
  trap?: { fn: FnCode; kind: string; text: string };
}

export interface E1SetFile {
  meta: { split: string; seed: number; n: number; mix: number[]; bankFile: string; bankSha256: string; generator: string; synthetic: true };
  cases: E1Case[];
}

const PURCHASE: FnCode[] = ["F01", "F02", "F03", "F05"];
const LONG_HOURS = ["06:30-20:00", "07:00-21:00", "06:00-22:00", "07:00-20:00", "08:00-21:30"];
const SHORT_HOURS = ["09:00-19:00", "08:00-19:00", "09:00-18:00", "08:30-20:00", "09:30-19:30"];
const VILLAGES = ["hwapyeong", "hwawol", "chunsan", "ungok", "unsan", "waryong", "jong", "seungchi", "seongbuk", "unje", "uwol"];
const SUBS = ["슈퍼마켓", "슈퍼마켓", "슈퍼마켓", "슈퍼마켓", "편의점", "반찬/식료품 소매업"];

function arg(name: string, def?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  if (def === undefined) throw new Error(`missing --${name}`);
  return def;
}

const sortFns = (xs: Iterable<FnCode>) => FN_CODES.filter((c) => new Set(xs).has(c));

function sampleSet(rng: Rng, pool: FnCode[], min: number, max: number): FnCode[] {
  const k = Math.min(pool.length, min + rng.int(max - min + 1));
  return rng.shuffle(pool).slice(0, k);
}

function build(rng: Rng, bank: Bank, kind: E1Case["kind"], id: string): E1Case {
  const available = FN_CODES.filter((c) => (PURCHASE.includes(c) ? bank.items[c]?.length || bank.phrases[c]?.length : bank.phrases[c]?.length) || c === "F04");
  let gold: FnCode[];
  let trapFn: FnCode | null = null;
  if (kind === "items") {
    const purch = sampleSet(rng, PURCHASE.filter((c) => bank.items[c]?.length), 1, 4);
    gold = rng.chance(0.4) ? [...purch, "F04"] : purch;
    if (gold.length < 2) gold.push(rng.pick(PURCHASE.filter((c) => bank.items[c]?.length && !gold.includes(c))));
  } else if (kind === "rich") {
    gold = sampleSet(rng, available, 3, 8);
  } else {
    // trap: choose the trap function first so it is never in gold
    trapFn = rng.pick((Object.keys(bank.traps) as FnCode[]).filter((f) => bank.traps[f]?.length).sort());
    gold = sampleSet(rng, available.filter((c) => c !== trapFn), 2, 6);
  }
  const items: string[] = [];
  const sentences: string[] = [];
  let longHours = false;
  for (const f of gold) {
    if (PURCHASE.includes(f)) {
      const useItems = kind === "items" || !bank.phrases[f]?.length || (bank.items[f]?.length && rng.chance(0.6));
      if (useItems && bank.items[f]?.length) {
        for (const it of rng.shuffle(bank.items[f]!).slice(0, 1 + rng.int(2))) items.push(it);
      } else sentences.push(rng.pick(bank.phrases[f]!));
    } else if (f === "F04") {
      if (kind === "items" || !bank.phrases.F04?.length || rng.chance(0.5)) longHours = true;
      else sentences.push(rng.pick(bank.phrases.F04!));
    } else {
      sentences.push(rng.pick(bank.phrases[f]!));
    }
  }
  let trap: E1Case["trap"];
  if (kind === "trap") {
    const fn = trapFn!;
    const t = rng.pick(bank.traps[fn]!);
    trap = { fn, kind: t.kind, text: t.text };
    sentences.push(t.text);
  }
  if (kind !== "items" && bank.fillers.length && rng.chance(0.5)) sentences.push(rng.pick(bank.fillers));
  const memo = kind === "items" ? "" : rng.shuffle(sentences).map((s) => s.replace(/[.\s]+$/, "") + ".").join(" ");
  return {
    id,
    kind,
    input: {
      sbizSub: rng.pick(SUBS),
      items: rng.shuffle(items),
      hours: rng.pick(longHours ? LONG_HOURS : SHORT_HOURS),
      villageId: rng.pick(VILLAGES),
      memo,
    },
    gold: sortFns(gold),
    ...(trap ? { trap } : {}),
  };
}

export function generate(bankFile: string, mix: number[], seed: number, prefix: string): E1SetFile {
  const raw = readFileSync(bankFile, "utf8");
  const bank = JSON.parse(raw) as Bank;
  const rng = makeRng(seed);
  const kinds: E1Case["kind"][] = ["items", "rich", "trap"];
  const cases: E1Case[] = [];
  kinds.forEach((k, ki) => {
    for (let i = 0; i < (mix[ki] ?? 0); i++) cases.push(build(rng, bank, k, `${prefix}-${String(cases.length + 1).padStart(2, "0")}`));
  });
  return {
    meta: {
      split: bank.split,
      seed,
      n: cases.length,
      mix,
      bankFile: path.basename(bankFile),
      bankSha256: createHash("sha256").update(raw).digest("hex"),
      generator: "scripts/eval/e1_gen.ts",
      synthetic: true,
    },
    cases,
  };
}

const isMain = process.argv[1] && /e1_gen\.ts$/.test(process.argv[1]);
if (isMain) {
  const root = path.resolve(path.dirname(process.argv[1]), "..", "..");
  const bankFile = path.resolve(root, arg("bank"));
  const out = path.resolve(root, arg("out"));
  const mix = arg("mix", "5,6,4").split(",").map(Number);
  const seed = Number(arg("seed", "42"));
  const set = generate(bankFile, mix, seed, arg("prefix", "case"));
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(set, null, 1) + "\n", "utf8");
  console.log(`e1_gen: ${set.meta.split} n=${set.meta.n} mix=${mix.join("/")} bank=${set.meta.bankSha256.slice(0, 12)} -> ${path.relative(root, out)}`);
}
