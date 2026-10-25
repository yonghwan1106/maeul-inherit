// Footer notice (spec 8.1), shown on every screen: one line per item instead of a dotted string.
import { COPY } from "@/lib/copy";

export function Footer() {
  return (
    <footer className="mt-auto border-t-[3px] border-double border-rule bg-paper">
      <ul className="mx-auto m-0 flex w-full max-w-6xl list-none flex-col gap-0.5 px-4 py-5 text-[14px] leading-relaxed text-pencil-ink sm:flex-row sm:flex-wrap sm:gap-x-6">
        {COPY.footer.map((l, i) => (
          <li key={l} className={i === 0 ? "font-medium text-ink sm:w-full" : ""}>
            {l}
          </li>
        ))}
      </ul>
    </footer>
  );
}
