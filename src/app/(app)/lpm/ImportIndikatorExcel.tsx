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
    const contohPernyataanStandar1 =
      "UPPS memastikan setiap program studi memiliki capaian pembelajaran lulusan mencakup kompetensi yang meliputi (1) penguasaan ilmu pengetahuan dan teknologi, (2) kecakapan umum, (3) pengetahuan dan ketrampilan, dan (4) kemampuan intelektual";

    const templateData = [
      {
        NO: 1,
        STANDAR: "Standar Kompetensi Lulusan",
        PERNYATAAN_STANDAR: contohPernyataanStandar1,
        KODE: "IK1",
        PERNYATAAN:
          "Tersedia CPL PS yang mencakup kompetensi penguasaan ilmu pengetahuan, teknologi, serta kecakapan/keterampilan spesifik dan aplikasinya sesuai bidang ilmu yang dipelajarinya",
        DOKUMEN_BUKTI: "Dokumen Kurikulum Program Studi yang memuat CPL",
      },
      {
        NO: 2,
        STANDAR: "Standar Kompetensi Lulusan",
        PERNYATAAN_STANDAR: contohPernyataanStandar1,
        KODE: "IK2",
        PERNYATAAN:
          "Tersedia CPL PS yang mencakup kompetensi kecakapan umum sebagai dasar penguasaan IPTEK dan kesiapan kerja yang mencakup komunikasi, kolaborasi, literasi digital, serta etika profesional",
        DOKUMEN_BUKTI: "Dokumen Kurikulum Program Studi yang memuat CPL",
      },
      {
        NO: 3,
        STANDAR: "Standar Isi Pembelajaran",
        PERNYATAAN_STANDAR:
          "UPPS memastikan materi pembelajaran setiap program studi wajib memperhatikan perkembangan ilmu pengetahuan dan teknologi yang menjadi dasar keilmuan program studi.",
        KODE: "IK1",
        PERNYATAAN:
          "Tersedia dokumen kurikulum yang memuat materi pembelajaran sesuai perkembangan dasar keilmuan",
        DOKUMEN_BUKTI:
          "Dokumen Kurikulum PS yang memuat materi pembelajaran sesuai perkembangan keilmuan",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws["!cols"] = [
      { wch: 6 },
      { wch: 28 },
      { wch: 55 },
      { wch: 12 },
      { wch: 55 },
      { wch: 40 },
    ];
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
      if (!wb.SheetNames || wb.SheetNames.length === 0) {
        setParseError("File Excel kosong atau tidak memiliki sheet.");
        return;
      }

      const parsed: PreviewRow[] = [];

      // Iterasi seluruh sheet agar mendukung baik 1 sheet Template maupun banyak sheet Instrumen AMI (per Standar)
      for (const sheetName of wb.SheetNames) {
        const normSheet = normalizeHeader(sheetName);
        if (normSheet === "judul" || normSheet === "temuan" || normSheet === "ptk" || normSheet === "sheet1") {
          // Lewati sheet sampul/rekap jika menggunakan workbook Instrumen AMI multi-sheet
          if (wb.SheetNames.length > 1) continue;
        }

        const sheet = wb.Sheets[sheetName];
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          defval: "",
        });
        if (!matrix || matrix.length === 0) continue;

        let headerRowIndex = -1;
        let colKode = -1;
        let colStandar = -1;
        let colPernyataanStandar = -1;
        let colPernyataan = -1;
        let colBukti = -1;

        for (let r = 0; r < Math.min(matrix.length, 15); r++) {
          const row = matrix[r];
          if (!Array.isArray(row)) continue;

          let k = -1;
          let s = -1;
          let ps = -1;
          let p = -1;
          let b = -1;

          row.forEach((cell, idx) => {
            const norm = normalizeHeader(cell);
            if (!norm) return;
            if (
              k === -1 &&
              (norm === "kode" || norm === "kodeindikator" || norm === "nokode" || norm === "ik")
            ) {
              k = idx;
            } else if (
              ps === -1 &&
              (norm === "pernyataanstandar" ||
                norm === "isipernyataanstandar" ||
                norm === "deskripsistandar")
            ) {
              ps = idx;
            } else if (
              s === -1 &&
              (norm === "standar" || norm === "standarspmi" || norm === "namastandar")
            ) {
              s = idx;
            } else if (
              p === -1 &&
              (norm === "pernyataan" ||
                norm === "pernyataanindikator" ||
                norm === "indikatorkinerja" ||
                norm === "indikator" ||
                norm === "deskripsi")
            ) {
              p = idx;
            } else if (
              b === -1 &&
              (norm.includes("bukti") || norm === "dokumenbukti" || norm === "target")
            ) {
              b = idx;
            }
          });

          if (k !== -1 && p !== -1) {
            headerRowIndex = r;
            colKode = k;
            colStandar = s;
            colPernyataanStandar = ps;
            colPernyataan = p;
            colBukti = b;
            break;
          }
        }

        if (headerRowIndex === -1) continue;

        let lastStandar = colStandar === -1 ? sheetName.trim() : "";
        let lastPernyataanStandar = "";

        for (let r = headerRowIndex + 1; r < matrix.length; r++) {
          const row = matrix[r];
          if (!Array.isArray(row)) continue;

          const kode = String(row[colKode] ?? "")
            .trim()
            .toUpperCase()
            .replace(/\s+/g, "-");
          const rawStandar = colStandar !== -1 ? String(row[colStandar] ?? "").trim() : "";
          const rawPernyataanStandar =
            colPernyataanStandar !== -1 ? String(row[colPernyataanStandar] ?? "").trim() : "";
          const pernyataan = String(row[colPernyataan] ?? "").trim();
          const buktiDiminta = colBukti !== -1 ? String(row[colBukti] ?? "").trim() : "";

          if (!kode && !rawStandar && !pernyataan && !buktiDiminta) continue;
          if (pernyataan.toLowerCase() === "dst") continue;

          const standar = rawStandar || lastStandar;
          if (rawStandar) lastStandar = rawStandar;

          // Jika ganti standar baru dan pernyataan standar kosong, reset pernyataan standar
          const pernyataanStandar = rawPernyataanStandar || lastPernyataanStandar;
          if (rawPernyataanStandar) lastPernyataanStandar = rawPernyataanStandar;

          parsed.push({
            rowNum: r + 1,
            kode,
            standar,
            pernyataanStandar,
            pernyataan,
            buktiDiminta,
          });
        }
      }

      if (parsed.length === 0) {
        setParseError(
          "Tidak ditemukan baris indikator yang valid. Pastikan kolom di Excel memiliki: STANDAR, PERNYATAAN_STANDAR, KODE (atau IK), PERNYATAAN (atau Indikator Kinerja), dan DOKUMEN_BUKTI."
        );
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
    const key = `${r.standar.toUpperCase()}|||${r.kode.toUpperCase()}`;
    const isDuplicate =
      existingCodeSet.has(key) || existingCodeSet.has(r.kode.toUpperCase());
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
                  <th>No</th>
                  <th>Status</th>
                  <th>Standar</th>
                  <th>Isi Pernyataan Standar</th>
                  <th>Kode IK</th>
                  <th>Indikator Kinerja</th>
                  <th>Dokumen Bukti</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, idx) => {
                  const isMissingRequired = !row.kode || !row.standar || !row.pernyataan;
                  const key = `${row.standar.toUpperCase()}|||${row.kode.toUpperCase()}`;
                  const isDuplicate =
                    !isMissingRequired &&
                    (existingCodeSet.has(key) || existingCodeSet.has(row.kode.toUpperCase()));

                  return (
                    <tr key={idx}>
                      <td className="font-mono text-xs">{idx + 1}</td>
                      <td>
                        {isMissingRequired ? (
                          <Badge tone="red">🔴 Kosong (Skip)</Badge>
                        ) : isDuplicate ? (
                          mode === "SKIP_EXISTING" ? (
                            <Badge tone="amber">🟡 Sudah Ada (Skip)</Badge>
                          ) : (
                            <Badge tone="blue">🔄 Update</Badge>
                          )
                        ) : (
                          <Badge tone="green">🟢 Baru</Badge>
                        )}
                      </td>
                      <td className="text-xs font-bold">
                        {row.standar || <span className="text-red-600">(Kosong)</span>}
                      </td>
                      <td className="text-xs text-slate-700">
                        {row.pernyataanStandar || "—"}
                      </td>
                      <td className="font-mono text-xs font-black">
                        {row.kode || <span className="text-red-600">(Kosong)</span>}
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
