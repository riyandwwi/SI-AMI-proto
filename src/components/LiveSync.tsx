"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function LiveSync() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [justSynced, setJustSynced] = useState(false);

  const handleManualSync = () => {
    startTransition(() => {
      router.refresh();
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 2000);
    });
  };

  return (
    <button
      type="button"
      onClick={handleManualSync}
      disabled={isPending}
      title="Klik untuk memuat pembaruan terbaru dari anggota tim lain tanpa mengganggu ketikan Anda"
      className="inline-flex items-center gap-1.5 rounded-full border border-black/30 bg-[#D9F99D] px-2.5 py-0.5 text-[11px] font-black text-black hover:bg-[#BEF264] disabled:opacity-60"
    >
      <span
        className={`h-2 w-2 rounded-full bg-green-700 ${
          isPending ? "animate-ping" : ""
        }`}
      />
      {isPending ? "Memuat..." : justSynced ? "✓ Tersinkron" : "🔄 Sinkron"}
    </button>
  );
}
