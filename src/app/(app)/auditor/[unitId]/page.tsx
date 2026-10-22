import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  BUTUH_RTL,
  KLASIFIKASI_LABEL,
  RTL_LABEL,
  STATUS_DOK_LABEL,
} from "@/lib/periode";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";
import { simpanAuditDokumen, simpanAuditLapangan, verifikasiRtlAuditor } from "../actions";

export default async function AuditorUnitWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams: SP;
}) {
  const user = await requireUser("AUDITOR");
  const { unitId: paramId } = await params;
  const sp = await searchParams;
  const mode = one(sp.mode) ?? "dokumen"; // dokumen | lapangan | rtl

  // Cari Sesi AMI berdasarkan ID periode (atau unitId sebagai fallback)
  const periode =
    (await prisma.periode.findUnique({
      where: { id: paramId },
      include: { unit: true },
    })) ??
    (await prisma.periode.findFirst({
      where: { unitId: paramId },
      include: { unit: true },
      orderBy: { createdAt: "desc" },
    }));

  if (!periode) return <Empty>Sesi AMI tidak ditemukan.</Empty>;

  const targetUnitId = periode.unitId ?? user.unitId;
  if (!targetUnitId) return <Empty>Program Studi untuk sesi ini belum ditentukan.</Empty>;

  const [indikator, isianList, prodiAuditees] = await Promise.all([
    prisma.indikator.findMany({
      where: { periodeId: periode.id },
      orderBy: [{ urutan: "asc" }, { kode: "asc" }],
    }),
    prisma.isian.findMany({
      where: { unitId: targetUnitId, indikator: { periodeId: periode.id } },
    }),
    prisma.user.findMany({
      where: { role: "AUDITEE", unitId: targetUnitId, aktif: true },
      orderBy: { nama: "asc" },
    }),
  ]);

  const isianByInd = new Map(isianList.map((i) => [i.indikatorId, i]));
  const jmlFokusLapangan = isianList.filter((i) => i.statusDokumen === "PERLU_KLARIFIKASI").length;
  const buka = periode.aktif;

  return (
    <>
      <PageHeader
        title={`Meja Kerja Auditor — ${periode.nama}`}
        desc={`Auditee Prodi ${periode.unit?.nama ?? ""}: ${
          prodiAuditees.map((a) => `${a.nama}${a.nimNuptk ? ` (${a.nimNuptk})` : ""}`).join(", ") || "Belum ada akun Auditee"
        }`}
      >
        <Link href="/auditor" className="btn-secondary text-xs">
          ← Kembali ke Daftar Sesi
        </Link>
      </PageHeader>
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {/* Sub-Navigasi 3 Mode Pemeriksaan Auditor */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/auditor/${periode.id}?mode=dokumen`}
            className={mode === "dokumen" ? "btn text-xs" : "btn-secondary text-xs"}
          >
            📄 1. Audit Dokumen (Cek Link Drive)
          </Link>
          <Link
            href={`/auditor/${periode.id}?mode=lapangan`}
            className={mode === "lapangan" ? "btn text-xs" : "btn-secondary text-xs"}
          >
            🏛️ 2. Audit Lapangan &amp; Klasifikasi Temuan ({jmlFokusLapangan} Fokus)
          </Link>
          <Link
            href={`/auditor/${periode.id}?mode=rtl`}
            className={mode === "rtl" ? "btn text-xs" : "btn-secondary text-xs"}
          >
            🛠️ 3. Verifikasi Tindak Lanjut (RTL)
          </Link>
        </div>
        <Badge tone={buka ? "green" : "amber"}>
          {buka ? "🟢 Sesi Terbuka" : "🔒 Sesi Terkunci oleh LPM"}
        </Badge>
      </div>

      {/* Daftar Indikator */}
      <div className="space-y-4">
        {indikator.map((ind) => {
          const isian = isianByInd.get(ind.id);
          const isFokus = isian?.statusDokumen === "PERLU_KLARIFIKASI";
          const butuhRtl = isian?.klasifikasi && BUTUH_RTL.includes(isian.klasifikasi);

          if (mode === "rtl" && !butuhRtl) {
            return null;
          }

          return (
            <div
              key={ind.id}
              className={`card space-y-3 ${
                mode === "lapangan" && isFokus ? "border-amber-400 bg-amber-50/30" : ""
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">{ind.kode}</code>
                  <span className="text-sm font-bold text-slate-900">{ind.standar}</span>
                  <span className="text-xs text-slate-500">• Target: {ind.target}</span>
                  {isFokus && (
                    <Badge tone="amber">🎯 Fokus Konfirmasi Audit Lapangan</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isian?.linkDrive ? (
                    <a
                      href={isian.linkDrive}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary text-xs"
                    >
                      📂 Buka Link Google Drive Bukti Auditee ↗
                    </a>
                  ) : (
                    <Badge tone="red">⚠️ Auditee Belum Mengisi Link Drive</Badge>
                  )}
                </div>
              </div>

              <p className="text-sm text-slate-800">{ind.pernyataan}</p>

              {/* Kotak Klaim & Link Drive Auditee */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
                <div>
                  <strong>Klaim Evaluasi Diri Auditee:</strong>{" "}
                  {isian?.klaim ? isian.klaim : <em className="text-slate-400">Belum diisi oleh Auditee</em>}
                </div>
                <div className="truncate">
                  <strong>Tautan Google Drive:</strong>{" "}
                  {isian?.linkDrive ? (
                    <a href={isian.linkDrive} target="_blank" rel="noopener noreferrer" className="font-mono text-blue-600 underline">
                      {isian.linkDrive}
                    </a>
                  ) : (
                    <em className="text-slate-400">Belum ada link</em>
                  )}
                </div>
              </div>

              {/* MODE 1: AUDIT DOKUMEN (DESK AUDIT) */}
              {mode === "dokumen" && (
                <form action={simpanAuditDokumen} className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-3">
                  <input type="hidden" name="periodeId" value={periode.id} />
                  <input type="hidden" name="unitId" value={targetUnitId} />
                  <input type="hidden" name="indikatorId" value={ind.id} />
                  <div className="space-y-1">
                    <label>Status Kecukupan Bukti Drive (Desk Audit)</label>
                    <select
                      name="statusDokumen"
                      disabled={!buka}
                      defaultValue={isian?.statusDokumen ?? "BELUM_DICEK"}
                      className="w-full"
                    >
                      <option value="BELUM_DICEK">⏳ Belum Diperiksa</option>
                      <option value="LENGKAP">✅ Bukti Drive Lengkap &amp; Sesuai</option>
                      <option value="PERLU_KLARIFIKASI">🎯 Perlu Klarifikasi di Audit Lapangan</option>
                    </select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label>Catatan Audit Dokumen &amp; Daftar Pertanyaan untuk Audit Lapangan</label>
                    <div className="flex gap-2">
                      <input
                        name="catatanDokumen"
                        disabled={!buka}
                        defaultValue={isian?.catatanDokumen ?? ""}
                        placeholder="Tulis hasil pemeriksaan dokumen Drive & fokus pertanyaan lapangan..."
                        className="w-full"
                      />
                      {buka && <button className="btn shrink-0">Simpan Desk Audit</button>}
                    </div>
                  </div>
                </form>
              )}

              {/* MODE 2: AUDIT LAPANGAN & KLASIFIKASI TEMUAN */}
              {mode === "lapangan" && (
                <>
                  <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-2.5 text-xs">
                    <strong>Catatan dari Audit Dokumen ({STATUS_DOK_LABEL[isian?.statusDokumen ?? "BELUM_DICEK"]}):</strong>{" "}
                    {isian?.catatanDokumen ?? "Belum ada catatan audit dokumen."}
                  </div>

                  <form action={simpanAuditLapangan} className="space-y-3 pt-1">
                    <input type="hidden" name="periodeId" value={periode.id} />
                    <input type="hidden" name="unitId" value={targetUnitId} />
                    <input type="hidden" name="indikatorId" value={ind.id} />
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="space-y-1">
                        <label>Klasifikasi Hasil / Temuan Audit</label>
                        <select
                          name="klasifikasi"
                          disabled={!buka}
                          defaultValue={isian?.klasifikasi ?? "MENCAPAI"}
                          className="w-full font-semibold"
                        >
                          <option value="MELAMPAUI">🌟 Melampaui Standar</option>
                          <option value="MENCAPAI">✅ Mencapai Standar</option>
                          <option value="OBSERVASI">👀 Observasi (OB)</option>
                          <option value="KTS_MINOR">⚠️ KTS Minor</option>
                          <option value="KTS_MAYOR">🚨 KTS Mayor</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label>Fakta Lapangan / Akar Masalah</label>
                        <input
                          name="catatanLapangan"
                          disabled={!buka}
                          defaultValue={isian?.catatanLapangan ?? ""}
                          placeholder="Catat hasil konfirmasi wawancara/observasi..."
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-1">
                        <label>Rekomendasi Perbaikan Auditor</label>
                        <div className="flex gap-2">
                          <input
                            name="rekomendasi"
                            disabled={!buka}
                            defaultValue={isian?.rekomendasi ?? ""}
                            placeholder="Rekomendasi tindak lanjut..."
                            className="w-full"
                          />
                          {buka && <button className="btn-success shrink-0">Simpan Temuan</button>}
                        </div>
                      </div>
                    </div>
                  </form>
                </>
              )}

              {/* MODE 3: VERIFIKASI TINDAK LANJUT (RTL) */}
              {mode === "rtl" && isian && (
                <div className="space-y-3 pt-1">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs space-y-1">
                    <div>
                      <strong>Klasifikasi Temuan:</strong> {KLASIFIKASI_LABEL[isian.klasifikasi!]} — {isian.catatanLapangan}
                    </div>
                    <div>
                      <strong>Rencana Tindak Lanjut Auditee:</strong> {isian.rtlRencana ?? "Belum diisi Auditee"}
                    </div>
                    <div>
                      <strong>Link Google Drive Bukti Perbaikan:</strong>{" "}
                      {isian.rtlLinkBukti ? (
                        <a href={isian.rtlLinkBukti} target="_blank" rel="noopener noreferrer" className="font-mono text-blue-600 underline">
                          {isian.rtlLinkBukti}
                        </a>
                      ) : (
                        "Belum diunggah Auditee"
                      )}
                    </div>
                  </div>

                  <form action={verifikasiRtlAuditor} className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <input type="hidden" name="periodeId" value={periode.id} />
                    <input type="hidden" name="isianId" value={isian.id} />
                    <div className="space-y-1">
                      <label>Keputusan Verifikasi RTL ({RTL_LABEL[isian.rtlStatus]})</label>
                      <select
                        name="rtlStatus"
                        disabled={!buka}
                        defaultValue={isian.rtlStatus === "TERVERIFIKASI" ? "TERVERIFIKASI" : "PROSES"}
                        className="w-full"
                      >
                        <option value="PROSES">⏳ Masih Perlu Perbaikan (Proses)</option>
                        <option value="TERVERIFIKASI">✅ Closed / Terverifikasi Selesai</option>
                      </select>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label>Catatan Verifikasi RTL Auditor</label>
                      <div className="flex gap-2">
                        <input
                          name="rtlCatatanAuditor"
                          disabled={!buka}
                          defaultValue={isian.rtlCatatanAuditor ?? ""}
                          placeholder="Catatan hasil pengecekan bukti perbaikan..."
                          className="w-full"
                        />
                        {buka && <button className="btn-success shrink-0">Simpan Verifikasi</button>}
                      </div>
                    </div>
                  </form>
                </div>
              )}
            </div>
          );
        })}

        {mode === "rtl" && isianList.filter((i) => i.klasifikasi && BUTUH_RTL.includes(i.klasifikasi)).length === 0 && (
          <Empty>Tidak ada temuan Observasi / KTS yang memerlukan verifikasi RTL pada sesi ini.</Empty>
        )}
      </div>
    </>
  );
}
