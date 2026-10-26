"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface TeamRaceItem {
  periodeId: string;
  namaKelompok: string;
  totalIndikator: number;
  auditeeFilledCount: number;
  auditeePct: number;
  auditeeLatestBy: string | null;
  auditeeLatestKode: string | null;
  auditeeLatestAt: string | null;
  auditeeMembers: string[];
  auditorCheckedCount: number;
  auditorVerifiedCount: number;
  auditorPct: number;
  auditorLatestBy: string | null;
  auditorLatestKode: string | null;
  auditorLatestAt: string | null;
  auditorMembers: string[];
}

export interface IndividualRankItem {
  key: string;
  nama: string;
  username: string | null;
  namaKelompok: string;
  count: number;
  verifiedCount?: number;
  totalGroupIndikator: number;
  pctOfGroup: number;
  latestKode: string | null;
  latestAt: string | null;
}

export default function LeaderboardClient({
  initialMode,
  teams,
  auditeeIndividuals,
  auditorIndividuals,
  lastServerTime,
}: {
  initialMode: "auditee" | "auditor";
  teams: TeamRaceItem[];
  auditeeIndividuals: IndividualRankItem[];
  auditorIndividuals: IndividualRankItem[];
  lastServerTime: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"auditee" | "auditor">(initialMode);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          startTransition(() => {
            router.refresh();
          });
          return 5;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [autoRefresh, router]);

  function handleManualRefresh() {
    setCountdown(5);
    startTransition(() => {
      router.refresh();
    });
  }

  // Sort teams dynamically like a race based on active mode
  const sortedTeams = [...teams].sort((a, b) => {
    if (mode === "auditee") {
      if (b.auditeePct !== a.auditeePct) return b.auditeePct - a.auditeePct;
      if (b.auditeeFilledCount !== a.auditeeFilledCount)
        return b.auditeeFilledCount - a.auditeeFilledCount;
      return a.namaKelompok.localeCompare(b.namaKelompok, "id");
    } else {
      if (b.auditorPct !== a.auditorPct) return b.auditorPct - a.auditorPct;
      if (b.auditorCheckedCount !== a.auditorCheckedCount)
        return b.auditorCheckedCount - a.auditorCheckedCount;
      return a.namaKelompok.localeCompare(b.namaKelompok, "id");
    }
  });

  const sortedIndividuals =
    mode === "auditee" ? auditeeIndividuals : auditorIndividuals;

  const totalAllIndikator = teams.reduce((acc, t) => acc + t.totalIndikator, 0);
  const totalAllDone = teams.reduce(
    (acc, t) =>
      acc + (mode === "auditee" ? t.auditeeFilledCount : t.auditorCheckedCount),
    0,
  );
  const overallPct =
    totalAllIndikator > 0
      ? Math.round((totalAllDone / totalAllIndikator) * 1000) / 10
      : 0;

  return (
    <div className="space-y-6">
      {/* Header & Mode Switcher */}
      <div className="rounded-2xl border-2 border-[#334155] bg-[#CBD5E1] p-5 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-xl border-2 border-[#0F172A] bg-[#0F172A] px-3 py-1 text-sm font-black text-white">
                🏆 LIVE LEADERBOARD TRAINING
              </span>
              {autoRefresh ? (
                <span className="inline-flex items-center gap-2 rounded-xl border-2 border-[#065F46] bg-[#D1FAE5] px-3 py-1 text-xs font-black text-[#065F46]">
                  <span className="inline-block h-2.5 w-2.5 animate-ping rounded-full bg-[#059669]" />
                  LIVE BALAPAN AKTIF (Update {countdown}d)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#475569] bg-[#E2E8F0] px-3 py-1 text-xs font-black text-[#334155]">
                  ⏸️ Auto-Refresh Dijeda
                </span>
              )}
              <span className="text-xs font-bold text-[#334155]">
                🕒 Update: {lastServerTime}
              </span>
            </div>
            <h1 className="text-2xl font-black text-[#0F172A]">
              {mode === "auditee"
                ? "🏁 Balapan Pengisian Instrumen Auditee (Kelompok & Individu)"
                : "🏁 Balapan Pemeriksaan & Verifikasi Auditor (Kelompok & Individu)"}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/training"
              className="rounded-xl border-2 border-[#334155] bg-[#EDF2F7] px-4 py-2 text-sm font-black text-[#0F172A] hover:bg-white"
            >
              ← Kembali ke Sesi Training
            </Link>
            <button
              type="button"
              onClick={() => {
                setAutoRefresh((v) => !v);
                setCountdown(5);
              }}
              className={`rounded-xl border-2 px-4 py-2 text-sm font-black transition ${
                autoRefresh
                  ? "border-[#065F46] bg-[#059669] text-white"
                  : "border-[#334155] bg-[#EDF2F7] text-[#0F172A]"
              }`}
            >
              {autoRefresh ? "⚡ Live Auto-Update: ON" : "▶️ Nyalakan Live"}
            </button>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isPending}
              className="rounded-xl border-2 border-[#1E3A8A] bg-[#1D4ED8] px-4 py-2 text-sm font-black text-white hover:bg-[#1E40AF] disabled:opacity-60"
            >
              {isPending ? "⏳ Memuat..." : "🔄 Refresh Sekarang"}
            </button>
          </div>
        </div>

        {/* Tombol Pilih Mode: Hari Ini (Auditee) vs Besok (Auditor) */}
        <div className="mt-4 grid grid-cols-1 gap-3 border-t-2 border-[#94A3B8] pt-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("auditee")}
            className={`flex items-center justify-between rounded-xl border-2 p-4 text-left transition ${
              mode === "auditee"
                ? "border-[#1E3A8A] bg-[#1D4ED8] text-white shadow-md"
                : "border-[#475569] bg-[#E2E8F0] text-[#0F172A] hover:bg-[#EDF2F7]"
            }`}
          >
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider opacity-90">
                Sesi Pengisian Auditee
              </div>
              <div className="text-lg font-black">
                📝 Leaderboard AUDITEE (Paling Banyak Ngisi)
              </div>
            </div>
            <span
              className={`rounded-lg px-3 py-1 text-xs font-black ${
                mode === "auditee"
                  ? "bg-white text-[#1E3A8A]"
                  : "bg-[#CBD5E1] text-[#0F172A]"
              }`}
            >
              {mode === "auditee" ? "SEDANG TAMPIL" : "Klik untuk Buka"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMode("auditor")}
            className={`flex items-center justify-between rounded-xl border-2 p-4 text-left transition ${
              mode === "auditor"
                ? "border-[#581C87] bg-[#6D28D9] text-white shadow-md"
                : "border-[#475569] bg-[#E2E8F0] text-[#0F172A] hover:bg-[#EDF2F7]"
            }`}
          >
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider opacity-90">
                Sesi Pemeriksaan Auditor (Besok / Lanjutan)
              </div>
              <div className="text-lg font-black">
                🕵️ Leaderboard AUDITOR (Paling Banyak Menilai)
              </div>
            </div>
            <span
              className={`rounded-lg px-3 py-1 text-xs font-black ${
                mode === "auditor"
                  ? "bg-white text-[#581C87]"
                  : "bg-[#CBD5E1] text-[#0F172A]"
              }`}
            >
              {mode === "auditor" ? "SEDANG TAMPIL" : "Siap Dipakai Besok"}
            </span>
          </button>
        </div>
      </div>

      {/* BAGIAN 1 (ATAS): BALAPAN PROGRES KELOMPOK / TEAM RACE */}
      <div className="rounded-2xl border-2 border-[#334155] bg-[#E2E8F0] p-5 shadow-md">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#94A3B8] pb-3">
          <div>
            <h2 className="text-xl font-black text-[#0F172A]">
              🏎️ Arena Balapan Progres Kelompok ({sortedTeams.length} Kelompok)
            </h2>
            <p className="text-sm font-semibold text-[#334155]">
              Urutan posisi otomatis naik-turun secara real-time berdasarkan persentase progres tertinggi!
            </p>
          </div>
          <div className="rounded-xl border-2 border-[#1E3A8A] bg-[#DBEAFE] px-4 py-2 text-sm font-black text-[#1E3A8A]">
            Total Progres Seluruh Kelompok: {totalAllDone} / {totalAllIndikator} Indikator ({overallPct}%)
          </div>
        </div>

        {sortedTeams.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[#64748B] bg-[#EDF2F7] p-8 text-center text-base font-bold text-[#334155]">
            Belum ada Kelompok Training yang dibuat. Silakan buat kelompok di halaman Sesi Training terlebih dahulu.
          </div>
        ) : (
          <div className="space-y-4">
            {sortedTeams.map((team, idx) => {
              const rank = idx + 1;
              const pct = mode === "auditee" ? team.auditeePct : team.auditorPct;
              const doneCount =
                mode === "auditee"
                  ? team.auditeeFilledCount
                  : team.auditorCheckedCount;
              const latestBy =
                mode === "auditee" ? team.auditeeLatestBy : team.auditorLatestBy;
              const latestKode =
                mode === "auditee"
                  ? team.auditeeLatestKode
                  : team.auditorLatestKode;
              const members =
                mode === "auditee" ? team.auditeeMembers : team.auditorMembers;

              const medal =
                rank === 1
                  ? "🥇 JUARA 1"
                  : rank === 2
                    ? "🥈 POSISI 2"
                    : rank === 3
                      ? "🥉 POSISI 3"
                      : `#${rank}`;

              const rankBadgeClass =
                rank === 1
                  ? "border-[#92400E] bg-[#FDE68A] text-[#78350F]"
                  : rank === 2
                    ? "border-[#334155] bg-[#E2E8F0] text-[#0F172A]"
                    : rank === 3
                      ? "border-[#9A3412] bg-[#FED7AA] text-[#7C2D12]"
                      : "border-[#475569] bg-[#CBD5E1] text-[#0F172A]";

              const barColorClass =
                mode === "auditee"
                  ? rank === 1
                    ? "bg-gradient-to-r from-[#1D4ED8] to-[#059669]"
                    : "bg-[#1D4ED8]"
                  : rank === 1
                    ? "bg-gradient-to-r from-[#6D28D9] to-[#059669]"
                    : "bg-[#6D28D9]";

              return (
                <div
                  key={team.periodeId}
                  className={`rounded-2xl border-2 p-4 transition-all duration-700 ${
                    rank === 1
                      ? "border-[#1E3A8A] bg-[#EDF2F7] shadow-md"
                      : "border-[#64748B] bg-[#EDF2F7]"
                  }`}
                >
                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        className={`rounded-xl border-2 px-3.5 py-1 text-base font-black ${rankBadgeClass}`}
                      >
                        {medal}
                      </span>
                      <span className="text-lg font-black text-[#0F172A]">
                        {team.namaKelompok}
                      </span>
                      <span className="rounded-lg border border-[#64748B] bg-[#DCE5EF] px-2.5 py-0.5 text-xs font-bold text-[#0F172A]">
                        👥 {members.length}{" "}
                        {mode === "auditee" ? "Auditee" : "Auditor"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {latestBy && (
                        <span className="rounded-lg border border-[#1E3A8A] bg-[#DBEAFE] px-3 py-1 text-xs font-bold text-[#1E3A8A]">
                          🕒 Save Terakhir: 👤 {latestBy}
                          {latestKode ? ` (${latestKode})` : ""}
                        </span>
                      )}
                      <span className="rounded-xl border-2 border-[#0F172A] bg-[#0F172A] px-3.5 py-1 text-lg font-black text-white">
                        {pct}% ({doneCount}/{team.totalIndikator})
                      </span>
                    </div>
                  </div>

                  {/* Lintasan Balapan (Race Track Bar) */}
                  <div className="relative h-9 w-full overflow-hidden rounded-xl border-2 border-[#334155] bg-[#CBD5E1] p-1">
                    <div
                      className={`flex h-full items-center justify-end rounded-lg pr-2 text-xs font-black text-white transition-all duration-700 ease-out ${barColorClass}`}
                      style={{ width: `${Math.max(pct, pct > 0 ? 6 : 2)}%` }}
                    >
                      <span className="text-base leading-none drop-shadow">
                        {pct >= 100 ? "🏁🏆" : rank === 1 ? "🏎️💨" : "🏇"}
                      </span>
                    </div>
                  </div>

                  {/* Daftar Anggota di Kelompok Ini */}
                  {members.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-bold text-[#334155]">
                      <span>
                        Anggota {mode === "auditee" ? "Auditee" : "Auditor"}:
                      </span>
                      {members.map((m, i) => (
                        <span
                          key={i}
                          className="rounded-md border border-[#94A3B8] bg-[#E2E8F0] px-2 py-0.5 text-[#0F172A]"
                        >
                          👤 {m}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BAGIAN 2 (BAWAH): KLASEMEN INDIVIDU PALING BANYAK NGISI / MENILAI */}
      <div className="rounded-2xl border-2 border-[#334155] bg-[#E2E8F0] p-5 shadow-md">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#94A3B8] pb-3">
          <div>
            <h2 className="text-xl font-black text-[#0F172A]">
              {mode === "auditee"
                ? "🏅 Klasemen Individu Auditee — Paling Banyak Mengisi Indikator"
                : "🏅 Klasemen Individu Auditor — Paling Banyak Memeriksa Indikator"}
            </h2>
            <p className="text-sm font-semibold text-[#334155]">
              {mode === "auditee"
                ? "Daftar nama peserta Auditee diurutkan dari yang paling rajin menyimpan isian & link bukti."
                : "Daftar nama peserta Auditor diurutkan dari yang paling rajin memeriksa & memverifikasi indikator."}
            </p>
          </div>
          <span className="rounded-xl border-2 border-[#334155] bg-[#EDF2F7] px-3.5 py-1.5 text-sm font-black text-[#0F172A]">
            Total Peserta Terdaftar: {sortedIndividuals.length} Orang
          </span>
        </div>

        {sortedIndividuals.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[#64748B] bg-[#EDF2F7] p-8 text-center text-base font-bold text-[#334155]">
            Belum ada peserta {mode === "auditee" ? "Auditee" : "Auditor"} di kelompok training.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="w-24 text-center text-sm">Peringkat</th>
                  <th className="text-sm">
                    Nama {mode === "auditee" ? "Auditee" : "Auditor"}
                  </th>
                  <th className="text-sm">Kelompok Training</th>
                  <th className="text-sm">Indikator Terakhir</th>
                  <th className="w-64 text-sm">Progres Kontribusi</th>
                  <th className="w-40 text-right text-sm">
                    Total {mode === "auditee" ? "Diisi" : "Diperiksa"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedIndividuals.map((person, index) => {
                  const rank = index + 1;
                  const medal =
                    rank === 1
                      ? "🥇 #1"
                      : rank === 2
                        ? "🥈 #2"
                        : rank === 3
                          ? "🥉 #3"
                          : `#${rank}`;

                  const rowBg =
                    rank === 1 && person.count > 0
                      ? "bg-[#FEF3C7]"
                      : rank <= 3 && person.count > 0
                        ? "bg-[#DBEAFE]"
                        : "bg-[#EDF2F7]";

                  return (
                    <tr key={person.key} className={rowBg}>
                      <td className="text-center font-mono text-base font-black text-[#0F172A]">
                        {medal}
                      </td>
                      <td>
                        <div className="text-base font-black text-[#0F172A]">
                          👤 {person.nama}
                        </div>
                        {person.username && (
                          <div className="font-mono text-xs font-bold text-[#475569]">
                            @{person.username}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="rounded-lg border border-[#334155] bg-[#DCE5EF] px-2.5 py-1 text-xs font-black text-[#0F172A]">
                          {person.namaKelompok}
                        </span>
                      </td>
                      <td>
                        {person.latestKode ? (
                          <span className="rounded-lg border border-[#1E3A8A] bg-[#DBEAFE] px-2.5 py-1 font-mono text-xs font-black text-[#1E3A8A]">
                            🕒 {person.latestKode}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-[#64748B]">
                            Belum ada simpanan
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="space-y-1">
                          <div className="h-3.5 w-full overflow-hidden rounded-full border border-[#475569] bg-[#CBD5E1]">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                mode === "auditee"
                                  ? "bg-[#1D4ED8]"
                                  : "bg-[#6D28D9]"
                              }`}
                              style={{
                                width: `${Math.min(100, Math.max(person.pctOfGroup, person.count > 0 ? 5 : 0))}%`,
                              }}
                            />
                          </div>
                          <div className="text-xs font-bold text-[#334155]">
                            {person.pctOfGroup}% dari target kelompok (
                            {person.totalGroupIndikator} ind)
                          </div>
                        </div>
                      </td>
                      <td className="text-right">
                        <span
                          className={`inline-block rounded-xl border-2 px-3.5 py-1.5 text-base font-black ${
                            person.count > 0
                              ? "border-[#065F46] bg-[#D1FAE5] text-[#065F46]"
                              : "border-[#64748B] bg-[#E2E8F0] text-[#475569]"
                          }`}
                        >
                          {person.count} Indikator
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
