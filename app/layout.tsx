import type { Metadata } from "next";
import "./globals.css";

// A1 skeleton — bundle C (C1) owns and replaces this layout.
export const metadata: Metadata = {
  title: "이어받는 마을 — 가게가 닫혀도",
  description:
    "마을의 마지막 가게가 닫혀도 장보기·택배·배달이 끊기지 않도록, AI가 그 가게가 하던 일을 찾아 농협·우체국·마을회관에 나눠 맡기는 계획을 짭니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
