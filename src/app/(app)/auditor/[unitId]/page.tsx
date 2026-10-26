import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanupExpiredSignatures } from "@/lib/ttd-cleanup";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";
import { SignaturePadCard } from "@/components/SignaturePadCard";
import AuditorClient, { type AuditorIndikatorItem } from "./AuditorClient";

export default async function AuditorUnitWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams: SP;
}) {
  const user = await requireUser("AUDITOR");
  const { unitId: paramId } = await params;
  const sp = await searchParams;
  const mode = one(sp.mode) ?? "dokumen";

  await cleanupExpiredSignatures();

  if (user.isTraining) {
    if (!user.trainingPeriodeId) redirect("/training");
    if (paramId !== user.trainingPeriodeId) {
      redirect(`/auditor/${user.trainingPeriodeId}`);
    }
  }

  const periode =
    (await prisma.periode.findUnique({
      where: { id: paramId },
      include: { unit: true },
    })) ??
    (await prisma.periode.findFirst({
      where: { unitId: paramId },
      include: { unit: true },
      orderBy: { createdAt: "desc" },
    }));

  if (!periode) {
    if (user.isTraining) redirect("/training");
    return <Empty>Sesi AMI tidak ditemukan.</Empty>;
  }

  // Isolasi ketat: Akun Training hanya boleh membuka Sesi Training miliknya, dan Akun Asli tidak membuka Sesi Training
  if (user.isTraining && (!periode.isTraining || periode.id !== user.trainingPeriodeId)) {
    redirect("/training");
  }
  if (!user.isTraining && periode.isTraining) {
    redirect("/auditor");
  }

  // ATURAN INDEPENDENSI (Khusus Sesi AMI Asli Kampus): Auditor TIDAK BOLEH mengaudit prodinya sendiri
  if (!periode.isTraining && user.unitId && periode.unitId && user.unitId === periode.unitId) {
    return (
      <Empty>
        Independensi AMI: Anda berasal dari Prodi {user.unit?.nama} sehingga tidak diperbolehkan mengaudit Prodi sendiri.
      </Empty>
    );
  }

  const targetUnitId = periode.unitId;
  if (!targetUnitId) return <Empty>Program Studi belum ditentukan.</Empty>;

  const [indikator, isianList] = await Promise.all([
    prisma.indikator.findMany({
      where: { periodeId: periode.id },
      orderBy: [{ urutan: "asc" }, { kode: "asc" }],
    }),
    prisma.isian.findMany({
      where: { unitId: targetUnitId, indikator: { periodeId: periode.id } },
    }),
  ]);

  const isianByInd = new Map(isianList.map((i) => [i.indikatorId, i]));
  const jmlFokusLapangan = isianList.filter((i) => i.statusDokumen === "PERLU_KLARIFIKASI").length;
  const buka = periode.aktif;

  const clientItems: AuditorIndikatorItem[] = indikator.map((ind) => {
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

  return (
    <>
      <PageHeader title={user.isTraining ? `${periode.nama} — Mode Auditor` : periode.nama}>
        <div className="flex flex-wrap items-center gap-2">
          {user.isTraining ? (
            <>
              <Link href="/auditee" className="btn text-xs">
                📝 Pindah Jadi Auditee Kelompok Ini
              </Link>
              <Link href="/training" className="btn-secondary text-xs">
                🔄 Ganti Kelompok
              </Link>
            </>
          ) : (
            <Link href="/auditor" className="btn-secondary text-xs">
              ← Kembali
            </Link>
          )}
        </div>
      </PageHeader>
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-3">
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/auditor/${periode.id}?mode=dokumen`}
            className={mode === "dokumen" ? "btn text-xs" : "btn-secondary text-xs"}
          >
            📄 1. Audit Dokumen
          </Link>
          <Link
            href={`/auditor/${periode.id}?mode=lapangan`}
            className={mode === "lapangan" ? "btn text-xs" : "btn-secondary text-xs"}
          >
            🏛️ 2. Audit Lapangan ({jmlFokusLapangan})
          </Link>
          <Link
            href={`/auditor/${periode.id}?mode=rtl`}
            className={mode === "rtl" ? "btn text-xs" : "btn-secondary text-xs"}
          >
            🛠️ 3. Verifikasi RTL
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
            📥 Excel
          </a>
        </div>
        <Badge tone={buka ? "green" : "amber"}>
          {buka ? "🟢 Sesi Terbuka" : "🔒 Sesi Terkunci"}
        </Badge>
      </div>

      {!periode.sourceLocked ? (
        <Empty>
          ⏳ Instrumen &amp; Indikator sedang disusun atau diedit oleh LPM. Indikator akan otomatis muncul di halaman Auditor setelah dikunci oleh LPM.
        </Empty>
      ) : clientItems.length === 0 ? (
        <Empty>Belum ada indikator.</Empty>
      ) : (
        <AuditorClient
          periodeId={periode.id}
          unitId={targetUnitId}
          mode={mode}
          buka={buka}
          indikator={clientItems}
        />
      )}

      {/* Panel Tanda Tangan Ketua Auditor */}
      <SignaturePadCard
        session={{
          periodeId: periode.id,
          periodeNama: periode.nama,
          ketuaAuditeeId: periode.ketuaAuditeeId,
          ketuaAuditeeNama: periode.ketuaAuditeeNama,
          ketuaAuditeeNip: periode.ketuaAuditeeNip,
          hasTtdAuditee: Boolean(periode.ttdAuditee),
          ttdAuditeePreview: periode.ttdAuditee,
          ketuaAuditorId: periode.isTraining ? user.id : periode.ketuaAuditorId,
          ketuaAuditorNama: periode.ketuaAuditorNama ?? (periode.isTraining ? user.nama : null),
          ketuaAuditorNip: periode.ketuaAuditorNip ?? (periode.isTraining ? user.nimNuptk : null),
          hasTtdAuditor: Boolean(periode.ttdAuditor),
          ttdAuditorPreview: periode.ttdAuditor,
          kepalaLpmNama: periode.kepalaLpmNama ?? periode.disahkanOleh,
          kepalaLpmNip: periode.kepalaLpmNip,
          hasTtdLpm: Boolean(periode.ttdLpm),
          ttdLpmPreview: periode.ttdLpm,
        }}
        currentUserId={user.id}
        currentRole="AUDITOR"
      />
    </>
  );
}
