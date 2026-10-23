import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";
import { hapusIndikator, tambahIndikator } from "../actions";

export default async function LpmIndikatorPage({ searchParams }: { searchParams: SP }) {
  await requireUser("LPM");
  const sp = await searchParams;
  const periodes = await prisma.periode.findMany({
    include: { unit: true, indikator: { orderBy: [{ urutan: "asc" }, { kode: "asc" }] } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader title="Master Indikator SPMI" />
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      <form action={tambahIndikator} className="card space-y-3">
        <h2 className="border-b-2 border-black pb-2 text-base font-black text-black">+ Tambah Indikator</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <label>Sesi AMI</label>
            <select name="periodeId" defaultValue="ALL" className="w-full">
              <option value="ALL">Semua Sesi AMI</option>
              {periodes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label>Kode</label>
            <input name="kode" required placeholder="STD-PEND-04" className="w-full font-mono" />
          </div>
          <div className="space-y-1">
            <label>Standar</label>
            <input name="standar" required placeholder="Standar Isi..." className="w-full" />
          </div>
          <div className="space-y-1">
            <label>Target</label>
            <input name="target" required placeholder="100%" className="w-full" />
          </div>
        </div>
        <div className="flex gap-2">
          <input
            name="pernyataan"
            required
            placeholder="Pernyataan indikator..."
            className="w-full"
          />
          <button className="btn shrink-0">+ Tambah</button>
        </div>
      </form>

      {periodes.length === 0 ? (
        <Empty>Belum ada Sesi AMI.</Empty>
      ) : (
        periodes.map((p) => (
          <div key={p.id} className="card space-y-3 overflow-x-auto">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-black">{p.nama}</h3>
              <Badge tone="blue">{p.indikator.length} Indikator</Badge>
            </div>
            {p.indikator.length === 0 ? (
              <Empty>Belum ada indikator.</Empty>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Standar</th>
                    <th>Pernyataan Indikator</th>
                    <th>Target</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {p.indikator.map((ind) => (
                    <tr key={ind.id}>
                      <td>
                        <code className="rounded-xl border-2 border-black bg-[#BAE6FD] px-2.5 py-0.5 text-xs font-black text-black shadow-[1.5px_1.5px_0px_#000]">
                          {ind.kode}
                        </code>
                      </td>
                      <td className="font-bold text-black">{ind.standar}</td>
                      <td className="text-slate-800">{ind.pernyataan}</td>
                      <td className="font-bold text-black">{ind.target}</td>
                      <td>
                        <form action={hapusIndikator}>
                          <input type="hidden" name="indikatorId" value={ind.id} />
                          <button className="btn-danger text-xs">Hapus</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))
      )}
    </>
  );
}
