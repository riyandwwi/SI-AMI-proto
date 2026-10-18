import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActivePeriode } from "@/lib/periode";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";
import { hapusIndikator, tambahIndikator } from "../actions";

export default async function LpmIndikatorPage({ searchParams }: { searchParams: SP }) {
  await requireUser("LPM");
  const sp = await searchParams;
  const periode = await getActivePeriode();

  if (!periode) return <Empty>Belum ada periode aktif. Buat periode terlebih dahulu di menu Sesi &amp; Periode.</Empty>;

  const indikator = await prisma.indikator.findMany({
    where: { periodeId: periode.id },
    orderBy: [{ urutan: "asc" }, { kode: "asc" }],
  });
  const locked = periode.sourceLocked;

  return (
    <>
      <PageHeader
        title="Master Standar & Indikator Mutu SPMI ITBMP"
        desc="Hanya LPM yang berwenang menambah/mengubah indikator sebelum dikunci (Source-Lock)."
      >
        <Badge tone={locked ? "amber" : "green"}>{locked ? "🔒 Source-Locked" : "🔓 Dapat Diedit"}</Badge>
      </PageHeader>
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {/* Form Tambah Indikator */}
      <form action={tambahIndikator} className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">+ Tambah Indikator Standar SPMI</h2>
          {locked && (
            <span className="text-xs font-semibold text-amber-700">
              🔒 Buka Source-Lock di halaman Sesi &amp; Periode untuk menambah/menghapus indikator.
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label>Kode Indikator</label>
            <input name="kode" required disabled={locked} placeholder="STD-PEND-01" className="w-full font-mono" />
          </div>
          <div className="space-y-1">
            <label>Kategori Standar SPMI</label>
            <input name="standar" required disabled={locked} placeholder="Standar Isi Pembelajaran" className="w-full" />
          </div>
          <div className="space-y-1">
            <label>Target Capaian</label>
            <input name="target" required disabled={locked} placeholder="100% Mata Kuliah" className="w-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label>Pernyataan Indikator Mutu</label>
            <textarea
              name="pernyataan"
              rows={2}
              required
              disabled={locked}
              placeholder="Ketersediaan dokumen kurikulum OBE dan RPS lengkap untuk seluruh mata kuliah aktif..."
              className="w-full"
            />
          </div>
          <div className="space-y-1">
            <label>Dokumen Bukti Google Drive yang Diminta dari Auditee</label>
            <textarea
              name="buktiDiminta"
              rows={2}
              disabled={locked}
              placeholder="Folder Google Drive berisi SK Kurikulum, Matriks CPL-MK, dan file RPS seluruh MK."
              className="w-full"
            />
          </div>
        </div>
        <button disabled={locked} className="btn">
          Tambahkan Indikator
        </button>
      </form>

      {/* Tabel Indikator */}
      <div className="card overflow-x-auto">
        {indikator.length === 0 ? (
          <Empty>Belum ada indikator untuk periode ini.</Empty>
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
              {indikator.map((ind) => (
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
                      <button disabled={locked} className="btn-danger text-xs">
                        Hapus
                      </button>
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
