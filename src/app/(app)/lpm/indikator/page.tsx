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
      <PageHeader
        title="Master Standar & Indikator Mutu SPMI ITBMP"
        desc="Kelola daftar indikator standar SPMI yang akan diisi oleh Auditee dan diperiksa oleh Auditor."
      />
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {/* Form Tambah Indikator */}
      <form action={tambahIndikator} className="card space-y-3">
        <h2 className="text-base font-bold text-slate-900">+ Tambah Indikator Standar SPMI</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <label>Terapkan ke Sesi AMI</label>
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
            <label>Kode Indikator</label>
            <input name="kode" required placeholder="STD-PEND-04" className="w-full font-mono" />
          </div>
          <div className="space-y-1">
            <label>Kategori Standar SPMI</label>
            <input name="standar" required placeholder="Standar Isi Pembelajaran" className="w-full" />
          </div>
          <div className="space-y-1">
            <label>Target Capaian</label>
            <input name="target" required placeholder="100% Mata Kuliah" className="w-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label>Pernyataan Indikator Mutu</label>
            <textarea
              name="pernyataan"
              rows={2}
              required
              placeholder="Ketersediaan dokumen kurikulum OBE dan RPS lengkap untuk seluruh mata kuliah aktif..."
              className="w-full"
            />
          </div>
          <div className="space-y-1">
            <label>Dokumen Bukti Google Drive yang Diminta dari Auditee</label>
            <textarea
              name="buktiDiminta"
              rows={2}
              placeholder="Folder Google Drive berisi SK Kurikulum, Matriks CPL-MK, dan file RPS seluruh MK."
              className="w-full"
            />
          </div>
        </div>
        <button className="btn">Tambahkan Indikator</button>
      </form>

      {/* Daftar Indikator per Sesi AMI */}
      {periodes.length === 0 ? (
        <Empty>Belum ada Sesi AMI. Buat Sesi AMI terlebih dahulu di menu Sesi AMI.</Empty>
      ) : (
        periodes.map((p) => (
          <div key={p.id} className="card space-y-3 overflow-x-auto">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{p.nama}</h3>
                <Badge tone="blue">{p.indikator.length} Indikator</Badge>
              </div>
            </div>
            {p.indikator.length === 0 ? (
              <Empty>Belum ada indikator untuk sesi ini.</Empty>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Standar SPMI</th>
                    <th>Pernyataan Indikator &amp; Bukti Google Drive yang Diminta</th>
                    <th>Target</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {p.indikator.map((ind) => (
                    <tr key={ind.id}>
                      <td>
                        <code className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-bold text-blue-700">{ind.kode}</code>
                      </td>
                      <td className="font-semibold text-slate-900">{ind.standar}</td>
                      <td>
                        <div className="text-slate-800">{ind.pernyataan}</div>
                        {ind.buktiDiminta && (
                          <div className="mt-1 text-xs text-slate-500">
                            <strong>Bukti Drive:</strong> {ind.buktiDiminta}
                          </div>
                        )}
                      </td>
                      <td className="font-semibold text-slate-800">{ind.target}</td>
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
