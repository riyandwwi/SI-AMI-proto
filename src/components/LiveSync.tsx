"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function LiveSync() {
  const router = useRouter();
  const lastVersionRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    const checkVersion = async () => {
      if (!active) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      try {
        const res = await fetch("/api/sync-version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { v?: string };
        if (!data.v) return;

        if (lastVersionRef.current === null) {
          lastVersionRef.current = data.v;
          return;
        }

        if (lastVersionRef.current !== data.v) {
          lastVersionRef.current = data.v;
          router.refresh();
        }
      } catch {
        // Abaikan gangguan jaringan sementara
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 5000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        checkVersion();
      }
    };
    window.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, [router]);

  return (
    <span
      title="Sinkronisasi Real-Time Aktif"
      className="inline-flex items-center gap-1 rounded-full border border-black/25 bg-[#D9F99D] px-2.5 py-0.5 text-[11px] font-black text-black"
    >
      <span className="h-2 w-2 rounded-full bg-green-600 animate-pulse" />
      Live
    </span>
  );
}
