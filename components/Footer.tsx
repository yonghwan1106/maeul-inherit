// Footer notice (spec 8.1), shown on every screen.
import { COPY } from "@/lib/copy";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-card">
      <p className="mx-auto w-full max-w-6xl px-4 py-5 text-[13px] leading-relaxed text-muted">{COPY.footer}</p>
    </footer>
  );
}
