import { requireUser } from "@/lib/auth";
import { getActivePeriode } from "@/lib/periode";
import { getRekap } from "@/lib/rekap";
import { fmtWaktu } from "@/lib/format";
import { Badge, Empty, PageHeader, Stat } from "@/components/ui";

export default async function LpmRekapPage() {
  await requireUser("LPM");
  const periode = await getActivePeriode();
  if (!periode) return <Empty>Belum ada periode aktif.</Empty>;

  const { rows, total, persenCapaian } = await getRekap(periode.id);

  return (
    <>
      <PageHeader
        title="Rekapitulasi Hasil Audit Mutu Internal & RTL (LPM)"
        desc={`${periode.nama} (${periode.tahun}) — Kompilasi hasil audit seluruh unit kerja & program studi ITBMP.`}
      >
        <Badge tone={periode.disahkanAt ? "green" : "amber"}>
          {periode.disahkanAt
            ? `✅ Disahkan Pimpinan (${periode.disahkanOleh}) pada ${fmtWaktu(periode.disahkanAt)}`
            : "⏳ Menunggu Pengesahan Pimpinan"}
        </Badge>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Unit Sasaran Diaudit" value={`${total.unit} Unit`} note={`${total.indikator} Indikator per unit`} />
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
              <th>Unit / Program Studi</th>
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
    </>
  );
}
