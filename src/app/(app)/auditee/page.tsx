import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sortPeriodesChronological } from "@/lib/periode";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";
import { SignaturePadCard } from "@/components/SignaturePadCard";
import AuditeeClient, { type AuditeeIndikatorItem } from "./AuditeeClient";

export default async function AuditeePage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser("AUDITEE");
  const sp = await searchParams;
  const arsipId = one(sp.arsipId);

  if (!user.unitId || !user.unit) {
    return <Empty>Akun Auditee belum dihubungkan ke Program Studi.</Empty>;
  }

  // Ambil semua Sesi AMI milik Prodi Auditee ini, lalu urutkan berdasarkan Tahun Akademik & Semester (Ganjil -> Genap)
  const rawPeriodes = await prisma.periode.findMany({
    where: { unitId: user.unitId },
    include: {
      penugasan: {
        include: {
          tim: {
            include: {
              auditor: { include: { unit: true } },
            },
          },
        },
      },
    },
  });

  if (rawPeriodes.length === 0) {
    return <Empty>Belum ada Sesi AMI untuk Program Studi {user.unit.nama}.</Empty>;
  }

  // Urutan kronologis: 2025/2026 Ganjil -> 2025/2026 Genap -> 2026/2027 Ganjil -> 2026/2027 Genap
  const sortedPeriodes = sortPeriodesChronological(rawPeriodes);

  // Sesi terbaru adalah sesi aktif paling akhir secara TA/Semester (atau sesi paling akhir jika semua terkunci)
  const activePeriodes = sortedPeriodes.filter((p) => p.aktif);
  const latestPeriode =
    activePeriodes.length > 0
      ? activePeriodes[activePeriodes.length - 1]
      : sortedPeriodes[sortedPeriodes.length - 1];

  // Sesi-sesi sebelumnya (selain sesi terbaru) hanya bisa dilihat (Read-Only)
  const olderPeriodes = sortedPeriodes.filter((p) => p.id !== latestPeriode.id);

  // Jika Auditee klik salah satu sesi lama (?arsipId=...), tampilkan dalam mode Hanya Lihat
  const viewingOlderPeriode = arsipId
    ? olderPeriodes.find((p) => p.id === arsipId) ?? null
    : null;

  const periode = viewingOlderPeriode ?? latestPeriode;
  const isReadOnlyArchive = Boolean(viewingOlderPeriode);

  const [indikator, isianList, crossAuditorsFallback] = await Promise.all([
    prisma.indikator.findMany({
      where: { periodeId: periode.id },
      orderBy: [{ urutan: "asc" }, { kode: "asc" }],
    }),
    prisma.isian.findMany({
      where: { unitId: user.unitId, indikator: { periodeId: periode.id } },
    }),
    prisma.user.findMany({
      where: { role: "AUDITOR", NOT: { unitId: user.unitId }, aktif: true },
      include: { unit: true },
      orderBy: { nama: "asc" },
    }),
  ]);

  const assignedAuditors = periode.penugasan
    .flatMap((pg) => pg.tim.map((t) => t.auditor))
    .filter((a) => a.aktif && a.unitId !== user.unitId);

  const displayAuditors = assignedAuditors.length > 0 ? assignedAuditors : crossAuditorsFallback;

  const isianByInd = new Map(isianList.map((i) => [i.indikatorId, i]));
  // Jika sedang melihat sesi lama (arsip), otomatis terkunci (Hanya Lihat)
  const buka = isReadOnlyArchive ? false : periode.aktif;

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
      <PageHeader title={`Prodi ${user.unit.nama} — ${periode.tahun} (${periode.semester})`}>
        <div className="flex flex-wrap items-center gap-2">
          {periode.ketuaAuditeeNama && (
            <Badge tone="blue">⭐ Ketua Auditee: {periode.ketuaAuditeeNama}</Badge>
          )}
          {displayAuditors.length > 0 && (
            <Badge tone="purple">
              🕵️ Auditor:{" "}
              {displayAuditors
                .map((a) => `${a.nama}${a.unit ? ` (${a.unit.nama})` : ""}`)
                .join(", ")}
            </Badge>
          )}
          <Badge tone={buka ? "green" : "amber"}>
            {isReadOnlyArchive
              ? "📜 Arsip Sesi Lalu (Hanya Lihat)"
              : buka
                ? "🟢 Sesi Aktif Terbuka"
                : "🔒 Sesi Terkunci"}
          </Badge>
          <a
            href={`/api/rekap-excel?periodeId=${periode.id}&print=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs"
          >
            🖨️ Print Rekap
          </a>
        </div>
      </PageHeader>
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {/* Navigasi Sesi Aktif vs Riwayat Sesi Sebelumnya (Hanya Lihat) */}
      {olderPeriodes.length > 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-2 py-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-black uppercase text-black">Sesi Prodi {user.unit.nama}:</span>
            <Link
              href="/auditee"
              className={!isReadOnlyArchive ? "btn text-xs" : "btn-secondary text-xs"}
            >
              🟢 Sesi Aktif: {latestPeriode.tahun} ({latestPeriode.semester})
            </Link>

            <span className="ml-2 font-black uppercase text-slate-700">
              📜 Lihat Sesi Sebelumnya:
            </span>
            {olderPeriodes.map((old) => (
              <Link
                key={old.id}
                href={`/auditee?arsipId=${old.id}`}
                className={
                  periode.id === old.id ? "btn-purple text-xs" : "btn-secondary text-xs"
                }
              >
                📜 {old.tahun} ({old.semester})
              </Link>
            ))}
          </div>
        </div>
      )}

      {isReadOnlyArchive && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-black bg-[#E9D5FF] px-4 py-3 text-xs font-black text-black">
          <span>
            📜 Anda sedang melihat arsip sesi sebelumnya ({periode.tahun} {periode.semester}) — Mode Hanya Lihat.
          </span>
          <Link href="/auditee" className="btn text-xs">
            ← Kembali ke Sesi Aktif ({latestPeriode.tahun} {latestPeriode.semester})
          </Link>
        </div>
      )}

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

      {/* Panel Tanda Tangan Ketua Auditee */}
      <SignaturePadCard
        session={{
          periodeId: periode.id,
          periodeNama: periode.nama,
          ketuaAuditeeId: periode.ketuaAuditeeId,
          ketuaAuditeeNama: periode.ketuaAuditeeNama,
          ketuaAuditeeNip: periode.ketuaAuditeeNip,
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
      />
    </>
  );
}
