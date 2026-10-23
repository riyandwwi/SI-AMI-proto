import type { ReactNode } from "react";

export type SP = Promise<Record<string, string | string[] | undefined>>;

export function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (!ok && !err) return null;
  return (
    <div
      className={`rounded-2xl border-2 border-black p-4 text-sm font-black shadow-[4px_4px_0px_#000000] ${
        err ? "bg-[#FECDD3] text-black" : "bg-[#D9F99D] text-black"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-black bg-white text-xs shadow-[1.5px_1.5px_0px_#000000]">
          {err ? "⚠️" : "✓"}
        </span>
        <span className="leading-snug">{err ?? ok}</span>
      </div>
    </div>
  );
}

export function PageHeader({ title, children }: { title: string; desc?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <h1 className="text-2xl font-black tracking-tight text-black sm:text-3xl">{title}</h1>
      {children}
    </div>
  );
}

const TONES = {
  slate: "bg-white/90 text-black border border-black/25",
  blue: "bg-[#BAE6FD] text-black border border-black/25",
  green: "bg-[#D9F99D] text-black border border-black/25",
  amber: "bg-[#FEF08A] text-black border border-black/25",
  red: "bg-[#FECDD3] text-black border border-black/25",
  purple: "bg-[#E9D5FF] text-black border border-black/25",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-0.5 text-xs font-black uppercase tracking-wide ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  tone,
  color = "bg-white",
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: string;
  color?: string;
}) {
  return (
    <div
      className={`rounded-2xl border-2 border-black p-5 shadow-[4px_4px_0px_#000000] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#000000] ${color}`}
    >
      <div className="text-xs font-black uppercase tracking-wider text-slate-700">{label}</div>
      <div className={`mt-1.5 text-3xl font-black ${tone ?? "text-black"}`}>{value}</div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-black bg-white/80 p-8 text-center text-sm font-bold text-slate-800 shadow-[4px_4px_0px_#000000]">
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full border-2 border-black bg-[#FEF08A] text-sm shadow-[2px_2px_0px_#000000]">
        📂
      </div>
      {children}
    </div>
  );
}
