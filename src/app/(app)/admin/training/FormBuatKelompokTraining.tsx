"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import { simpanKelompokTrainingLengkap, type NewGroupMemberInput } from "./actions";

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
  const [auditors, setAuditors] = useState<NewGroupMemberInput[]>([
    { nama: "", username: "" },
    { nama: "", username: "" },
  ]);
  const [auditees, setAuditees] = useState<NewGroupMemberInput[]>([
    { nama: "", username: "" },
    { nama: "", username: "" },
  ]);
  const [pickedAuditorIds, setPickedAuditorIds] = useState<string[]>([]);
  const [pickedAuditeeIds, setPickedAuditeeIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ ok?: string; err?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const updateAuditor = (idx: number, field: keyof NewGroupMemberInput, val: string) => {
    setAuditors((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item)));
  };

  const updateAuditee = (idx: number, field: keyof NewGroupMemberInput, val: string) => {
    setAuditees((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item)));
  };

  const addAuditorRow = () => setAuditors((prev) => [...prev, { nama: "", username: "" }]);
  const removeAuditorRow = (idx: number) =>
    setAuditors((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : [{ nama: "", username: "" }]));

  const addAuditeeRow = () => setAuditees((prev) => [...prev, { nama: "", username: "" }]);
  const removeAuditeeRow = (idx: number) =>
    setAuditees((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : [{ nama: "", username: "" }]));

  const togglePickAuditor = (userId: string) => {
    setPickedAuditeeIds((prev) => prev.filter((id) => id !== userId));
    setPickedAuditorIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const togglePickAuditee = (userId: string) => {
    setPickedAuditorIds((prev) => prev.filter((id) => id !== userId));
    setPickedAuditeeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    startTransition(async () => {
      const res = await simpanKelompokTrainingLengkap({
        namaKelompok,
        auditors,
        auditees,
        existingAuditorIds: pickedAuditorIds,
        existingAuditeeIds: pickedAuditeeIds,
      });

      if (!res.ok) {
        setNotice({ err: res.error ?? "Gagal menyimpan kelompok." });
        return;
      }

      setNotice({ ok: res.message ?? "Kelompok berhasil disimpan." });
      setNamaKelompok(`Kelompok ${nextGroupNumber + 1}`);
      setAuditors([
        { nama: "", username: "" },
        { nama: "", username: "" },
      ]);
      setAuditees([
        { nama: "", username: "" },
        { nama: "", username: "" },
      ]);
      setPickedAuditorIds([]);
      setPickedAuditeeIds([]);
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
          <Badge tone="amber">🔑 Password Akun: 123</Badge>
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

          {/* 2 Kolom: SISI KIRI (AUDITOR) & SISI KANAN (AUDITEE) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* SISI KIRI: MASUKKAN AUDITOR */}
            <div className="rounded-2xl border-2 border-black bg-[#E9D5FF]/55 p-4 space-y-3 shadow-[3px_3px_0px_#000]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/15 pb-2">
                <span className="text-xs font-black uppercase text-black">
                  👈 Sisi Kiri: 🕵️ Masukkan AUDITOR Kelompok Ini
                </span>
                <Badge tone="purple">Role: AUDITOR</Badge>
              </div>

              <div className="space-y-2">
                {auditors.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="w-5 shrink-0 text-xs font-black text-black">{idx + 1}.</span>
                    <input
                      value={row.nama}
                      onChange={(e) => updateAuditor(idx, "nama", e.target.value)}
                      placeholder="Nama Auditor..."
                      className="w-full bg-white text-xs"
                    />
                    <input
                      value={row.username ?? ""}
                      onChange={(e) => updateAuditor(idx, "username", e.target.value)}
                      placeholder="Username (opsional)"
                      className="w-40 shrink-0 bg-white font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removeAuditorRow(idx)}
                      className="btn-danger shrink-0 px-2 py-1 text-xs"
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
                + Tambah Baris Auditor
              </button>

              {unassignedUsers.length > 0 && (
                <div className="space-y-1.5 border-t border-black/15 pt-2.5">
                  <div className="text-[11px] font-black uppercase text-slate-800">
                    Atau Pilih dari Akun Hasil Import yang Belum Punya Kelompok:
                  </div>
                  <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                    {unassignedUsers.map((u) => {
                      const active = pickedAuditorIds.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => togglePickAuditor(u.id)}
                          className={`rounded-xl border border-black px-2.5 py-1 text-xs font-bold transition ${
                            active
                              ? "bg-black text-white"
                              : "bg-white text-black hover:bg-[#FEF08A]"
                          }`}
                        >
                          {active ? "✓ " : "+ "}
                          {u.nama} ({u.username})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* SISI KANAN: MASUKKAN AUDITEE */}
            <div className="rounded-2xl border-2 border-black bg-[#BAE6FD]/55 p-4 space-y-3 shadow-[3px_3px_0px_#000]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/15 pb-2">
                <span className="text-xs font-black uppercase text-black">
                  👉 Sisi Kanan: 📝 Masukkan AUDITEE Kelompok Ini
                </span>
                <Badge tone="blue">Role: AUDITEE</Badge>
              </div>

              <div className="space-y-2">
                {auditees.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="w-5 shrink-0 text-xs font-black text-black">{idx + 1}.</span>
                    <input
                      value={row.nama}
                      onChange={(e) => updateAuditee(idx, "nama", e.target.value)}
                      placeholder="Nama Auditee..."
                      className="w-full bg-white text-xs"
                    />
                    <input
                      value={row.username ?? ""}
                      onChange={(e) => updateAuditee(idx, "username", e.target.value)}
                      placeholder="Username (opsional)"
                      className="w-40 shrink-0 bg-white font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removeAuditeeRow(idx)}
                      className="btn-danger shrink-0 px-2 py-1 text-xs"
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
                + Tambah Baris Auditee
              </button>

              {unassignedUsers.length > 0 && (
                <div className="space-y-1.5 border-t border-black/15 pt-2.5">
                  <div className="text-[11px] font-black uppercase text-slate-800">
                    Atau Pilih dari Akun Hasil Import yang Belum Punya Kelompok:
                  </div>
                  <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                    {unassignedUsers.map((u) => {
                      const active = pickedAuditeeIds.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => togglePickAuditee(u.id)}
                          className={`rounded-xl border border-black px-2.5 py-1 text-xs font-bold transition ${
                            active
                              ? "bg-black text-white"
                              : "bg-white text-black hover:bg-[#FEF08A]"
                          }`}
                        >
                          {active ? "✓ " : "+ "}
                          {u.nama} ({u.username})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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
