import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BUTUH_RTL, KLASIFIKASI_LABEL, RTL_LABEL, STATUS_DOK_LABEL } from "@/lib/periode";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";
import { simpanIsianAuditee, simpanRtlAuditee } from "./actions";

export default async function AuditeePage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser("AUDITEE");
  const sp = await searchParams;

  if (!user.unitId || !user.unit) {
    return <Empty>Akun Auditee Anda belum dihubungkan ke Program Studi. Hubungi Super Admin.</Empty>;
  }

  // Cari Sesi AMI untuk Prodi Auditee ini (atau sesi umum terbaru)
  const periode =
    (await prisma.periode.findFirst({
      where: { unitId: user.unitId },
      orderBy: [{ aktif: "desc" }, { createdAt: "desc" }],
    })) ??
    (await prisma.periode.findFirst({
      orderBy: [{ aktif: "desc" }, { createdAt: "desc" }],
    }));

  if (!periode) {
    return <Empty>Belum ada Sesi AMI yang dibuat oleh LPM untuk Program Studi {user.unit.nama}.</Empty>;
  }

  const [indikator, isianList, prodiAuditors] = await Promise.all([
    prisma.indikator.findMany({
      where: { periodeId: periode.id },
      orderBy: [{ urutan: "asc" }, { kode: "asc" }],
    }),
    prisma.isian.findMany({
      where: { unitId: user.unitId, indikator: { periodeId: periode.id } },
    }),
    prisma.user.findMany({
      where: { role: "AUDITOR", unitId: user.unitId, aktif: true },
      orderBy: { nama: "asc" },
    }),
  ]);

  const isianByInd = new Map(isianList.map((i) => [i.indikatorId, i]));
  const buka = periode.aktif;

  return (
    <>
      <PageHeader
        title={`Portal Evaluasi Diri & Bukti Drive — Prodi ${user.unit.nama}`}
        desc={`${periode.nama} · Tahun Akademik ${periode.tahun} (${periode.semester})`}
      >
        <Badge tone={buka ? "green" : "amber"}>
          {buka ? "🟢 Sesi AMI Terbuka (Dapat Mengisi Bukti)" : "🔒 Sesi AMI Terkunci oleh LPM"}
        </Badge>
      </PageHeader>
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {/* Info Auditor Prodi */}
      <div className="card flex flex-wrap items-center justify-between gap-3 text-xs">
        <div>
          <span className="font-semibold text-slate-700">Auditor Program Studi {user.unit.nama}: </span>
          {prodiAuditors.length > 0 ? (
            <span className="font-bold text-slate-900">
              {prodiAuditors.map((a) => `${a.nama}${a.nimNuptk ? ` (${a.nimNuptk})` : ""}`).join(", ")}
            </span>
          ) : (
            <span className="text-slate-500">Belum ada akun Auditor untuk Prodi ini</span>
          )}
        </div>
        <div className="text-slate-600">
          Tempelkan tautan (link) folder/file <strong>Google Drive</strong> resmi pada setiap indikator di bawah ini.
        </div>
      </div>

      {/* Daftar Indikator */}
      {indikator.length === 0 ? (
        <Empty>LPM belum menambahkan indikator pada sesi ini.</Empty>
      ) : (
        <div className="space-y-4">
          {indikator.map((ind) => {
            const isian = isianByInd.get(ind.id);
            const perluRtl = isian?.klasifikasi && BUTUH_RTL.includes(isian.klasifikasi);

            return (
              <div key={ind.id} className="card space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">{ind.kode}</code>
                    <span className="text-sm font-bold text-slate-900">{ind.standar}</span>
                    <span className="text-xs text-slate-500">• Target: {ind.target}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={isian?.linkDrive ? "green" : "amber"}>
                      {isian?.linkDrive ? "✓ Link Drive Tersimpan" : "⚠️ Belum Ada Link Drive"}
                    </Badge>
                    {isian && (
                      <Badge
                        tone={
                          isian.statusDokumen === "LENGKAP"
                            ? "green"
                            : isian.statusDokumen === "PERLU_KLARIFIKASI"
                              ? "amber"
                              : "slate"
                        }
                      >
                        Desk Audit: {STATUS_DOK_LABEL[isian.statusDokumen]}
                      </Badge>
                    )}
                    {isian?.klasifikasi && (
                      <Badge
                        tone={
                          isian.klasifikasi === "MELAMPAUI" || isian.klasifikasi === "MENCAPAI"
                            ? "green"
                            : isian.klasifikasi === "OBSERVASI"
                              ? "blue"
                              : isian.klasifikasi === "KTS_MINOR"
                                ? "amber"
                                : "red"
                        }
                      >
                        Hasil: {KLASIFIKASI_LABEL[isian.klasifikasi]}
                      </Badge>
                    )}
                  </div>
                </div>

                <p className="text-sm text-slate-800">{ind.pernyataan}</p>
                {ind.buktiDiminta && (
                  <p className="text-xs text-slate-500">
                    <strong>Dokumen Bukti yang Diminta di Google Drive:</strong> {ind.buktiDiminta}
                  </p>
                )}

                {/* Form Evaluasi Diri & Link Google Drive */}
                <form action={simpanIsianAuditee} className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-2">
                  <input type="hidden" name="indikatorId" value={ind.id} />
                  <div className="space-y-1">
                    <label>Klaim Evaluasi Diri Auditee</label>
                    <textarea
                      name="klaim"
                      rows={2}
                      required
                      disabled={!buka}
                      defaultValue={isian?.klaim ?? ""}
                      placeholder="Jelaskan pemenuhan standar di prodi Anda..."
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1">
                    <label>🔗 Tautan Bukti Google Drive (https://drive.google.com/...)</label>
                    <div className="flex gap-2">
                      <input
                        name="linkDrive"
                        type="url"
                        required
                        disabled={!buka}
                        defaultValue={isian?.linkDrive ?? ""}
                        placeholder="https://drive.google.com/drive/folders/..."
                        className="w-full font-mono text-xs"
                      />
                      {buka && <button className="btn shrink-0">Simpan</button>}
                    </div>
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-slate-500">Pastikan akses folder/file Drive disetel Viewer untuk Auditor.</span>
                      {isian?.linkDrive && (
                        <a
                          href={isian.linkDrive}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-blue-600 hover:underline"
                        >
                          ↗ Buka Link Drive
                        </a>
                      )}
                    </div>
                  </div>
                </form>

                {/* Catatan Auditor (Jika sudah diperiksa) */}
                {(isian?.catatanDokumen || isian?.catatanLapangan || isian?.rekomendasi) && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
                    {isian.catatanDokumen && (
                      <div>
                        <strong>Catatan Audit Dokumen (Auditor):</strong> {isian.catatanDokumen}
                      </div>
                    )}
                    {isian.catatanLapangan && (
                      <div>
                        <strong>Temuan / Catatan Audit Lapangan:</strong> {isian.catatanLapangan}
                      </div>
                    )}
                    {isian.rekomendasi && (
                      <div>
                        <strong>Rekomendasi Perbaikan:</strong> {isian.rekomendasi}
                      </div>
                    )}
                  </div>
                )}

                {/* Form Rencana Tindak Lanjut (RTL) jika terdapat temuan OB / KTS */}
                {isian && perluRtl && (
                  <form action={simpanRtlAuditee} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2.5">
                    <input type="hidden" name="isianId" value={isian.id} />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-amber-900">
                        🛠️ Rencana Tindak Lanjut (RTL) atas Temuan {KLASIFIKASI_LABEL[isian.klasifikasi!]}
                      </span>
                      <Badge tone={isian.rtlStatus === "TERVERIFIKASI" ? "green" : "amber"}>
                        Status RTL: {RTL_LABEL[isian.rtlStatus]}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <label>Rencana / Tindakan Perbaikan Auditee</label>
                        <input
                          name="rtlRencana"
                          required
                          disabled={!buka || isian.rtlStatus === "TERVERIFIKASI"}
                          defaultValue={isian.rtlRencana ?? ""}
                          placeholder="Uraikan tindakan koreksi yang dilakukan..."
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-1">
                        <label>Link Google Drive Bukti Perbaikan (RTL)</label>
                        <div className="flex gap-2">
                          <input
                            name="rtlLinkBukti"
                            type="url"
                            disabled={!buka || isian.rtlStatus === "TERVERIFIKASI"}
                            defaultValue={isian.rtlLinkBukti ?? ""}
                            placeholder="https://drive.google.com/drive/folders/..."
                            className="w-full font-mono text-xs"
                          />
                          {buka && isian.rtlStatus !== "TERVERIFIKASI" && (
                            <button className="btn shrink-0 text-xs">Simpan RTL</button>
                          )}
                        </div>
                      </div>
                    </div>
                    {isian.rtlCatatanAuditor && (
                      <div className="text-xs text-slate-700">
                        <strong>Catatan Verifikasi RTL Auditor:</strong> {isian.rtlCatatanAuditor}
                      </div>
                    )}
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
