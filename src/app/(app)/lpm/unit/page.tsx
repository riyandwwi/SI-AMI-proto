import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActivePeriode } from "@/lib/periode";
import { Badge, Flash, PageHeader, one, type SP } from "@/components/ui";
import { tambahUnit, toggleUnitDiaudit } from "../actions";

export default async function LpmUnitPage({ searchParams }: { searchParams: SP }) {
  await requireUser("LPM");
  const sp = await searchParams;
  const [periode, units] = await Promise.all([
    getActivePeriode(),
    prisma.unit.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { kode: "asc" },
    }),
  ]);
  const locked = Boolean(periode?.sourceLocked);

  return (
    <>
      <PageHeader
        title="Daftar Unit Kerja & Program Studi (Auditee ITBMP)"
        desc="Memetakan seluruh unit sasaran agar tidak ada program studi atau unit kerja yang terlewat atau terduplikasi."
      >
        <Badge tone={locked ? "amber" : "green"}>{locked ? "🔒 Source-Locked" : "🔓 Dapat Diedit"}</Badge>
      </PageHeader>
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      <form action={tambahUnit} className="card space-y-3">
        <h2 className="text-base font-bold text-slate-900">+ Tambah Unit / Program Studi ITBMP</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <label>Kode Unit</label>
            <input name="kode" required disabled={locked} placeholder="PRODI-TI" className="w-full font-mono" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label>Nama Program Studi / Unit Kerja</label>
            <input name="nama" required disabled={locked} placeholder="Prodi S1 Teknik Informatika" className="w-full" />
          </div>
          <div className="space-y-1">
            <label>Jenis Unit</label>
            <div className="flex gap-2">
              <select name="jenis" disabled={locked} className="w-full">
                <option value="PRODI">Program Studi</option>
                <option value="FAKULTAS">Fakultas</option>
                <option value="UPT">UPT / Lembaga</option>
                <option value="BIRO">Biro / Bagian</option>
              </select>
              <button disabled={locked} className="btn shrink-0">
                Tambah
              </button>
            </div>
          </div>
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama Unit / Program Studi</th>
              <th>Jenis</th>
              <th>Akun Terkait</th>
              <th>Wajib Diaudit</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id}>
                <td>
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold">{u.kode}</code>
                </td>
                <td className="font-semibold text-slate-900">{u.nama}</td>
                <td>
                  <Badge tone="slate">{u.jenis}</Badge>
                </td>
                <td>{u._count.users} akun</td>
                <td>
                  <Badge tone={u.diaudit ? "green" : "slate"}>{u.diaudit ? "Wajib Diaudit" : "Tidak Diaudit"}</Badge>
                </td>
                <td>
                  <form action={toggleUnitDiaudit}>
                    <input type="hidden" name="unitId" value={u.id} />
                    <button disabled={locked} className="btn-secondary text-xs">
                      {u.diaudit ? "Kecualikan" : "Masukkan Cakupan"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
