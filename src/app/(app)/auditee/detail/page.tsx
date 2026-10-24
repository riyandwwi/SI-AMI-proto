import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sortPeriodesChronological } from "@/lib/periode";
import { Badge, Empty, PageHeader, one, type SP } from "@/components/ui";
import { TabelInstrumenDanRekap } from "@/components/TabelInstrumenDanRekap";
import type { AuditeeIndikatorItem } from "../AuditeeClient";

export default async function AuditeeDetailIndikatorPage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser("AUDITEE");
  const sp = await searchParams;
  const arsipId = one(sp.arsipId);
  const tabParam = one(sp.tab);

  if (!user.unitId || !user.unit) {
    return <Empty>Akun Auditee belum dihubungkan ke Program Studi.</Empty>;
  }

  const rawPeriodes = await prisma.periode.findMany({
    where: { unitId: user.unitId },
  });

  if (rawPeriodes.length === 0) {
    return <Empty>Belum ada Sesi AMI untuk Program Studi {user.unit.nama}.</Empty>;
  }

  const sortedPeriodes = sortPeriodesChronological(rawPeriodes);
  const activePeriodes = sortedPeriodes.filter((p) => p.aktif);
  const latestPeriode =
    activePeriodes.length > 0
      ? activePeriodes[activePeriodes.length - 1]
      : sortedPeriodes[sortedPeriodes.length - 1];

  const olderPeriodes = sortedPeriodes.filter((p) => p.id !== latestPeriode.id);
  const viewingOlderPeriode = arsipId
    ? olderPeriodes.find((p) => p.id === arsipId) ?? null
    : null;

  const periode = viewingOlderPeriode ?? latestPeriode;
  const isReadOnlyArchive = Boolean(viewingOlderPeriode);

  const [indikator, isianList] = await Promise.all([
    prisma.indikator.findMany({
      where: { periodeId: periode.id },
      orderBy: [{ urutan: "asc" }, { kode: "asc" }],
    }),
    prisma.isian.findMany({
      where: { unitId: user.unitId, indikator: { periodeId: periode.id } },
    }),
  ]);

  const isianByInd = new Map(isianList.map((i) => [i.indikatorId, i]));

  const clientItems: AuditeeIndikatorItem[] = indikator.map((ind) => {
    const isian = isianByInd.get(ind.id);
    return {
      id: ind.id,
      kode: ind.kode,
      standar: ind.standar,
      pernyataanStandar: ind.pernyataanStandar,
      pernyataan: ind.pernyataan,
      target: ind.target,
      buktiDiminta: ind.buktiDiminta,
      isian: isian
        ? {
            id: isian.id,
            klaim: isian.klaim,
            linkDrive: isian.linkDrive,
            diisiOleh: isian.diisiOleh,
            statusDokumen: isian.statusDokumen,
            catatanDokumen: isian.catatanDokumen,
            klasifikasi: isian.klasifikasi,
            catatanLapangan: isian.catatanLapangan,
            rekomendasi: isian.rekomendasi,
            diperiksaOleh: isian.diperiksaOleh,
            terverifikasiAuditor: isian.terverifikasiAuditor,
            terverifikasiLapangan: isian.terverifikasiLapangan,
            rtlRencana: isian.rtlRencana,
            rtlLinkBukti: isian.rtlLinkBukti,
            rtlStatus: isian.rtlStatus,
            rtlCatatanAuditor: isian.rtlCatatanAuditor,
          }
        : null,
    };
  });

  const backHref = isReadOnlyArchive ? `/auditee?arsipId=${periode.id}` : "/auditee";

  return (
    <>
      <PageHeader
        title={`📑 Detail Indikator & Rekap — Prodi ${user.unit.nama} (${periode.tahun} ${periode.semester})`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Link href={backHref} className="btn text-xs">
            ← Kembali ke Pengisian Indikator
          </Link>
          <a
            href={`/api/rekap-excel?periodeId=${periode.id}&print=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs"
          >
            🖨️ Print Rekap
          </a>
          <a
            href={`/api/rekap-excel?periodeId=${periode.id}`}
            className="btn-secondary text-xs"
          >
            📥 Download Excel
          </a>
        </div>
      </PageHeader>

      {olderPeriodes.length > 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-2 py-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-black uppercase text-black">Pilih Sesi:</span>
            <Link
              href="/auditee/detail"
              className={!isReadOnlyArchive ? "btn text-xs" : "btn-secondary text-xs"}
            >
              🟢 Sesi Aktif: {latestPeriode.tahun} ({latestPeriode.semester})
            </Link>
            {olderPeriodes.map((old) => (
              <Link
                key={old.id}
                href={`/auditee/detail?arsipId=${old.id}`}
                className={
                  periode.id === old.id ? "btn-purple text-xs" : "btn-secondary text-xs"
                }
              >
                📜 {old.tahun} ({old.semester})
              </Link>
            ))}
          </div>
          <Badge tone="blue">{clientItems.length} Total Indikator</Badge>
        </div>
      )}

      {!periode.sourceLocked ? (
        <Empty>
          ⏳ Instrumen &amp; Indikator sedang disusun atau diedit oleh LPM. Indikator akan otomatis muncul setelah dikunci oleh LPM.
        </Empty>
      ) : clientItems.length === 0 ? (
        <Empty>Belum ada indikator pada sesi ini.</Empty>
      ) : (
        <TabelInstrumenDanRekap
          periodeId={periode.id}
          periodeNama={periode.nama}
          indikator={clientItems}
          defaultTab={tabParam === "rekap" ? "rekap" : "instrumen"}
        />
      )}
    </>
  );
}
