import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptPassword } from "@/lib/crypto";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";
import { ImportTrainingUsers } from "./ImportTrainingUsers";
import {
  buatKelompokTraining,
  generateDummyTrainingAccounts,
  hapusSatuAkunTraining,
  hapusSatuKelompokTraining,
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

  return (
    <>
      <PageHeader title="🎓 Sesi Training & Akun Pelatihan AMI">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin" className="btn-secondary text-xs">
            ← Kelola Akun Utama
          </Link>
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

      {/* 1. Buat Kelompok Training + Generate Cepat 25 Akun Dummy */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Form Buat Kelompok Training */}
        <form action={buatKelompokTraining} className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/15 pb-2">
            <h2 className="text-sm font-black text-black">
              1️⃣ Buat Kelompok Sesi Training
            </h2>
            <Badge tone="green">
              Otomatis Salin {masterIndikatorSet.size} Indikator LPM
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-2">
              <label>Nama Pelatihan</label>
              <input
                name="namaEvent"
                defaultValue="Pelatihan AMI"
                required
                placeholder="Pelatihan AMI"
                className="w-full text-xs"
              />
            </div>
            <div className="space-y-1">
              <label>Jumlah Kelompok</label>
              <div className="flex gap-2">
                <input
                  name="jumlahKelompok"
                  type="number"
                  min={1}
                  max={25}
                  defaultValue={5}
                  required
                  className="w-full text-xs font-black"
                />
                <button className="btn shrink-0 text-xs">+ Buat</button>
              </div>
            </div>
          </div>
        </form>

        {/* Form Generate Cepat 25-100 Akun Dummy */}
        <form action={generateDummyTrainingAccounts} className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/15 pb-2">
            <h2 className="text-sm font-black text-black">
              2️⃣ Generate Instan Akun Dummy (25 s/d 100+ Akun)
            </h2>
            <Badge tone="amber">🔑 Password: 123</Badge>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
            <div className="space-y-1 sm:col-span-2">
              <label>Jumlah Akun yang Dibuat</label>
              <div className="flex gap-2">
                <input
                  name="jumlahAkun"
                  type="number"
                  min={1}
                  max={150}
                  defaultValue={50}
                  required
                  className="w-full text-xs font-black"
                />
                <button className="btn-success shrink-0 text-xs">
                  ⚡ Generate Akun Dummy
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* 2. Import Akun Peserta Training via Excel (.xlsx) atau Copy-Paste */}
      <ImportTrainingUsers />

      {/* 3. Daftar Kelompok Sesi Training */}
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/15 pb-2.5">
          <h2 className="text-sm font-black text-black">
            📂 Daftar Kelompok Sesi Training ({trainingPeriodes.length} Kelompok)
          </h2>
          <Badge tone="purple">
            ⏱️ Tanda Tangan Otomatis Reset 3 Menit (Hemat Server Vercel)
          </Badge>
        </div>

        {trainingPeriodes.length === 0 ? (
          <Empty>Belum ada Kelompok Sesi Training. Silakan buat kelompok di atas.</Empty>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {trainingPeriodes.map((tp) => (
              <div
                key={tp.id}
                className="rounded-2xl border-2 border-black bg-[#FAF7EE] p-3.5 space-y-2.5 shadow-[3px_3px_0px_#000]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-black text-black">{tp.nama}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge tone="blue">{tp.indikator.length} Indikator</Badge>
                      <Badge tone="green">{tp.trainingUsers.length} Peserta Masuk</Badge>
                    </div>
                  </div>
                  <form action={hapusSatuKelompokTraining}>
                    <input type="hidden" name="periodeId" value={tp.id} />
                    <button className="btn-danger px-2.5 py-1 text-xs">🗑️</button>
                  </form>
                </div>

                {tp.trainingUsers.length > 0 ? (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {tp.trainingUsers.map((u) => (
                      <Badge key={u.id} tone="purple">
                        👤 {u.nama} ({u.username})
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs font-semibold text-slate-500">
                    Belum ada peserta yang memilih kelompok ini.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Daftar Akun Peserta Training (Hanya Bisa Akses Sesi Training) */}
      <div className="card space-y-3 overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/15 pb-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-black text-black">
              👥 Daftar Akun Peserta Training ({trainingUsers.length} Akun)
            </h2>
            <Badge tone="amber">
              🔒 Terisolasi: Hanya Bisa Masuk Sesi Training &amp; Otomatis Hilang Saat Training Dihapus
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
                <th>Kelompok yang Dipilih</th>
                <th>Hak Akses di Kelompok</th>
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
                      <Badge tone="amber">⏳ Belum Pilih Kelompok</Badge>
                    )}
                  </td>
                  <td>
                    <Badge tone="purple">📝 Auditee + 🕵️ Auditor</Badge>
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
