"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui";
import { importBatchIndikatorExcel, type ExcelIndikatorRowInput } from "./actions";

export interface PeriodeWithCodes {
  id: string;
  nama: string;
  existingCodes: string[];
}

interface PreviewRow extends ExcelIndikatorRowInput {
  rowNum: number;
}

function normalizeHeader(h: unknown): string {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function ImportIndikatorExcel({
  periodes,
  defaultPeriodeId = "ALL",
}: {
  periodes: PeriodeWithCodes[];
  defaultPeriodeId?: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedPeriodeId, setSelectedPeriodeId] = useState<string>(defaultPeriodeId);
  const [mode, setMode] = useState<"SKIP_EXISTING" | "UPDATE_EXISTING">("SKIP_EXISTING");
  const [fileName, setFileName] = useState<string>("");
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Kumpulan kode indikator yang sudah ada di sesi terpilih
  const existingCodeSet = new Set<string>();
  for (const p of periodes) {
    if (selectedPeriodeId === "ALL" || p.id === selectedPeriodeId) {
      for (const c of p.existingCodes) {
        existingCodeSet.add(c.toUpperCase());
      }
    }
  }

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        STANDAR: "Standar Isi Pembelajaran",
        KODE: "STD-ISI-01",
        PERNYATAAN:
          "Ketersediaan dokumen Kurikulum Berbasis OBE dan pemetaan CPL pada seluruh mata kuliah.",
        DOKUMEN_BUKTI: "SK Kurikulum OBE, Dokumen Pemetaan CPL",
      },
      {
        STANDAR: "Standar Isi Pembelajaran",
        KODE: "STD-ISI-02",
        PERNYATAAN:
          "Ketersediaan RPS lengkap untuk seluruh mata kuliah aktif pada semester berjalan.",
        DOKUMEN_BUKTI: "Folder RPS Mata Kuliah Semester Berjalan",
      },
      {
        STANDAR: "Standar Proses Pembelajaran",
        KODE: "STD-PROSES-01",
        PERNYATAAN:
          "Pelaksanaan perkuliahan minimal 14-16 pertemuan per semester disertai berita acara dan presensi.",
        DOKUMEN_BUKTI: "Rekap Presensi Dosen & Mahasiswa, Jurnal Perkuliahan",
      },
      {
        STANDAR: "Standar Proses Pembelajaran",
        KODE: "STD-PROSES-02",
        PERNYATAAN:
          "Pelaksanaan monitoring dan evaluasi (monev) proses pembelajaran tengah dan akhir semester.",
        DOKUMEN_BUKTI: "Laporan Monev Pembelajaran",
      },
      {
        STANDAR: "Standar Penilaian Pembelajaran",
        KODE: "STD-NILAI-01",
        PERNYATAAN:
          "Ketersediaan rubrik penilaian dan transparansi nilai akhir mahasiswa pada seluruh mata kuliah.",
        DOKUMEN_BUKTI: "Rubrik Penilaian, Rekap Nilai SIAKAD",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws["!cols"] = [{ wch: 32 }, { wch: 18 }, { wch: 65 }, { wch: 45 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Indikator_AMI");
    XLSX.writeFile(wb, "Template_Indikator_AMI_ITBMP.xlsx");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setParseError(null);
    setSuccessMsg(null);
    setPreviewRows([]);

    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const firstSheetName = wb.SheetNames[0];
      if (!firstSheetName) {
        setParseError("File Excel kosong atau tidak memiliki sheet.");
        return;
      }

      const sheet = wb.Sheets[firstSheetName];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: "",
      });

      if (!matrix || matrix.length === 0) {
        setParseError("File Excel tidak memiliki baris data.");
        return;
      }

      // Cari baris header pada 10 baris pertama agar aman jika ada judul di baris 1
      let headerRowIndex = -1;
      let colKode = -1;
      let colStandar = -1;
      let colPernyataan = -1;
      let colBukti = -1;

      for (let r = 0; r < Math.min(matrix.length, 10); r++) {
        const row = matrix[r];
        if (!Array.isArray(row)) continue;

        let k = -1;
        let s = -1;
        let p = -1;
        let b = -1;

        row.forEach((cell, idx) => {
          const norm = normalizeHeader(cell);
          if (!norm) return;
          if (k === -1 && (norm === "kode" || norm === "kodeindikator" || norm === "nokode")) {
            k = idx;
          } else if (
            s === -1 &&
            (norm === "standar" || norm === "standarspmi" || norm === "namastandar")
          ) {
            s = idx;
          } else if (
            p === -1 &&
            (norm === "pernyataan" ||
              norm === "pernyataanindikator" ||
              norm === "indikator" ||
              norm === "deskripsi")
          ) {
            p = idx;
          } else if (
            b === -1 &&
            (norm.includes("bukti") || norm.includes("dokumen") || norm === "target")
          ) {
            b = idx;
          }
        });

        if (k !== -1 || s !== -1 || p !== -1) {
          headerRowIndex = r;
          colKode = k;
          colStandar = s;
          colPernyataan = p;
          colBukti = b;
          break;
        }
      }

      if (headerRowIndex === -1) {
        setParseError(
          "Header kolom tidak dikenali! Pastikan baris judul di Excel memiliki kolom: KODE, STANDAR, PERNYATAAN, dan DOKUMEN_BUKTI (gunakan tombol Download Template)."
        );
        return;
      }

      const missingCols: string[] = [];
      if (colKode === -1) missingCols.push("KODE");
      if (colStandar === -1) missingCols.push("STANDAR");
      if (colPernyataan === -1) missingCols.push("PERNYATAAN");

      if (missingCols.length > 0) {
        setParseError(
          `Kolom wajib tidak ditemukan di Excel: ${missingCols.join(", ")}. Import dibatalkan agar data antar kolom tidak bergeser / tumpang tindih.`
        );
        return;
      }

      const parsed: PreviewRow[] = [];
      let lastStandar = "";
      for (let r = headerRowIndex + 1; r < matrix.length; r++) {
        const row = matrix[r];
        if (!Array.isArray(row)) continue;

        const kode = String(row[colKode] ?? "")
          .trim()
          .toUpperCase()
          .replace(/\s+/g, "-");
        const rawStandar = String(row[colStandar] ?? "").trim();
        const pernyataan = String(row[colPernyataan] ?? "").trim();
        const buktiDiminta = colBukti !== -1 ? String(row[colBukti] ?? "").trim() : "";

        // Lewati baris yang benar-benar kosong seluruhnya
        if (!kode && !rawStandar && !pernyataan && !buktiDiminta) continue;

        // Jika kolom STANDAR di-merge ke bawah di Excel (kosong pada baris lanjutan), otomatis warisi Standar di atasnya!
        const standar = rawStandar || lastStandar;
        if (rawStandar) lastStandar = rawStandar;

        parsed.push({
          rowNum: r + 1,
          kode,
          standar,
          pernyataan,
          buktiDiminta,
        });
      }

      if (parsed.length === 0) {
        setParseError("Tidak ada baris indikator yang terisi di bawah baris judul.");
        return;
      }

      setPreviewRows(parsed);
    } catch {
      setParseError("Gagal membaca file Excel. Pastikan format file adalah .xlsx, .xls, atau .csv.");
    }
  };

  const validRowsToImport = previewRows.filter((r) => {
    const isComplete = Boolean(r.kode && r.standar && r.pernyataan);
    if (!isComplete) return false;
    const isDuplicate = existingCodeSet.has(r.kode.toUpperCase());
    if (isDuplicate && mode === "SKIP_EXISTING") return false;
    return true;
  });

  const handleConfirmImport = () => {
    if (validRowsToImport.length === 0) {
      setParseError("Tidak ada baris indikator baru untuk diimport.");
      return;
    }

    setParseError(null);
    startTransition(async () => {
      const res = await importBatchIndikatorExcel(selectedPeriodeId, previewRows, mode);
      if (!res.ok) {
        setParseError(res.error ?? "Gagal mengimport indikator.");
        return;
      }

      setSuccessMsg(res.message ?? "Berhasil mengimport indikator.");
      setPreviewRows([]);
      setFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    });
  };

  const handleReset = () => {
    setPreviewRows([]);
    setParseError(null);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/15 pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-black text-black">📊 Import Indikator dari Excel</h2>
          <Badge tone="green">🔒 Aman untuk Indikator Manual</Badge>
        </div>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="btn-secondary text-xs"
        >
          📥 Download Template Excel (.xlsx)
        </button>
      </div>

      {parseError && (
        <div className="rounded-2xl border-2 border-black bg-[#FECDD3] px-4 py-3 text-xs font-black text-black">
          ⚠️ {parseError}
        </div>
      )}

      {successMsg && (
        <div className="rounded-2xl border-2 border-black bg-[#D9F99D] px-4 py-3 text-xs font-black text-black">
          ✓ {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label>Target Sesi AMI</label>
          <select
            value={selectedPeriodeId}
            onChange={(e) => setSelectedPeriodeId(e.target.value)}
            className="w-full text-xs"
          >
            <option value="ALL">Semua Sesi AMI</option>
            {periodes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label>Mode Perlindungan Indikator Manual</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "SKIP_EXISTING" | "UPDATE_EXISTING")}
            className="w-full text-xs font-bold"
          >
            <option value="SKIP_EXISTING">
              🔒 Aman: Lewati Kode yang Sudah Ada (Indikator Manual Tidak Diubah)
            </option>
            <option value="UPDATE_EXISTING">
              🔄 Update: Perbarui Standar/Pernyataan jika Kode Sama
            </option>
          </select>
        </div>

        <div className="space-y-1">
          <label>Pilih File Excel (.xlsx / .xls / .csv)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="w-full text-xs file:mr-2 file:rounded-lg file:border file:border-black file:bg-[#FEF08A] file:px-2.5 file:py-1 file:text-xs file:font-black"
          />
        </div>
      </div>

      {/* Tabel Pratinjau (Preview) Sebelum Masuk Database */}
      {previewRows.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-black/20 bg-[#FAF7EE] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-black text-black">
              📋 Pratinjau File: <span className="font-mono">{fileName}</span> ({previewRows.length} baris terbaca)
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={handleReset}
                className="btn-secondary text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isPending || validRowsToImport.length === 0}
                onClick={handleConfirmImport}
                className="btn-success text-xs"
              >
                {isPending
                  ? "Mengimport..."
                  : `✅ Konfirmasi Import (${validRowsToImport.length} Indikator)`}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Baris</th>
                  <th>Status Validasi</th>
                  <th>Kode</th>
                  <th>Standar</th>
                  <th>Pernyataan Indikator</th>
                  <th>Dokumen Bukti</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, idx) => {
                  const isMissingRequired = !row.kode || !row.standar || !row.pernyataan;
                  const isDuplicate =
                    !isMissingRequired && existingCodeSet.has(row.kode.toUpperCase());

                  return (
                    <tr key={idx}>
                      <td className="font-mono text-xs">{row.rowNum}</td>
                      <td>
                        {isMissingRequired ? (
                          <Badge tone="red">🔴 Kolom Kosong (Di-skip)</Badge>
                        ) : isDuplicate ? (
                          mode === "SKIP_EXISTING" ? (
                            <Badge tone="amber">🟡 Sudah Ada (Aman Di-skip)</Badge>
                          ) : (
                            <Badge tone="blue">🔄 Sudah Ada (Akan Diupdate)</Badge>
                          )
                        ) : (
                          <Badge tone="green">🟢 Baru (Siap Masuk)</Badge>
                        )}
                      </td>
                      <td className="font-mono text-xs font-black">
                        {row.kode || <span className="text-red-600">(Kosong)</span>}
                      </td>
                      <td className="text-xs font-bold">
                        {row.standar || <span className="text-red-600">(Kosong)</span>}
                      </td>
                      <td className="text-xs">
                        {row.pernyataan || <span className="text-red-600">(Kosong)</span>}
                      </td>
                      <td className="text-xs">{row.buktiDiminta || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
