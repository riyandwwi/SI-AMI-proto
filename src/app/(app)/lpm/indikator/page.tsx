import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_STANDAR_SPMI,
  groupIndikatorByStandar,
  sortPeriodesChronological,
} from "@/lib/periode";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";
import { ImportIndikatorExcel } from "../ImportIndikatorExcel";
import {
  editIndikator,
  hapusIndikator,
  hapusStandarEmergency,
  tambahIndikator,
  ubahNamaStandar,
} from "../actions";

export default async function LpmIndikatorPage({ searchParams }: { searchParams: SP }) {
  await requireUser("LPM");
  const sp = await searchParams;
  const standarFilter = one(sp.standar) ?? "ALL";

  const rawPeriodes = await prisma.periode.findMany({
    include: { unit: true, indikator: { orderBy: [{ urutan: "asc" }, { kode: "asc" }] } },
  });

  const periodes = sortPeriodesChronological(rawPeriodes);

  const periodeOptions = periodes.map((p) => ({
    id: p.id,
    nama: p.nama,
    existingCodes: p.indikator.map((i) => i.kode),
  }));

  // Kumpulkan semua nama Standar unik (bawaan + yang sudah ada di database)
  const allStandarSet = new Set<string>(DEFAULT_STANDAR_SPMI);
  const existingStandarInDb = new Set<string>();
  for (const p of periodes) {
    for (const ind of p.indikator) {
      if (ind.standar) {
        allStandarSet.add(ind.standar);
        existingStandarInDb.add(ind.standar);
      }
    }
  }
  const allStandarList = Array.from(allStandarSet);
  const filterStandarList = Array.from(existingStandarInDb);

  return (
    <>
      <PageHeader title="Master Standar & Indikator SPMI" />
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {periodes.length > 0 && (
        <ImportIndikatorExcel periodes={periodeOptions} defaultPeriodeId="ALL" />
      )}

      {/* Form Tambah Indikator (Pilih Standar yang Ada atau Buat Standar Baru) */}
      <form action={tambahIndikator} className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/15 pb-2">
          <h2 className="text-base font-black text-black">
            + Tambah Standar / Indikator Baru
          </h2>
          <Badge tone="blue">1 Standar Bisa Memiliki Banyak Indikator</Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <label>Sesi AMI</label>
            <select name="periodeId" defaultValue="ALL" className="w-full text-xs">
              <option value="ALL">Semua Sesi AMI</option>
              {periodes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label>Pilih Standar SPMI</label>
            <select
              name="standar"
              defaultValue={allStandarList[0] ?? "Standar Isi Pembelajaran"}
              className="w-full text-xs font-bold"
            >
              {allStandarList.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label>Atau Ketik Standar Baru (Emergency)</label>
            <input
              name="standarBaru"
              placeholder="Kosongkan jika pilih di samping..."
              className="w-full text-xs"
            />
          </div>

          <div className="space-y-1">
            <label>Kode Indikator</label>
            <input
              name="kode"
              required
              placeholder="STD-ISI-01"
              className="w-full font-mono text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-2">
            <label>Pernyataan Indikator</label>
            <input
              name="pernyataan"
              required
              placeholder="Pernyataan indikator..."
              className="w-full text-xs"
            />
          </div>
          <div className="space-y-1">
            <label>Dokumen Bukti</label>
            <div className="flex gap-2">
              <input
                name="buktiDiminta"
                placeholder="Contoh: SK Kurikulum, RPS..."
                className="w-full text-xs"
              />
              <button className="btn shrink-0 text-xs">+ Tambah</button>
            </div>
          </div>
        </div>
      </form>

      {/* Filter / Sort Indikator per Standar */}
      {filterStandarList.length > 0 && (
        <div className="card flex flex-wrap items-center gap-2 py-3 text-xs">
          <span className="font-black uppercase text-black">Filter / Sort per Standar:</span>
          <Link
            href="/lpm/indikator?standar=ALL"
            className={standarFilter === "ALL" ? "btn text-xs" : "btn-secondary text-xs"}
          >
            Semua Standar ({filterStandarList.length})
          </Link>
          {filterStandarList.map((st) => (
            <Link
              key={st}
              href={`/lpm/indikator?standar=${encodeURIComponent(st)}`}
              className={standarFilter === st ? "btn text-xs" : "btn-secondary text-xs"}
            >
              📂 {st}
            </Link>
          ))}
        </div>
      )}

      {periodes.length === 0 ? (
        <Empty>Belum ada Sesi AMI.</Empty>
      ) : (
        periodes.map((p) => {
          const allGroups = groupIndikatorByStandar(p.indikator);
          const visibleGroups =
            standarFilter === "ALL"
              ? allGroups
              : allGroups.filter((g) => g.standar === standarFilter);

          return (
            <div key={p.id} className="card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/15 pb-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-black text-black">{p.nama}</h3>
                  <Badge tone="blue">{p.indikator.length} Indikator</Badge>
                  <Badge tone="purple">{allGroups.length} Standar</Badge>
                </div>
              </div>

              {visibleGroups.length === 0 ? (
                <Empty>Belum ada indikator untuk standar ini.</Empty>
              ) : (
                <div className="space-y-4">
                  {visibleGroups.map((group) => (
                    <div
                      key={group.standar}
                      className="rounded-2xl border-2 border-black bg-[#FAF7EE] p-4 space-y-3 shadow-[3px_3px_0px_#000]"
                    >
                      {/* Header Kelompok Standar + Ubah Nama Standar + Hapus Standar (Emergency) */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/15 pb-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-xl border border-black bg-[#FEF08A] px-3 py-1 text-xs font-black text-black">
                            📂 {group.standar}
                          </span>
                          <Badge tone="blue">
                            Indikator {group.startIndex} – {group.endIndex} ({group.items.length} Butir)
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Emergency: Ubah Nama Standar */}
                          <details className="relative">
                            <summary className="btn-secondary text-xs list-none">
                              ✏️ Ubah Nama Standar
                            </summary>
                            <form
                              action={ubahNamaStandar}
                              className="mt-2 flex items-center gap-1.5 rounded-xl border border-black bg-white p-2"
                            >
                              <input type="hidden" name="periodeId" value={p.id} />
                              <input type="hidden" name="standarLama" value={group.standar} />
                              <input type="hidden" name="returnTo" value="/lpm/indikator" />
                              <input
                                name="standarBaru"
                                required
                                defaultValue={group.standar}
                                className="w-48 text-xs"
                              />
                              <button className="btn-success text-xs">Simpan</button>
                            </form>
                          </details>

                          {/* Emergency: Hapus 1 Standar Sekaligus */}
                          <form action={hapusStandarEmergency}>
                            <input type="hidden" name="periodeId" value={p.id} />
                            <input type="hidden" name="standar" value={group.standar} />
                            <input type="hidden" name="returnTo" value="/lpm/indikator" />
                            <button className="btn-danger text-xs">
                              🗑️ Hapus Standar Ini
                            </button>
                          </form>
                        </div>
                      </div>

                      {/* Daftar Indikator di dalam Standar Ini */}
                      <div className="space-y-2.5">
                        {group.items.map(({ item: ind, noUrut }) => (
                          <div
                            key={ind.id}
                            className="rounded-xl border border-black/15 bg-white p-3 space-y-2"
                          >
                            <form action={editIndikator} className="space-y-2">
                              <input type="hidden" name="indikatorId" value={ind.id} />
                              <input type="hidden" name="returnTo" value="/lpm/indikator" />
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                                <div className="space-y-1">
                                  <label>No. {noUrut} — Kode</label>
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
                                  <label>Pernyataan Indikator #{noUrut}</label>
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

                            <div className="flex justify-end border-t border-black/10 pt-1.5">
                              <form action={hapusIndikator}>
                                <input type="hidden" name="indikatorId" value={ind.id} />
                                <input type="hidden" name="returnTo" value="/lpm/indikator" />
                                <button className="btn-danger px-2.5 py-1 text-xs">
                                  Hapus Indikator #{noUrut}
                                </button>
                              </form>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Form Cepat: + Tambah Indikator Langsung ke Standar Ini */}
                      <form
                        action={tambahIndikator}
                        className="grid grid-cols-1 gap-2 rounded-xl border border-dashed border-black/30 bg-[#EFE9DB]/60 p-2.5 sm:grid-cols-4"
                      >
                        <input type="hidden" name="periodeId" value={p.id} />
                        <input type="hidden" name="standar" value={group.standar} />
                        <input type="hidden" name="returnTo" value="/lpm/indikator" />
                        <input
                          name="kode"
                          required
                          placeholder="+ Kode baru..."
                          className="font-mono text-xs"
                        />
                        <input
                          name="pernyataan"
                          required
                          placeholder={`+ Tambah indikator ke ${group.standar}...`}
                          className="text-xs sm:col-span-2"
                        />
                        <div className="flex gap-1.5">
                          <input
                            name="buktiDiminta"
                            placeholder="Dokumen bukti..."
                            className="w-full text-xs"
                          />
                          <button className="btn shrink-0 px-3 py-1 text-xs">+ Tambah</button>
                        </div>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </>
  );
}
