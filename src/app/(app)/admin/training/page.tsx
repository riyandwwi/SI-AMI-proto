import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptPassword } from "@/lib/crypto";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";
import { FormBuatKelompokTraining } from "./FormBuatKelompokTraining";
import { ImportTrainingUsers } from "./ImportTrainingUsers";
import { KelompokTrainingBoard } from "./KelompokTrainingBoard";
import {
  generateDummyTrainingAccounts,
  hapusSatuAkunTraining,
  hapusSemuaSesiDanAkunTraining,
  sinkronkanIndikatorTraining,
} from "./actions";

export default async function AdminTrainingPage({ searchParams }: { searchParams: SP }) {
  await requireUser("SUPER_ADMIN", "LPM");
  const sp = await searchParams;

  const [trainingPeriodes, trainingUsers, masterPeriodes] = await Promise.all([
    prisma.periode.findMany({
      where: { isTraining: true },
      include: {
        indikator: { select: { id: true } },
        trainingUsers: {
          orderBy: { nama: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: { isTraining: true },
      include: { trainingPeriode: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.periode.findMany({
      where: { isTraining: false },
      include: { indikator: { select: { kode: true, standar: true } } },
    }),
  ]);

  const masterIndikatorSet = new Set<string>();
  for (const p of masterPeriodes) {
    for (const i of p.indikator) {
      masterIndikatorSet.add(`${i.standar.toUpperCase()}|||${i.kode.toUpperCase()}`);
    }
  }

  const unassignedUsers = trainingUsers
    .filter((u) => !u.trainingPeriodeId)
    .map((u) => ({ id: u.id, nama: u.nama, username: u.username }));

  return (
    <>
      <PageHeader title="🎓 Sesi Training & Pembagian Kelompok (Auditor / Auditee)">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin" className="btn-secondary text-xs">
            ← Kelola Akun Utama
          </Link>
          <Link
            href="/admin/training/leaderboard?mode=auditee"
            className="btn-primary text-xs font-black"
          >
            🏆 Live Leaderboard Auditee
          </Link>
          <Link
            href="/admin/training/leaderboard?mode=auditor"
            className="btn-secondary border-2 border-[#581C87] bg-[#F3E8FF] text-xs font-black text-[#581C87] hover:bg-[#E9D5FF]"
          >
            🕵️ Leaderboard Auditor (Besok)
          </Link>
          {trainingPeriodes.length > 0 && (
            <a
              href="/api/export-isian?training=all"
              className="btn-success text-xs font-black"
            >
              📥 Download Excel Semua Kelompok ({trainingPeriodes.length})
            </a>
          )}
          {trainingPeriodes.length > 0 && (
            <form action={sinkronkanIndikatorTraining}>
              <button className="btn-secondary text-xs">
                🔄 Sinkronkan Indikator LPM ({masterIndikatorSet.size} Indikator)
              </button>
            </form>
          )}
          {(trainingPeriodes.length > 0 || trainingUsers.length > 0) && (
            <form action={hapusSemuaSesiDanAkunTraining}>
              <button className="btn-danger text-xs">
                🗑️ Hapus Semua Sesi &amp; Akun Training ({trainingPeriodes.length} Kelompok, {trainingUsers.length} Akun)
              </button>
            </form>
          )}
        </div>
      </PageHeader>
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {/* 1. Form Buat Grup / Kelompok Baru (Sisi Kiri: Auditor, Sisi Kanan: Auditee -> Klik Simpan Kelompok) */}
      <FormBuatKelompokTraining
        nextGroupNumber={trainingPeriodes.length + 1}
        masterIndikatorCount={masterIndikatorSet.size}
        unassignedUsers={unassignedUsers}
      />

      {/* 2. Board Drag & Drop Kelompok Training (Sisi Kiri: Auditor ⇄ Sisi Kanan: Auditee & Pindah Kelompok) */}
      <KelompokTrainingBoard
        groups={trainingPeriodes.map((tp) => ({
          id: tp.id,
          nama: tp.nama,
          semester: tp.semester,
          indikatorCount: tp.indikator.length,
          ketuaAuditorId: tp.ketuaAuditorId,
          ketuaAuditorNama: tp.ketuaAuditorNama,
          ketuaAuditeeId: tp.ketuaAuditeeId,
          ketuaAuditeeNama: tp.ketuaAuditeeNama,
        }))}
        allTrainingUsers={trainingUsers.map((u) => ({
          id: u.id,
          nama: u.nama,
          username: u.username,
          role: u.role,
          trainingPeriodeId: u.trainingPeriodeId,
        }))}
      />

      {/* 3. Opsi Tambahan: Import Excel / Copy-Paste / Generate Instan Akun Dummy */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ImportTrainingUsers />
        </div>
        <form action={generateDummyTrainingAccounts} className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/15 pb-2">
            <h2 className="text-sm font-black text-black">
              ⚡ Generate Cadangan Akun Dummy
            </h2>
            <Badge tone="amber">🔑 Password: 123</Badge>
          </div>
          <div className="space-y-2.5">
            <div className="space-y-1">
              <label>Awalan Username</label>
              <input
                name="prefixUsername"
                defaultValue="peserta"
                required
                placeholder="peserta"
                className="w-full font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <label>Jumlah Akun</label>
              <div className="flex gap-2">
                <input
                  name="jumlahAkun"
                  type="number"
                  min={1}
                  max={150}
                  defaultValue={25}
                  required
                  className="w-full text-xs font-black"
                />
                <button className="btn-success shrink-0 text-xs">
                  ⚡ Generate
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* 4. Tabel Semua Akun Peserta Training */}
      <div className="card space-y-3 overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/15 pb-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-black text-black">
              👥 Daftar Semua Akun Peserta Training ({trainingUsers.length} Akun)
            </h2>
            <Badge tone="amber">
              🔒 Terisolasi: Hanya Bisa Masuk Kelompok &amp; Role-nya Sendiri
            </Badge>
          </div>
        </div>

        {trainingUsers.length === 0 ? (
          <Empty>Belum ada akun peserta training.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th className="w-12">No</th>
                <th>Nama Peserta</th>
                <th>Username Login</th>
                <th>Password</th>
                <th>Kelompok Training</th>
                <th>Role di Kelompok</th>
                <th className="w-24 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {trainingUsers.map((u, idx) => (
                <tr key={u.id}>
                  <td className="font-mono text-xs font-black">{idx + 1}</td>
                  <td className="text-sm font-bold text-black">{u.nama}</td>
                  <td>
                    <code className="rounded-lg border border-black bg-[#FEF08A] px-2.5 py-0.5 font-mono text-xs font-black text-black">
                      {u.username}
                    </code>
                  </td>
                  <td>
                    <code className="rounded-lg bg-white px-2 py-0.5 font-mono text-xs font-bold text-black">
                      {decryptPassword(u.passwordEnc)}
                    </code>
                  </td>
                  <td>
                    {u.trainingPeriode ? (
                      <Badge tone="green">{u.trainingPeriode.nama}</Badge>
                    ) : (
                      <Badge tone="amber">⏳ Belum Masuk Kelompok</Badge>
                    )}
                  </td>
                  <td>
                    {u.role === "AUDITOR" ? (
                      <Badge tone="purple">🕵️ AUDITOR (Sisi Kiri)</Badge>
                    ) : (
                      <Badge tone="blue">📝 AUDITEE (Sisi Kanan)</Badge>
                    )}
                  </td>
                  <td className="text-right">
                    <form action={hapusSatuAkunTraining}>
                      <input type="hidden" name="userId" value={u.id} />
                      <button className="btn-danger px-2.5 py-1 text-xs">🗑️ Hapus</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
