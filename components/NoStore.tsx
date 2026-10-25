// Shown on S2~S4 when no store is registered (custom scenario cleared).
import Link from "next/link";
import { COPY } from "@/lib/copy";

export function NoStore() {
  return (
    <div className="border-t-2 border-ink pt-4">
      <p className="m-0 text-[17px]">등록된 가게가 없어요.</p>
      <Link href="/register" className="mt-3 inline-flex min-h-11 items-center font-semibold text-slate underline underline-offset-4">
        {COPY.s0.register}
      </Link>
    </div>
  );
}
