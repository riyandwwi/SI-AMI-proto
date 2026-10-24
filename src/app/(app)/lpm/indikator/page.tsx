import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  groupIndikatorByStandar,
  sortPeriodesChronological,
} from "@/lib/periode";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";
import { TabelInstrumenDanRekap } from "@/components/TabelInstrumenDanRekap";
import { ImportIndikatorExcel } from "../ImportIndikatorExcel";
import { FormStandarBertahap, type ExistingStandarInfo } from "../FormStandarBertahap";
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
    include: {
      unit: true,
      indikator: {
        orderBy: [{ urutan: "asc" }, { kode: "asc" }],
        include: { isian: true },
      },
    },
  });

  const periodes = sortPeriodesChronological(rawPeriodes);

  const periodeOptions = periodes.map((p) => ({
    id: p.id,
    nama: p.nama,
    existingCodes: p.indikator.map((i) => `${i.standar.toUpperCase()}|||${i.kode.toUpperCase()}`),
  }));

  // Kumpulkan semua Standar yang sudah dibuat manual di database beserta daftar Pernyataan Standarnya
  const standarMap = new Map<string, Set<string>>();
  const standarCountMap = new Map<string, number>();
  for (const p of periodes) {
    for (const ind of p.indikator) {
      if (!ind.standar) continue;
      if (!standarMap.has(ind.standar)) {
        standarMap.set(ind.standar, new Set<string>());
      }
      if (ind.pernyataanStandar) {
        standarMap.get(ind.standar)!.add(ind.pernyataanStandar);
      }
      standarCountMap.set(ind.standar, (standarCountMap.get(ind.standar) ?? 0) + 1);
    }
  }

  const existingStandarList: ExistingStandarInfo[] = Array.from(standarMap.entries()).map(
    ([standar, psSet]) => ({
      standar,
      pernyataanStandarList: Array.from(psSet),
      nextIkNumber: (standarCountMap.get(standar) ?? 0) + 1,
    })
  );
  const filterStandarList = existingStandarList.map((s) => s.standar);

  return (
    <>
      <PageHeader title="Master Standar, Pernyataan Standar & Indikator SPMI" />
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {periodes.length > 0 && (
        <ImportIndikatorExcel periodes={periodeOptions} defaultPeriodeId="ALL" />
      )}

      {/* Form Bertahap Manual: 1. Standar -> 2. Pernyataan Standar -> 3. Indikator */}
      <FormStandarBertahap
        returnTo="/lpm/indikator"
        periodes={periodes.map((p) => ({ id: p.id, nama: p.nama }))}
        defaultPeriodeId="ALL"
        existingStandarList={existingStandarList}
      />

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

          const rekapRows = p.indikator.map((ind) => ({
            id: ind.id,
            kode: ind.kode,
            standar: ind.standar,
            pernyataanStandar: ind.pernyataanStandar,
            pernyataan: ind.pernyataan,
            buktiDiminta: ind.buktiDiminta,
            isian: ind.isian.find((i) => !p.unitId || i.unitId === p.unitId) ?? ind.isian[0] ?? null,
          }));

          return (
            <div key={p.id} className="space-y-4">
              {/* 2 Tab Tabel (1. Tabel Standar, Pernyataan Standar & Indikator | 2. Tabel Rekap Audit Sesi Sebelum Print) */}
              <TabelInstrumenDanRekap
                periodeId={p.id}
                periodeNama={p.nama}
                indikator={rekapRows}
                defaultTab="instrumen"
              />

              <div className="card space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/15 pb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-black text-black">
                      ✏️ Kelola / Edit Standar &amp; Indikator — {p.nama}
                    </h3>
                    <Badge tone="blue">{p.indikator.length} Indikator</Badge>
                    <Badge tone="purple">{allGroups.length} Standar</Badge>
                  </div>
                </div>

                {visibleGroups.length === 0 ? (
                  <Empty>Belum ada indikator untuk standar ini.</Empty>
                ) : (
                  <div className="space-y-4">
                    {visibleGroups.map((group) => {
                      const lastPs =
                        group.items[group.items.length - 1]?.item.pernyataanStandar ?? "";

                      return (
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
                                      <label>No. {noUrut} — Kode (IK)</label>
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
                                        placeholder="Contoh: Dokumen Kurikulum Program Studi yang memuat CPL"
                                        className="w-full text-xs"
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <label>Isi Pernyataan Standar</label>
                                    <textarea
                                      name="pernyataanStandar"
                                      rows={2}
                                      defaultValue={ind.pernyataanStandar ?? ""}
                                      placeholder="Isi pernyataan standar..."
                                      className="w-full text-xs"
                                    />
                                  </div>

                                  <div className="flex flex-wrap items-end gap-2">
                                    <div className="flex-1 space-y-1">
                                      <label>Indikator Kinerja ({ind.kode})</label>
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
                                      Hapus Indikator #{noUrut} ({ind.kode})
                                    </button>
                                  </form>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Form Cepat: + Tambah Indikator (IK) Lanjutan ke Standar Ini */}
                          <form
                            action={tambahIndikator}
                            className="space-y-2 rounded-xl border border-dashed border-black/30 bg-[#EFE9DB]/60 p-3"
                          >
                            <div className="text-xs font-black text-black">
                              ➕ Tambah Indikator Lanjutan ke &ldquo;{group.standar}&rdquo;
                            </div>
                            <input type="hidden" name="periodeId" value={p.id} />
                            <input type="hidden" name="standar" value={group.standar} />
                            <input type="hidden" name="returnTo" value="/lpm/indikator" />

                            <div className="space-y-1">
                              <label>Isi Pernyataan Standar</label>
                              <textarea
                                name="pernyataanStandar"
                                rows={2}
                                defaultValue={lastPs}
                                placeholder="Isi pernyataan standar..."
                                className="w-full text-xs"
                              />
                            </div>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                              <input
                                name="kode"
                                required
                                defaultValue={`IK${group.items.length + 1}`}
                                placeholder="IK..."
                                className="font-mono text-xs"
                              />
                              <input
                                name="pernyataan"
                                required
                                placeholder="Indikator kinerja..."
                                className="text-xs sm:col-span-2"
                              />
                              <div className="flex gap-1.5">
                                <input
                                  name="buktiDiminta"
                                  placeholder="Dokumen bukti..."
                                  className="w-full text-xs"
                                />
                                <button className="btn shrink-0 text-xs">+ Tambah</button>
                              </div>
                            </div>
                          </form>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
