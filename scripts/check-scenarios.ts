// Scenario build check (spec 9.1, bundle B4). `npm run check:scenarios` — must pass before a build; exit 1 on any failure.
//   - every resident pointId / demo cellKey / referenced resource id exists in the region
//   - the virtual store name does not overlap a 상가정보 business name (normalised, containment both ways)
//   - the store's village has 0 food stores
//   - every demoConfirmation is on a realNamed=false cell
//   - precomputed inputHash values equal hashes recomputed from the current inputs (decompose + every compose job)
//   - precomputed answers carry model and generatedAt
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ComposeResponse, DecomposeResponse } from "../lib/apiTypes";
import type { Region, Scenario } from "../lib/types";
import { inputHash } from "../lib/guard/cache";
import { parseDecomposeRequest } from "../lib/llm/decompose";
import { parseComposeRequest, sanitizeDigest } from "../lib/llm/compose";
import { buildState, stateRequests, type DocState } from "../lib/scenarioDocs";

const ROOT = path.resolve(path.dirname(process.argv[1]), "..");
const IDS = ["sc1_seungchi", "sc2_waryong", "sc3_ungok"];

const norm = (s: string) =>
  s.replace(/\(가상\)/g, "").replace(/\([^)]*\)/g, "").replace(/[\s·.,\-_/]/g, "").replace(/주식회사|\(주\)/g, "").toLowerCase();

function sbizNames(): string[] {
  const f = path.join(ROOT, "pipeline", "raw", "sbiz_202606_wanju_5myeon.csv");
  if (!existsSync(f)) return [];
  const lines = readFileSync(f, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const head = lines[0].split(",");
  const i = head.indexOf("상호명");
  return lines.slice(1).map((l) => l.split(",")[i] ?? "").filter(Boolean);
}

function main() {
  const region = JSON.parse(readFileSync(path.join(ROOT, "data", "region_hwasan.json"), "utf8")) as Region;
  const pointIds = new Set(region.points.map((p) => p.id));
  const resIds = new Set(region.resources.map((r) => r.id));
  const bizNames = [...new Set([...sbizNames(), ...region.resources.filter((r) => r.sbizNo).map((r) => r.name)])];
  const fails: string[] = [];
  const ok: string[] = [];

  for (const id of IDS) {
    const f = path.join(ROOT, "data", "scenarios", `${id}.json`);
    if (!existsSync(f)) { fails.push(`${id}: file missing`); continue; }
    const sc = JSON.parse(readFileSync(f, "utf8")) as Scenario;
    const F = (m: string) => fails.push(`${id}: ${m}`);
    if (sc.id !== id) F(`id mismatch (${sc.id})`);

    for (const r of sc.residents) if (!pointIds.has(r.pointId)) F(`resident ${r.id} pointId ${r.pointId} not in region`);
    const v = region.villages.find((x) => x.id === sc.store.villageId);
    if (!v) F(`store villageId ${sc.store.villageId} not in region`);
    else if (v.foodStores !== 0) F(`store village ${v.name} has ${v.foodStores} food stores (must be 0)`);

    const sn = norm(sc.store.name);
    const clash = bizNames.filter((b) => {
      const bn = norm(b);
      return bn.length >= 2 && (sn.includes(bn) || bn.includes(sn));
    });
    if (clash.length) F(`store name overlaps 상가정보 names: ${clash.slice(0, 5).join(", ")}`);

    // registry check via the engine (base cells)
    const st0 = buildState(region, sc, "base");
    for (const c of sc.demoConfirmations) {
      const def = st0.cells.registry.get(c.cellKey);
      if (!def) { F(`demo cellKey ${c.cellKey} not in registry`); continue; }
      if (def.realNamed) F(`demo cellKey ${c.cellKey} is realNamed (시연 입력값 not allowed)`);
      for (const part of c.cellKey.split(":").slice(1)) if (!resIds.has(part) && !pointIds.has(part) && !region.villages.some((x) => x.id === part) && !/^F\d\d$/.test(part)) F(`cellKey part ${part} unknown`);
    }

    // decomposition hash + metadata
    const p = parseDecomposeRequest({ sbizSub: sc.store.sbizSub, items: sc.store.items, hours: sc.store.hours, villageId: sc.store.villageId, memo: sc.store.memo });
    if (!p.ok) { F(`store input invalid: ${p.message}`); continue; }
    const dh = inputHash("decompose", p.req);
    const d = sc.precomputed?.decompose;
    const dr = d?.response as DecomposeResponse | null;
    if (!d || d.inputHash !== dh) F(`decompose inputHash stale (stored ${d?.inputHash?.slice(0, 10)} vs now ${dh.slice(0, 10)}) — run npm run precompute`);
    if (!dr || !dr.model || !dr.generatedAt) F("decompose response lacks model/generatedAt");
    else if (dr.mode !== "live") F(`decompose response mode ${dr.mode} (expected live)`);

    // compose jobs
    const stored = new Map((sc.precomputed?.compose ?? []).map((c) => [c.inputHash, c]));
    const want = new Set<string>();
    for (const state of ["base", "demo"] as DocState[]) {
      const st = state === "base" ? st0 : buildState(region, sc, state);
      for (const raw of stateRequests(region, sc, st)) {
        const parsed = parseComposeRequest(JSON.parse(JSON.stringify(raw)));
        if (!parsed.ok) { F(`compose request invalid: ${parsed.message}`); continue; }
        for (const it of parsed.req.digest.items) if (!resIds.has(it.resId)) F(`digest resId ${it.resId} not in region`);
        const h = inputHash("compose", { ...parsed.req, digest: sanitizeDigest(region, parsed.req) });
        want.add(h);
        const c = stored.get(h);
        const tag = `${state} ${parsed.req.docType}${parsed.req.agencyResId ? ":" + parsed.req.agencyResId : ":" + parsed.req.audience.pointId}`;
        if (!c) { F(`compose ${tag} not precomputed (hash ${h.slice(0, 10)}) — run npm run precompute`); continue; }
        const r = c.response as ComposeResponse;
        if (!r || !r.generatedAt || (r.mode === "live" && !r.model)) F(`compose ${tag} lacks model/generatedAt`);
        if (r && !r.grounding?.pass) F(`compose ${tag} grounding did not pass`);
      }
    }
    for (const h of stored.keys()) if (!want.has(h)) F(`compose entry ${h.slice(0, 10)} is stale (no current job)`);
    ok.push(`${id}: residents ${sc.residents.length}, demo ${sc.demoConfirmations.length}, compose ${want.size}/${stored.size}, decompose ${dr?.functions?.length ?? 0} pieces (${dr?.model ?? "-"})`);
  }

  for (const l of ok) console.log("  " + l);
  if (fails.length) {
    console.error(`check:scenarios FAILED (${fails.length})`);
    for (const f of fails) console.error("  " + f);
    process.exit(1);
  }
  console.log("check:scenarios OK");
}

main();
