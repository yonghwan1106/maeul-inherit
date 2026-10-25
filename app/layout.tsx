import type { Metadata, Viewport } from "next";
import "./globals.css";
import { COPY } from "@/lib/copy";

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
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
