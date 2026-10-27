import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanupExpiredSignatures } from "@/lib/ttd-cleanup";
import { Empty, Flash, PageHeader, one, type SP } from "@/components/ui";
import { SignaturePadCard, type LpmCandidateItem } from "@/components/SignaturePadCard";

export default async function AuditorSignaturePage({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams: SP;
}) {
  const user = await requireUser("AUDITOR");
  const { unitId: paramId } = await params;
  const sp = await searchParams;

  await cleanupExpiredSignatures();

  if (user.isTraining) {
    if (!user.trainingPeriodeId) redirect("/training");
    if (paramId !== user.trainingPeriodeId) {
      redirect(`/auditor/${user.trainingPeriodeId}/ttd`);
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

  if (user.isTraining && (!periode.isTraining || periode.id !== user.trainingPeriodeId)) {
    redirect("/training");
  }
  if (!user.isTraining && periode.isTraining) {
    redirect("/auditor");
  }

  let lpmCandidates: LpmCandidateItem[] = [];
  if (periode.isTraining) {
    const rawCandidates = await prisma.user.findMany({
      where: {
        aktif: true,
        OR: [
          { trainingPeriodeId: periode.id },
          { role: "LPM" },
          { isTraining: true },
        ],
      },
      orderBy: [{ role: "asc" }, { nama: "asc" }],
    });
    lpmCandidates = rawCandidates.map((u) => ({
      id: u.id,
      nama: u.nama,
      username: u.username,
      nimNuptk: u.nimNuptk,
      role: u.role,
    }));
  }

  return (
    <>
      <PageHeader
        title={`✍️ Halaman Tanda Tangan — ${periode.nama}`}
        desc="Status tanda tangan digital berita acara & pengesahan laporan Rekap AMI"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/auditor/${periode.id}`} className="btn-secondary text-xs">
            ← Kembali ke Pemeriksaan Auditor
          </Link>
          <a
            href={`/api/rekap-excel?periodeId=${encodeURIComponent(periode.id)}&print=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn text-xs"
          >
            🖨️ Print Rekap Audit
          </a>
        </div>
      </PageHeader>

      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      <SignaturePadCard
        session={{
          periodeId: periode.id,
          periodeNama: periode.nama,
          isTraining: periode.isTraining,
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
        lpmCandidates={lpmCandidates}
      />
    </>
  );
}
