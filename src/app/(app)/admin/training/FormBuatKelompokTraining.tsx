"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import { simpanKelompokTrainingLengkap } from "./actions";

export interface UnassignedTrainingUser {
  id: string;
  nama: string;
  username: string;
}

export function FormBuatKelompokTraining({
  nextGroupNumber,
  masterIndikatorCount,
  unassignedUsers,
}: {
  nextGroupNumber: number;
  masterIndikatorCount: number;
  unassignedUsers: UnassignedTrainingUser[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const [namaKelompok, setNamaKelompok] = useState(`Kelompok ${nextGroupNumber}`);

  // Setiap baris di Sisi Kiri (Auditor) dan Sisi Kanan (Auditee) adalah Dropdown pilih akun
  const [auditorSelects, setAuditorSelects] = useState<string[]>(["", ""]);
  const [auditeeSelects, setAuditeeSelects] = useState<string[]>(["", ""]);

  const [notice, setNotice] = useState<{ ok?: string; err?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Kumpulan userId yang sedang dipilih agar tidak dobel dipilih di dropdown lain
  const allSelectedIds = new Set(
    [...auditorSelects, ...auditeeSelects].filter((id) => id.trim().length > 0)
  );

  const updateAuditorSelect = (idx: number, val: string) => {
    setAuditorSelects((prev) => prev.map((v, i) => (i === idx ? val : v)));
  };

  const updateAuditeeSelect = (idx: number, val: string) => {
    setAuditeeSelects((prev) => prev.map((v, i) => (i === idx ? val : v)));
  };

  const addAuditorRow = () => setAuditorSelects((prev) => [...prev, ""]);
  const removeAuditorRow = (idx: number) =>
    setAuditorSelects((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : [""]));

  const addAuditeeRow = () => setAuditeeSelects((prev) => [...prev, ""]);
  const removeAuditeeRow = (idx: number) =>
    setAuditeeSelects((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : [""]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    const pickedAuditorIds = Array.from(new Set(auditorSelects.filter(Boolean)));
    const pickedAuditeeIds = Array.from(new Set(auditeeSelects.filter(Boolean)));

    startTransition(async () => {
      const res = await simpanKelompokTrainingLengkap({
        namaKelompok,
        auditors: [],
        auditees: [],
        existingAuditorIds: pickedAuditorIds,
        existingAuditeeIds: pickedAuditeeIds,
      });

      if (!res.ok) {
        setNotice({ err: res.error ?? "Gagal menyimpan kelompok." });
        return;
      }

      setNotice({ ok: res.message ?? "Kelompok berhasil disimpan." });
      setNamaKelompok(`Kelompok ${nextGroupNumber + 1}`);
      setAuditorSelects(["", ""]);
      setAuditeeSelects(["", ""]);
      router.refresh();
    });
  };

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/15 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-black text-black">
            ➕ Buat Grup / Kelompok Training Baru
          </h2>
          <Badge tone="green">Otomatis Masuk {masterIndikatorCount} Indikator LPM</Badge>
          <Badge tone="blue">{unassignedUsers.length} Akun Tersedia di Dropdown</Badge>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="btn-secondary text-xs"
        >
          {isOpen ? "🔼 Tutup Form Buat Grup" : "➕ Klik Buat Grup Baru"}
        </button>
      </div>

      {notice?.ok && (
        <div className="rounded-xl border-2 border-black bg-[#D9F99D] px-3.5 py-2.5 text-xs font-black text-black">
          ✓ {notice.ok}
        </div>
      )}
      {notice?.err && (
        <div className="rounded-xl border-2 border-black bg-[#FECDD3] px-3.5 py-2.5 text-xs font-black text-black">
          ⚠️ {notice.err}
        </div>
      )}

      {isOpen && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nama Kelompok */}
          <div className="max-w-md space-y-1">
            <label className="text-xs font-black uppercase text-black">
              Nama Grup / Kelompok Training
            </label>
            <input
              value={namaKelompok}
              onChange={(e) => setNamaKelompok(e.target.value)}
              required
              placeholder="Contoh: Kelompok 1 / Kelompok A"
              className="w-full text-sm font-black"
            />
          </div>

          {unassignedUsers.length === 0 && (
            <div className="rounded-xl border-2 border-black bg-[#FEF08A] px-3.5 py-2.5 text-xs font-bold text-black">
              ℹ️ Belum ada akun peserta yang tersedia di dropdown. Silakan Import Excel / Copy-Paste / Generate akun terlebih dahulu di bagian bawah.
            </div>
          )}

          {/* 2 Kolom: SISI KIRI (DROPDOWN AUDITOR) & SISI KANAN (DROPDOWN AUDITEE) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* SISI KIRI: PILIH AUDITOR VIA DROPDOWN */}
            <div className="rounded-2xl border-2 border-black bg-[#E9D5FF]/55 p-4 space-y-3 shadow-[3px_3px_0px_#000]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/15 pb-2">
                <span className="text-xs font-black uppercase text-black">
                  👈 Sisi Kiri: 🕵️ Pilih AUDITOR Kelompok Ini
                </span>
                <Badge tone="purple">Role: AUDITOR</Badge>
              </div>

              <div className="space-y-2">
                {auditorSelects.map((selectedId, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="w-5 shrink-0 text-xs font-black text-black">{idx + 1}.</span>
                    <select
                      value={selectedId}
                      onChange={(e) => updateAuditorSelect(idx, e.target.value)}
                      className="w-full bg-white text-xs font-bold text-black"
                    >
                      <option value="">-- Pilih Akun Auditor --</option>
                      {unassignedUsers
                        .filter((u) => u.id === selectedId || !allSelectedIds.has(u.id))
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nama} ({u.username})
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeAuditorRow(idx)}
                      className="btn-danger shrink-0 px-2.5 py-1 text-xs"
                      title="Hapus baris"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addAuditorRow}
                className="btn-secondary w-full text-xs"
              >
                + Tambah Dropdown Auditor
              </button>
            </div>

            {/* SISI KANAN: PILIH AUDITEE VIA DROPDOWN */}
            <div className="rounded-2xl border-2 border-black bg-[#BAE6FD]/55 p-4 space-y-3 shadow-[3px_3px_0px_#000]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/15 pb-2">
                <span className="text-xs font-black uppercase text-black">
                  👉 Sisi Kanan: 📝 Pilih AUDITEE Kelompok Ini
                </span>
                <Badge tone="blue">Role: AUDITEE</Badge>
              </div>

              <div className="space-y-2">
                {auditeeSelects.map((selectedId, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="w-5 shrink-0 text-xs font-black text-black">{idx + 1}.</span>
                    <select
                      value={selectedId}
                      onChange={(e) => updateAuditeeSelect(idx, e.target.value)}
                      className="w-full bg-white text-xs font-bold text-black"
                    >
                      <option value="">-- Pilih Akun Auditee --</option>
                      {unassignedUsers
                        .filter((u) => u.id === selectedId || !allSelectedIds.has(u.id))
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nama} ({u.username})
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeAuditeeRow(idx)}
                      className="btn-danger shrink-0 px-2.5 py-1 text-xs"
                      title="Hapus baris"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addAuditeeRow}
                className="btn-secondary w-full text-xs"
              >
                + Tambah Dropdown Auditee
              </button>
            </div>
          </div>

          <div className="flex justify-end border-t border-black/15 pt-3">
            <button type="submit" disabled={isPending} className="btn-success text-sm">
              {isPending ? "Menyimpan Kelompok..." : "💾 Simpan Kelompok"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
