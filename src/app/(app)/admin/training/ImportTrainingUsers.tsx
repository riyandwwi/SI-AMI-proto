"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui";
import { importAkunTrainingBatch, type BulkTrainingUserRow } from "./actions";

export function ImportTrainingUsers() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [preview, setPreview] = useState<BulkTrainingUserRow[]>([]);
  const [notice, setNotice] = useState<{ ok?: string; err?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDownloadTemplate = () => {
    const sample = Array.from({ length: 25 }, (_, idx) => ({
      No: idx + 1,
      "Nama Lengkap": `Peserta Pelatihan ${idx + 1}`,
      "NIDN / NUPTK": `TRN-${String(idx + 1).padStart(3, "0")}`,
      Username: `peserta${idx + 1}`,
    }));
    const ws = XLSX.utils.json_to_sheet(sample);
    ws["!cols"] = [{ wch: 6 }, { wch: 30 }, { wch: 18 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Akun Training");
    XLSX.writeFile(wb, "Template_25_Akun_Training_AMI.xlsx");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setNotice(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const rows: BulkTrainingUserRow[] = [];

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        if (!ws) continue;
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        for (const r of json) {
          const keys = Object.keys(r);
          const findVal = (patterns: string[]) => {
            const k = keys.find((key) =>
              patterns.some((p) => key.toLowerCase().includes(p))
            );
            return k ? String(r[k] ?? "").trim() : "";
          };
          const nama = findVal(["nama", "name", "peserta"]);
          const nimNuptk = findVal(["nidn", "nuptk", "nip", "nim"]);
          const username = findVal(["user", "akun", "login"]);
          if (nama) {
            rows.push({ nama, nimNuptk, username });
          }
        }
      }

      if (rows.length === 0) {
        setNotice({
          err: "Tidak ditemukan kolom Nama Lengkap pada file Excel. Gunakan Template yang disediakan.",
        });
        return;
      }
      setPreview(rows);
    } catch {
      setNotice({ err: "Gagal membaca file Excel." });
    }
  };

  const handleParsePaste = () => {
    setNotice(null);
    const lines = pasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setNotice({ err: "Kotak teks masih kosong." });
      return;
    }

    const parsed: BulkTrainingUserRow[] = lines.map((line, idx) => {
      const parts = line.split(/\t|;|,/).map((p) => p.trim());
      const nama = parts[0] || `Peserta ${idx + 1}`;
      const username = parts[1]
        ? parts[1].toLowerCase().replace(/[^a-z0-9._-]/g, "")
        : `peserta${idx + 1}`;
      const nimNuptk = parts[2] || `TRN-${String(idx + 1).padStart(3, "0")}`;
      return { nama, username, nimNuptk };
    });

    setPreview(parsed);
  };

  const handleConfirmImport = () => {
    if (preview.length === 0) return;
    setNotice(null);
    startTransition(async () => {
      const res = await importAkunTrainingBatch(preview);
      if (!res.ok) {
        setNotice({ err: res.error ?? "Gagal mengimport akun training." });
        return;
      }
      setNotice({ ok: res.message ?? "Berhasil mengimport akun training." });
      setPreview([]);
      setPasteText("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  };

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/15 pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-black text-black">
            📊 Import / Copy-Paste Akun Peserta Training (Bulk)
          </h2>
          <Badge tone="amber">🔑 Password Otomatis: 123</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="btn-secondary text-xs"
          >
            📥 Download Template 25 Akun (.xlsx)
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="max-w-xs text-xs file:mr-2 file:cursor-pointer file:rounded-lg file:border file:border-black file:bg-[#FEF08A] file:px-3 file:py-1 file:text-xs file:font-black hover:file:bg-[#fde047]"
          />
        </div>
      </div>

      {notice?.err && (
        <div className="rounded-xl border-2 border-black bg-[#FECDD3] px-3 py-2 text-xs font-black text-black">
          ⚠️ {notice.err}
        </div>
      )}
      {notice?.ok && (
        <div className="rounded-xl border-2 border-black bg-[#D9F99D] px-3 py-2 text-xs font-black text-black">
          ✓ {notice.ok}
        </div>
      )}

      {/* Opsi Copy-Paste Cepat Daftar Nama (Misal 25 Nama dari WA / Excel) */}
      <details className="rounded-xl border border-black/20 bg-[#FAF7EE] p-3 text-xs">
        <summary className="cursor-pointer font-black text-black">
          📋 Atau Klik di Sini untuk Copy-Paste Daftar Nama Peserta (1 Baris = 1 Peserta)
        </summary>
        <div className="mt-2.5 space-y-2">
          <textarea
            rows={4}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"Contoh (cukup ketik/paste nama per baris):\nBudi Santoso\nSiti Aminah\nAndi Wijaya"}
            className="w-full text-xs"
          />
          <button type="button" onClick={handleParsePaste} className="btn text-xs">
            🔍 Baca Daftar Nama
          </button>
        </div>
      </details>

      {preview.length > 0 && (
        <div className="space-y-2.5 rounded-xl border-2 border-black bg-[#FAF7EE] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-black text-black">
              📋 Pratinjau {preview.length} Akun Training Siap Dibuat:
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPreview([])}
                className="btn-secondary text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmImport}
                className="btn-success text-xs"
              >
                {isPending ? "Membuat Akun..." : `✅ Buat ${preview.length} Akun Training Sekarang`}
              </button>
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto">
            <table>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nama Lengkap</th>
                  <th>Username</th>
                  <th>NIDN / NUPTK</th>
                  <th>Password</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i}>
                    <td className="font-mono text-xs">{i + 1}</td>
                    <td className="text-xs font-bold">{r.nama}</td>
                    <td className="font-mono text-xs font-black">
                      {r.username || `peserta${i + 1}`}
                    </td>
                    <td className="font-mono text-xs">{r.nimNuptk || `TRN-00${i + 1}`}</td>
                    <td className="font-mono text-xs font-bold">123</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
