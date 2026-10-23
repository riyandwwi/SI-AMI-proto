import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";

export default async function AuditorListPage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser("AUDITOR");
  const sp = await searchParams;

  // Ambil semua Sesi AMI yang BUKAN dari prodi asal Auditor (Independensi AMI: tidak boleh satu prodi)
  const [allPeriodes, auditees] = await Promise.all([
    prisma.periode.findMany({
      where: user.unitId ? { NOT: { unitId: user.unitId } } : undefined,
      include: {
        unit: true,
        penugasan: { include: { tim: true } },
        indikator: { include: { isian: true } },
      },
      orderBy: [{ aktif: "desc" }, { createdAt: "desc" }],
    }),
    prisma.user.findMany({
      where: { role: "AUDITEE", aktif: true },
      orderBy: { nama: "asc" },
    }),
  ]);

  // Utamakan sesi di mana Auditor ditugaskan secara spesifik, atau tampilkan sesi lintas-prodi jika belum ada penugasan spesifik
  const periodes = allPeriodes.filter((p) => {
    const allTim = p.penugasan.flatMap((pg) => pg.tim);
    if (allTim.length === 0) return true;
    return allTim.some((t) => t.auditorId === user.id);
  });

  const displayPeriodes = periodes.length > 0 ? periodes : allPeriodes;

  return (
    <>
      <PageHeader title="Sesi Audit Lintas Prodi">
        {user.unit && <Badge tone="purple">Asal Auditor: {user.unit.nama}</Badge>}
      </PageHeader>
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {displayPeriodes.length === 0 ? (
        <Empty>Belum ada Sesi AMI lintas prodi yang ditugaskan kepada Anda.</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {displayPeriodes.map((p) => {
            const prodiAuditees = auditees.filter((a) => a.unitId === p.unitId);

            return (
              <div key={p.id} className="card flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-black text-black">{p.nama}</h2>
                    <Badge tone={p.aktif ? "green" : "amber"}>
                      {p.aktif ? "🟢 Terbuka" : "🔒 Terkunci"}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="blue">{p.tahun}</Badge>
                    <Badge tone="purple">{p.semester}</Badge>
                    {p.unit && <Badge tone="amber">Diaudit: {p.unit.nama}</Badge>}
                  </div>

                  <div className="pt-1 text-xs font-bold text-slate-700">
                    👤 Auditee ({p.unit?.nama}):{" "}
                    {prodiAuditees.length > 0
                      ? prodiAuditees.map((a) => a.nama).join(", ")
                      : "—"}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-black/15 pt-3">
                  <Link href={`/auditor/${p.id}?mode=dokumen`} className="btn text-xs">
                    📄 1. Audit Dokumen
                  </Link>
                  <Link href={`/auditor/${p.id}?mode=lapangan`} className="btn-secondary text-xs">
                    🏛️ 2. Audit Lapangan
                  </Link>
                  <Link href={`/auditor/${p.id}?mode=rtl`} className="btn-secondary text-xs">
                    🛠️ 3. Verifikasi RTL
                  </Link>
                  <a
                    href={`/api/rekap-excel?periodeId=${p.id}&print=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary text-xs"
                  >
                    🖨️ Print
                  </a>
                  <a
                    href={`/api/rekap-excel?periodeId=${p.id}`}
                    className="btn-secondary text-xs"
                  >
                    📥 Excel
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
