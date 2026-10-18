import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtWaktu } from "@/lib/format";
import { Badge, PageHeader } from "@/components/ui";

export default async function LpmLogPage() {
  await requireUser("LPM");
  const logs = await prisma.auditLog.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <>
      <PageHeader
        title="Jejak Audit & Riwayat Aktivitas Sistem (Audit Trail)"
        desc="Mencatat seluruh perubahan sesi, penguncian sumber data (Source-Lock), penugasan tim, penilaian auditor, dan pengesahan."
      />
      <div className="card overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Waktu (WIB)</th>
              <th>Pengguna</th>
              <th>Aksi</th>
              <th>Keterangan Detail</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap text-xs text-slate-500">{fmtWaktu(l.createdAt)}</td>
                <td className="font-semibold text-slate-800">{l.user ? `${l.user.nama} (${l.user.username})` : "Sistem"}</td>
                <td>
                  <Badge tone="blue">{l.aksi}</Badge>
                </td>
                <td className="text-slate-600">{l.detail ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
