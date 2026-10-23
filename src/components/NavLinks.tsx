"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="flex flex-wrap gap-2 pt-1">
      {items.map((it) => {
        const root = items.some((o) => o.href !== it.href && o.href.startsWith(it.href + "/"));
        const active = root ? path === it.href : path === it.href || path.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`rounded-xl border-2 border-black px-3.5 py-1.5 text-xs font-black transition-all ${
              active
                ? "bg-[#FEF08A] text-black shadow-[3px_3px_0px_#000000] -translate-x-0.5 -translate-y-0.5"
                : "bg-white text-black shadow-[2px_2px_0px_#000000] hover:bg-[#FAF7EE] hover:shadow-[3.5px_3.5px_0px_#000000]"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
