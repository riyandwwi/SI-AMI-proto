"use client";

import { useState } from "react";

export function PasswordCell({ plainPassword }: { plainPassword: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code
        className={`rounded-lg px-2 py-1 text-xs font-mono font-bold ${
          show
            ? "border-2 border-black bg-[#FEF08A] text-black shadow-[1.5px_1.5px_0px_#000000]"
            : "border-2 border-black/30 bg-slate-100 text-slate-500"
        }`}
      >
        {show ? plainPassword : "••••••••••"}
      </code>
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="rounded-lg border-2 border-black bg-white px-2.5 py-1 text-xs font-black shadow-[2px_2px_0px_#000000] transition-all hover:bg-[#FEF08A] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
      >
        {show ? "Sembunyikan" : "👁️ Lihat"}
      </button>
    </div>
  );
}
