// S2 생활기능 분해 (spec 8.4)
import { SCENARIO_PARAMS, scenarioPageData } from "@/lib/pageData";
import { StepFlow } from "@/components/StepFlow";
import { FunctionsScreen } from "./FunctionsScreen";

export const dynamicParams = false;
export function generateStaticParams() {
  return SCENARIO_PARAMS;
}

export const metadata = { title: "생활기능 분해 — 이어받는 마을" };

export default async function FunctionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = scenarioPageData(id);
  return (
    <>
      <StepFlow active={[1]} sid={id} />
      <FunctionsScreen sid={d.sid} loaded={d.scenario} temp={d.temp} mock={d.mock} />
    </>
  );
}
