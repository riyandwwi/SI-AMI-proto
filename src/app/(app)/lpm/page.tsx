import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HOMEBASE_LIST, PRODI_LIST } from "@/lib/roles";
import {
  KLASIFIKASI_LABEL,
  RTL_LABEL,
  STATUS_DOK_LABEL,
  sortPeriodesChronological,
} from "@/lib/periode";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";
import { ImportIndikatorExcel } from "./ImportIndikatorExcel";
import {
  buatSesiAmi,
  editIndikator,
  hapusIndikator,
  hapusSesiAmi,
  hapusUserEmergencyOlehLpm,
  lepasAuditorDariSesi,
  pilihKetuaSesiAmi,
  tambahIndikator,
  tambahUserEmergencyOlehLpm,
  toggleStatusSesi,
  tugaskanAuditorKeSesi,
} from "./actions";

export default async function LpmPage({ searchParams }: { searchParams: SP }) {
  await requireUser("LPM");
  const sp = await searchParams;
  const tab = one(sp.tab) ?? "sesi";
  const prodiFilter = one(sp.prodi) ?? "ALL";
  const selectedPeriodeId = one(sp.periodeId);

  const [rawPeriodes, allUsers] = await Promise.all([
    prisma.periode.findMany({
      include: {
        unit: true,
        penugasan: {
          include: {
            tim: {
              include: {
                auditor: { include: { unit: true } },
              },
            },
          },
        },
        indikator: {
          orderBy: [{ urutan: "asc" }, { kode: "asc" }],
          include: { isian: true },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: { in: ["AUDITOR", "AUDITEE"] }, aktif: true },
      include: { unit: true },
      orderBy: { nama: "asc" },
    }),
  ]);

  // Urutkan sesi berdasarkan Tahun Akademik & Semester (2025/2026 Ganjil -> 2025/2026 Genap -> 2026/2027 Ganjil -> dst)
  const periodes = sortPeriodesChronological(rawPeriodes);
  const filteredPeriodes =
    prodiFilter === "ALL"
      ? periodes
      : periodes.filter((p) => p.unit?.kode === prodiFilter);

  const activePeriodeForPantau =
    periodes.find((p) => p.id === selectedPeriodeId) ?? periodes[0] ?? null;

  return (
    <>
      <PageHeader title="Sesi AMI & Pantau Pekerjaan" />
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {/* Navigasi Tab */}
      <div className="flex flex-wrap gap-2 border-b-2 border-black pb-3">
        <Link
          href="/lpm?tab=sesi"
          className={tab === "sesi" ? "btn text-xs" : "btn-secondary text-xs"}
        >
          📅 1. Sesi AMI, Auditor &amp; Auditee
        </Link>
        <Link
          href={`/lpm?tab=pantau${activePeriodeForPantau ? `&periodeId=${activePeriodeForPantau.id}` : ""}`}
          className={tab === "pantau" ? "btn text-xs" : "btn-secondary text-xs"}
        >
          👀 2. Indikator &amp; Pantau Pekerjaan
        </Link>
      </div>

      {tab === "sesi" ? (
        <>
          {/* Form Buat Sesi AMI */}
          <form action={buatSesiAmi} className="card space-y-4">
            <h2 className="border-b border-black/15 pb-2 text-base font-black text-black">
              + Buat Sesi AMI
            </h2>
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

          {/* Form Emergency LPM: Tambah Akun Auditor / Auditee */}
          <form action={tambahUserEmergencyOlehLpm} className="card space-y-4">
            <input type="hidden" name="returnTo" value="/lpm?tab=sesi" />
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/15 pb-2">
              <h2 className="text-base font-black text-black">🚨 Emergency: + Buat Akun Auditor / Auditee</h2>
              <Badge tone="amber">🔑 Password Default: 123</Badge>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1">
                <label>Role</label>
                <select name="role" required defaultValue="AUDITOR" className="w-full font-bold">
                  <option value="AUDITOR">Auditor (Lintas Prodi)</option>
                  <option value="AUDITEE">Auditee (Satu Prodi)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label>Nama Lengkap</label>
                <input name="nama" required placeholder="Nama..." className="w-full" />
              </div>
              <div className="space-y-1">
                <label>NIDN / NUPTK</label>
                <input name="nimNuptk" required placeholder="NIDN / NUPTK..." className="w-full font-mono" />
              </div>
              <div className="space-y-1">
                <label>Homebase / Prodi</label>
                <select name="prodiKode" required defaultValue="PRODI-BD" className="w-full">
                  {HOMEBASE_LIST.map((p) => (
                    <option key={p.kode} value={p.kode}>
                      {p.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label>Username</label>
                <div className="flex gap-2">
                  <input name="username" required placeholder="Username..." className="w-full font-mono" />
                  <button className="btn shrink-0">+ Tambah</button>
                </div>
              </div>
            </div>
          </form>

          {/* Filter Sesi per Program Studi (Urut Kronologis TA & Semester) */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black uppercase text-black">Filter Prodi:</span>
              <Link
                href="/lpm?tab=sesi&prodi=ALL"
                className={prodiFilter === "ALL" ? "btn text-xs" : "btn-secondary text-xs"}
              >
                Semua Prodi ({periodes.length})
              </Link>
              {PRODI_LIST.map((pr) => (
                <Link
                  key={pr.kode}
                  href={`/lpm?tab=sesi&prodi=${pr.kode}`}
                  className={prodiFilter === pr.kode ? "btn text-xs" : "btn-secondary text-xs"}
                >
                  {pr.nama} ({periodes.filter((p) => p.unit?.kode === pr.kode).length})
                </Link>
              ))}
            </div>
            <Badge tone="slate">📅 Urutan: Tahun Akademik &amp; Semester (Ganjil ➔ Genap)</Badge>
          </div>

          {/* Daftar Sesi AMI */}
          {filteredPeriodes.length === 0 ? (
            <Empty>Belum ada Sesi AMI.</Empty>
          ) : (
            <div className="space-y-4">
              {filteredPeriodes.map((p) => {
                // 1. Auditee WAJIB satu prodi dengan Sesi AMI ini
                const prodiAuditees = allUsers.filter(
                  (u) => u.role === "AUDITEE" && u.unitId === p.unitId
                );

                // 2. Auditor TIDAK BOLEH satu prodi dengan Sesi AMI ini (Lintas Prodi)
                const assignedFromPenugasan = p.penugasan
                  .flatMap((pg) => pg.tim.map((t) => t.auditor))
                  .filter((a) => a.aktif && a.unitId !== p.unitId);

                const fallbackCrossAuditors = allUsers.filter(
                  (u) => u.role === "AUDITOR" && u.unitId !== p.unitId
                );

                const assignedAuditors =
                  assignedFromPenugasan.length > 0 ? assignedFromPenugasan : fallbackCrossAuditors;

                const assignedIds = new Set(assignedAuditors.map((a) => a.id));

                // Pilihan Auditor lintas-prodi yang belum ditugaskan ke sesi ini
                const availableCrossAuditors = allUsers.filter(
                  (u) => u.role === "AUDITOR" && u.unitId !== p.unitId && !assignedIds.has(u.id)
                );

                return (
                  <div key={p.id} className="card space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/15 pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black text-black">{p.nama}</h3>
                        <Badge tone="blue">{p.tahun}</Badge>
                        <Badge tone="purple">{p.semester}</Badge>
                        <Badge tone={p.aktif ? "green" : "amber"}>
                          {p.aktif ? "🟢 Terbuka" : "🔒 Terkunci"}
                        </Badge>
                        <Badge tone={p.ttdAuditee ? "green" : "slate"}>
                          {p.ttdAuditee ? "✅ TTD Auditee" : "⏳ TTD Auditee"}
                        </Badge>
                        <Badge tone={p.ttdAuditor ? "green" : "slate"}>
                          {p.ttdAuditor ? "✅ TTD Auditor" : "⏳ TTD Auditor"}
                        </Badge>
                        <Badge tone={p.ttdLpm ? "green" : "slate"}>
                          {p.ttdLpm ? "✅ TTD LPM" : "⏳ TTD LPM"}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/lpm?tab=pantau&periodeId=${p.id}`}
                          className="btn text-xs"
                        >
                          👀 Pantau &amp; Indikator
                        </Link>
                        <form action={toggleStatusSesi}>
                          <input type="hidden" name="periodeId" value={p.id} />
                          <button className="btn-secondary text-xs">
                            {p.aktif ? "🔒 Kunci Sesi" : "🔓 Buka Sesi"}
                          </button>
                        </form>
                        <form action={hapusSesiAmi}>
                          <input type="hidden" name="periodeId" value={p.id} />
                          <button className="btn-danger text-xs">Hapus</button>
                        </form>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {/* KOTAK KIRI: AUDITEE (SATU PRODI) + EMERGENCY TAMBAH/HAPUS */}
                      <div className="rounded-2xl border border-black/15 bg-[#FAF7EE] p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase text-black">
                            👤 Auditee Satu Prodi ({p.unit?.nama})
                          </span>
                          <Badge tone="blue">{prodiAuditees.length} Auditee</Badge>
                        </div>

                        {prodiAuditees.length === 0 ? (
                          <p className="text-xs font-semibold text-slate-400">Belum ada Auditee</p>
                        ) : (
                          <ul className="space-y-1.5 text-xs">
                            {prodiAuditees.map((a) => {
                              const isKetuaAuditee = p.ketuaAuditeeId === a.id;
                              return (
                                <li
                                  key={a.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 border border-black/15"
                                >
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-bold text-black">{a.nama}</span>
                                    {a.nimNuptk && (
                                      <span className="font-mono text-slate-500">({a.nimNuptk})</span>
                                    )}
                                    {isKetuaAuditee && (
                                      <Badge tone="amber">⭐ Ketua Auditee</Badge>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-bold text-slate-800">
                                      {a.username}
                                    </code>
                                    {!isKetuaAuditee && (
                                      <form action={pilihKetuaSesiAmi}>
                                        <input type="hidden" name="periodeId" value={p.id} />
                                        <input type="hidden" name="tipe" value="AUDITEE" />
                                        <input type="hidden" name="userId" value={a.id} />
                                        <input
                                          type="hidden"
                                          name="returnTo"
                                          value={`/lpm?tab=sesi&prodi=${prodiFilter}`}
                                        />
                                        <button className="btn-secondary px-2 py-0.5 text-[11px]">
                                          ⭐ Jadikan Ketua
                                        </button>
                                      </form>
                                    )}
                                    <form action={hapusUserEmergencyOlehLpm}>
                                      <input type="hidden" name="userId" value={a.id} />
                                      <input
                                        type="hidden"
                                        name="returnTo"
                                        value={`/lpm?tab=sesi&prodi=${prodiFilter}`}
                                      />
                                      <button className="btn-danger px-2 py-0.5 text-[11px]">
                                        Hapus
                                      </button>
                                    </form>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}

                        {/* Emergency Tambah Auditee Langsung ke Prodi Ini */}
                        {p.unit && (
                          <form action={tambahUserEmergencyOlehLpm} className="grid grid-cols-1 gap-1.5 pt-1 sm:grid-cols-3">
                            <input type="hidden" name="returnTo" value="/lpm?tab=sesi" />
                            <input type="hidden" name="role" value="AUDITEE" />
                            <input type="hidden" name="prodiKode" value={p.unit.kode} />
                            <input name="nama" required placeholder="Nama Auditee..." className="text-xs" />
                            <input name="nimNuptk" required placeholder="NIDN/NUPTK..." className="font-mono text-xs" />
                            <div className="flex gap-1">
                              <input name="username" required placeholder="Username..." className="w-full font-mono text-xs" />
                              <button className="btn shrink-0 px-2.5 py-1 text-xs">+ Auditee</button>
                            </div>
                          </form>
                        )}
                      </div>

                      {/* KOTAK KANAN: AUDITOR (WAJIB LINTAS PRODI / BEDA PRODI) + EMERGENCY TAMBAH/HAPUS */}
                      <div className="rounded-2xl border border-black/15 bg-[#FAF7EE] p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase text-black">
                            🕵️ Auditor Lintas Prodi (Bukan {p.unit?.nama})
                          </span>
                          <Badge tone="green">{assignedAuditors.length} Auditor</Badge>
                        </div>

                        {assignedAuditors.length === 0 ? (
                          <p className="text-xs font-semibold text-slate-400">Belum ada Auditor lintas prodi</p>
                        ) : (
                          <ul className="space-y-1.5 text-xs">
                            {assignedAuditors.map((a) => {
                              const isKetuaAuditor = p.ketuaAuditorId === a.id;
                              return (
                                <li
                                  key={a.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 border border-black/15"
                                >
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-bold text-black">{a.nama}</span>
                                    {a.unit && <Badge tone="purple">Asal: {a.unit.nama}</Badge>}
                                    {isKetuaAuditor && (
                                      <Badge tone="amber">⭐ Ketua Auditor</Badge>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-bold text-slate-800">
                                      {a.username}
                                    </code>
                                    {!isKetuaAuditor && (
                                      <form action={pilihKetuaSesiAmi}>
                                        <input type="hidden" name="periodeId" value={p.id} />
                                        <input type="hidden" name="tipe" value="AUDITOR" />
                                        <input type="hidden" name="userId" value={a.id} />
                                        <input
                                          type="hidden"
                                          name="returnTo"
                                          value={`/lpm?tab=sesi&prodi=${prodiFilter}`}
                                        />
                                        <button className="btn-secondary px-2 py-0.5 text-[11px]">
                                          ⭐ Jadikan Ketua
                                        </button>
                                      </form>
                                    )}
                                    {assignedFromPenugasan.length > 0 && (
                                      <form action={lepasAuditorDariSesi}>
                                        <input type="hidden" name="periodeId" value={p.id} />
                                        <input type="hidden" name="auditorId" value={a.id} />
                                        <input
                                          type="hidden"
                                          name="returnTo"
                                          value={`/lpm?tab=sesi&prodi=${prodiFilter}`}
                                        />
                                        <button className="btn-secondary px-2 py-0.5 text-[11px]">
                                          Lepas
                                        </button>
                                      </form>
                                    )}
                                    <form action={hapusUserEmergencyOlehLpm}>
                                      <input type="hidden" name="userId" value={a.id} />
                                      <input
                                        type="hidden"
                                        name="returnTo"
                                        value={`/lpm?tab=sesi&prodi=${prodiFilter}`}
                                      />
                                      <button className="btn-danger px-2 py-0.5 text-[11px]">
                                        Hapus
                                      </button>
                                    </form>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}

                        {/* Pilih / Tugaskan Auditor dari Prodi Lain yang Sudah Ada */}
                        {availableCrossAuditors.length > 0 && (
                          <form action={tugaskanAuditorKeSesi} className="flex gap-1.5 pt-1">
                            <input type="hidden" name="periodeId" value={p.id} />
                            <input type="hidden" name="returnTo" value="/lpm?tab=sesi" />
                            <select name="auditorId" required className="w-full text-xs">
                              {availableCrossAuditors.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.nama} — Asal Prodi: {a.unit?.nama ?? "-"}
                                </option>
                              ))}
                            </select>
                            <button className="btn shrink-0 px-2.5 py-1 text-xs">+ Tugaskan</button>
                          </form>
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
        /* TAB 2: KELOLA INDIKATOR & PANTAU PEKERJAAN */
        <div className="space-y-4">
          {periodes.length === 0 || !activePeriodeForPantau ? (
            <Empty>Belum ada Sesi AMI.</Empty>
          ) : (
            <>
              <div className="card flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-black text-black">
                  {activePeriodeForPantau.nama}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {periodes.map((p) => (
                    <Link
                      key={p.id}
                      href={`/lpm?tab=pantau&periodeId=${p.id}`}
                      className={p.id === activePeriodeForPantau.id ? "btn text-xs" : "btn-secondary text-xs"}
                    >
                      {p.unit?.nama ?? p.nama} ({p.semester})
                    </Link>
                  ))}
                </div>
              </div>

              {/* Import Indikator via Excel (Aman & Anti Tumpang Tindih) */}
              <ImportIndikatorExcel
                periodes={periodes.map((p) => ({
                  id: p.id,
                  nama: p.nama,
                  existingCodes: p.indikator.map((i) => i.kode),
                }))}
                defaultPeriodeId={activePeriodeForPantau.id}
              />

              {/* Form Cepat Tambah Indikator oleh LPM */}
              <form action={tambahIndikator} className="card space-y-3">
                <input type="hidden" name="returnTo" value={`/lpm?tab=pantau&periodeId=${activePeriodeForPantau.id}`} />
                <h3 className="border-b-2 border-black pb-2 text-sm font-black text-black">+ Tambah Indikator</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div className="space-y-1">
                    <label>Sesi</label>
                    <select name="periodeId" defaultValue={activePeriodeForPantau.id} className="w-full">
                      <option value={activePeriodeForPantau.id}>Sesi Ini ({activePeriodeForPantau.unit?.nama})</option>
                      <option value="ALL">Semua Sesi</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label>Kode</label>
                    <input name="kode" required placeholder="STD-PEND-04" className="w-full font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label>Standar</label>
                    <input name="standar" required placeholder="Standar Isi..." className="w-full" />
                  </div>
                  <div className="space-y-1">
                    <label>Dokumen Bukti</label>
                    <input
                      name="buktiDiminta"
                      placeholder="SK, RPS, Laporan..."
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    name="pernyataan"
                    required
                    placeholder="Pernyataan indikator..."
                    className="w-full"
                  />
                  <button className="btn shrink-0">+ Tambah</button>
                </div>
              </form>

              {/* Tabel Detail Indikator + Pekerjaan Auditee + Pekerjaan Auditor */}
              <div className="card overflow-x-auto space-y-3">
                <h3 className="text-sm font-black text-black">
                  Daftar Indikator ({activePeriodeForPantau.indikator.length})
                </h3>
                {activePeriodeForPantau.indikator.length === 0 ? (
                  <Empty>Belum ada indikator.</Empty>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th className="w-56">Indikator</th>
                        <th>Isian Auditee</th>
                        <th>Penilaian Auditor</th>
                        <th className="w-24 text-right">Aksi</th>
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
                              <div className="flex flex-wrap items-center gap-1.5">
                                <code className="rounded-lg border border-black/30 bg-[#BAE6FD] px-2 py-0.5 text-xs font-black text-black">
                                  {ind.kode}
                                </code>
                                {ind.buktiDiminta && (
                                  <Badge tone="slate">📋 {ind.buktiDiminta}</Badge>
                                )}
                              </div>
                              <div className="mt-1 font-bold text-black">{ind.standar}</div>
                              <div className="mt-0.5 text-xs text-slate-700">{ind.pernyataan}</div>

                              <details className="mt-2">
                                <summary className="cursor-pointer text-xs font-black text-blue-700 hover:underline">
                                  ✏️ Edit Indikator
                                </summary>
                                <form action={editIndikator} className="mt-2 space-y-1.5 rounded-xl border border-black/20 bg-[#FAF7EE] p-2.5 text-xs">
                                  <input type="hidden" name="indikatorId" value={ind.id} />
                                  <input
                                    type="hidden"
                                    name="returnTo"
                                    value={`/lpm?tab=pantau&periodeId=${activePeriodeForPantau.id}`}
                                  />
                                  <input
                                    name="kode"
                                    required
                                    defaultValue={ind.kode}
                                    placeholder="Kode"
                                    className="w-full font-mono text-xs"
                                  />
                                  <input
                                    name="standar"
                                    required
                                    defaultValue={ind.standar}
                                    placeholder="Standar"
                                    className="w-full text-xs"
                                  />
                                  <input
                                    name="buktiDiminta"
                                    defaultValue={ind.buktiDiminta ?? ""}
                                    placeholder="Dokumen bukti yang diminta..."
                                    className="w-full text-xs"
                                  />
                                  <textarea
                                    name="pernyataan"
                                    rows={2}
                                    required
                                    defaultValue={ind.pernyataan}
                                    placeholder="Pernyataan"
                                    className="w-full text-xs"
                                  />
                                  <button type="submit" className="btn-success w-full py-1 text-xs">
                                    💾 Simpan Edit
                                  </button>
                                </form>
                              </details>
                            </td>

                            <td className="space-y-1.5 text-xs">
                              {isian?.klaim || isian?.linkDrive ? (
                                <>
                                  {isian.diisiOleh && (
                                    <div>
                                      <Badge tone="blue">👤 {isian.diisiOleh}</Badge>
                                    </div>
                                  )}
                                  <div>{isian.klaim || "—"}</div>
                                  {isian.linkDrive && (
                                    <div>
                                      <a
                                        href={isian.linkDrive}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-mono font-bold text-blue-700 underline"
                                      >
                                        ↗ Buka Google Drive
                                      </a>
                                    </div>
                                  )}
                                  {isian.rtlRencana && (
                                    <div className="rounded-xl border border-black bg-[#FEF08A]/40 p-2">
                                      <strong>RTL:</strong> {isian.rtlRencana}
                                      {isian.rtlLinkBukti && (
                                        <div>
                                          <a
                                            href={isian.rtlLinkBukti}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-mono text-blue-700 underline"
                                          >
                                            ↗ Bukti RTL
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <Badge tone="amber">Belum Diisi</Badge>
                              )}
                            </td>

                            <td className="space-y-1.5 text-xs">
                              {isian ? (
                                <>
                                  <div className="flex flex-wrap gap-1">
                                    {isian.diperiksaOleh && (
                                      <Badge tone="purple">🕵️ {isian.diperiksaOleh}</Badge>
                                    )}
                                    {isian.terverifikasiAuditor && (
                                      <Badge tone="green">🔒 Terverifikasi</Badge>
                                    )}
                                    <Badge
                                      tone={
                                        isian.statusDokumen === "LENGKAP"
                                          ? "green"
                                          : isian.statusDokumen === "PERLU_KLARIFIKASI"
                                            ? "amber"
                                            : "slate"
                                      }
                                    >
                                      {STATUS_DOK_LABEL[isian.statusDokumen]}
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
                                        {KLASIFIKASI_LABEL[isian.klasifikasi]}
                                      </Badge>
                                    )}
                                  </div>
                                  {isian.catatanDokumen && (
                                    <div>
                                      <strong>Dokumen:</strong> {isian.catatanDokumen}
                                    </div>
                                  )}
                                  {isian.catatanLapangan && (
                                    <div>
                                      <strong>Lapangan:</strong> {isian.catatanLapangan}
                                    </div>
                                  )}
                                  {isian.rekomendasi && (
                                    <div>
                                      <strong>Rekomendasi:</strong> {isian.rekomendasi}
                                    </div>
                                  )}
                                  {isian.rtlStatus !== "BELUM" && (
                                    <div>
                                      <Badge tone={isian.rtlStatus === "TERVERIFIKASI" ? "green" : "amber"}>
                                        RTL: {RTL_LABEL[isian.rtlStatus]}
                                      </Badge>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <span className="text-slate-400">Belum diperiksa</span>
                              )}
                            </td>

                            <td className="text-right">
                              <form action={hapusIndikator}>
                                <input type="hidden" name="indikatorId" value={ind.id} />
                                <input
                                  type="hidden"
                                  name="returnTo"
                                  value={`/lpm?tab=pantau&periodeId=${activePeriodeForPantau.id}`}
                                />
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
