import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptPassword } from "@/lib/crypto";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";
import { FormBuatKelompokTraining } from "./FormBuatKelompokTraining";
import { ImportTrainingUsers } from "./ImportTrainingUsers";
import {
  generateDummyTrainingAccounts,
  hapusSatuAkunTraining,
  hapusSatuKelompokTraining,
  hapusSemuaSesiDanAkunTraining,
  lepasAkunDariKelompokTraining,
  masukkanAkunKeKelompokTraining,
  sinkronkanIndikatorTraining,
  tambahAkunBaruKeKelompokTraining,
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

      {/* 2. Daftar Card Kelompok Training (Sisi Kiri: Auditor, Sisi Kanan: Auditee) */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-black text-black">
            📂 Daftar Kelompok Sesi Training ({trainingPeriodes.length} Kelompok)
          </h2>
          <Badge tone="purple">
            ⏱️ Tanda Tangan Otomatis Reset 3 Menit (Hemat Server Vercel)
          </Badge>
        </div>

        {trainingPeriodes.length === 0 ? (
          <Empty>
            Belum ada Kelompok Training. Isi Sisi Kiri (Auditor) &amp; Sisi Kanan (Auditee) pada form di atas lalu klik Simpan Kelompok.
          </Empty>
        ) : (
          <div className="space-y-4">
            {trainingPeriodes.map((tp) => {
              const groupAuditors = tp.trainingUsers.filter((u) => u.role === "AUDITOR");
              const groupAuditees = tp.trainingUsers.filter((u) => u.role === "AUDITEE");

              return (
                <div key={tp.id} className="card space-y-4">
                  {/* Header Card Kelompok */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/15 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black text-black">{tp.nama}</h3>
                      <Badge tone="blue">{tp.indikator.length} Indikator LPM</Badge>
                      <Badge tone="purple">🕵️ {groupAuditors.length} Auditor</Badge>
                      <Badge tone="green">📝 {groupAuditees.length} Auditee</Badge>
                    </div>
                    <form action={hapusSatuKelompokTraining}>
                      <input type="hidden" name="periodeId" value={tp.id} />
                      <button className="btn-danger text-xs">🗑️ Hapus Kelompok</button>
                    </form>
                  </div>

                  {/* 2 Kolom: SISI KIRI (AUDITOR) & SISI KANAN (AUDITEE) */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* SISI KIRI: AUDITOR KELOMPOK INI */}
                    <div className="rounded-2xl border-2 border-black bg-[#FAF7EE] p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-black">
                          👈 Sisi Kiri: 🕵️ Auditor ({tp.semester})
                        </span>
                        <Badge tone="purple">{groupAuditors.length} Auditor</Badge>
                      </div>

                      {groupAuditors.length === 0 ? (
                        <p className="text-xs font-semibold text-slate-400">
                          Belum ada Auditor di kelompok ini.
                        </p>
                      ) : (
                        <ul className="space-y-1.5 text-xs">
                          {groupAuditors.map((u) => (
                            <li
                              key={u.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/15 bg-white px-3 py-2"
                            >
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-bold text-black">{u.nama}</span>
                                <Badge tone="purple">AUDITOR</Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <code className="rounded border border-black bg-[#FEF08A] px-2 py-0.5 font-mono font-black text-black">
                                  {u.username}
                                </code>
                                <form action={lepasAkunDariKelompokTraining}>
                                  <input type="hidden" name="userId" value={u.id} />
                                  <button className="btn-secondary px-2 py-0.5 text-[11px]">
                                    Lepas
                                  </button>
                                </form>
                                <form action={hapusSatuAkunTraining}>
                                  <input type="hidden" name="userId" value={u.id} />
                                  <button className="btn-danger px-2 py-0.5 text-[11px]">
                                    Hapus
                                  </button>
                                </form>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Tambah Cepat Akun Baru sebagai Auditor Kelompok Ini */}
                      <form
                        action={tambahAkunBaruKeKelompokTraining}
                        className="grid grid-cols-1 gap-1.5 border-t border-black/10 pt-2.5 sm:grid-cols-2"
                      >
                        <input type="hidden" name="periodeId" value={tp.id} />
                        <input type="hidden" name="role" value="AUDITOR" />
                        <input
                          name="nama"
                          required
                          placeholder="Ketik Nama Auditor baru..."
                          className="bg-white text-xs"
                        />
                        <div className="flex gap-1">
                          <input
                            name="username"
                            placeholder="Username (opsional)"
                            className="w-full bg-white font-mono text-xs"
                          />
                          <button className="btn shrink-0 px-2.5 py-1 text-xs">+ Auditor</button>
                        </div>
                      </form>

                      {/* Atau Masukkan dari Akun Hasil Import yang Belum Punya Kelompok */}
                      {unassignedUsers.length > 0 && (
                        <form action={masukkanAkunKeKelompokTraining} className="flex gap-1.5 pt-1">
                          <input type="hidden" name="periodeId" value={tp.id} />
                          <input type="hidden" name="role" value="AUDITOR" />
                          <select name="userId" required className="w-full bg-white text-xs">
                            {unassignedUsers.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.nama} ({u.username})
                              </option>
                            ))}
                          </select>
                          <button className="btn-secondary shrink-0 px-2.5 py-1 text-xs">
                            + Masukkan Auditor
                          </button>
                        </form>
                      )}
                    </div>

                    {/* SISI KANAN: AUDITEE KELOMPOK INI */}
                    <div className="rounded-2xl border-2 border-black bg-[#FAF7EE] p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-black">
                          👉 Sisi Kanan: 📝 Auditee ({tp.semester})
                        </span>
                        <Badge tone="blue">{groupAuditees.length} Auditee</Badge>
                      </div>

                      {groupAuditees.length === 0 ? (
                        <p className="text-xs font-semibold text-slate-400">
                          Belum ada Auditee di kelompok ini.
                        </p>
                      ) : (
                        <ul className="space-y-1.5 text-xs">
                          {groupAuditees.map((u) => (
                            <li
                              key={u.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/15 bg-white px-3 py-2"
                            >
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-bold text-black">{u.nama}</span>
                                <Badge tone="blue">AUDITEE</Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <code className="rounded border border-black bg-[#FEF08A] px-2 py-0.5 font-mono font-black text-black">
                                  {u.username}
                                </code>
                                <form action={lepasAkunDariKelompokTraining}>
                                  <input type="hidden" name="userId" value={u.id} />
                                  <button className="btn-secondary px-2 py-0.5 text-[11px]">
                                    Lepas
                                  </button>
                                </form>
                                <form action={hapusSatuAkunTraining}>
                                  <input type="hidden" name="userId" value={u.id} />
                                  <button className="btn-danger px-2 py-0.5 text-[11px]">
                                    Hapus
                                  </button>
                                </form>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Tambah Cepat Akun Baru sebagai Auditee Kelompok Ini */}
                      <form
                        action={tambahAkunBaruKeKelompokTraining}
                        className="grid grid-cols-1 gap-1.5 border-t border-black/10 pt-2.5 sm:grid-cols-2"
                      >
                        <input type="hidden" name="periodeId" value={tp.id} />
                        <input type="hidden" name="role" value="AUDITEE" />
                        <input
                          name="nama"
                          required
                          placeholder="Ketik Nama Auditee baru..."
                          className="bg-white text-xs"
                        />
                        <div className="flex gap-1">
                          <input
                            name="username"
                            placeholder="Username (opsional)"
                            className="w-full bg-white font-mono text-xs"
                          />
                          <button className="btn shrink-0 px-2.5 py-1 text-xs">+ Auditee</button>
                        </div>
                      </form>

                      {/* Atau Masukkan dari Akun Hasil Import yang Belum Punya Kelompok */}
                      {unassignedUsers.length > 0 && (
                        <form action={masukkanAkunKeKelompokTraining} className="flex gap-1.5 pt-1">
                          <input type="hidden" name="periodeId" value={tp.id} />
                          <input type="hidden" name="role" value="AUDITEE" />
                          <select name="userId" required className="w-full bg-white text-xs">
                            {unassignedUsers.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.nama} ({u.username})
                              </option>
                            ))}
                          </select>
                          <button className="btn-secondary shrink-0 px-2.5 py-1 text-xs">
                            + Masukkan Auditee
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
