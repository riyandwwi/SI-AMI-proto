import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PRODI_LIST } from "@/lib/roles";
import { KLASIFIKASI_LABEL, RTL_LABEL, STATUS_DOK_LABEL } from "@/lib/periode";
import { fmtWaktu } from "@/lib/format";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";
import { buatSesiAmi, hapusIndikator, hapusSesiAmi, tambahIndikator, toggleStatusSesi } from "./actions";

export default async function LpmPage({ searchParams }: { searchParams: SP }) {
  await requireUser("LPM");
  const sp = await searchParams;
  const tab = one(sp.tab) ?? "sesi"; // "sesi" | "pantau"
  const selectedPeriodeId = one(sp.periodeId);

  const [periodes, allUsers] = await Promise.all([
    prisma.periode.findMany({
      include: {
        unit: true,
        indikator: {
          orderBy: [{ urutan: "asc" }, { kode: "asc" }],
          include: { isian: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { role: { in: ["AUDITOR", "AUDITEE"] }, aktif: true },
      include: { unit: true },
      orderBy: { nama: "asc" },
    }),
  ]);

  const activePeriodeForPantau =
    periodes.find((p) => p.id === selectedPeriodeId) ?? periodes[0] ?? null;

  return (
    <>
      <PageHeader
        title="Manajemen Sesi AMI, Indikator & Pantau Pekerjaan (LPM)"
        desc="Buat sesi AMI dengan mengisi Tahun Akademik, Semester, dan Prodi. LPM dapat menambah/menghapus indikator serta memantau pekerjaan Auditor & Auditee."
      />
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {/* Navigasi Tab di Halaman LPM */}
      <div className="flex flex-wrap gap-2 border-b-2 border-black pb-3">
        <Link
          href="/lpm?tab=sesi"
          className={tab === "sesi" ? "btn text-xs" : "btn-secondary text-xs"}
        >
          📅 1. Buat &amp; Daftar Sesi AMI
        </Link>
        <Link
          href={`/lpm?tab=pantau${activePeriodeForPantau ? `&periodeId=${activePeriodeForPantau.id}` : ""}`}
          className={tab === "pantau" ? "btn text-xs" : "btn-secondary text-xs"}
        >
          👀 2. Kelola Indikator &amp; Pantau Pekerjaan Auditor / Auditee
        </Link>
        <Link href="/lpm/indikator" className="btn-secondary text-xs">
          📋 Master Semua Indikator SPMI
        </Link>
      </div>

      {tab === "sesi" ? (
        <>
          {/* Form Buat Sesi AMI */}
          <form action={buatSesiAmi} className="card space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">+ Buat Sesi AMI Baru</h2>
              <p className="text-xs text-slate-500">
                Pilih Tahun Akademik, Semester (Ganjil/Genap), dan Program Studi. Akun Auditor &amp; Auditee dari Prodi tersebut akan otomatis terdaftar pada sesi ini.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label>Tahun Akademik</label>
                <input name="tahun" required defaultValue="2026/2027" placeholder="2026/2027" className="w-full" />
              </div>
              <div className="space-y-1">
                <label>Semester</label>
                <select name="semester" required defaultValue="Ganjil" className="w-full">
                  <option value="Ganjil">Ganjil</option>
                  <option value="Genap">Genap</option>
                </select>
              </div>
              <div className="space-y-1">
                <label>Program Studi</label>
                <div className="flex gap-2">
                  <select name="prodiKode" required defaultValue="PRODI-BD" className="w-full">
                    {PRODI_LIST.map((p) => (
                      <option key={p.kode} value={p.kode}>
                        {p.nama}
                      </option>
                    ))}
                  </select>
                  <button className="btn shrink-0">+ Buat Sesi</button>
                </div>
              </div>
            </div>
          </form>

          {/* Daftar Sesi AMI & Otomatis Muncul Nama Auditee + Auditor */}
          {periodes.length === 0 ? (
            <Empty>Belum ada Sesi AMI yang dibuat. Silakan isi form di atas untuk membuat Sesi AMI.</Empty>
          ) : (
            <div className="space-y-4">
              {periodes.map((p) => {
                const prodiAuditees = allUsers.filter(
                  (u) => u.role === "AUDITEE" && (p.unitId ? u.unitId === p.unitId : true)
                );
                const prodiAuditors = allUsers.filter(
                  (u) => u.role === "AUDITOR" && (p.unitId ? u.unitId === p.unitId : true)
                );
                const totalInd = p.indikator.length;
                const terisiDrive = p.indikator.filter((ind) =>
                  ind.isian.some((i) => (!p.unitId || i.unitId === p.unitId) && i.linkDrive)
                ).length;
                const dinilaiAuditor = p.indikator.filter((ind) =>
                  ind.isian.some((i) => (!p.unitId || i.unitId === p.unitId) && i.klasifikasi)
                ).length;

                return (
                  <div key={p.id} className="card space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">{p.nama}</h3>
                          <Badge tone="blue">Tahun: {p.tahun}</Badge>
                          <Badge tone="purple">Semester: {p.semester}</Badge>
                          {p.unit && <Badge tone="slate">Prodi: {p.unit.nama}</Badge>}
                          <Badge tone={p.aktif ? "green" : "amber"}>
                            {p.aktif ? "🟢 Sesi Terbuka (Aktif)" : "🔒 Sesi Terkunci"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Jumlah Indikator: <strong>{totalInd} Indikator</strong> · Progres Bukti Auditee: <strong>{terisiDrive}/{totalInd}</strong> · Progres Penilaian Auditor: <strong>{dinilaiAuditor}/{totalInd}</strong>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/lpm?tab=pantau&periodeId=${p.id}`}
                          className="btn text-xs"
                        >
                          👀 Kelola Indikator &amp; Lihat Pekerjaan
                        </Link>
                        <form action={toggleStatusSesi}>
                          <input type="hidden" name="periodeId" value={p.id} />
                          <button className="btn-secondary text-xs">
                            {p.aktif ? "🔒 Kunci Sesi" : "🔓 Buka Sesi"}
                          </button>
                        </form>
                        <form action={hapusSesiAmi}>
                          <input type="hidden" name="periodeId" value={p.id} />
                          <button className="btn-danger text-xs">Hapus Sesi</button>
                        </form>
                      </div>
                    </div>

                    {/* Kotak Otomatis Nama Auditee & Nama Auditor dari Prodi yang Dipilih */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border-2 border-black bg-[#FAF7EE] p-4 space-y-2 shadow-[2px_2px_0px_#000]">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-wide text-black">
                            👤 Auditee Terdaftar ({p.unit?.nama ?? "Semua Prodi"})
                          </span>
                          <Badge tone="blue">{prodiAuditees.length} Akun</Badge>
                        </div>
                        {prodiAuditees.length === 0 ? (
                          <p className="text-xs font-semibold text-slate-500">
                            Belum ada akun Auditee untuk Prodi {p.unit?.nama ?? "ini"}. Tambahkan di menu Super Admin.
                          </p>
                        ) : (
                          <ul className="space-y-1.5 text-xs">
                            {prodiAuditees.map((a) => (
                              <li key={a.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
                                <div>
                                  <span className="font-bold text-black">{a.nama}</span>
                                  {a.nimNuptk && <span className="ml-1.5 font-mono text-slate-600">({a.nimNuptk})</span>}
                                </div>
                                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-bold text-slate-800">{a.username}</code>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="rounded-2xl border-2 border-black bg-[#FAF7EE] p-4 space-y-2 shadow-[2px_2px_0px_#000]">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-wide text-black">
                            🕵️ Auditor Terdaftar ({p.unit?.nama ?? "Semua Prodi"})
                          </span>
                          <Badge tone="green">{prodiAuditors.length} Akun</Badge>
                        </div>
                        {prodiAuditors.length === 0 ? (
                          <p className="text-xs font-semibold text-slate-500">
                            Belum ada akun Auditor untuk Prodi {p.unit?.nama ?? "ini"}. Tambahkan di menu Super Admin.
                          </p>
                        ) : (
                          <ul className="space-y-1.5 text-xs">
                            {prodiAuditors.map((a) => (
                              <li key={a.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
                                <div>
                                  <span className="font-bold text-black">{a.nama}</span>
                                  {a.nimNuptk && <span className="ml-1.5 font-mono text-slate-600">({a.nimNuptk})</span>}
                                </div>
                                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-bold text-slate-800">{a.username}</code>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* TAB 2: KELOLA INDIKATOR & PANTAU PEKERJAAN AUDITOR DAN AUDITEE */
        <div className="space-y-4">
          {periodes.length === 0 || !activePeriodeForPantau ? (
            <Empty>Belum ada Sesi AMI untuk dipantau.</Empty>
          ) : (
            <>
              {/* Pilihan Sesi AMI yang Ingin Dipantau */}
              <div className="card flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Sesi Aktif: {activePeriodeForPantau.nama}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Tambah atau hapus indikator pada sesi ini, serta pantau apa saja yang dikerjakan <strong>Auditee</strong> dan <strong>Auditor</strong>.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {periodes.map((p) => (
                    <Link
                      key={p.id}
                      href={`/lpm?tab=pantau&periodeId=${p.id}`}
                      className={p.id === activePeriodeForPantau.id ? "btn text-xs" : "btn-secondary text-xs"}
                    >
                      {p.unit?.nama ?? p.nama} ({p.tahun} {p.semester})
                    </Link>
                  ))}
                </div>
              </div>

              {/* Info Nama Auditee & Auditor pada Sesi Ini */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="card space-y-1.5">
                  <div className="text-xs font-bold uppercase text-slate-500">Auditee pada Sesi Ini</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {allUsers
                      .filter((u) => u.role === "AUDITEE" && (!activePeriodeForPantau.unitId || u.unitId === activePeriodeForPantau.unitId))
                      .map((u) => `${u.nama} (${u.nimNuptk || u.username})`)
                      .join(", ") || "Belum ada akun Auditee"}
                  </div>
                </div>
                <div className="card space-y-1.5">
                  <div className="text-xs font-bold uppercase text-slate-500">Auditor pada Sesi Ini</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {allUsers
                      .filter((u) => u.role === "AUDITOR" && (!activePeriodeForPantau.unitId || u.unitId === activePeriodeForPantau.unitId))
                      .map((u) => `${u.nama} (${u.nimNuptk || u.username})`)
                      .join(", ") || "Belum ada akun Auditor"}
                  </div>
                </div>
              </div>

              {/* Form Cepat Tambah Indikator oleh LPM */}
              <form action={tambahIndikator} className="card space-y-3">
                <input type="hidden" name="returnTo" value={`/lpm?tab=pantau&periodeId=${activePeriodeForPantau.id}`} />
                <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2">
                  <h3 className="text-sm font-bold text-slate-900">+ Tambah Indikator Baru (Oleh LPM)</h3>
                  <span className="text-xs text-slate-500">Pilih apakah indikator ditambahkan ke sesi ini saja atau semua sesi</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div className="space-y-1">
                    <label>Terapkan ke Sesi</label>
                    <select name="periodeId" defaultValue={activePeriodeForPantau.id} className="w-full">
                      <option value={activePeriodeForPantau.id}>Hanya Sesi Ini ({activePeriodeForPantau.unit?.nama})</option>
                      <option value="ALL">Semua Sesi AMI</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label>Kode Indikator</label>
                    <input name="kode" required placeholder="STD-PEND-04" className="w-full font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label>Standar SPMI</label>
                    <input name="standar" required placeholder="Standar Isi Pembelajaran" className="w-full" />
                  </div>
                  <div className="space-y-1">
                    <label>Target Capaian</label>
                    <input name="target" required placeholder="100% Mata Kuliah" className="w-full" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label>Pernyataan Indikator Mutu</label>
                    <input
                      name="pernyataan"
                      required
                      placeholder="Uraian indikator yang harus dipenuhi oleh Auditee..."
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1">
                    <label>Bukti Google Drive yang Diminta (Opsional)</label>
                    <div className="flex gap-2">
                      <input
                        name="buktiDiminta"
                        placeholder="Contoh: Folder Drive berisi SK Kurikulum & RPS..."
                        className="w-full"
                      />
                      <button className="btn shrink-0">+ Tambah Indikator</button>
                    </div>
                  </div>
                </div>
              </form>

              {/* Tabel Detail Indikator + Pekerjaan Auditee + Pekerjaan Auditor + Tombol Hapus Indikator */}
              <div className="card overflow-x-auto space-y-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Daftar Indikator ({activePeriodeForPantau.indikator.length}) &amp; Rincian Pekerjaan Auditee / Auditor
                </h3>
                {activePeriodeForPantau.indikator.length === 0 ? (
                  <Empty>Belum ada indikator pada sesi ini. Silakan tambahkan menggunakan form di atas.</Empty>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th className="w-60">Indikator SPMI</th>
                        <th>Pekerjaan Auditee (Evaluasi Diri, Link Drive &amp; RTL)</th>
                        <th>Pekerjaan Auditor (Desk Audit, Temuan Lapangan &amp; Verifikasi)</th>
                        <th className="w-28 text-right">Aksi LPM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePeriodeForPantau.indikator.map((ind) => {
                        const isian =
                          ind.isian.find((i) =>
                            activePeriodeForPantau.unitId ? i.unitId === activePeriodeForPantau.unitId : true
                          ) ?? ind.isian[0];

                        return (
                          <tr key={ind.id}>
                            <td>
                              <code className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-bold text-blue-700">
                                {ind.kode}
                              </code>
                              <div className="mt-1 font-semibold text-slate-900">{ind.standar}</div>
                              <div className="mt-0.5 text-xs text-slate-600">{ind.pernyataan}</div>
                              <div className="mt-1 text-xs font-medium text-slate-500">Target: {ind.target}</div>
                            </td>

                            {/* Kolom Pekerjaan Auditee */}
                            <td className="space-y-2 text-xs">
                              {isian?.klaim || isian?.linkDrive ? (
                                <>
                                  <div>
                                    <span className="font-semibold text-slate-700">Klaim Evaluasi Diri: </span>
                                    <span className="text-slate-800">{isian.klaim || "—"}</span>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-700">Bukti Google Drive: </span>
                                    {isian.linkDrive ? (
                                      <a
                                        href={isian.linkDrive}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-mono font-semibold text-blue-600 underline"
                                      >
                                        ↗ Buka Link Google Drive
                                      </a>
                                    ) : (
                                      <Badge tone="amber">Belum Diunggah</Badge>
                                    )}
                                  </div>
                                  {isian.rtlRencana && (
                                    <div className="rounded border border-amber-200 bg-amber-50 p-2">
                                      <div>
                                        <strong>Rencana Tindak Lanjut (RTL):</strong> {isian.rtlRencana}
                                      </div>
                                      {isian.rtlLinkBukti && (
                                        <div className="mt-1">
                                          <a
                                            href={isian.rtlLinkBukti}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-mono text-blue-600 underline"
                                          >
                                            ↗ Bukti Drive Perbaikan (RTL)
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <Badge tone="amber">⏳ Auditee Belum Mengisi</Badge>
                              )}
                            </td>

                            {/* Kolom Pekerjaan Auditor */}
                            <td className="space-y-2 text-xs">
                              {isian && (isian.statusDokumen !== "BELUM_DICEK" || isian.catatanDokumen || isian.klasifikasi) ? (
                                <>
                                  <div className="flex flex-wrap items-center gap-1.5">
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
                                    {isian.klasifikasi && (
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
                                        Temuan: {KLASIFIKASI_LABEL[isian.klasifikasi]}
                                      </Badge>
                                    )}
                                    <Badge tone={isian.rtlStatus === "TERVERIFIKASI" ? "green" : "slate"}>
                                      RTL: {RTL_LABEL[isian.rtlStatus]}
                                    </Badge>
                                  </div>

                                  {isian.catatanDokumen && (
                                    <div>
                                      <strong>Catatan Audit Dokumen:</strong> {isian.catatanDokumen}
                                    </div>
                                  )}
                                  {isian.catatanLapangan && (
                                    <div>
                                      <strong>Catatan Audit Lapangan:</strong> {isian.catatanLapangan}
                                    </div>
                                  )}
                                  {isian.rekomendasi && (
                                    <div>
                                      <strong>Rekomendasi Auditor:</strong> {isian.rekomendasi}
                                    </div>
                                  )}
                                  {isian.rtlCatatanAuditor && (
                                    <div>
                                      <strong>Catatan Verifikasi RTL:</strong> {isian.rtlCatatanAuditor}
                                    </div>
                                  )}
                                  <div className="text-slate-400">
                                    Terakhir diperbarui: {fmtWaktu(isian.updatedAt)}
                                  </div>
                                </>
                              ) : (
                                <Badge tone="slate">⏳ Auditor Belum Memeriksa</Badge>
                              )}
                            </td>

                            {/* Kolom Hapus Indikator */}
                            <td className="text-right">
                              <form action={hapusIndikator}>
                                <input type="hidden" name="returnTo" value={`/lpm?tab=pantau&periodeId=${activePeriodeForPantau.id}`} />
                                <input type="hidden" name="indikatorId" value={ind.id} />
                                <button className="btn-danger text-xs">Hapus</button>
                              </form>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
