import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BUTUH_RTL, getActivePeriode, KLASIFIKASI_LABEL, RTL_LABEL } from "@/lib/periode";
import { getRekap } from "@/lib/rekap";
import { fmtWaktu } from "@/lib/format";
import { Badge, Empty, Flash, PageHeader, Stat, one, type SP } from "@/components/ui";
import { sahkanLaporanAkhir } from "../actions";

export default async function LpmRekapPage({ searchParams }: { searchParams: SP }) {
  await requireUser("LPM");
  const sp = await searchParams;
  const periode = await getActivePeriode();
  if (!periode) return <Empty>Belum ada periode aktif.</Empty>;

  const [{ rows, total, persenCapaian }, daftarTemuan] = await Promise.all([
    getRekap(periode.id),
    prisma.isian.findMany({
      where: {
        indikator: { periodeId: periode.id },
        klasifikasi: { in: BUTUH_RTL },
      },
      include: { unit: true, indikator: true },
      orderBy: [{ unit: { kode: "asc" } }, { indikator: { urutan: "asc" } }],
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Rekapitulasi Hasil Audit Mutu Internal & Pengesahan (LPM)"
        desc={`${periode.nama} (${periode.tahun}) — Kompilasi hasil audit 3 Program Studi ITBMP (Bisnis Digital, Aktuaria, dan Perancangan Wilayah dan Kota).`}
      >
        <form action={sahkanLaporanAkhir}>
          <button className={periode.disahkanAt ? "btn-secondary" : "btn-success"}>
            {periode.disahkanAt
              ? `✅ Disahkan oleh ${periode.disahkanOleh} (${fmtWaktu(periode.disahkanAt)})`
              : "✍️ Sahkan Laporan AMI (Human Approval)"}
          </button>
        </form>
      </PageHeader>
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Prodi Sasaran Diaudit" value={`${total.unit} Prodi`} note={`${total.indikator} Indikator per Prodi`} />
        <Stat
          label="Keterisian Bukti Google Drive"
          value={`${total.terisiLink} / ${total.slot}`}
          note="Total bukti tautan Drive terkumpul"
          tone="text-blue-600"
        />
        <Stat
          label="Capaian Standar (Melampaui/Mencapai)"
          value={persenCapaian !== null ? `${persenCapaian}%` : "—"}
          note={`${total.klasifikasi.MELAMPAUI} Melampaui · ${total.klasifikasi.MENCAPAI} Mencapai`}
          tone="text-emerald-600"
        />
        <Stat
          label="Temuan (OB / KTS Minor / Mayor)"
          value={`${total.klasifikasi.OBSERVASI} OB · ${total.klasifikasi.KTS_MINOR} Minor · ${total.klasifikasi.KTS_MAYOR} Mayor`}
          note={`${total.temuanTerbuka} temuan masih menunggu verifikasi RTL`}
          tone="text-amber-600"
        />
      </div>

      <div className="card overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Kode</th>
              <th>Program Studi</th>
              <th>Tim Auditor (Ketua &amp; Anggota)</th>
              <th>Bukti Link Drive</th>
              <th>Melampaui / Mencapai</th>
              <th>Temuan (OB / Minor / Mayor)</th>
              <th>Status RTL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.unitId}>
                <td>
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold">{r.kode}</code>
                </td>
                <td className="font-semibold text-slate-900">{r.nama}</td>
                <td className="text-slate-600">{r.tim}</td>
                <td>
                  <Badge tone={r.terisiLink === r.jmlIndikator && r.jmlIndikator > 0 ? "green" : "amber"}>
                    {r.terisiLink} / {r.jmlIndikator} Link Drive
                  </Badge>
                </td>
                <td>
                  <span className="font-semibold text-emerald-700">
                    {r.klasifikasi.MELAMPAUI} Melampaui · {r.klasifikasi.MENCAPAI} Mencapai
                  </span>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone="blue">{r.klasifikasi.OBSERVASI} OB</Badge>
                    <Badge tone={r.klasifikasi.KTS_MINOR > 0 ? "amber" : "slate"}>{r.klasifikasi.KTS_MINOR} KTS Minor</Badge>
                    <Badge tone={r.klasifikasi.KTS_MAYOR > 0 ? "red" : "slate"}>{r.klasifikasi.KTS_MAYOR} KTS Mayor</Badge>
                  </div>
                </td>
                <td>
                  {r.temuanTerbuka === 0 ? (
                    <Badge tone="green">✓ Semua Selesai / Aman</Badge>
                  ) : (
                    <Badge tone="amber">{r.temuanTerbuka} Temuan Belum Ditutup</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Monitoring Detail Temuan & RTL */}
      <div className="card space-y-3 overflow-x-auto">
        <h2 className="text-base font-bold text-slate-900">Monitoring Detail Temuan (OB / KTS) &amp; Tindak Lanjut (RTL)</h2>
        {daftarTemuan.length === 0 ? (
          <Empty>Belum ada temuan Observasi atau KTS pada periode ini.</Empty>
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
