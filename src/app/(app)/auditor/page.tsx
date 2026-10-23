import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";

export default async function AuditorListPage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser("AUDITOR");
  const sp = await searchParams;

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
      <PageHeader title={`Sesi Audit — ${user.unit?.nama ?? "Auditor"}`} />
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {periodes.length === 0 ? (
        <Empty>Belum ada Sesi AMI untuk Program Studi {user.unit?.nama ?? "Anda"}.</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {periodes.map((p) => {
            const prodiAuditees = auditees.filter((a) => !p.unitId || a.unitId === p.unitId);

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
                    {p.unit && <Badge tone="slate">{p.unit.nama}</Badge>}
                  </div>

                  <div className="pt-1 text-xs font-bold text-slate-700">
                    👤 Auditee:{" "}
                    {prodiAuditees.length > 0
                      ? prodiAuditees.map((a) => a.nama).join(", ")
                      : "—"}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t-2 border-black pt-3">
                  <Link href={`/auditor/${p.id}?mode=dokumen`} className="btn text-xs">
                    📄 1. Audit Dokumen
                  </Link>
                  <Link href={`/auditor/${p.id}?mode=lapangan`} className="btn-secondary text-xs">
                    🏛️ 2. Audit Lapangan
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
