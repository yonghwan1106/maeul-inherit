// Scenario screens S2~S4 share the band, header and footer (spec 8.1).
import { TopBand } from "@/components/TopBand";
import { SiteHeader } from "@/components/Logo";
import { Footer } from "@/components/Footer";

export default function ScenarioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBand />
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">{children}</main>
      <Footer />
    </>
  );
}
