import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BUTUH_RTL, getActivePeriode, KLASIFIKASI_LABEL, RTL_LABEL, TAHAP_LABEL } from "@/lib/periode";
import { getRekap } from "@/lib/rekap";
import { fmtWaktu } from "@/lib/format";
import { Badge, Empty, Flash, PageHeader, Stat, one, type SP } from "@/components/ui";
import { sahkanLaporanInstitusi } from "./actions";

export default async function PimpinanPage({ searchParams }: { searchParams: SP }) {
  await requireUser("PIMPINAN");
  const sp = await searchParams;
  const periode = await getActivePeriode();

  if (!periode) return <Empty>Belum ada periode AMI aktif.</Empty>;

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
        title="Dashboard Eksekutif Mutu & Pengesahan Pimpinan ITBMP"
        desc={`${periode.nama} (${periode.tahun}) · Sesi Aktif: ${TAHAP_LABEL[periode.tahap]}`}
      >
        <form action={sahkanLaporanInstitusi}>
          <button className={periode.disahkanAt ? "btn-secondary" : "btn-success"}>
            {periode.disahkanAt
              ? `✅ Telah Disahkan oleh ${periode.disahkanOleh} (${fmtWaktu(periode.disahkanAt)})`
              : "✍️ Sahkan Laporan AMI Institusi (Human Approval)"}
          </button>
        </form>
      </PageHeader>
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {/* Ringkasan KPI Eksekutif */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Cakupan Unit Auditee ITBMP" value={`${total.unit} Unit`} note="100% Terpetakan" />
        <Stat
          label="Capaian Standar SPMI"
          value={persenCapaian !== null ? `${persenCapaian}%` : "—"}
          note={`${total.klasifikasi.MELAMPAUI} Melampaui · ${total.klasifikasi.MENCAPAI} Mencapai`}
          tone="text-blue-600"
        />
        <Stat
          label="Total Temuan (KTS & OB)"
          value={`${total.klasifikasi.KTS_MAYOR} Mayor · ${total.klasifikasi.KTS_MINOR} Minor`}
          note={`+ ${total.klasifikasi.OBSERVASI} Observasi (OB)`}
          tone="text-amber-600"
        />
        <Stat
          label="Status Pengesahan Laporan"
          value={periode.disahkanAt ? "Disahkan" : "Menunggu"}
          note={periode.disahkanAt ? `Oleh ${periode.disahkanOleh}` : "Prinsip Human-in-the-Loop"}
          tone={periode.disahkanAt ? "text-emerald-600" : "text-slate-700"}
        />
      </div>

      {/* Tabel Rekap Mutu per Unit Kerja / Prodi */}
      <div className="card space-y-3 overflow-x-auto">
        <h2 className="text-base font-bold text-slate-900">Rekapitulasi Ketercapaian Standar per Unit / Program Studi</h2>
        <table>
          <thead>
            <tr>
              <th>Kode</th>
              <th>Unit / Program Studi ITBMP</th>
              <th>Tim Auditor</th>
              <th>Keterisian Link Drive</th>
              <th>Hasil Klasifikasi</th>
              <th>Status Tindak Lanjut (RTL)</th>
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
                    {r.terisiLink} / {r.jmlIndikator} Bukti Drive
                  </Badge>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone="green">{r.klasifikasi.MELAMPAUI + r.klasifikasi.MENCAPAI} Tercapai</Badge>
                    <Badge tone="blue">{r.klasifikasi.OBSERVASI} OB</Badge>
                    <Badge tone={r.klasifikasi.KTS_MINOR > 0 ? "amber" : "slate"}>{r.klasifikasi.KTS_MINOR} Minor</Badge>
                    <Badge tone={r.klasifikasi.KTS_MAYOR > 0 ? "red" : "slate"}>{r.klasifikasi.KTS_MAYOR} Mayor</Badge>
                  </div>
                </td>
                <td>
                  {r.temuanTerbuka === 0 ? (
                    <Badge tone="green">✓ Closed / Terverifikasi</Badge>
                  ) : (
                    <Badge tone="amber">{r.temuanTerbuka} Temuan Dalam Tindak Lanjut</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Daftar Detail Temuan KTS / OB & Monitoring RTL */}
      <div className="card space-y-3 overflow-x-auto">
        <h2 className="text-base font-bold text-slate-900">Monitoring Temuan (OB / KTS) &amp; Rencana Tindak Lanjut (RTL)</h2>
        {daftarTemuan.length === 0 ? (
          <Empty>Belum ada temuan Observasi atau KTS pada periode ini.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Unit / Prodi</th>
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
