import { requireUser } from "@/lib/auth";
import { getActivePeriode, TAHAP_DESK, TAHAP_LABEL, TAHAP_URUT, tahapIndex } from "@/lib/periode";
import { fmtTanggal, toInputDate } from "@/lib/format";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";
import { buatPeriode, simpanTanggalPeriode, toggleSourceLock, ubahTahapPeriode } from "./actions";

export default async function LpmPage({ searchParams }: { searchParams: SP }) {
  await requireUser("LPM");
  const sp = await searchParams;
  const periode = await getActivePeriode();

  return (
    <>
      <PageHeader
        title="Pengendali Siklus, Sesi & Source-Lock (LPM)"
        desc="LPM mengatur tahapan sesi AMI, mengunci sumber data (Source-Lock), serta menetapkan tanggal cut-off pengisian bukti auditee."
      />
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {!periode ? (
        <Empty>Belum ada periode AMI aktif. Silakan buat periode baru di bawah ini.</Empty>
      ) : (
        <>
          {/* Kartu Status Siklus & Source-Lock */}
          <div className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">{periode.nama}</h2>
                  <Badge tone="blue">{periode.tahun}</Badge>
                  <Badge tone={periode.sourceLocked ? "amber" : "green"}>
                    {periode.sourceLocked ? "🔒 Source-Locked (Data Dasar Dikunci)" : "🔓 Source Terbuka (Dapat Diedit)"}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Prinsip <strong>Source-Lock</strong>: Kunci sumber data sebelum membuat jadwal dan memulai pengisian agar indikator &amp; daftar unit tidak berubah di tengah audit.
                </p>
              </div>
              <form action={toggleSourceLock}>
                <button className={periode.sourceLocked ? "btn-secondary" : "btn"}>
                  {periode.sourceLocked ? "🔓 Buka Source-Lock" : "🔒 Kunci Sumber Data (Source-Lock)"}
                </button>
              </form>
            </div>

            {/* 7 Tahapan Siklus AMI (Stage-Gate Controller) */}
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                Tahapan Sesi Siklus AMI (Klik untuk Mengaktifkan / Mengunci Sesi)
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {TAHAP_URUT.map((t) => {
                  const idx = tahapIndex(t);
                  const curIdx = tahapIndex(periode.tahap);
                  const isActive = t === periode.tahap;
                  const isPast = idx < curIdx;
                  return (
                    <div
                      key={t}
                      className={`flex flex-col justify-between rounded-lg border p-3.5 ${
                        isActive
                          ? "border-blue-500 bg-blue-50/60"
                          : isPast
                            ? "border-emerald-200 bg-emerald-50/30"
                            : "border-slate-200 bg-white"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-900">{TAHAP_LABEL[t]}</span>
                          <Badge tone={isActive ? "blue" : isPast ? "green" : "slate"}>
                            {isActive ? "Sesi Aktif" : isPast ? "Selesai" : "Menunggu"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">{TAHAP_DESK[t]}</p>
                      </div>
                      <form action={ubahTahapPeriode} className="mt-3">
                        <input type="hidden" name="tahap" value={t} />
                        <button disabled={isActive} className={isActive ? "btn w-full" : "btn-secondary w-full"}>
                          {isActive ? "✓ Sedang Berlangsung" : "Aktifkan Sesi Ini"}
                        </button>
                      </form>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Kalender & Cut-Off Pengisian Bukti */}
          <form action={simpanTanggalPeriode} className="card space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Kalender &amp; Tenggat Cut-Off Pengisian Bukti Auditee</h2>
              <p className="text-xs text-slate-500">
                Jika tanggal <strong>Cut-Off Pengisian Bukti</strong> terlewati atau sesi dipindah ke <em>Audit Dokumen</em>, auditee otomatis tidak bisa mengubah link Google Drive-nya lagi.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <label>Mulai Pengisian Auditee ({fmtTanggal(periode.tglMulaiPengisian)})</label>
                <input name="tglMulaiPengisian" type="date" defaultValue={toInputDate(periode.tglMulaiPengisian)} className="w-full" />
              </div>
              <div className="space-y-1">
                <label>Batas Cut-Off Bukti Drive ({fmtTanggal(periode.tglCutOff)})</label>
                <input name="tglCutOff" type="date" defaultValue={toInputDate(periode.tglCutOff)} className="w-full" />
              </div>
              <div className="space-y-1">
                <label>Tanggal Opening Meeting ({fmtTanggal(periode.tglOpening)})</label>
                <input name="tglOpening" type="date" defaultValue={toInputDate(periode.tglOpening)} className="w-full" />
              </div>
              <div className="space-y-1">
                <label>Tanggal Closing Meeting ({fmtTanggal(periode.tglClosing)})</label>
                <input name="tglClosing" type="date" defaultValue={toInputDate(periode.tglClosing)} className="w-full" />
              </div>
            </div>
            <button className="btn">Simpan Kalender Periode</button>
          </form>
        </>
      )}

      {/* Buat Periode Baru */}
      <form action={buatPeriode} className="card space-y-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Buat Siklus / Periode AMI Baru</h2>
          <p className="text-xs text-slate-500">Membuat periode baru akan menjadikan periode tersebut sebagai periode aktif.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-2">
            <label>Nama Siklus / Periode AMI</label>
            <input name="nama" required placeholder="AMI Siklus Tahun Akademik 2026/2027 Ganjil" className="w-full" />
          </div>
          <div className="space-y-1">
            <label>Tahun Akademik</label>
            <div className="flex gap-2">
              <input name="tahun" required placeholder="2026/2027" className="w-full" />
              <button className="btn shrink-0">Buat</button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
