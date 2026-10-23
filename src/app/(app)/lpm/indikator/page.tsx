import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";
import { ImportIndikatorExcel } from "../ImportIndikatorExcel";
import { editIndikator, hapusIndikator, tambahIndikator } from "../actions";

export default async function LpmIndikatorPage({ searchParams }: { searchParams: SP }) {
  await requireUser("LPM");
  const sp = await searchParams;
  const periodes = await prisma.periode.findMany({
    include: { unit: true, indikator: { orderBy: [{ urutan: "asc" }, { kode: "asc" }] } },
    orderBy: { createdAt: "desc" },
  });

  const periodeOptions = periodes.map((p) => ({
    id: p.id,
    nama: p.nama,
    existingCodes: p.indikator.map((i) => i.kode),
  }));

  return (
    <>
      <PageHeader title="Master Indikator SPMI" />
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {periodes.length > 0 && <ImportIndikatorExcel periodes={periodeOptions} defaultPeriodeId="ALL" />}

      <form action={tambahIndikator} className="card space-y-3">
        <h2 className="border-b border-black/15 pb-2 text-base font-black text-black">
          + Tambah Indikator
        </h2>
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
            <label>Dokumen Bukti</label>
            <input
              name="buktiDiminta"
              placeholder="Contoh: SK Kurikulum, RPS..."
              className="w-full"
            />
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
            <div className="flex items-center gap-2 border-b border-black/15 pb-2">
              <h3 className="text-base font-black text-black">{p.nama}</h3>
              <Badge tone="blue">{p.indikator.length} Indikator</Badge>
            </div>
            {p.indikator.length === 0 ? (
              <Empty>Belum ada indikator.</Empty>
            ) : (
              <div className="space-y-2.5">
                {p.indikator.map((ind) => (
                  <div
                    key={ind.id}
                    className="rounded-2xl border border-black/15 bg-[#FAF7EE] p-3.5 space-y-2.5"
                  >
                    <form action={editIndikator} className="space-y-2">
                      <input type="hidden" name="indikatorId" value={ind.id} />
                      <input type="hidden" name="returnTo" value="/lpm/indikator" />
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                        <div className="space-y-1">
                          <label>Kode</label>
                          <input
                            name="kode"
                            required
                            defaultValue={ind.kode}
                            className="w-full font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label>Standar</label>
                          <input
                            name="standar"
                            required
                            defaultValue={ind.standar}
                            className="w-full text-xs"
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <label>Dokumen Bukti</label>
                          <input
                            name="buktiDiminta"
                            defaultValue={ind.buktiDiminta ?? ""}
                            placeholder="Contoh: SK Kurikulum, RPS..."
                            className="w-full text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-end gap-2">
                        <div className="flex-1 space-y-1">
                          <label>Pernyataan Indikator</label>
                          <textarea
                            name="pernyataan"
                            rows={2}
                            required
                            defaultValue={ind.pernyataan}
                            className="w-full text-xs"
                          />
                        </div>
                        <button type="submit" className="btn-success shrink-0 text-xs">
                          💾 Simpan Edit
                        </button>
                      </div>
                    </form>

                    <div className="flex justify-end border-t border-black/10 pt-2">
                      <form action={hapusIndikator}>
                        <input type="hidden" name="indikatorId" value={ind.id} />
                        <input type="hidden" name="returnTo" value="/lpm/indikator" />
                        <button className="btn-danger px-2.5 py-1 text-xs">Hapus Indikator</button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </>
  );
}
