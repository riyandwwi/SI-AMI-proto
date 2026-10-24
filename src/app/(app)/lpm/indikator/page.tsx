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

  // Kumpulkan semua Standar yang sudah ada beserta daftar Pernyataan Standarnya
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

  return (
    <>
      <PageHeader title="Master Standar, Pernyataan Standar & Indikator SPMI">
        {periodes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <form action={toggleKunciIndikator}>
              <input type="hidden" name="periodeId" value="ALL" />
              <input type="hidden" name="lockAction" value="LOCK" />
              <input type="hidden" name="returnTo" value="/lpm/indikator" />
              <button className="btn-success text-xs">
                🔒 Kunci &amp; Terbitkan Semua Sesi ke Auditor/Auditee
              </button>
            </form>
            <form action={toggleKunciIndikator}>
              <input type="hidden" name="periodeId" value="ALL" />
              <input type="hidden" name="lockAction" value="UNLOCK" />
              <input type="hidden" name="returnTo" value="/lpm/indikator" />
              <button className="btn-secondary text-xs">
                🔓 Buka Kunci Semua Sesi (Edit)
              </button>
            </form>
            <form action={hapusSemuaIndikator}>
              <input type="hidden" name="periodeId" value="ALL" />
              <input type="hidden" name="returnTo" value="/lpm/indikator" />
              <button className="btn-danger text-xs">
                🗑️ Hapus Semua Indikator (Semua Sesi)
              </button>
            </form>
          </div>
        )}
      </PageHeader>
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {/* 1. Card Import Indikator dari Excel (1 Baris Minimalis) */}
      {periodes.length > 0 && (
        <ImportIndikatorExcel periodes={periodeOptions} defaultPeriodeId="ALL" />
      )}

      {/* 2. Card Input Indikator Manual (Default Ter-Minimize) */}
      <FormStandarBertahap
        returnTo="/lpm/indikator"
        periodes={periodes.map((p) => ({ id: p.id, nama: p.nama }))}
        defaultPeriodeId="ALL"
        existingStandarList={existingStandarList}
      />

      {/* 3. Tabel Standar, Pernyataan Standar & Indikator (Dengan Dropdown Pilih Standar Top-Down) */}
      {periodes.length === 0 ? (
        <Empty>Belum ada Sesi AMI.</Empty>
      ) : (
        <div className="space-y-4">
          {periodes.map((p) => {
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
