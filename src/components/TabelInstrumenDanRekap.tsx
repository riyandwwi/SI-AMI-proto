"use client";

import { useState } from "react";
import type { Klasifikasi, StatusDokumen, StatusRtl } from "@prisma/client";
import {
  KLASIFIKASI_LABEL,
  RTL_LABEL,
  STATUS_DOK_LABEL,
  groupIndikatorByStandar,
} from "@/lib/periode";
import { Badge, Empty } from "@/components/ui";

export interface RekapTableRowItem {
  id: string;
  kode: string;
  standar: string;
  pernyataanStandar?: string | null;
  pernyataan: string;
  buktiDiminta?: string | null;
  isian?: {
    klaim?: string | null;
    linkDrive?: string | null;
    diisiOleh?: string | null;
    statusDokumen: StatusDokumen;
    catatanDokumen?: string | null;
    klasifikasi?: Klasifikasi | null;
    catatanLapangan?: string | null;
    rekomendasi?: string | null;
    diperiksaOleh?: string | null;
    terverifikasiAuditor?: boolean;
    rtlRencana?: string | null;
    rtlLinkBukti?: string | null;
    rtlStatus: StatusRtl;
    rtlCatatanAuditor?: string | null;
  } | null;
}

export function TabelInstrumenDanRekap({
  periodeId,
  periodeNama,
  indikator,
  defaultTab = "instrumen",
  hideHeaderButtons = false,
  headerRight,
}: {
  periodeId?: string;
  periodeNama?: string;
  indikator: RekapTableRowItem[];
  defaultTab?: "instrumen" | "rekap";
  hideHeaderButtons?: boolean;
  headerRight?: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<"instrumen" | "rekap">(defaultTab);
  const [filterStandar, setFilterStandar] = useState<string>("SEMUA");

  const standarGroups = groupIndikatorByStandar(indikator);
  const visibleGroups =
    filterStandar === "SEMUA"
      ? standarGroups
      : standarGroups.filter((g) => g.standar === filterStandar);

  const printUrl = `/api/rekap-excel?print=1${periodeId ? `&periodeId=${encodeURIComponent(periodeId)}` : ""}`;
  const excelUrl = `/api/rekap-excel${periodeId ? `?periodeId=${encodeURIComponent(periodeId)}` : ""}`;

  return (
    <div className="card space-y-3">
      {/* Header 2 Tab + Tombol Print & Download Excel (Disembunyikan jika hideHeaderButtons=true di halaman Indikator LPM) */}
      {!hideHeaderButtons ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/15 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("instrumen")}
              className={activeTab === "instrumen" ? "btn text-xs" : "btn-secondary text-xs"}
            >
              📑 1. Tabel Standar, Pernyataan Standar &amp; Indikator ({indikator.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("rekap")}
              className={activeTab === "rekap" ? "btn text-xs" : "btn-secondary text-xs"}
            >
              📊 2. Tabel Rekap Audit Sesi (Sebelum Print)
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={printUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-xs"
            >
              🖨️ Print Rekap
            </a>
            <a href={excelUrl} className="btn-success text-xs">
              📥 Download Excel
            </a>
          </div>
        </div>
      ) : (
        (periodeNama || headerRight) && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/15 pb-2.5">
            {periodeNama && (
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-black text-black">{periodeNama}</h3>
                <Badge tone="blue">{standarGroups.length} Standar</Badge>
                <Badge tone="purple">{indikator.length} Indikator</Badge>
              </div>
            )}
            {headerRight && <div className="flex flex-wrap items-center gap-2">{headerRight}</div>}
          </div>
        )
      )}

      {!hideHeaderButtons && periodeNama && (
        <div className="text-xs font-bold text-slate-700">
          Sesi: <strong className="text-black">{periodeNama}</strong>
        </div>
      )}

      {/* Filter Standar Top-Down (Dropdown 1 Baris Minimalis, siap untuk 18 Standar LLDIKTI) */}
      {standarGroups.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/20 bg-[#FAF7EE] px-3 py-2 text-xs">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <label className="shrink-0 font-black uppercase text-black">
              📂 Pilih Standar:
            </label>
            <select
              value={filterStandar}
              onChange={(e) => setFilterStandar(e.target.value)}
              className="min-w-[240px] max-w-full flex-1 rounded-xl border-2 border-black bg-white px-3 py-1.5 text-xs font-black text-black sm:max-w-md"
            >
              <option value="SEMUA">
                Semua Standar ({standarGroups.length} Standar — {indikator.length} Indikator)
              </option>
              {standarGroups.map((g, idx) => (
                <option key={g.standar} value={g.standar}>
                  {idx + 1}. {g.standar} (Indikator #{g.startIndex}–#{g.endIndex} • {g.items.length} Butir)
                </option>
              ))}
            </select>
            {filterStandar !== "SEMUA" && (
              <button
                type="button"
                onClick={() => setFilterStandar("SEMUA")}
                className="btn-secondary px-2.5 py-1 text-xs"
              >
                ✕ Semua
              </button>
            )}
          </div>
        </div>
      )}

      {indikator.length === 0 ? (
        <Empty>Belum ada Standar &amp; Indikator pada sesi ini.</Empty>
      ) : activeTab === "instrumen" ? (
        /* TAB 1: TABEL STANDAR, PERNYATAAN STANDAR & INDIKATOR */
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th className="w-12 text-center">No</th>
                <th className="w-48">Standar SPMI</th>
                <th className="w-80">Isi Pernyataan Standar</th>
                <th className="w-24">Kode (IK)</th>
                <th>Indikator Kinerja</th>
                <th className="w-56">Dokumen Bukti</th>
              </tr>
            </thead>
            <tbody>
              {visibleGroups.map((grp) => (
                <>
                  <tr key={`hdr-${grp.standar}`} className="bg-[#FEF08A]/80">
                    <td colSpan={6} className="font-black text-xs text-black">
                      📂 {grp.standar} — Indikator {grp.startIndex} s/d {grp.endIndex} ({grp.items.length} Indikator)
                    </td>
                  </tr>
                  {grp.items.map(({ item: ind, noUrut }, idx) => {
                    const prev = idx > 0 ? grp.items[idx - 1].item : null;
                    const samePernyataanStandar =
                      prev &&
                      (prev.pernyataanStandar || "") !== "" &&
                      (prev.pernyataanStandar || "") === (ind.pernyataanStandar || "");

                    return (
                      <tr key={ind.id}>
                        <td className="text-center font-mono text-sm font-black text-black">#{noUrut}</td>
                        <td className="text-sm font-black text-black">{ind.standar}</td>
                        <td className="text-sm font-semibold leading-relaxed text-black">
                          {samePernyataanStandar ? (
                            <span className="font-semibold text-black">
                              {ind.pernyataanStandar}
                            </span>
                          ) : (
                            ind.pernyataanStandar || <span>—</span>
                          )}
                        </td>
                        <td>
                          <code className="rounded bg-[#BAE6FD] px-2.5 py-0.5 text-xs font-black text-black">
                            {ind.kode}
                          </code>
                        </td>
                        <td className="text-sm font-semibold leading-relaxed text-black">{ind.pernyataan}</td>
                        <td className="text-sm font-semibold text-black">{ind.buktiDiminta || "—"}</td>
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* TAB 2: TABEL REKAP AUDIT SELAMA SESI (SEBELUM DI-PRINT) */
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th className="w-10 text-center">No</th>
                <th className="w-40">Standar</th>
                <th className="w-64">Isi Pernyataan Standar</th>
                <th className="w-20">Kode IK</th>
                <th className="w-64">Indikator Kinerja</th>
                <th className="w-44">Dokumen Bukti</th>
                <th className="w-56">Evaluasi Diri &amp; Bukti Auditee</th>
                <th className="w-52">Audit Dokumen Auditor</th>
                <th className="w-44">Klasifikasi &amp; Temuan Lapangan</th>
                <th className="w-44">Rekomendasi Auditor</th>
                <th className="w-48">Tindak Lanjut (RTL)</th>
              </tr>
            </thead>
            <tbody>
              {visibleGroups.map((grp) => (
                <>
                  <tr key={`rekap-hdr-${grp.standar}`} className="bg-[#FEF08A]/80">
                    <td colSpan={11} className="font-black text-xs text-black">
                      📂 {grp.standar} — Indikator {grp.startIndex} s/d {grp.endIndex} ({grp.items.length} Indikator)
                    </td>
                  </tr>
                  {grp.items.map(({ item: ind, noUrut }) => {
                    const isian = ind.isian;
                    return (
                      <tr key={ind.id}>
                        <td className="text-center font-mono text-sm font-black text-black">#{noUrut}</td>
                        <td className="text-sm font-black text-black">{ind.standar}</td>
                        <td className="text-sm font-semibold leading-relaxed text-black">{ind.pernyataanStandar || "—"}</td>
                        <td>
                          <code className="rounded bg-[#BAE6FD] px-2.5 py-0.5 text-xs font-black text-black">
                            {ind.kode}
                          </code>
                        </td>
                        <td className="text-sm font-semibold leading-relaxed text-black">{ind.pernyataan}</td>
                        <td className="text-sm font-semibold text-black">{ind.buktiDiminta || "—"}</td>
                        <td className="text-xs space-y-1">
                          <div>{isian?.klaim || <span className="text-slate-400">Belum diisi</span>}</div>
                          {isian?.linkDrive && (
                            <div>
                              <a
                                href={isian.linkDrive}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-bold text-blue-700 underline"
                              >
                                📂 Buka Bukti Drive ↗
                              </a>
                            </div>
                          )}
                          {isian?.diisiOleh && (
                            <div className="text-[11px] text-slate-500">Oleh: {isian.diisiOleh}</div>
                          )}
                        </td>
                        <td className="text-xs space-y-1">
                          <div>
                            <Badge
                              tone={
                                isian?.statusDokumen === "LENGKAP"
                                  ? "green"
                                  : isian?.statusDokumen === "PERLU_KLARIFIKASI"
                                    ? "amber"
                                    : "slate"
                              }
                            >
                              {isian ? STATUS_DOK_LABEL[isian.statusDokumen] : "Belum Diperiksa"}
                            </Badge>
                          </div>
                          {isian?.catatanDokumen && (
                            <div className="text-slate-700">{isian.catatanDokumen}</div>
                          )}
                        </td>
                        <td className="text-xs space-y-1">
                          {isian?.klasifikasi ? (
                            <Badge
                              tone={
                                isian.klasifikasi === "MELAMPAUI" || isian.klasifikasi === "MENCAPAI"
                                  ? "green"
                                  : isian.klasifikasi === "OBSERVASI"
                                    ? "amber"
                                    : "red"
                              }
                            >
                              {KLASIFIKASI_LABEL[isian.klasifikasi]}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                          {isian?.catatanLapangan && (
                            <div className="text-slate-700">{isian.catatanLapangan}</div>
                          )}
                        </td>
                        <td className="text-xs text-slate-700">
                          {isian?.rekomendasi || "—"}
                        </td>
                        <td className="text-xs space-y-1">
                          {isian?.rtlRencana ? (
                            <>
                              <div>{isian.rtlRencana}</div>
                              {isian.rtlLinkBukti && (
                                <a
                                  href={isian.rtlLinkBukti}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-bold text-blue-700 underline"
                                >
                                  📂 Bukti RTL ↗
                                </a>
                              )}
                              <div>
                                <Badge
                                  tone={isian.rtlStatus === "TERVERIFIKASI" ? "green" : "amber"}
                                >
                                  {RTL_LABEL[isian.rtlStatus]}
                                </Badge>
                              </div>
                            </>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
