import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActivePeriode, TAHAP_LABEL } from "@/lib/periode";
import { fmtTanggal, fmtWaktu } from "@/lib/format";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";

export default async function AuditorListPage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser("AUDITOR");
  const sp = await searchParams;
  const periode = await getActivePeriode();

  if (!periode) return <Empty>Belum ada periode AMI aktif.</Empty>;

  const [tugas, jmlIndikator] = await Promise.all([
    prisma.penugasanAuditor.findMany({
      where: { auditorId: user.id, penugasan: { periodeId: periode.id } },
      include: {
        penugasan: {
          include: {
            unit: true,
            tim: { include: { auditor: true } },
          },
        },
      },
    }),
    prisma.indikator.count({ where: { periodeId: periode.id } }),
  ]);

  return (
    <>
      <PageHeader
        title="Daftar Penugasan Audit Saya (Auditor Internal)"
        desc={`${periode.nama} — Sesi Saat Ini: ${TAHAP_LABEL[periode.tahap]}. Tim yang memeriksa dokumen dipertahankan untuk audit lapangan (Team Continuity).`}
      />
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {tugas.length === 0 ? (
        <Empty>Anda belum memiliki penugasan unit auditee pada periode aktif ini.</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {tugas.map(({ peran, penugasan }) => {
            const rekan = penugasan.tim.filter((t) => t.auditorId !== user.id).map((t) => t.auditor.nama);
            return (
              <div key={penugasan.id} className="card flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold">{penugasan.unit.kode}</code>
                      <h2 className="text-base font-bold text-slate-900">{penugasan.unit.nama}</h2>
                    </div>
                    <Badge tone={peran === "KETUA" ? "blue" : "slate"}>Peran: {peran}</Badge>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <div>
                      <strong>Rekan Tim Auditor:</strong> {rekan.length ? rekan.join(", ") : "—"}
                    </div>
                    <div>
                      <strong>Jadwal Audit Dokumen:</strong>{" "}
                      {penugasan.jadwalDokumenMulai
                        ? `${fmtTanggal(penugasan.jadwalDokumenMulai)} s.d ${fmtTanggal(penugasan.jadwalDokumenSelesai)}`
                        : "Perlu verifikasi manual"}
                    </div>
                    <div>
                      <strong>Jadwal Visitasi Lapangan:</strong>{" "}
                      {penugasan.jadwalLapanganMulai ? fmtWaktu(penugasan.jadwalLapanganMulai) : "Perlu verifikasi manual"}
                    </div>
                    <div>
                      <strong>Total Indikator SPMI:</strong> {jmlIndikator} Indikator
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                  <Link href={`/auditor/${penugasan.unitId}?mode=dokumen`} className="btn text-xs">
                    📄 1. Audit Dokumen (Cek Link Drive)
                  </Link>
                  <Link href={`/auditor/${penugasan.unitId}?mode=lapangan`} className="btn-secondary text-xs">
                    🏛️ 2. Audit Lapangan &amp; Temuan
                  </Link>
                  <Link href={`/auditor/${penugasan.unitId}?mode=rtl`} className="btn-secondary text-xs">
                    🛠️ 3. Verifikasi RTL
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
