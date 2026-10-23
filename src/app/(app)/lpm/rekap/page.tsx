import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BUTUH_RTL, KLASIFIKASI_LABEL, RTL_LABEL } from "@/lib/periode";
import { fmtWaktu } from "@/lib/format";
import { Badge, Empty, Flash, PageHeader, Stat, one, type SP } from "@/components/ui";
import { sahkanLaporanAkhir } from "../actions";

export default async function LpmRekapPage({ searchParams }: { searchParams: SP }) {
  await requireUser("LPM");
  const sp = await searchParams;

  const [periodes, allUsers, daftarTemuan] = await Promise.all([
    prisma.periode.findMany({
      include: {
        unit: true,
        indikator: { include: { isian: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { role: { in: ["AUDITOR", "AUDITEE"] }, aktif: true },
      orderBy: { nama: "asc" },
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
      <PageHeader
        title="Rekapitulasi Hasil Audit Mutu Internal & Pengesahan (LPM)"
        desc="Kompilasi hasil audit seluruh Sesi AMI pada 3 Program Studi ITBMP (Bisnis Digital, Aktuaria, dan Perancangan Wilayah dan Kota)."
      />
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Total Sesi AMI"
          value={`${periodes.length} Sesi`}
          note={`${totalSlot} Total Butir Indikator`}
          color="bg-[#E9D5FF]"
        />
        <Stat
          label="Keterisian Bukti Google Drive"
          value={`${totalDrive} / ${totalSlot}`}
          note="Total bukti tautan Drive terkumpul"
          color="bg-[#FEF08A]"
        />
        <Stat
          label="Capaian Standar (Melampaui/Mencapai)"
          value={persenCapaian !== null ? `${persenCapaian}%` : "—"}
          note={`${totalMelampaui} Melampaui · ${totalMencapai} Mencapai`}
          color="bg-[#D9F99D]"
        />
        <Stat
          label="Temuan (OB / KTS Minor / Mayor)"
          value={`${totalOb} OB · ${totalMinor} Minor · ${totalMayor} Mayor`}
          note="Ringkasan temuan seluruh sesi"
          color="bg-[#BAE6FD]"
        />
      </div>

      {/* Tabel Rekap per Sesi AMI */}
      <div className="card overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Sesi AMI &amp; Semester</th>
              <th>Program Studi</th>
              <th>Auditee &amp; Auditor Prodi</th>
              <th>Bukti Link Drive</th>
              <th>Hasil Temuan</th>
              <th>Pengesahan LPM</th>
            </tr>
          </thead>
          <tbody>
            {periodes.map((p) => {
              const auditees = allUsers.filter((u) => u.role === "AUDITEE" && (!p.unitId || u.unitId === p.unitId));
              const auditors = allUsers.filter((u) => u.role === "AUDITOR" && (!p.unitId || u.unitId === p.unitId));
              const jmlInd = p.indikator.length;
              const isianList = p.indikator
                .map((ind) => ind.isian.find((i) => !p.unitId || i.unitId === p.unitId) ?? ind.isian[0])
                .filter(Boolean);
              const terisi = isianList.filter((i) => i?.linkDrive).length;
              const tercapai = isianList.filter(
                (i) => i?.klasifikasi === "MELAMPAUI" || i?.klasifikasi === "MENCAPAI"
              ).length;
              const ob = isianList.filter((i) => i?.klasifikasi === "OBSERVASI").length;
              const minor = isianList.filter((i) => i?.klasifikasi === "KTS_MINOR").length;
              const mayor = isianList.filter((i) => i?.klasifikasi === "KTS_MAYOR").length;

              return (
                <tr key={p.id}>
                  <td>
                    <div className="font-semibold text-slate-900">{p.nama}</div>
                    <div className="text-xs text-slate-500">
                      Tahun {p.tahun} · Semester {p.semester}
                    </div>
                  </td>
                  <td className="font-semibold text-slate-800">{p.unit?.nama ?? "—"}</td>
                  <td className="text-xs text-slate-600 space-y-1">
                    <div>
                      <strong>Auditee:</strong> {auditees.map((a) => a.nama).join(", ") || "—"}
                    </div>
                    <div>
                      <strong>Auditor:</strong> {auditors.map((a) => a.nama).join(", ") || "—"}
                    </div>
                  </td>
                  <td>
                    <Badge tone={terisi === jmlInd && jmlInd > 0 ? "green" : "amber"}>
                      {terisi} / {jmlInd} Link Drive
                    </Badge>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <Badge tone="green">{tercapai} Tercapai</Badge>
                      <Badge tone="blue">{ob} OB</Badge>
                      <Badge tone={minor > 0 ? "amber" : "slate"}>{minor} Minor</Badge>
                      <Badge tone={mayor > 0 ? "red" : "slate"}>{mayor} Mayor</Badge>
                    </div>
                  </td>
                  <td>
                    {p.disahkanAt ? (
                      <Badge tone="green">
                        ✅ Disahkan ({fmtWaktu(p.disahkanAt)})
                      </Badge>
                    ) : (
                      <form action={sahkanLaporanAkhir}>
                        <input type="hidden" name="periodeId" value={p.id} />
                        <button className="btn-success text-xs">✍️ Sahkan</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Monitoring Detail Temuan & RTL */}
      <div className="card space-y-3 overflow-x-auto">
        <h2 className="text-base font-bold text-slate-900">Monitoring Detail Temuan (OB / KTS) &amp; Tindak Lanjut (RTL)</h2>
        {daftarTemuan.length === 0 ? (
          <Empty>Belum ada temuan Observasi atau KTS.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Program Studi</th>
                <th>Indikator</th>
                <th>Klasifikasi</th>
                <th>Uraian Temuan &amp; Rekomendasi Auditor</th>
                <th>Rencana Tindak Lanjut &amp; Link Bukti Drive</th>
                <th>Status RTL</th>
              </tr>
            </thead>
            <tbody>
              {daftarTemuan.map((t) => (
                <tr key={t.id}>
                  <td className="font-semibold text-slate-900">{t.unit.nama}</td>
                  <td>
                    <code className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-bold text-blue-700">{t.indikator.kode}</code>
                    <div className="mt-0.5 text-xs text-slate-500">{t.indikator.standar}</div>
                  </td>
                  <td>
                    <Badge
                      tone={
                        t.klasifikasi === "OBSERVASI" ? "blue" : t.klasifikasi === "KTS_MINOR" ? "amber" : "red"
                      }
                    >
                      {KLASIFIKASI_LABEL[t.klasifikasi!]}
                    </Badge>
                  </td>
                  <td className="text-xs text-slate-700">
                    <div>{t.catatanLapangan ?? "—"}</div>
                    {t.rekomendasi && (
                      <div className="mt-1 text-slate-500">
                        <strong>Rekomendasi:</strong> {t.rekomendasi}
                      </div>
                    )}
                  </td>
                  <td className="text-xs">
                    <div>{t.rtlRencana ?? <em className="text-slate-400">Belum diisi Auditee</em>}</div>
                    {t.rtlLinkBukti && (
                      <a
                        href={t.rtlLinkBukti}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block font-mono text-blue-600 underline"
                      >
                        ↗ Buka Bukti Drive RTL
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
        )}
      </div>
    </>
  );
}
