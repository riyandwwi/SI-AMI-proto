import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActivePeriode } from "@/lib/periode";
import { cekKonsistensi } from "@/lib/qc";
import { fmtTanggal, fmtWaktu, toInputDate, toInputDateTime } from "@/lib/format";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";
import { jalankanUsulanTimOtomatis, sahkanPenugasan, simpanPenugasanManual } from "../actions";

export default async function LpmPenugasanPage({ searchParams }: { searchParams: SP }) {
  await requireUser("LPM");
  const sp = await searchParams;
  const periode = await getActivePeriode();

  if (!periode) return <Empty>Belum ada periode aktif. Buat periode terlebih dahulu di menu Sesi &amp; Periode.</Empty>;

  const [units, auditors, penugasan, qc] = await Promise.all([
    prisma.unit.findMany({ where: { diaudit: true }, orderBy: { kode: "asc" } }),
    prisma.user.findMany({
      where: { role: "AUDITOR", aktif: true },
      include: { unit: true },
      orderBy: { nama: "asc" },
    }),
    prisma.penugasan.findMany({
      where: { periodeId: periode.id },
      include: { unit: true, tim: { include: { auditor: { include: { unit: true } } } } },
    }),
    cekKonsistensi(periode.id),
  ]);

  const penugasanByUnit = new Map(penugasan.map((p) => [p.unitId, p]));

  return (
    <>
      <PageHeader
        title="Plotting Tim Auditor, Conflict of Interest & Jadwal AMI"
        desc="Menerapkan 4 Prinsip Buku Panduan: Source-Lock, Bebas Conflict of Interest, Team Continuity (Tim Dokumen = Tim Lapangan), dan Human Approval."
      >
        <form action={jalankanUsulanTimOtomatis}>
          <button className="btn">✨ Buat Usulan Tim Otomatis (Bebas CoI &amp; Seimbang)</button>
        </form>
      </PageHeader>
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {/* Panel Quality Control Cross-Check & Beban Kerja Auditor */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card space-y-2 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">🔍 Quality Control &amp; Cross-Check Konsistensi Rencana AMI</h2>
            <Badge tone={qc.isu.some((i) => i.level === "ERROR") ? "amber" : "green"}>
              {qc.isu.length === 0 ? "Semua Valid & Siap" : `${qc.isu.length} Catatan Verifikasi`}
            </Badge>
          </div>
          {qc.isu.length === 0 ? (
            <p className="text-xs text-emerald-700">
              ✅ Seluruh unit sasaran telah memiliki tim auditor, bebas Conflict of Interest, jadwal lengkap, dan tidak ada bentrok jadwal.
            </p>
          ) : (
            <ul className="space-y-1 text-xs">
              {qc.isu.map((it, idx) => (
                <li
                  key={idx}
                  className={`rounded px-2.5 py-1.5 ${
                    it.level === "ERROR" ? "bg-amber-50 text-amber-900 border border-amber-200" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  <strong>{it.level === "ERROR" ? "⚠️ Wajib Diverifikasi:" : "ℹ️ Info:"}</strong> {it.pesan}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card space-y-2">
          <h2 className="text-sm font-bold text-slate-900">⚖️ Keseimbangan Beban Auditor</h2>
          {qc.beban.length === 0 ? (
            <p className="text-xs text-slate-500">Belum ada akun Auditor aktif.</p>
          ) : (
            <div className="space-y-1.5 text-xs">
              {qc.beban.map((b) => (
                <div key={b.auditorId} className="flex items-center justify-between rounded border border-slate-100 px-2.5 py-1.5">
                  <span className="font-medium text-slate-800">{b.nama}</span>
                  <div className="flex items-center gap-1.5">
                    <Badge tone="blue">{b.total} Auditee</Badge>
                    <Badge tone="slate">{b.ketua}x Ketua</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Daftar Unit & Form Penugasan Tim + Jadwal */}
      <div className="space-y-4">
        {units.map((u) => {
          const p = penugasanByUnit.get(u.id);
          const ketua = p?.tim.find((t) => t.peran === "KETUA")?.auditor;
          const anggota = p?.tim.find((t) => t.peran === "ANGGOTA")?.auditor;

          return (
            <div key={u.id} className="card space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold">{u.kode}</code>
                  <h3 className="text-base font-bold text-slate-900">{u.nama}</h3>
                  <Badge tone="blue">🔗 Team Continuity: Tim Dokumen = Tim Lapangan</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {p ? (
                    <>
                      <Badge tone={p.sumber === "USULAN_OTOMATIS" ? "purple" : "slate"}>
                        {p.sumber === "USULAN_OTOMATIS" ? "Usulan Otomatis" : "Ditetapkan LPM"}
                      </Badge>
                      <Badge tone={p.disahkan ? "green" : "amber"}>
                        {p.disahkan ? "✅ Disahkan LPM (Human Approved)" : "⏳ Draft — Perlu Pengesahan LPM"}
                      </Badge>
                      {!p.disahkan && (
                        <form action={sahkanPenugasan}>
                          <input type="hidden" name="penugasanId" value={p.id} />
                          <button className="btn-success text-xs">✅ Sahkan Penugasan</button>
                        </form>
                      )}
                    </>
                  ) : (
                    <Badge tone="red">⚠️ Belum Ada Tim Auditor</Badge>
                  )}
                </div>
              </div>

              <form action={simpanPenugasanManual} className="space-y-3">
                <input type="hidden" name="unitId" value={u.id} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <label>Ketua Tim Auditor (Bebas CoI)</label>
                    <select name="ketuaId" required defaultValue={ketua?.id ?? ""} className="w-full">
                      <option value="">— Pilih Ketua Auditor —</option>
                      {auditors.map((a) => {
                        const isCoI = a.unitId === u.id;
                        return (
                          <option key={a.id} value={a.id} disabled={isCoI}>
                            {a.nama} ({a.unit?.kode ?? "Non-Unit"}){isCoI ? " — ❌ CoI (Unit Sendiri)" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label>Anggota Tim Auditor (Bebas CoI)</label>
                    <select name="anggotaId" required defaultValue={anggota?.id ?? ""} className="w-full">
                      <option value="">— Pilih Anggota Auditor —</option>
                      {auditors.map((a) => {
                        const isCoI = a.unitId === u.id;
                        return (
                          <option key={a.id} value={a.id} disabled={isCoI}>
                            {a.nama} ({a.unit?.kode ?? "Non-Unit"}){isCoI ? " — ❌ CoI (Unit Sendiri)" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label>
                      Mulai Audit Dokumen ({p?.jadwalDokumenMulai ? fmtTanggal(p.jadwalDokumenMulai) : "Perlu verifikasi manual"})
                    </label>
                    <input
                      name="jadwalDokumenMulai"
                      type="date"
                      defaultValue={toInputDate(p?.jadwalDokumenMulai)}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-1">
                    <label>
                      Selesai Audit Dokumen ({p?.jadwalDokumenSelesai ? fmtTanggal(p.jadwalDokumenSelesai) : "Perlu verifikasi manual"})
                    </label>
                    <input
                      name="jadwalDokumenSelesai"
                      type="date"
                      defaultValue={toInputDate(p?.jadwalDokumenSelesai)}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label>
                      Mulai Visitasi Lapangan ({p?.jadwalLapanganMulai ? fmtWaktu(p.jadwalLapanganMulai) : "Perlu verifikasi manual"})
                    </label>
                    <input
                      name="jadwalLapanganMulai"
                      type="datetime-local"
                      defaultValue={toInputDateTime(p?.jadwalLapanganMulai)}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-1">
                    <label>
                      Selesai Visitasi Lapangan ({p?.jadwalLapanganSelesai ? fmtWaktu(p.jadwalLapanganSelesai) : "Opsional / +3 jam"})
                    </label>
                    <input
                      name="jadwalLapanganSelesai"
                      type="datetime-local"
                      defaultValue={toInputDateTime(p?.jadwalLapanganSelesai)}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-1">
                    <label>Alasan Resmi Perubahan Tim (Wajib jika ubah tim yg sudah disahkan)</label>
                    <div className="flex gap-2">
                      <input
                        name="alasanPerubahan"
                        defaultValue={p?.alasanPerubahan ?? ""}
                        placeholder="Isi jika mengganti auditor..."
                        className="w-full"
                      />
                      <button className="btn shrink-0">Simpan</button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          );
        })}
      </div>
    </>
  );
}
