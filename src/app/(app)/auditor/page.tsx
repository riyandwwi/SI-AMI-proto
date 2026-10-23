import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";

export default async function AuditorListPage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser("AUDITOR");
  const sp = await searchParams;

  // Tampilkan Sesi AMI sesuai Prodi tempat Auditor terdaftar (atau semua sesi jika tidak terikat prodi)
  const [periodes, auditees] = await Promise.all([
    prisma.periode.findMany({
      where: user.unitId ? { unitId: user.unitId } : undefined,
      include: {
        unit: true,
        indikator: { include: { isian: true } },
      },
      orderBy: [{ aktif: "desc" }, { createdAt: "desc" }],
    }),
    prisma.user.findMany({
      where: { role: "AUDITEE", aktif: true, ...(user.unitId ? { unitId: user.unitId } : {}) },
      orderBy: { nama: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader
        title={`Daftar Sesi Audit Saya — ${user.unit?.nama ?? "Auditor Internal"}`}
        desc="Sesi AMI otomatis terhubung berdasarkan Program Studi akun Auditor Anda."
      />
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {periodes.length === 0 ? (
        <Empty>
          Belum ada Sesi AMI yang dibuat oleh LPM untuk Program Studi {user.unit?.nama ?? "Anda"}.
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {periodes.map((p) => {
            const prodiAuditees = auditees.filter((a) => !p.unitId || a.unitId === p.unitId);
            const jmlInd = p.indikator.length;
            const jmlDrive = p.indikator.filter((ind) =>
              ind.isian.some((i) => (!p.unitId || i.unitId === p.unitId) && i.linkDrive)
            ).length;
            const jmlDinilai = p.indikator.filter((ind) =>
              ind.isian.some((i) => (!p.unitId || i.unitId === p.unitId) && i.klasifikasi)
            ).length;

            return (
              <div key={p.id} className="card flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-bold text-slate-900">{p.nama}</h2>
                    <Badge tone={p.aktif ? "green" : "amber"}>
                      {p.aktif ? "🟢 Sesi Terbuka" : "🔒 Sesi Terkunci"}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="blue">Tahun: {p.tahun}</Badge>
                    <Badge tone="purple">Semester: {p.semester}</Badge>
                    {p.unit && <Badge tone="slate">Prodi: {p.unit.nama}</Badge>}
                  </div>

                  <div className="pt-1 text-xs text-slate-600 space-y-1">
                    <div>
                      <strong>Auditee Prodi Ini:</strong>{" "}
                      {prodiAuditees.length > 0
                        ? prodiAuditees.map((a) => `${a.nama}${a.nimNuptk ? ` (${a.nimNuptk})` : ""}`).join(", ")
                        : "Belum ada akun Auditee"}
                    </div>
                    <div>
                      <strong>Bukti Drive Diunggah Auditee:</strong> {jmlDrive} / {jmlInd} Indikator
                    </div>
                    <div>
                      <strong>Indikator Selesai Dinilai:</strong> {jmlDinilai} / {jmlInd} Indikator
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t-2 border-black pt-3">
                  <Link href={`/auditor/${p.id}?mode=dokumen`} className="btn text-xs">
                    📄 1. Audit Dokumen (Cek Link Drive)
                  </Link>
                  <Link href={`/auditor/${p.id}?mode=lapangan`} className="btn-secondary text-xs">
                    🏛️ 2. Audit Lapangan &amp; Temuan
                  </Link>
                  <Link href={`/auditor/${p.id}?mode=rtl`} className="btn-secondary text-xs">
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
