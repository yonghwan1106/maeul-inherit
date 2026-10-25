// S4 주민별 대안·안내 (spec 8.6)
import { SCENARIO_PARAMS, scenarioPageData } from "@/lib/pageData";
import { loadResults } from "@/lib/data";
import { StepFlow } from "@/components/StepFlow";
import { ResidentsScreen, type E4Example } from "./ResidentsScreen";

export const dynamicParams = false;
export function generateStaticParams() {
  return SCENARIO_PARAMS;
}

export const metadata = { title: "주민별 대안·안내 — 이어받는 마을" };

function e4Examples(): E4Example[] {
  const r = loadResults();
  const e4 = (r?.e4 ?? null) as { examples?: unknown } | null;
  if (!e4 || !Array.isArray(e4.examples)) return [];
  return e4.examples
    .filter((x): x is { sentence: string; reason: string } => !!x && typeof (x as { sentence?: unknown }).sentence === "string")
    .slice(0, 3)
    .map((x) => ({ sentence: String(x.sentence), reason: String(x.reason ?? "") }));
}

export default async function ResidentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = scenarioPageData(id);
  return (
    <>
      <StepFlow active={[4, 5]} sid={id} />
      <ResidentsScreen sid={d.sid} region={d.region} loaded={d.scenario} temp={d.temp} mock={d.mock} examples={e4Examples()} />
    </>
  );
}
