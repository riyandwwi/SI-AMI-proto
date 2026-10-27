"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Empty } from "@/components/ui";
import {
  hapusSatuAkunTraining,
  hapusSatuKelompokTraining,
  pilihKetuaTrainingClient,
  pindahkanAkunTrainingClient,
} from "./actions";

export interface TrainingMemberItem {
  id: string;
  nama: string;
  username: string;
  role: "AUDITOR" | "AUDITEE" | "LPM" | "SUPER_ADMIN";
  trainingPeriodeId: string | null;
}

export interface TrainingGroupItem {
  id: string;
  nama: string;
  semester: string;
  indikatorCount: number;
  ketuaAuditorId?: string | null;
  ketuaAuditorNama?: string | null;
  ketuaAuditeeId?: string | null;
  ketuaAuditeeNama?: string | null;
}

export function KelompokTrainingBoard({
  groups,
  allTrainingUsers,
}: {
  groups: TrainingGroupItem[];
  allTrainingUsers: TrainingMemberItem[];
}) {
  const router = useRouter();
  const [users, setUsers] = useState<TrainingMemberItem[]>(allTrainingUsers);
  const [ketuaAuditorMap, setKetuaAuditorMap] = useState<Record<string, string | null>>(() => {
    const m: Record<string, string | null> = {};
    for (const g of groups) m[g.id] = g.ketuaAuditorId ?? null;
    return m;
  });
  const [ketuaAuditeeMap, setKetuaAuditeeMap] = useState<Record<string, string | null>>(() => {
    const m: Record<string, string | null> = {};
    for (const g of groups) m[g.id] = g.ketuaAuditeeId ?? null;
    return m;
  });
  const [draggedUserId, setDraggedUserId] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok?: string; err?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setUsers(allTrainingUsers);
  }, [allTrainingUsers]);

  useEffect(() => {
    const mAud: Record<string, string | null> = {};
    const mAde: Record<string, string | null> = {};
    for (const g of groups) {
      mAud[g.id] = g.ketuaAuditorId ?? null;
      mAde[g.id] = g.ketuaAuditeeId ?? null;
    }
    setKetuaAuditorMap(mAud);
    setKetuaAuditeeMap(mAde);
  }, [groups]);

  const handlePilihKetua = (
    periodeId: string,
    tipe: "AUDITOR" | "AUDITEE",
    userId: string
  ) => {
    setNotice(null);
    if (tipe === "AUDITOR") {
      setKetuaAuditorMap((prev) => ({ ...prev, [periodeId]: userId }));
    } else {
      setKetuaAuditeeMap((prev) => ({ ...prev, [periodeId]: userId }));
    }

    startTransition(async () => {
      const res = await pilihKetuaTrainingClient({ periodeId, tipe, userId });
      if (!res.ok) {
        setNotice({ err: res.error ?? "Gagal memilih ketua." });
        router.refresh();
        return;
      }
      setNotice({ ok: res.message ?? "Ketua kelompok diperbarui." });
      router.refresh();
    });
  };

  const moveUser = (
    userId: string,
    targetPeriodeId: string | null,
    targetRole: "AUDITOR" | "AUDITEE"
  ) => {
    setNotice(null);

    // Optimistic update instan di layar
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, trainingPeriodeId: targetPeriodeId, role: targetRole }
          : u
      )
    );

    startTransition(async () => {
      const res = await pindahkanAkunTrainingClient({
        userId,
        targetPeriodeId,
        targetRole,
      });
      if (!res.ok) {
        setNotice({ err: res.error ?? "Gagal memindahkan akun." });
        router.refresh();
        return;
      }
      setNotice({ ok: res.message ?? "Berhasil dipindahkan." });
      router.refresh();
    });
  };

  const handleDropToZone = (
    e: React.DragEvent,
    targetPeriodeId: string | null,
    targetRole: "AUDITOR" | "AUDITEE"
  ) => {
    e.preventDefault();
    setDragOverZone(null);
    const uid = e.dataTransfer.getData("text/plain") || draggedUserId;
    setDraggedUserId(null);
    if (!uid) return;

    const current = users.find((u) => u.id === uid);
    if (!current) return;
    if (current.trainingPeriodeId === targetPeriodeId && current.role === targetRole) {
      return;
    }

    moveUser(uid, targetPeriodeId, targetRole);
  };

  const unassignedUsers = users.filter((u) => !u.trainingPeriodeId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-black text-black">
            📂 Daftar Kelompok Sesi Training ({groups.length} Kelompok)
          </h2>
          <Badge tone="blue">
            🖐️ Bisa Drag &amp; Drop Peserta Antar Sisi (Auditor ⇄ Auditee) atau Antar Kelompok
          </Badge>
        </div>
        <Badge tone="purple">
          ⏱️ Tanda Tangan Otomatis Reset 3 Menit
        </Badge>
      </div>

      {notice?.ok && (
        <div className="rounded-xl border-2 border-black bg-[#D9F99D] px-3.5 py-2 text-xs font-black text-black">
          ✓ {notice.ok}
        </div>
      )}
      {notice?.err && (
        <div className="rounded-xl border-2 border-black bg-[#FECDD3] px-3.5 py-2 text-xs font-black text-black">
          ⚠️ {notice.err}
        </div>
      )}

      {/* Kotak Pool Peserta yang Belum Masuk Kelompok (Bisa di-Drag ke Kelompok Mana Saja) */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverZone("UNASSIGNED");
        }}
        onDragLeave={() => setDragOverZone(null)}
        onDrop={(e) => handleDropToZone(e, null, "AUDITEE")}
        className={`rounded-2xl border-2 border-dashed border-black p-4 transition ${
          dragOverZone === "UNASSIGNED" ? "bg-[#FEF08A] ring-2 ring-black" : "bg-[#FAF7EE]"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
          <span className="text-xs font-black uppercase text-black">
            📥 Akun Belum Masuk Kelompok ({unassignedUsers.length} Akun) — Tarik (Drag) ke Kotak Auditor / Auditee di Bawah:
          </span>
          {draggedUserId && (
            <Badge tone="amber">Lepas di sini untuk mengeluarkan dari kelompok</Badge>
          )}
        </div>

        {unassignedUsers.length === 0 ? (
          <p className="text-xs font-semibold text-slate-600">
            Semua akun training sudah masuk ke kelompok (atau tarik akun ke kotak ini untuk melepas dari kelompok).
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 pt-1">
            {unassignedUsers.map((u) => (
              <div
                key={u.id}
                draggable
                onDragStart={(e) => {
                  setDraggedUserId(u.id);
                  e.dataTransfer.setData("text/plain", u.id);
                }}
                onDragEnd={() => {
                  setDraggedUserId(null);
                  setDragOverZone(null);
                }}
                className="flex cursor-grab active:cursor-grabbing items-center gap-1.5 rounded-xl border-2 border-black bg-white px-3 py-1.5 text-xs font-bold text-black shadow-[2px_2px_0px_#000] hover:bg-[#FEF08A]"
                title="Tarik (Drag) ke kotak Auditor atau Auditee di bawah"
              >
                <span>🖐️ {u.nama}</span>
                <code className="rounded border border-black/30 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-black">
                  {u.username}
                </code>
              </div>
            ))}
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <Empty>
          Belum ada Kelompok Training. Silakan buat kelompok pada form di atas terlebih dahulu.
        </Empty>
      ) : (
        <div className="space-y-4">
          {groups.map((tp) => {
            const groupAuditors = users.filter(
              (u) => u.trainingPeriodeId === tp.id && u.role === "AUDITOR"
            );
            const groupAuditees = users.filter(
              (u) => u.trainingPeriodeId === tp.id && u.role !== "AUDITOR"
            );

            const leftZoneKey = `${tp.id}_AUDITOR`;
            const rightZoneKey = `${tp.id}_AUDITEE`;

            return (
              <div key={tp.id} className="card space-y-4">
                {/* Header Card Kelompok */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/15 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-black text-black">{tp.nama}</h3>
                    <Badge tone="blue">{tp.indikatorCount} Indikator LPM</Badge>
                    <Badge tone="purple">🕵️ {groupAuditors.length} Auditor</Badge>
                    <Badge tone="green">📝 {groupAuditees.length} Auditee</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/api/export-isian?periodeId=${encodeURIComponent(tp.id)}&role=auditee`}
                      className="btn-success text-xs"
                    >
                      📥 Excel Isian Auditee
                    </a>
                    <a
                      href={`/api/export-isian?periodeId=${encodeURIComponent(tp.id)}&role=auditor`}
                      className="btn-secondary border-2 border-[#581C87] bg-[#F3E8FF] text-xs font-black text-[#581C87] hover:bg-[#E9D5FF]"
                    >
                      📥 Excel Hasil Auditor
                    </a>
                    <form action={hapusSatuKelompokTraining}>
                      <input type="hidden" name="periodeId" value={tp.id} />
                      <button className="btn-danger text-xs">🗑️ Hapus Kelompok</button>
                    </form>
                  </div>
                </div>

                {/* 2 Kolom Drop Zone: SISI KIRI (AUDITOR) & SISI KANAN (AUDITEE) */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* SISI KIRI: DROP ZONE AUDITOR */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverZone(leftZoneKey);
                    }}
                    onDragLeave={() => setDragOverZone(null)}
                    onDrop={(e) => handleDropToZone(e, tp.id, "AUDITOR")}
                    className={`rounded-2xl border-2 border-black p-4 space-y-3 transition ${
                      dragOverZone === leftZoneKey
                        ? "bg-[#E9D5FF] ring-4 ring-black"
                        : "bg-[#FAF7EE]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-black">
                        👈 Sisi Kiri: 🕵️ Auditor ({tp.semester})
                      </span>
                      <Badge tone="purple">{groupAuditors.length} Auditor</Badge>
                    </div>

                    {groupAuditors.length === 0 ? (
                      <div className="rounded-xl border-2 border-dashed border-black/30 bg-white/70 p-4 text-center text-xs font-bold text-slate-600">
                        🖐️ Tarik (Drag) peserta ke sini atau pilih dari dropdown di bawah untuk menjadikannya AUDITOR
                      </div>
                    ) : (
                      <ul className="space-y-2 text-xs">
                        {groupAuditors.map((u) => {
                          const isKetuaAuditor = ketuaAuditorMap[tp.id] === u.id;
                          return (
                            <li
                              key={u.id}
                              draggable
                              onDragStart={(e) => {
                                setDraggedUserId(u.id);
                                e.dataTransfer.setData("text/plain", u.id);
                              }}
                              onDragEnd={() => {
                                setDraggedUserId(null);
                                setDragOverZone(null);
                              }}
                              className="flex cursor-grab active:cursor-grabbing flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-black bg-white px-3 py-2 shadow-[2px_2px_0px_#000]"
                              title="Tarik (Drag) untuk pindah ke Auditee (Kanan) atau ke Kelompok lain"
                            >
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-black text-black">🖐️ {u.nama}</span>
                                <code className="rounded border border-black bg-[#FEF08A] px-2 py-0.5 font-mono font-black text-black">
                                  {u.username}
                                </code>
                                {isKetuaAuditor && (
                                  <Badge tone="amber">⭐ Ketua Auditor</Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-1">
                                {!isKetuaAuditor && (
                                  <button
                                    type="button"
                                    disabled={isPending}
                                    onClick={() => handlePilihKetua(tp.id, "AUDITOR", u.id)}
                                    className="btn-secondary border border-amber-500 bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-900 hover:bg-amber-100"
                                    title="Tetapkan sebagai Ketua Auditor kelompok ini (penandatangan Berita Acara)"
                                  >
                                    ⭐ Jadikan Ketua
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() => moveUser(u.id, tp.id, "AUDITEE")}
                                  className="btn-secondary px-2 py-0.5 text-[11px]"
                                  title="Pindahkan ke Sisi Kanan (Jadi Auditee)"
                                >
                                  ⇄ Jadi Auditee 👉
                                </button>
                                {groups.length > 1 && (
                                  <select
                                    value={tp.id}
                                    disabled={isPending}
                                    onChange={(e) => moveUser(u.id, e.target.value, "AUDITOR")}
                                    className="rounded-lg border border-black bg-white px-1.5 py-0.5 text-[11px] font-bold text-black"
                                    title="Pindah ke kelompok lain"
                                  >
                                    {groups.map((g) => (
                                      <option key={g.id} value={g.id}>
                                        {g.semester}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() => moveUser(u.id, null, "AUDITEE")}
                                  className="btn-secondary px-2 py-0.5 text-[11px]"
                                  title="Keluarkan dari kelompok"
                                >
                                  Lepas
                                </button>
                                <form action={hapusSatuAkunTraining}>
                                  <input type="hidden" name="userId" value={u.id} />
                                  <button className="btn-danger px-2 py-0.5 text-[11px]">
                                    ✕
                                  </button>
                                </form>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {/* Dropdown Pilih Cepat ke Sisi Kiri (Auditor) */}
                    {unassignedUsers.length > 0 && (
                      <div className="pt-1">
                        <select
                          defaultValue=""
                          disabled={isPending}
                          onChange={(e) => {
                            if (e.target.value) {
                              moveUser(e.target.value, tp.id, "AUDITOR");
                              e.target.value = "";
                            }
                          }}
                          className="w-full bg-white text-xs font-bold text-black"
                        >
                          <option value="">+ Pilih dari Dropdown untuk Masuk Jadi AUDITOR...</option>
                          {unassignedUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.nama} ({u.username})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* SISI KANAN: DROP ZONE AUDITEE */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverZone(rightZoneKey);
                    }}
                    onDragLeave={() => setDragOverZone(null)}
                    onDrop={(e) => handleDropToZone(e, tp.id, "AUDITEE")}
                    className={`rounded-2xl border-2 border-black p-4 space-y-3 transition ${
                      dragOverZone === rightZoneKey
                        ? "bg-[#BAE6FD] ring-4 ring-black"
                        : "bg-[#FAF7EE]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-black">
                        👉 Sisi Kanan: 📝 Auditee ({tp.semester})
                      </span>
                      <Badge tone="blue">{groupAuditees.length} Auditee</Badge>
                    </div>

                    {groupAuditees.length === 0 ? (
                      <div className="rounded-xl border-2 border-dashed border-black/30 bg-white/70 p-4 text-center text-xs font-bold text-slate-600">
                        🖐️ Tarik (Drag) peserta ke sini atau pilih dari dropdown di bawah untuk menjadikannya AUDITEE
                      </div>
                    ) : (
                      <ul className="space-y-2 text-xs">
                        {groupAuditees.map((u) => {
                          const isKetuaAuditee = ketuaAuditeeMap[tp.id] === u.id;
                          return (
                            <li
                              key={u.id}
                              draggable
                              onDragStart={(e) => {
                                setDraggedUserId(u.id);
                                e.dataTransfer.setData("text/plain", u.id);
                              }}
                              onDragEnd={() => {
                                setDraggedUserId(null);
                                setDragOverZone(null);
                              }}
                              className="flex cursor-grab active:cursor-grabbing flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-black bg-white px-3 py-2 shadow-[2px_2px_0px_#000]"
                              title="Tarik (Drag) untuk pindah ke Auditor (Kiri) atau ke Kelompok lain"
                            >
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-black text-black">🖐️ {u.nama}</span>
                                <code className="rounded border border-black bg-[#FEF08A] px-2 py-0.5 font-mono font-black text-black">
                                  {u.username}
                                </code>
                                {isKetuaAuditee && (
                                  <Badge tone="amber">⭐ Ketua Auditee</Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-1">
                                {!isKetuaAuditee && (
                                  <button
                                    type="button"
                                    disabled={isPending}
                                    onClick={() => handlePilihKetua(tp.id, "AUDITEE", u.id)}
                                    className="btn-secondary border border-amber-500 bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-900 hover:bg-amber-100"
                                    title="Tetapkan sebagai Ketua Auditee kelompok ini (penandatangan Berita Acara)"
                                  >
                                    ⭐ Jadikan Ketua
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() => moveUser(u.id, tp.id, "AUDITOR")}
                                  className="btn-secondary px-2 py-0.5 text-[11px]"
                                  title="Pindahkan ke Sisi Kiri (Jadi Auditor)"
                                >
                                  👈 Jadi Auditor ⇄
                                </button>
                                {groups.length > 1 && (
                                  <select
                                    value={tp.id}
                                    disabled={isPending}
                                    onChange={(e) => moveUser(u.id, e.target.value, "AUDITEE")}
                                    className="rounded-lg border border-black bg-white px-1.5 py-0.5 text-[11px] font-bold text-black"
                                    title="Pindah ke kelompok lain"
                                  >
                                    {groups.map((g) => (
                                      <option key={g.id} value={g.id}>
                                        {g.semester}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() => moveUser(u.id, null, "AUDITEE")}
                                  className="btn-secondary px-2 py-0.5 text-[11px]"
                                  title="Keluarkan dari kelompok"
                                >
                                  Lepas
                                </button>
                                <form action={hapusSatuAkunTraining}>
                                  <input type="hidden" name="userId" value={u.id} />
                                  <button className="btn-danger px-2 py-0.5 text-[11px]">
                                    ✕
                                  </button>
                                </form>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {/* Dropdown Pilih Cepat ke Sisi Kanan (Auditee) */}
                    {unassignedUsers.length > 0 && (
                      <div className="pt-1">
                        <select
                          defaultValue=""
                          disabled={isPending}
                          onChange={(e) => {
                            if (e.target.value) {
                              moveUser(e.target.value, tp.id, "AUDITEE");
                              e.target.value = "";
                            }
                          }}
                          className="w-full bg-white text-xs font-bold text-black"
                        >
                          <option value="">+ Pilih dari Dropdown untuk Masuk Jadi AUDITEE...</option>
                          {unassignedUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.nama} ({u.username})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
