// S3 이어받기 계획 (spec 8.5) — the core screen.
import { SCENARIO_PARAMS, scenarioPageData } from "@/lib/pageData";
import { StepFlow } from "@/components/StepFlow";
import { PlanScreen } from "./PlanScreen";

export const dynamicParams = false;
export function generateStaticParams() {
  return SCENARIO_PARAMS;
}

export const metadata = { title: "이어받기 계획 — 이어받는 마을" };

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = scenarioPageData(id);
  return (
    <>
      <StepFlow active={[2, 3]} sid={id} />
      <PlanScreen sid={d.sid} region={d.region} loaded={d.scenario} temp={d.temp} mock={d.mock} />
    </>
  );
}
