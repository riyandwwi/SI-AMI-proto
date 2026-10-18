"use client";

import { useState } from "react";

export function PasswordCell({ plainPassword }: { plainPassword: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className={`rounded px-2 py-0.5 text-xs font-semibold ${show ? "bg-amber-50 text-amber-900 border border-amber-200" : "text-slate-400"}`}>
        {show ? plainPassword : "••••••••••"}
      </code>
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
      >
        {show ? "Sembunyikan" : "👁️ Lihat"}
      </button>
    </div>
  );
}
