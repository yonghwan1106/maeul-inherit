// S1 시설 중단 등록 (spec 8.3)
import { loadAllScenarios, loadRegion } from "@/lib/data";
import { SiteHeader } from "@/components/Logo";
import { TopBand } from "@/components/TopBand";
import { Footer } from "@/components/Footer";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "시설 중단 등록 — 이어받는 마을" };

export default function RegisterPage() {
  const { region, mock } = loadRegion();
  const scenarios = loadAllScenarios(region).map((s) => s.scenario);
  return (
    <>
      <TopBand />
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <RegisterForm region={region} scenarios={scenarios} mock={mock} />
      </main>
      <Footer />
    </>
  );
}
