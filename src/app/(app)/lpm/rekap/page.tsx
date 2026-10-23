import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BUTUH_RTL, KLASIFIKASI_LABEL, RTL_LABEL } from "@/lib/periode";
import { fmtWaktu } from "@/lib/format";
import { Badge, Empty, Flash, PageHeader, Stat, one, type SP } from "@/components/ui";
import { sahkanLaporanAkhir } from "../actions";

export default async function LpmRekapPage({ searchParams }: { searchParams: SP }) {
  await requireUser("LPM");
  const sp = await searchParams;

  const [periodes, daftarTemuan] = await Promise.all([
    prisma.periode.findMany({
      include: {
        unit: true,
        indikator: { include: { isian: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.isian.findMany({
      where: { klasifikasi: { in: BUTUH_RTL } },
      include: { unit: true, indikator: { include: { periode: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  if (periodes.length === 0) return <Empty>Belum ada Sesi AMI.</Empty>;

  let totalSlot = 0;
  let totalDrive = 0;
  let totalMelampaui = 0;
  let totalMencapai = 0;
  let totalOb = 0;
  let totalMinor = 0;
  let totalMayor = 0;

  for (const p of periodes) {
    totalSlot += p.indikator.length;
    for (const ind of p.indikator) {
      const isian = ind.isian.find((i) => !p.unitId || i.unitId === p.unitId) ?? ind.isian[0];
      if (!isian) continue;
      if (isian.linkDrive) totalDrive++;
      if (isian.klasifikasi === "MELAMPAUI") totalMelampaui++;
      if (isian.klasifikasi === "MENCAPAI") totalMencapai++;
      if (isian.klasifikasi === "OBSERVASI") totalOb++;
      if (isian.klasifikasi === "KTS_MINOR") totalMinor++;
      if (isian.klasifikasi === "KTS_MAYOR") totalMayor++;
    }
  }

  const totalDinilai = totalMelampaui + totalMencapai + totalOb + totalMinor + totalMayor;
  const persenCapaian =
    totalDinilai > 0 ? Math.round(((totalMelampaui + totalMencapai) / totalDinilai) * 1000) / 10 : null;

  return (
    <>
      <PageHeader title="Rekap & Pengesahan">
        <a href="/api/rekap-excel" className="btn text-xs">
          📥 Download Semua Rekap Excel (.xls)
        </a>
      </PageHeader>
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Total Sesi AMI"
          value={`${periodes.length} Sesi`}
          color="bg-[#E9D5FF]"
        />
        <Stat
          label="Bukti Drive"
          value={`${totalDrive} / ${totalSlot}`}
          color="bg-[#FEF08A]"
        />
        <Stat
          label="Capaian Standar"
          value={persenCapaian !== null ? `${persenCapaian}%` : "—"}
          color="bg-[#D9F99D]"
        />
        <Stat
          label="Temuan (OB / Minor / Mayor)"
          value={`${totalOb} / ${totalMinor} / ${totalMayor}`}
          color="bg-[#BAE6FD]"
        />
      </div>

      {/* Tabel Rekap per Sesi AMI */}
      <div className="card overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Sesi AMI</th>
              <th>Prodi</th>
              <th>Bukti Drive</th>
              <th>Hasil Temuan</th>
              <th>Pengesahan &amp; Export Excel</th>
            </tr>
          </thead>
          <tbody>
            {periodes.map((p) => {
              const jmlInd = p.indikator.length;
              let drive = 0;
              let melampaui = 0;
              let mencapai = 0;
              let ob = 0;
              let minor = 0;
              let mayor = 0;

              for (const ind of p.indikator) {
                const isian = ind.isian.find((i) => !p.unitId || i.unitId === p.unitId) ?? ind.isian[0];
                if (!isian) continue;
                if (isian.linkDrive) drive++;
                if (isian.klasifikasi === "MELAMPAUI") melampaui++;
                if (isian.klasifikasi === "MENCAPAI") mencapai++;
                if (isian.klasifikasi === "OBSERVASI") ob++;
                if (isian.klasifikasi === "KTS_MINOR") minor++;
                if (isian.klasifikasi === "KTS_MAYOR") mayor++;
              }

              return (
                <tr key={p.id}>
                  <td>
                    <div className="font-bold text-black">{p.nama}</div>
                    <div className="mt-1 flex gap-1">
                      <Badge tone="blue">{p.tahun}</Badge>
                      <Badge tone="purple">{p.semester}</Badge>
                    </div>
                  </td>
                  <td className="font-bold text-black">{p.unit?.nama ?? "—"}</td>
                  <td>
                    <Badge tone={drive === jmlInd && jmlInd > 0 ? "green" : "amber"}>
                      {drive} / {jmlInd}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <Badge tone="green">🌟 {melampaui}</Badge>
                      <Badge tone="green">✅ {mencapai}</Badge>
                      <Badge tone="blue">👀 OB: {ob}</Badge>
                      <Badge tone="amber">⚠️ Minor: {minor}</Badge>
                      <Badge tone="red">🚨 Mayor: {mayor}</Badge>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-wrap items-center gap-2">
                      {p.disahkanAt ? (
                        <>
                          <Badge tone="green">✓ Disahkan ({p.disahkanOleh})</Badge>
                          <a
                            href={`/api/rekap-excel?periodeId=${p.id}`}
                            className="btn-success text-xs"
                          >
                            📥 Download Excel
                          </a>
                        </>
                      ) : (
                        <>
                          <form action={sahkanLaporanAkhir}>
                            <input type="hidden" name="periodeId" value={p.id} />
                            <button className="btn text-xs">Sahkan</button>
                          </form>
                          <a
                            href={`/api/rekap-excel?periodeId=${p.id}`}
                            className="btn-secondary text-xs"
                          >
                            📥 Excel
                          </a>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Daftar Temuan & RTL */}
      {daftarTemuan.length > 0 && (
        <div className="card space-y-3 overflow-x-auto">
          <h2 className="text-base font-black text-black">
            Daftar Temuan &amp; Status RTL ({daftarTemuan.length})
          </h2>
          <table>
            <thead>
              <tr>
                <th>Prodi</th>
                <th>Indikator</th>
                <th>Temuan</th>
                <th>RTL Auditee</th>
                <th>Status RTL</th>
              </tr>
            </thead>
            <tbody>
              {daftarTemuan.map((t) => (
                <tr key={t.id}>
                  <td className="font-bold text-black">{t.unit.nama}</td>
                  <td>
                    <code className="rounded border border-black bg-[#BAE6FD] px-1.5 py-0.5 text-xs font-black">
                      {t.indikator.kode}
                    </code>
                  </td>
                  <td className="text-xs">
                    <Badge
                      tone={
                        t.klasifikasi === "OBSERVASI"
                          ? "blue"
                          : t.klasifikasi === "KTS_MINOR"
                            ? "amber"
                            : "red"
                      }
                    >
                      {KLASIFIKASI_LABEL[t.klasifikasi!]}
                    </Badge>
                    {t.catatanLapangan && <div className="mt-1">{t.catatanLapangan}</div>}
                  </td>
                  <td className="text-xs">
                    <div>{t.rtlRencana ?? "—"}</div>
                    {t.rtlLinkBukti && (
                      <a
                        href={t.rtlLinkBukti}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono font-bold text-blue-700 underline"
                      >
                        ↗ Bukti RTL
                      </a>
                    )}
                  </td>
                  <td>
                    <Badge tone={t.rtlStatus === "TERVERIFIKASI" ? "green" : "amber"}>
                      {RTL_LABEL[t.rtlStatus]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
