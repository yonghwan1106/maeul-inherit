// Scenario screens S2~S4 share the header, the 가상 시나리오 note and the footer (spec 8.1).
import { TopBand } from "@/components/TopBand";
import { SiteHeader } from "@/components/Logo";
import { Footer } from "@/components/Footer";

export default function ScenarioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <TopBand />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-12">{children}</main>
      <Footer />
    </>
  );
}
