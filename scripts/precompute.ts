// Precompute scenario LLM outputs (spec 9.1, bundle B4). `npm run precompute` — real claude-haiku-5-5 calls.
// Per scenario: decompose 1 + 2 states (base, demo) x (3 resident notices + agency drafts for the top-3
// 「먼저 전화할 곳」 cells, agency de-duplicated) <= 12 compose calls. Entries whose inputHash is unchanged and
// whose stored answer is live are reused (use --force to regenerate). Writes data/scenarios/{id}.json.
// Options: --src <dir> (seed inputs from another folder), --force, --force-compose (documents only; keeps the frozen
// L1 decomposition), --only sc1_seungchi
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { ComposeResponse, DecomposeResponse } from "../lib/apiTypes";
import type { PrecomputedCompose, Region, Scenario } from "../lib/types";
import { inputHash } from "../lib/guard/cache";
import { hasKey } from "../lib/llm/client";
import { decomposeLive, parseDecomposeRequest } from "../lib/llm/decompose";
import { composeLive, parseComposeRequest, sanitizeDigest } from "../lib/llm/compose";
import { buildState, stateRequests, type DocState } from "../lib/scenarioDocs";

const ROOT = path.resolve(path.dirname(process.argv[1]), "..");
const SCENARIO_IDS = ["sc1_seungchi", "sc2_waryong", "sc3_ungok"] as const;

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

function decomposeReqOf(sc: Scenario) {
  const p = parseDecomposeRequest({ sbizSub: sc.store.sbizSub, items: sc.store.items, hours: sc.store.hours, villageId: sc.store.villageId, memo: sc.store.memo });
  if (!p.ok) throw new Error(`${sc.id}: bad store input — ${p.message}`);
  return p.req;
}

async function main() {
  if (!hasKey()) {
    console.error("precompute: ANTHROPIC_API_KEY not set — precompute needs real LLM calls");
    process.exit(1);
  }
  const region = JSON.parse(readFileSync(path.join(ROOT, "data", "region_hwasan.json"), "utf8")) as Region;
  const src = arg("src");
  const only = arg("only");
  const force = process.argv.includes("--force");
  const forceCompose = force || process.argv.includes("--force-compose");
  let calls = 0;
  for (const id of SCENARIO_IDS) {
    if (only && only !== id) continue;
    const dst = path.join(ROOT, "data", "scenarios", `${id}.json`);
    const from = src && existsSync(path.join(src, `${id}.json`)) ? path.join(src, `${id}.json`) : dst;
    const sc = JSON.parse(readFileSync(from, "utf8")) as Scenario;

    // 1) decomposition
    const dreq = decomposeReqOf(sc);
    const dhash = inputHash("decompose", dreq);
    const prevD = sc.precomputed?.decompose;
    const prevResp = prevD?.response as DecomposeResponse | null | undefined;
    if (force || !prevResp || prevD.inputHash !== dhash || prevResp.mode !== "live") {
      const r = await decomposeLive(dreq, dhash);
      calls += r.rawTexts.length;
      if (r.response.mode !== "live") throw new Error(`${id}: decompose fell back to rules (${r.response.validator.fallbackReason})`);
      sc.precomputed = { decompose: { inputHash: dhash, response: r.response }, compose: sc.precomputed?.compose ?? [] };
      console.log(`${id} decompose live ${r.response.model} -> ${r.response.functions.map((f) => f.code).join(" ")}`);
    } else {
      console.log(`${id} decompose reused (${prevResp.functions.map((f) => f.code).join(" ")})`);
    }

    // 2) documents per state
    const old = new Map((sc.precomputed.compose ?? []).map((c) => [c.inputHash, c]));
    const compose: PrecomputedCompose[] = [];
    for (const state of ["base", "demo"] as DocState[]) {
      const st = buildState(region, sc, state);
      for (const raw of stateRequests(region, sc, st)) {
        const parsed = parseComposeRequest(JSON.parse(JSON.stringify(raw)));
        if (!parsed.ok) throw new Error(`${id}: ${parsed.message}`);
        const req = parsed.req;
        const digest = sanitizeDigest(region, req);
        const h = inputHash("compose", { ...req, digest });
        const prev = old.get(h);
        let response: ComposeResponse;
        if (!forceCompose && prev && (prev.response as ComposeResponse)?.mode === "live") {
          response = prev.response as ComposeResponse;
        } else {
          const r = await composeLive(region, req, digest, h);
          calls += r.texts.length;
          response = r.response;
        }
        // same hash in both states (resident not touched by the demo value) is stored per state so screens can look up by state
        if (compose.some((c) => c.inputHash === h && c.state === state)) continue;
        compose.push({ state, docType: req.docType, agencyResId: req.agencyResId, audience: req.audience, inputHash: h, response });
        const tag = req.docType === "agency" ? `agency:${req.agencyResId}` : `resident:${req.audience.pointId}`;
        console.log(`${id} ${state} ${tag} ${response.mode} pass=${response.grounding.pass} attempts=${response.grounding.attempts}`);
      }
    }
    sc.precomputed.compose = compose;
    mkdirSync(path.dirname(dst), { recursive: true });
    writeFileSync(dst, JSON.stringify(sc, null, 1) + "\n", "utf8");
    console.log(`${id} -> ${path.relative(ROOT, dst)} (compose ${compose.length})`);
  }
  console.log(`precompute done, LLM generations ${calls}`);
}

main().catch((e) => {
  console.error("precompute failed:", (e as Error).message);
  process.exit(1);
});
