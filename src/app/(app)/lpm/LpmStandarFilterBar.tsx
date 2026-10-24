"use client";

import { useRouter } from "next/navigation";

export interface StandarGroupSummary {
  standar: string;
  startIndex: number;
  endIndex: number;
  count: number;
}

export function LpmStandarFilterBar({
  periodeId,
  standarFilter,
  totalIndikator,
  groups,
}: {
  periodeId: string;
  standarFilter: string;
  totalIndikator: number;
  groups: StandarGroupSummary[];
}) {
  const router = useRouter();

  const handleSelect = (val: string) => {
    const param = val === "ALL" ? "ALL" : encodeURIComponent(val);
    router.push(`/lpm?tab=pantau&periodeId=${periodeId}&standar=${param}`);
  };

  return (
    <div className="card flex flex-wrap items-center justify-between gap-2 py-3 text-xs">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <label htmlFor="lpm-filter-standar" className="shrink-0 font-black uppercase text-black">
          📂 Filter Standar SPMI:
        </label>
        <select
          id="lpm-filter-standar"
          value={standarFilter}
          onChange={(e) => handleSelect(e.target.value)}
          className="min-w-[240px] max-w-full flex-1 rounded-xl border-2 border-black bg-white px-3 py-1.5 text-xs font-black text-black sm:max-w-md"
        >
          <option value="ALL">
            Semua Standar ({groups.length} Standar — {totalIndikator} Indikator)
          </option>
          {groups.map((g, idx) => (
            <option key={g.standar} value={g.standar}>
              {idx + 1}. {g.standar} (Indikator #{g.startIndex}–#{g.endIndex} • {g.count} Butir)
            </option>
          ))}
        </select>
        {standarFilter !== "ALL" && (
          <button
            type="button"
            onClick={() => handleSelect("ALL")}
            className="btn-secondary px-2.5 py-1 text-xs"
          >
            ✕ Semua
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/api/rekap-excel?periodeId=${encodeURIComponent(periodeId)}&print=1`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary px-3 py-1 text-xs"
        >
          🖨️ Print Rekap
        </a>
        <a
          href={`/api/rekap-excel?periodeId=${encodeURIComponent(periodeId)}`}
          className="btn-success px-3 py-1 text-xs"
        >
          📥 Download Excel
        </a>
      </div>
    </div>
  );
}
