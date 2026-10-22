import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";
import AuditeeClient, { type AuditeeIndikatorItem } from "./AuditeeClient";

export default async function AuditeePage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser("AUDITEE");
  const sp = await searchParams;

  if (!user.unitId || !user.unit) {
    return <Empty>Akun Auditee Anda belum dihubungkan ke Program Studi. Hubungi Super Admin.</Empty>;
  }

  // Cari Sesi AMI untuk Prodi Auditee ini (atau sesi umum terbaru)
  const periode =
    (await prisma.periode.findFirst({
      where: { unitId: user.unitId },
      orderBy: [{ aktif: "desc" }, { createdAt: "desc" }],
    })) ??
    (await prisma.periode.findFirst({
      orderBy: [{ aktif: "desc" }, { createdAt: "desc" }],
    }));

  if (!periode) {
    return <Empty>Belum ada Sesi AMI yang dibuat oleh LPM untuk Program Studi {user.unit.nama}.</Empty>;
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
      buktiDiminta: ind.buktiDiminta,
      isian: isian
        ? {
            id: isian.id,
            klaim: isian.klaim,
            linkDrive: isian.linkDrive,
            statusDokumen: isian.statusDokumen,
            catatanDokumen: isian.catatanDokumen,
            klasifikasi: isian.klasifikasi,
            catatanLapangan: isian.catatanLapangan,
            rekomendasi: isian.rekomendasi,
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
      <PageHeader
        title={`Portal Evaluasi Diri & Bukti Drive — Prodi ${user.unit.nama}`}
        desc={`${periode.nama} · Tahun Akademik ${periode.tahun} (${periode.semester})`}
      >
        <Badge tone={buka ? "green" : "amber"}>
          {buka ? "🟢 Sesi AMI Terbuka (Dapat Mengisi Bukti)" : "🔒 Sesi AMI Terkunci oleh LPM"}
        </Badge>
      </PageHeader>
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {/* Info Auditor Prodi */}
      <div className="card flex flex-wrap items-center justify-between gap-3 text-xs">
        <div>
          <span className="font-semibold text-slate-700">Auditor Program Studi {user.unit.nama}: </span>
          {prodiAuditors.length > 0 ? (
            <span className="font-bold text-slate-900">
              {prodiAuditors.map((a) => `${a.nama}${a.nimNuptk ? ` (${a.nimNuptk})` : ""}`).join(", ")}
            </span>
          ) : (
            <span className="text-slate-500">Belum ada akun Auditor untuk Prodi ini</span>
          )}
        </div>
        <div className="text-slate-600">
          Tempelkan tautan (link) folder/file <strong>Google Drive</strong> resmi pada setiap indikator di bawah ini.
        </div>
      </div>

      {/* Daftar Indikator */}
      {clientItems.length === 0 ? (
        <Empty>LPM belum menambahkan indikator pada sesi ini.</Empty>
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
