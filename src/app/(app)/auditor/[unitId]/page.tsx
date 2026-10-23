import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";
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
  const mode = one(sp.mode) ?? "dokumen"; // dokumen | lapangan | rtl

  // Cari Sesi AMI berdasarkan ID periode (atau unitId sebagai fallback)
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

  if (!periode) return <Empty>Sesi AMI tidak ditemukan.</Empty>;

  const targetUnitId = periode.unitId ?? user.unitId;
  if (!targetUnitId) return <Empty>Program Studi untuk sesi ini belum ditentukan.</Empty>;

  const [indikator, isianList, prodiAuditees] = await Promise.all([
    prisma.indikator.findMany({
      where: { periodeId: periode.id },
      orderBy: [{ urutan: "asc" }, { kode: "asc" }],
    }),
    prisma.isian.findMany({
      where: { unitId: targetUnitId, indikator: { periodeId: periode.id } },
    }),
    prisma.user.findMany({
      where: { role: "AUDITEE", unitId: targetUnitId, aktif: true },
      orderBy: { nama: "asc" },
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
      pernyataan: ind.pernyataan,
      target: ind.target,
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
        title={`Meja Kerja Auditor — ${periode.nama}`}
        desc={`Auditee Prodi ${periode.unit?.nama ?? ""}: ${
          prodiAuditees.map((a) => `${a.nama}${a.nimNuptk ? ` (${a.nimNuptk})` : ""}`).join(", ") || "Belum ada akun Auditee"
        }`}
      >
        <Link href="/auditor" className="btn-secondary text-xs">
          ← Kembali ke Daftar Sesi
        </Link>
      </PageHeader>
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {/* Sub-Navigasi 3 Mode Pemeriksaan Auditor */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-3">
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/auditor/${periode.id}?mode=dokumen`}
            className={mode === "dokumen" ? "btn text-xs" : "btn-secondary text-xs"}
          >
            📄 1. Audit Dokumen (Cek Link Drive)
          </Link>
          <Link
            href={`/auditor/${periode.id}?mode=lapangan`}
            className={mode === "lapangan" ? "btn text-xs" : "btn-secondary text-xs"}
          >
            🏛️ 2. Audit Lapangan &amp; Klasifikasi Temuan ({jmlFokusLapangan} Fokus)
          </Link>
          <Link
            href={`/auditor/${periode.id}?mode=rtl`}
            className={mode === "rtl" ? "btn text-xs" : "btn-secondary text-xs"}
          >
            🛠️ 3. Verifikasi Tindak Lanjut (RTL)
          </Link>
        </div>
        <Badge tone={buka ? "green" : "amber"}>
          {buka ? "🟢 Sesi Terbuka" : "🔒 Sesi Terkunci oleh LPM"}
        </Badge>
      </div>

      {clientItems.length === 0 ? (
        <Empty>LPM belum menambahkan indikator pada sesi ini.</Empty>
      ) : (
        <AuditorClient
          periodeId={periode.id}
          unitId={targetUnitId}
          mode={mode}
          buka={buka}
          indikator={clientItems}
        />
      )}
    </>
  );
}
