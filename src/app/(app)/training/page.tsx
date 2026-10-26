import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";
import { pilihKelompokOlehPesertaTraining } from "../admin/training/actions";

export default async function TrainingSelectGroupPage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;

  // Jika bukan akun training, arahkan ke halaman sesuai rolenya
  if (!user.isTraining) {
    if (user.role === "SUPER_ADMIN") redirect("/admin/training");
    if (user.role === "LPM") redirect("/lpm");
    redirect("/");
  }

  const trainingPeriodes = await prisma.periode.findMany({
    where: { isTraining: true, aktif: true },
    include: {
      indikator: { select: { id: true } },
      trainingUsers: {
        select: { id: true, nama: true, username: true },
        orderBy: { nama: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <>
      <PageHeader title="🎓 Pilih Kelompok Pelatihan AMI Anda">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="blue">👤 {user.nama} ({user.username})</Badge>
          <Badge tone="amber">✨ Akun Anda Bisa Jadi Auditee &amp; Auditor di Kelompok</Badge>
        </div>
      </PageHeader>
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {trainingPeriodes.length === 0 ? (
        <Empty>
          ⏳ Belum ada Kelompok Sesi Training yang dibuka oleh Admin / LPM. Silakan tunggu sebentar.
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {trainingPeriodes.map((tp) => {
            const isMyGroup = user.trainingPeriodeId === tp.id;

            return (
              <div
                key={tp.id}
                className={`card flex flex-col justify-between space-y-4 transition ${
                  isMyGroup ? "bg-[#FEF08A] ring-2 ring-black" : ""
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-black text-black">{tp.nama}</h2>
                    {isMyGroup && <Badge tone="green">✓ Kelompok Anda</Badge>}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="blue">{tp.indikator.length} Indikator</Badge>
                    <Badge tone="purple">{tp.trainingUsers.length} Peserta di Kelompok Ini</Badge>
                  </div>

                  {tp.trainingUsers.length > 0 && (
                    <div className="rounded-xl border border-black/15 bg-white/80 p-2.5 text-xs">
                      <div className="mb-1 font-black text-black">Anggota Kelompok:</div>
                      <div className="flex flex-wrap gap-1">
                        {tp.trainingUsers.map((m) => (
                          <Badge key={m.id} tone={m.id === user.id ? "green" : "slate"}>
                            👤 {m.nama}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 border-t border-black/15 pt-3 sm:grid-cols-2">
                  <form action={pilihKelompokOlehPesertaTraining}>
                    <input type="hidden" name="periodeId" value={tp.id} />
                    <input type="hidden" name="targetRole" value="AUDITEE" />
                    <button className="btn w-full text-xs">
                      📝 Masuk Jadi Auditee
                    </button>
                  </form>
                  <form action={pilihKelompokOlehPesertaTraining}>
                    <input type="hidden" name="periodeId" value={tp.id} />
                    <input type="hidden" name="targetRole" value="AUDITOR" />
                    <button className="btn-secondary w-full text-xs">
                      🕵️ Masuk Jadi Auditor
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
