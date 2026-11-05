import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sortPeriodesChronological } from "@/lib/periode";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";
import { TabelInstrumenDanRekap } from "@/components/TabelInstrumenDanRekap";
import { ImportIndikatorExcel } from "../ImportIndikatorExcel";
import { FormStandarBertahap, type ExistingStandarInfo } from "../FormStandarBertahap";
import { hapusSemuaIndikator, toggleKunciIndikator } from "../actions";

export default async function LpmIndikatorPage({ searchParams }: { searchParams: SP }) {
  await requireUser("LPM");
  const sp = await searchParams;
  const filterPeriodeId = one(sp.periodeId) ?? "ALL";

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
  const visiblePeriodes =
    filterPeriodeId === "ALL"
      ? periodes
      : periodes.filter((p) => p.id === filterPeriodeId);

  const periodeOptions = periodes.map((p) => ({
    id: p.id,
    nama: p.nama,
    existingCodes: p.indikator.map((i) => `${i.standar.toUpperCase()}|||${i.kode.toUpperCase()}`),
  }));

  // Kumpulkan semua Standar yang sudah ada beserta daftar Pernyataan Standarnya
  const standarMap = new Map<string, Set<string>>();
  const standarCountMap = new Map<string, number>();
  for (const p of visiblePeriodes) {
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

  const defaultTargetId =
    filterPeriodeId !== "ALL" && periodes.some((p) => p.id === filterPeriodeId)
      ? filterPeriodeId
      : (periodes[0]?.id ?? "ALL");

  return (
    <>
      <PageHeader title="Master Standar, Pernyataan Standar & Indikator SPMI">
        {periodes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <form action={toggleKunciIndikator}>
              <input type="hidden" name="periodeId" value={filterPeriodeId} />
              <input type="hidden" name="lockAction" value="LOCK" />
              <input
                type="hidden"
                name="returnTo"
                value={
                  filterPeriodeId === "ALL"
                    ? "/lpm/indikator"
                    : `/lpm/indikator?periodeId=${filterPeriodeId}`
                }
              />
              <button className="btn-success text-xs">
                🔒 Kunci &amp; Terbitkan {filterPeriodeId === "ALL" ? "Semua Sesi" : "Sesi Ini"}
              </button>
            </form>
            <form action={toggleKunciIndikator}>
              <input type="hidden" name="periodeId" value={filterPeriodeId} />
              <input type="hidden" name="lockAction" value="UNLOCK" />
              <input
                type="hidden"
                name="returnTo"
                value={
                  filterPeriodeId === "ALL"
                    ? "/lpm/indikator"
                    : `/lpm/indikator?periodeId=${filterPeriodeId}`
                }
              />
              <button className="btn-secondary text-xs">
                🔓 Buka Kunci {filterPeriodeId === "ALL" ? "Semua Sesi" : "Sesi Ini"} (Edit)
              </button>
            </form>
            <form action={hapusSemuaIndikator}>
              <input type="hidden" name="periodeId" value={filterPeriodeId} />
              <input
                type="hidden"
                name="returnTo"
                value={
                  filterPeriodeId === "ALL"
                    ? "/lpm/indikator"
                    : `/lpm/indikator?periodeId=${filterPeriodeId}`
                }
              />
              <button className="btn-danger text-xs">
                🗑️ Hapus Indikator ({filterPeriodeId === "ALL" ? "Semua Sesi" : "Sesi Ini"})
              </button>
            </form>
          </div>
        )}
      </PageHeader>
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {/* Filter Pilih Sesi Prodi (PWK / Bisnis Digital / Aktuaria) */}
      {periodes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black uppercase text-slate-700">Pilih Sesi Prodi:</span>
          <Link
            href="/lpm/indikator"
            className={filterPeriodeId === "ALL" ? "btn text-xs" : "btn-secondary text-xs"}
          >
            Semua Sesi ({periodes.length})
          </Link>
          {periodes.map((p) => (
            <Link
              key={p.id}
              href={`/lpm/indikator?periodeId=${p.id}`}
              className={filterPeriodeId === p.id ? "btn text-xs" : "btn-secondary text-xs"}
            >
              {p.unit?.nama ?? p.nama} — {p.tahun} ({p.semester}) [{p.indikator.length} Indikator]
            </Link>
          ))}
        </div>
      )}

      {/* 1. Card Import Indikator dari Excel (Dengan Dropdown Target Sesi Prodi) */}
      {periodes.length > 0 && (
        <ImportIndikatorExcel
          periodes={periodeOptions}
          defaultPeriodeId={defaultTargetId}
        />
      )}

      {/* 2. Card Input Indikator Manual (Default Ter-Minimize) */}
      <FormStandarBertahap
        returnTo={
          filterPeriodeId === "ALL"
            ? "/lpm/indikator"
            : `/lpm/indikator?periodeId=${filterPeriodeId}`
        }
        periodes={periodes.map((p) => ({ id: p.id, nama: p.nama }))}
        defaultPeriodeId={defaultTargetId}
        existingStandarList={existingStandarList}
      />

      {/* 3. Tabel Standar, Pernyataan Standar & Indikator (Dengan Dropdown Pilih Standar Top-Down) */}
      {visiblePeriodes.length === 0 ? (
        <Empty>Belum ada Sesi AMI.</Empty>
      ) : (
        <div className="space-y-4">
          {visiblePeriodes.map((p) => {
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
              <TabelInstrumenDanRekap
                key={p.id}
                periodeId={p.id}
                periodeNama={p.nama}
                indikator={rekapRows}
                defaultTab="instrumen"
                hideHeaderButtons={true}
                headerRight={
                  <>
                    {p.sourceLocked ? (
                      <Badge tone="green">
                        🔒 Terkunci &amp; Diterbitkan ke Auditor/Auditee
                      </Badge>
                    ) : (
                      <Badge tone="amber">
                        🔓 Belum Dikunci (Draft)
                      </Badge>
                    )}

                    {!p.sourceLocked && (
                      <form action={toggleKunciIndikator}>
                        <input type="hidden" name="periodeId" value={p.id} />
                        <input type="hidden" name="lockAction" value="DRAFT" />
                        <input type="hidden" name="returnTo" value="/lpm/indikator" />
                        <button className="btn-secondary text-xs">
                          💾 Simpan Draft
                        </button>
                      </form>
                    )}

                    <form action={toggleKunciIndikator}>
                      <input type="hidden" name="periodeId" value={p.id} />
                      <input
                        type="hidden"
                        name="lockAction"
                        value={p.sourceLocked ? "UNLOCK" : "LOCK"}
                      />
                      <input type="hidden" name="returnTo" value="/lpm/indikator" />
                      <button
                        className={p.sourceLocked ? "btn-secondary text-xs" : "btn-success text-xs"}
                      >
                        {p.sourceLocked
                          ? "🔓 Buka Kunci (Edit)"
                          : "🔒 Kunci & Terbitkan"}
                      </button>
                    </form>

                    {!p.sourceLocked && p.indikator.length > 0 && (
                      <form action={hapusSemuaIndikator}>
                        <input type="hidden" name="periodeId" value={p.id} />
                        <input type="hidden" name="returnTo" value="/lpm/indikator" />
                        <button className="btn-danger text-xs">
                          🗑️ Hapus Semua ({p.indikator.length})
                        </button>
                      </form>
                    )}
                  </>
                }
              />
            );
          })}
        </div>
      )}
    </>
  );
}
