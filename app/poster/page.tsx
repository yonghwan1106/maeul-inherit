// /poster — representative image (spec 8.9), 1200 x 675, noindex. Server component.
// Every number comes from the engine (lib/compute -> lib/engine): SC1, 김순자, after the scenario's demo confirmation.
import type { Metadata } from "next";
import type { FnCode, Tri } from "@/lib/types";
import { COPY } from "@/lib/copy";
import { loadRegion, loadScenario } from "@/lib/data";
import { residentView } from "@/lib/compute";
import { makeCells } from "@/lib/engine";
import { applyFnEdits, parseDecompose, pointName } from "@/lib/view";
import { FnIcon } from "@/components/FnIcons";

export const metadata: Metadata = {
  title: `${COPY.serviceName} — 대표 이미지`,
  robots: { index: false, follow: false },
};

const SHUTTER_FNS: FnCode[] = ["F01", "F06", "F07", "F09"];
const TRI_CLASS: Record<Tri, string> = { Y: "tri-y", U: "tri-u", N: "tri-n" };

export default function Poster() {
  const { region } = loadRegion();
  const sc = loadScenario("sc1_seungchi", region)?.scenario ?? null;
  const kim = sc?.residents.find((r) => r.name === "김순자") ?? sc?.residents[0] ?? null;
  const fns = sc ? applyFnEdits(parseDecompose(sc.precomputed.decompose.response).functions, []) : [];
  const cells = sc ? makeCells(region, fns, sc.demoConfirmations) : null;
  const view = sc && kim && cells ? residentView(region, cells, kim, fns) : null;
  const who = kim ? `${kim.name} 어르신 · ${kim.age}세 · ${COPY.modeResident[kim.mode]} · ${pointName(region, kim.pointId)}` : "";

  return (
    <div
      data-poster="1"
      className="relative overflow-hidden bg-paper text-ink"
      style={{ width: 1200, height: 675, padding: "30px 36px 0" }}
    >
      <h1 className="m-0 font-extrabold tracking-tight" style={{ fontSize: 72, lineHeight: 1.05 }}>
        {COPY.logo}
      </h1>

      <div className="mt-5 grid gap-5" style={{ gridTemplateColumns: "360px 1fr", height: 300 }}>
        {/* left 1/3: shutter (CSS) + grey icons */}
        <div className="flex flex-col rounded-2xl border border-line bg-card p-4">
          <div className="rounded-t-lg bg-band px-3 py-2 text-center text-[20px] font-bold text-white">
            {sc?.store.name ?? ""}
          </div>
          <div
            aria-hidden="true"
            className="flex-1 rounded-b-lg border-2 border-t-0 border-line"
            style={{ background: "repeating-linear-gradient(180deg, #c9c4b8 0 12px, #b4ae9f 12px 15px)" }}
          />
          <div className="mt-3 grid grid-cols-4 gap-2">
            {SHUTTER_FNS.map((c) => (
              <div key={c} className="flex flex-col items-center text-gone">
                <FnIcon code={c} size={34} />
                <span className="text-[15px] font-semibold">{COPY.fnName[c]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* right 2/3: two resident cards */}
        {view ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: "300px 1fr" }}>
            <section className="flex flex-col rounded-2xl border border-line bg-card p-4" data-poster-card="b1">
              <h2 className="m-0 text-[22px] font-bold leading-snug">{COPY.poster.left}</h2>
              <p className="mt-1 mb-0 text-[14px] text-muted">{who}</p>
              <p className="num mt-auto mb-0 text-[40px] font-extrabold leading-none text-gone">
                {COPY.tri.Y} {view.b1.countY}
              </p>
              {!view.b1.walkable && view.mode !== "car" ? (
                <p className="mt-2 mb-0 text-[22px] font-bold text-warn">{COPY.s3.mini.notWalkable.replace(/^—\s*/, "")}</p>
              ) : null}
              <p className="mt-2 mb-0 text-[14px] text-muted">{COPY.s3.mini.b1(view.b1.distKm.toFixed(1), view.b1.countY)}</p>
            </section>

            <section className="flex flex-col rounded-2xl border-2 border-brand bg-card p-4" data-poster-card="engine">
              <h2 className="m-0 text-[22px] font-bold leading-snug text-brand">{COPY.poster.right}</h2>
              <p className="mt-1 mb-0 text-[14px] text-muted">{who}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {view.rows.map((r) => (
                  <div key={r.code} className={`flex flex-col items-center rounded-lg px-1 py-2 ${TRI_CLASS[r.tri]}`} data-tri={r.tri}>
                    <FnIcon code={r.code} size={26} />
                    <span className="text-[15px] font-semibold leading-tight">{COPY.fnName[r.code]}</span>
                    <span className="text-[13px] leading-tight">
                      {r.tri === "Y" ? "● " : r.tri === "U" ? "◐ " : "— "}
                      {COPY.triResident[r.tri]}
                    </span>
                  </div>
                ))}
              </div>
              <p className="num mt-auto mb-0 text-[22px] font-extrabold">
                {COPY.triResident.Y} {view.countY} · {COPY.triResident.U} {view.countU} · {COPY.triResident.N} {view.countN}
              </p>
            </section>
          </div>
        ) : (
          <div />
        )}
      </div>

      <p className="mt-5 mb-0 font-semibold" style={{ fontSize: 36, lineHeight: 1.3, letterSpacing: "-0.02em" }}>
        {COPY.oneLiner}
      </p>

      <p className="absolute m-0 text-[15px] text-muted" style={{ right: 36, bottom: 14 }}>
        {COPY.poster.foot}
      </p>
    </div>
  );
}
