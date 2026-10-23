import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";
import AuditeeClient, { type AuditeeIndikatorItem } from "./AuditeeClient";

export default async function AuditeePage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser("AUDITEE");
  const sp = await searchParams;

  if (!user.unitId || !user.unit) {
    return <Empty>Akun Auditee belum dihubungkan ke Program Studi.</Empty>;
  }

  const periode =
    (await prisma.periode.findFirst({
      where: { unitId: user.unitId },
      orderBy: [{ aktif: "desc" }, { createdAt: "desc" }],
    })) ??
    (await prisma.periode.findFirst({
      orderBy: [{ aktif: "desc" }, { createdAt: "desc" }],
    }));

  if (!periode) {
    return <Empty>Belum ada Sesi AMI untuk Program Studi {user.unit.nama}.</Empty>;
  }

  const [indikator, isianList, prodiAuditors] = await Promise.all([
    prisma.indikator.findMany({
      where: { periodeId: periode.id },
      orderBy: [{ urutan: "asc" }, { kode: "asc" }],
    }),
    prisma.isian.findMany({
      where: { unitId: user.unitId, indikator: { periodeId: periode.id } },
    }),
    prisma.user.findMany({
      where: { role: "AUDITOR", unitId: user.unitId, aktif: true },
      orderBy: { nama: "asc" },
    }),
  ]);

  const isianByInd = new Map(isianList.map((i) => [i.indikatorId, i]));
  const buka = periode.aktif;

  const clientItems: AuditeeIndikatorItem[] = indikator.map((ind) => {
    const isian = isianByInd.get(ind.id);
    return {
      id: ind.id,
      kode: ind.kode,
      standar: ind.standar,
      pernyataan: ind.pernyataan,
      target: ind.target,
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
            rtlRencana: isian.rtlRencana,
            rtlLinkBukti: isian.rtlLinkBukti,
            rtlStatus: isian.rtlStatus,
            rtlCatatanAuditor: isian.rtlCatatanAuditor,
          }
        : null,
    };
  });

  return (
    <>
      <PageHeader title={`Prodi ${user.unit.nama} — ${periode.tahun} (${periode.semester})`}>
        <div className="flex flex-wrap items-center gap-2">
          {prodiAuditors.length > 0 && (
            <Badge tone="purple">
              🕵️ Auditor: {prodiAuditors.map((a) => a.nama).join(", ")}
            </Badge>
          )}
          <Badge tone={buka ? "green" : "amber"}>
            {buka ? "🟢 Sesi Terbuka" : "🔒 Sesi Terkunci"}
          </Badge>
        </div>
      </PageHeader>
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {clientItems.length === 0 ? (
        <Empty>Belum ada indikator.</Empty>
      ) : (
        <AuditeeClient
          periodeId={periode.id}
          unitId={user.unitId}
          buka={buka}
          indikator={clientItems}
        />
      )}
    </>
  );
}
