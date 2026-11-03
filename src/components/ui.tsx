import type { ReactNode } from "react";

export type SP = Promise<Record<string, string | string[] | undefined>>;

export function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (!ok && !err) return null;
  return (
    <div
      className={`rounded-xl border p-3.5 text-sm font-semibold shadow-2xs ${
        err
          ? "border-rose-200 bg-rose-50 text-rose-900"
          : "border-emerald-200 bg-emerald-50 text-emerald-900"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs shadow-2xs">
          {err ? "⚠️" : "✓"}
        </span>
        <span className="leading-snug">{err ?? ok}</span>
      </div>
    </div>
  );
}

export function PageHeader({ title, desc, children }: { title: string; desc?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3 pt-1">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {desc && <p className="mt-0.5 text-xs font-medium text-slate-500">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

const TONES = {
  slate: "bg-slate-100 text-slate-700 border border-slate-200",
  blue: "bg-sky-50 text-sky-800 border border-sky-200",
  green: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  amber: "bg-amber-50 text-amber-800 border border-amber-200",
  red: "bg-rose-50 text-rose-800 border border-rose-200",
  purple: "bg-violet-50 text-violet-800 border border-violet-200",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-normal ${TONES[tone]}`}
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
      className={`rounded-2xl border border-slate-200/90 p-4 shadow-xs ${color}`}
    >
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone ?? "text-slate-900"}`}>{value}</div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-medium text-slate-600">
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm">
        📂
      </div>
      {children}
    </div>
  );
}
