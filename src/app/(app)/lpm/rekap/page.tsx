import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PRODI_LIST } from "@/lib/roles";
import {
  BUTUH_RTL,
  KLASIFIKASI_LABEL,
  RTL_LABEL,
  sortPeriodesChronological,
} from "@/lib/periode";
import { Badge, Empty, Flash, PageHeader, Stat, one, type SP } from "@/components/ui";
import { SignaturePadCard } from "@/components/SignaturePadCard";
import { TabelInstrumenDanRekap } from "@/components/TabelInstrumenDanRekap";
import { sahkanLaporanAkhir } from "../actions";

export default async function LpmRekapPage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser("LPM");
  const sp = await searchParams;
  const prodiFilter = one(sp.prodi) ?? "ALL";

  const [rawPeriodes, daftarTemuan] = await Promise.all([
    prisma.periode.findMany({
      include: {
        unit: true,
        indikator: {
          orderBy: [{ urutan: "asc" }, { kode: "asc" }],
          include: { isian: true },
        },
      },
    }),
    prisma.isian.findMany({
      where: { klasifikasi: { in: BUTUH_RTL } },
      include: { unit: true, indikator: { include: { periode: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  if (rawPeriodes.length === 0) return <Empty>Belum ada Sesi AMI.</Empty>;

  const allSortedPeriodes = sortPeriodesChronological(rawPeriodes);
  const periodes =
    prodiFilter === "ALL"
      ? allSortedPeriodes
      : allSortedPeriodes.filter((p) => p.unit?.kode === prodiFilter);

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
      <PageHeader title="Rekap, Tanda Tangan & Pengesahan">
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/rekap-excel?print=1"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs"
          >
            🖨️ Print Semua
          </a>
          <a href="/api/rekap-excel" className="btn text-xs">
            📥 Download Semua Excel (.xls)
          </a>
        </div>
      </PageHeader>
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {/* Filter per Prodi (Urutan Kronologis TA & Semester) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black uppercase text-black">Filter Prodi:</span>
          <Link
            href="/lpm/rekap?prodi=ALL"
            className={prodiFilter === "ALL" ? "btn text-xs" : "btn-secondary text-xs"}
          >
            Semua Prodi ({allSortedPeriodes.length})
          </Link>
          {PRODI_LIST.map((pr) => (
            <Link
              key={pr.kode}
              href={`/lpm/rekap?prodi=${pr.kode}`}
              className={prodiFilter === pr.kode ? "btn text-xs" : "btn-secondary text-xs"}
            >
              {pr.nama}
            </Link>
          ))}
        </div>
        <Badge tone="slate">📅 Urutan: Tahun Akademik &amp; Semester (Ganjil ➔ Genap)</Badge>
      </div>

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
              <th>Status Tanda Tangan</th>
              <th>Pengesahan &amp; Export</th>
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
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={p.ttdAuditee ? "green" : "amber"}>
                        {p.ttdAuditee ? "✅ Auditee" : "⏳ Auditee"}
                      </Badge>
                      <Badge tone={p.ttdAuditor ? "green" : "amber"}>
                        {p.ttdAuditor ? "✅ Auditor" : "⏳ Auditor"}
                      </Badge>
                      <Badge tone={p.ttdLpm ? "green" : "amber"}>
                        {p.ttdLpm ? "✅ LPM" : "⏳ LPM"}
                      </Badge>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-wrap items-center gap-2">
                      {p.disahkanAt ? (
                        <Badge tone="green">✓ Disahkan ({p.disahkanOleh})</Badge>
                      ) : (
                        <form action={sahkanLaporanAkhir}>
                          <input type="hidden" name="periodeId" value={p.id} />
                          <button className="btn text-xs">Sahkan</button>
                        </form>
                      )}
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
                        className="btn-success text-xs"
                      >
                        📥 Excel
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Panel Tempel Tanda Tangan Kepala LPM & 2 Tab Tabel Rekap per Sesi */}
      <div className="space-y-6">
        {periodes.map((p) => {
          const rekapRows = p.indikator.map((ind) => ({
            id: ind.id,
            kode: ind.kode,
            standar: ind.standar,
            pernyataanStandar: ind.pernyataanStandar,
            pernyataan: ind.pernyataan,
            buktiDiminta: ind.buktiDiminta,
            isian: ind.isian.find((i) => !p.unitId || i.unitId === p.unitId) ?? ind.isian[0] ?? null,
          }));

          return (
            <div key={p.id} className="space-y-3">
              <SignaturePadCard
                session={{
                  periodeId: p.id,
                  periodeNama: p.nama,
                  ketuaAuditeeId: p.ketuaAuditeeId,
                  ketuaAuditeeNama: p.ketuaAuditeeNama,
                  ketuaAuditeeNip: p.ketuaAuditeeNip,
                  hasTtdAuditee: Boolean(p.ttdAuditee),
                  ttdAuditeePreview: p.ttdAuditee,
                  ketuaAuditorId: p.ketuaAuditorId,
                  ketuaAuditorNama: p.ketuaAuditorNama,
                  ketuaAuditorNip: p.ketuaAuditorNip,
                  hasTtdAuditor: Boolean(p.ttdAuditor),
                  ttdAuditorPreview: p.ttdAuditor,
                  kepalaLpmNama: p.kepalaLpmNama ?? user.nama,
                  kepalaLpmNip: p.kepalaLpmNip ?? user.nimNuptk,
                  hasTtdLpm: Boolean(p.ttdLpm),
                  ttdLpmPreview: p.ttdLpm,
                }}
                currentUserId={user.id}
                currentRole="LPM"
              />

              <TabelInstrumenDanRekap
                periodeId={p.id}
                periodeNama={p.nama}
                indikator={rekapRows}
                defaultTab="rekap"
              />
            </div>
          );
        })}
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
