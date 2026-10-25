import type { Metadata, Viewport } from "next";
import { Do_Hyeon, IBM_Plex_Sans_KR } from "next/font/google";
import "./globals.css";
import { COPY } from "@/lib/copy";

// 간판 글씨(도현체) — names and titles only. Google lists no Korean subset for next/font, so the Korean
// unicode-range files are self-hosted by next/font and loaded on use; preloading only the latin file of a
// title face would not help, so it is off.
const dohyeon = Do_Hyeon({ weight: "400", subsets: ["latin"], display: "swap", preload: false, variable: "--font-dohyeon" });
// 본문(IBM Plex Sans KR) 400 · 500 · 600. Latin file (digits, punctuation) is preloaded; Hangul slices load on use.
const plex = IBM_Plex_Sans_KR({ weight: ["400", "500", "600"], subsets: ["latin"], display: "swap", preload: true, variable: "--font-plex" });

export const metadata: Metadata = {
  title: COPY.logo,
  description: COPY.oneLiner,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`h-full antialiased ${dohyeon.variable} ${plex.variable}`}>
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
