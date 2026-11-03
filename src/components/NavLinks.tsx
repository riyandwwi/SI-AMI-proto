"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  const sp = useSearchParams();
  const currentTab = sp.get("tab");
  const currentView = sp.get("view");

  return (
    <nav className="flex flex-wrap items-center gap-1.5">
      {items.map((it) => {
        const [itemPath, itemQuery] = it.href.split("?");
        let active = false;

        if (itemQuery) {
          const params = new URLSearchParams(itemQuery);
          if (params.has("tab")) {
            active = path === itemPath && currentTab === params.get("tab");
          } else if (params.has("view")) {
            active = path === itemPath && currentView === params.get("view");
          } else {
            active = path === itemPath;
          }
        } else {
          const root = items.some((o) => o.href !== it.href && o.href.startsWith(it.href + "/"));
          const baseMatch = root ? path === itemPath : path === itemPath || path.startsWith(itemPath + "/");
          if (itemPath === "/lpm" && currentTab === "archive") {
            active = false;
          } else if (itemPath === "/auditor" && currentView === "archive") {
            active = false;
          } else {
            active = baseMatch;
          }
        }

        return (
          <Link
            key={it.href}
            href={it.href}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              active
                ? "bg-blue-600 text-white shadow-2xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
