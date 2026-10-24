"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui";
import { tambahIndikator } from "./actions";

export interface ExistingStandarInfo {
  standar: string;
  pernyataanStandarList: string[];
  nextIkNumber: number;
}

export function FormStandarBertahap({
  returnTo,
  periodes,
  defaultPeriodeId = "ALL",
  existingStandarList,
}: {
  returnTo: string;
  periodes: { id: string; nama: string }[];
  defaultPeriodeId?: string;
  existingStandarList: ExistingStandarInfo[];
}) {
  const draftKey = `ami_lpm_form_draft_${defaultPeriodeId}`;

  const [customStandarList, setCustomStandarList] = useState<string[]>([]);
  const [inputStandarBaru, setInputStandarBaru] = useState("");

  const allStandarNames = Array.from(
    new Set([...existingStandarList.map((s) => s.standar), ...customStandarList])
  );

  const [selectedStandar, setSelectedStandar] = useState<string>(
    allStandarNames[0] ?? ""
  );
  const [selectedPeriodeId, setSelectedPeriodeId] = useState<string>(defaultPeriodeId);

  const currentStandarInfo = existingStandarList.find(
    (s) => s.standar === selectedStandar
  );
  const existingPernyataanStandar = currentStandarInfo?.pernyataanStandarList ?? [];

  const [pernyataanStandar, setPernyataanStandar] = useState<string>(
    existingPernyataanStandar[0] ?? ""
  );
  const [kode, setKode] = useState<string>(
    currentStandarInfo ? `IK${currentStandarInfo.nextIkNumber}` : "IK1"
  );
  const [pernyataan, setPernyataan] = useState<string>("");
  const [buktiDiminta, setBuktiDiminta] = useState<string>("");
  const [draftSavedNotice, setDraftSavedNotice] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Pulihkan draft ketikan LPM dari localStorage saat halaman dibuka
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        customStandarList?: string[];
        selectedStandar?: string;
        pernyataanStandar?: string;
        kode?: string;
        pernyataan?: string;
        buktiDiminta?: string;
      };
      if (parsed.customStandarList?.length) {
        setCustomStandarList(parsed.customStandarList);
      }
      if (parsed.selectedStandar) {
        setSelectedStandar(parsed.selectedStandar);
      }
      if (parsed.pernyataanStandar) {
        setPernyataanStandar(parsed.pernyataanStandar);
      }
      if (parsed.kode) {
        setKode(parsed.kode);
      }
      if (parsed.pernyataan) {
        setPernyataan(parsed.pernyataan);
      }
      if (parsed.buktiDiminta) {
        setBuktiDiminta(parsed.buktiDiminta);
      }
    } catch {
      // Abaikan
    }
  }, [draftKey]);

  // Simpan otomatis ketikan ke localStorage setiap ada perubahan
  useEffect(() => {
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          customStandarList,
          selectedStandar,
          pernyataanStandar,
          kode,
          pernyataan,
          buktiDiminta,
        })
      );
    } catch {
      // Abaikan
    }
  }, [draftKey, customStandarList, selectedStandar, pernyataanStandar, kode, pernyataan, buktiDiminta]);

  const handleBuatStandarManual = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputStandarBaru.trim();
    if (!trimmed) return;
    if (!customStandarList.includes(trimmed) && !allStandarNames.includes(trimmed)) {
      setCustomStandarList((prev) => [...prev, trimmed]);
    }
    setSelectedStandar(trimmed);
    setPernyataanStandar("");
    setKode("IK1");
    setInputStandarBaru("");
    setDraftSavedNotice(`Standar "${trimmed}" dibuat di Draft. Silakan lanjut isi Pernyataan Standar & Indikator.`);
  };

  const handleSelectStandar = (std: string) => {
    setSelectedStandar(std);
    const info = existingStandarList.find((s) => s.standar === std);
    setPernyataanStandar(info?.pernyataanStandarList[0] ?? "");
    setKode(info ? `IK${info.nextIkNumber}` : "IK1");
  };

  return (
    <div className={`card transition ${isExpanded ? "space-y-4 py-4" : "py-3"}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded((prev) => !prev);
          }
        }}
        className={`flex cursor-pointer select-none flex-wrap items-center justify-between gap-2 ${
          isExpanded ? "border-b border-black/15 pb-2.5" : ""
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-black bg-white text-xs font-black text-black">
            {isExpanded ? "▼" : "▶"}
          </span>
          <h2 className="text-sm font-black text-black">
            ➕ Input Indikator Manual (Standar ➔ Pernyataan Standar ➔ IK)
          </h2>
          {selectedStandar && !isExpanded && (
            <Badge tone="blue">📂 {selectedStandar}</Badge>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded((prev) => !prev);
          }}
          className="btn-secondary px-3 py-1 text-xs"
        >
          {isExpanded ? "▲ Minimize Input Manual" : "▼ Buka Input Manual"}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {draftSavedNotice && (
            <div className="rounded-xl border border-black bg-[#FEF08A] px-3 py-2 text-xs font-bold text-black">
              💾 {draftSavedNotice}
            </div>
          )}

      {/* TAHAP 1: ISI MANUAL STANDAR DULU */}
      <div className="rounded-2xl border-2 border-black bg-[#FAF7EE] p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-black text-black">
            📂 TAHAP 1 — Buat / Pilih Nama Standar (Manual seperti Nama Sheet Excel)
          </div>
          {selectedStandar ? (
            <Badge tone="green">Standar Aktif: {selectedStandar}</Badge>
          ) : (
            <Badge tone="amber">Wajib Buat Standar Dulu</Badge>
          )}
        </div>

        <form onSubmit={handleBuatStandarManual} className="flex flex-wrap gap-2">
          <input
            type="text"
            value={inputStandarBaru}
            onChange={(e) => setInputStandarBaru(e.target.value)}
            placeholder='Ketik nama Standar baru, contoh: "Standar Kompetensi Lulusan" atau "Standar Isi"...'
            className="min-w-[260px] flex-1 text-xs"
          />
          <button type="submit" className="btn text-xs">
            ➕ Buat Standar Manual
          </button>
        </form>

        {allStandarNames.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-bold text-slate-600">
              Atau klik Standar yang sudah Anda buat untuk menambah Pernyataan Standar / Indikator:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allStandarNames.map((std) => (
                <button
                  key={std}
                  type="button"
                  onClick={() => handleSelectStandar(std)}
                  className={`rounded-xl border border-black px-3 py-1 text-xs transition ${
                    selectedStandar === std
                      ? "bg-[#FEF08A] font-black text-black shadow-[2px_2px_0px_#000]"
                      : "bg-white font-semibold text-slate-800 hover:bg-[#FEF08A]/50"
                  }`}
                >
                  📂 {std}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* TAHAP 2 & 3: ISI PERNYATAAN STANDAR & INDIKATOR (AKTIF SETELAH STANDAR DIPILIH/DIBUAT) */}
      {!selectedStandar ? (
        <div className="rounded-2xl border border-dashed border-black/40 bg-white/60 p-4 text-center text-xs font-bold text-slate-600">
          ⬆️ Silakan ketik dan klik <strong>&ldquo;➕ Buat Standar Manual&rdquo;</strong> pada Tahap 1 terlebih dahulu sebelum mengisi Pernyataan Standar dan Indikator.
        </div>
      ) : (
        <form
          action={tambahIndikator}
          onSubmit={() => {
            setPernyataan("");
            setBuktiDiminta("");
          }}
          className="space-y-4"
        >
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="standar" value={selectedStandar} />

          {/* TAHAP 2: PERNYATAAN STANDAR */}
          <div className="rounded-2xl border-2 border-black bg-[#FAF7EE] p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-black text-black">
                📜 TAHAP 2 — Isi Pernyataan Standar untuk &ldquo;{selectedStandar}&rdquo;
              </div>
              <span className="text-[11px] font-semibold text-slate-600">
                1 Pernyataan Standar bisa membawahi beberapa Indikator (IK1, IK2, dst.)
              </span>
            </div>

            {existingPernyataanStandar.length > 0 && (
              <div className="space-y-1">
                <label className="text-[11px] text-slate-600">
                  Klik untuk memakai Pernyataan Standar yang sudah ada di {selectedStandar} (untuk lanjut tambah IK2, IK3, dst.):
                </label>
                <div className="flex flex-col gap-1.5">
                  {existingPernyataanStandar.map((ps, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPernyataanStandar(ps)}
                      className={`rounded-xl border border-black p-2 text-left text-xs transition ${
                        pernyataanStandar === ps
                          ? "bg-[#BAE6FD] font-bold text-black"
                          : "bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      ✓ {ps}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label>Isi Pernyataan Standar</label>
              <textarea
                name="pernyataanStandar"
                rows={3}
                required
                value={pernyataanStandar}
                onChange={(e) => setPernyataanStandar(e.target.value)}
                placeholder="Contoh: UPPS memastikan setiap program studi memiliki capaian pembelajaran lulusan mencakup kompetensi yang meliputi (1) penguasaan ilmu pengetahuan dan teknologi, (2) kecakapan umum, (3) pengetahuan dan ketrampilan, dan (4) kemampuan intelektual"
                className="w-full text-xs"
              />
            </div>
          </div>

          {/* TAHAP 3: INDIKATOR KINERJA (IK1, IK2, dst.) */}
          <div className="rounded-2xl border-2 border-black bg-[#FAF7EE] p-3.5 space-y-3">
            <div className="text-xs font-black text-black">
              🎯 TAHAP 3 — Tambah Indikator Kinerja (IK1, IK2, dst.) &amp; Dokumen Bukti
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <label>Target Sesi AMI</label>
                <select
                  name="periodeId"
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
                <label>Kode Indikator (IK)</label>
                <input
                  name="kode"
                  required
                  value={kode}
                  onChange={(e) => setKode(e.target.value)}
                  placeholder="IK1"
                  className="w-full font-mono text-xs"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label>Dokumen Bukti yang Diminta</label>
                <input
                  name="buktiDiminta"
                  value={buktiDiminta}
                  onChange={(e) => setBuktiDiminta(e.target.value)}
                  placeholder="Contoh: Dokumen Kurikulum Program Studi yang memuat CPL"
                  className="w-full text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label>Pernyataan Indikator Kinerja</label>
              <textarea
                name="pernyataan"
                rows={2}
                required
                value={pernyataan}
                onChange={(e) => setPernyataan(e.target.value)}
                placeholder="Contoh: Tersedia CPL PS yang mencakup kompetensi penguasaan ilmu pengetahuan, teknologi, serta kecakapan/keterampilan spesifik dan aplikasinya sesuai bidang ilmu yang dipelajarinya"
                className="w-full text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="submit"
                name="aksiSimpan"
                value="DRAFT"
                className="btn-secondary text-xs"
              >
                💾 Simpan sebagai Draft (Belum Terbit ke Auditor/Auditee)
              </button>
              <button
                type="submit"
                name="aksiSimpan"
                value="LOCK"
                className="btn-success text-xs"
              >
                🔒 Simpan &amp; Kunci (Terbitkan ke Auditor/Auditee)
              </button>
            </div>
          </div>
        </form>
      )}
        </div>
      )}
    </div>
  );
}
