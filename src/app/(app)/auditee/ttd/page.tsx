import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sortPeriodesChronological } from "@/lib/periode";
import { cleanupExpiredSignatures } from "@/lib/ttd-cleanup";
import { Empty, Flash, PageHeader, one, type SP } from "@/components/ui";
import { SignaturePadCard, type LpmCandidateItem } from "@/components/SignaturePadCard";

export default async function AuditeeSignaturePage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser("AUDITEE");
  const sp = await searchParams;
  const arsipId = one(sp.arsipId);

  await cleanupExpiredSignatures();

  if (user.isTraining && !user.trainingPeriodeId) {
    return (
      <Empty>
        ⏳ Akun pelatihan Anda belum dimasukkan ke dalam Kelompok Training oleh Super Admin.
      </Empty>
    );
  }

  if (!user.unitId || !user.unit) {
    return <Empty>Akun Auditee belum dihubungkan ke Program Studi / Kelompok.</Empty>;
  }

  const rawPeriodes = await prisma.periode.findMany({
    where: user.isTraining
      ? { id: user.trainingPeriodeId ?? "__NONE__", isTraining: true }
      : { unitId: user.unitId, isTraining: false },
  });

  if (rawPeriodes.length === 0) {
    if (user.isTraining) redirect("/training");
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
          <Link
            href={arsipId ? `/auditee?arsipId=${encodeURIComponent(arsipId)}` : "/auditee"}
            className="btn-secondary text-xs"
          >
            ← Kembali ke Evaluasi Diri Auditee
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
          ketuaAuditeeId: periode.isTraining ? user.id : periode.ketuaAuditeeId,
          ketuaAuditeeNama: periode.ketuaAuditeeNama ?? (periode.isTraining ? user.nama : null),
          ketuaAuditeeNip: periode.ketuaAuditeeNip ?? (periode.isTraining ? user.nimNuptk : null),
          hasTtdAuditee: Boolean(periode.ttdAuditee),
          ttdAuditeePreview: periode.ttdAuditee,
          ketuaAuditorId: periode.ketuaAuditorId,
          ketuaAuditorNama: periode.ketuaAuditorNama,
          ketuaAuditorNip: periode.ketuaAuditorNip,
          hasTtdAuditor: Boolean(periode.ttdAuditor),
          ttdAuditorPreview: periode.ttdAuditor,
          kepalaLpmNama: periode.kepalaLpmNama ?? periode.disahkanOleh,
          kepalaLpmNip: periode.kepalaLpmNip,
          hasTtdLpm: Boolean(periode.ttdLpm),
          ttdLpmPreview: periode.ttdLpm,
        }}
        currentUserId={user.id}
        currentRole="AUDITEE"
        lpmCandidates={lpmCandidates}
      />
    </>
  );
}
