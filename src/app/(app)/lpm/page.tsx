import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HOMEBASE_LIST, PRODI_LIST } from "@/lib/roles";
import {
  KLASIFIKASI_LABEL,
  RTL_LABEL,
  STATUS_DOK_LABEL,
  groupIndikatorByStandar,
  sortPeriodesChronological,
} from "@/lib/periode";
import { Badge, Empty, Flash, PageHeader, one, type SP } from "@/components/ui";
import { ImportIndikatorExcel } from "./ImportIndikatorExcel";
import { FormStandarBertahap, type ExistingStandarInfo } from "./FormStandarBertahap";
import { LpmStandarFilterBar } from "./LpmStandarFilterBar";
import { cleanupExpiredSignatures } from "@/lib/ttd-cleanup";
import {
  buatSesiAmi,
  hapusIndikator,
  hapusSemuaIndikator,
  hapusSesiAmi,
  hapusStandarEmergency,
  hapusUserEmergencyOlehLpm,
  lepasAuditorDariSesi,
  pilihKetuaSesiAmi,
  tambahUserEmergencyOlehLpm,
  toggleKunciIndikator,
  toggleStatusSesi,
  tugaskanAuditorKeSesi,
} from "./actions";

export default async function LpmPage({ searchParams }: { searchParams: SP }) {
  await requireUser("LPM");
  await cleanupExpiredSignatures();
  const sp = await searchParams;
  const tab = one(sp.tab) ?? "sesi";
  const prodiFilter = one(sp.prodi) ?? "ALL";
  const standarFilter = one(sp.standar) ?? "ALL";
  const selectedPeriodeId = one(sp.periodeId);

  const [rawPeriodes, allUsers] = await Promise.all([
    prisma.periode.findMany({
      include: {
        unit: true,
        trainingUsers: {
          orderBy: { nama: "asc" },
        },
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
      where: { role: { in: ["AUDITOR", "AUDITEE"] }, aktif: true, isTraining: false },
      include: { unit: true },
      orderBy: { nama: "asc" },
    }),
  ]);

  // Urutkan sesi berdasarkan Tahun Akademik & Semester (2025/2026 Ganjil -> 2025/2026 Genap -> 2026/2027 Ganjil -> dst)
  const periodes = sortPeriodesChronological(rawPeriodes);
  const filteredPeriodes =
    prodiFilter === "ALL"
      ? periodes
      : prodiFilter === "TRAINING"
        ? periodes.filter((p) => p.isTraining)
        : periodes.filter((p) => !p.isTraining && p.unit?.kode === prodiFilter);

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
                  {pr.nama} ({periodes.filter((p) => !p.isTraining && p.unit?.kode === pr.kode).length})
                </Link>
              ))}
              <Link
                href="/lpm?tab=sesi&prodi=TRAINING"
                className={prodiFilter === "TRAINING" ? "btn text-xs" : "btn-secondary text-xs"}
              >
                🎓 Sesi Training ({periodes.filter((p) => p.isTraining).length})
              </Link>
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
                        {p.isTraining && <Badge tone="amber">🎓 Sesi Training</Badge>}
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

                    {p.isTraining ? (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-black/15 bg-[#FAF7EE] p-4 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase text-black">
                              👈 Sisi Kiri: 🕵️ Auditor Kelompok ({p.semester})
                            </span>
                            <Badge tone="purple">
                              {p.trainingUsers.filter((tu) => tu.role === "AUDITOR").length} Auditor
                            </Badge>
                          </div>
                          <ul className="space-y-1.5 text-xs">
                            {p.trainingUsers
                              .filter((tu) => tu.role === "AUDITOR")
                              .map((tu) => {
                                const isKetuaAuditor = p.ketuaAuditorId === tu.id;
                                return (
                                  <li
                                    key={tu.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/15 bg-white px-3 py-2"
                                  >
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="font-bold text-black">🕵️ {tu.nama}</span>
                                      {isKetuaAuditor && (
                                        <Badge tone="amber">⭐ Ketua Auditor</Badge>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-800">
                                        {tu.username}
                                      </code>
                                      {!isKetuaAuditor && (
                                        <form action={pilihKetuaSesiAmi}>
                                          <input type="hidden" name="periodeId" value={p.id} />
                                          <input type="hidden" name="tipe" value="AUDITOR" />
                                          <input type="hidden" name="userId" value={tu.id} />
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
                                    </div>
                                  </li>
                                );
                              })}
                          </ul>
                        </div>

                        <div className="rounded-2xl border border-black/15 bg-[#FAF7EE] p-4 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase text-black">
                              👉 Sisi Kanan: 📝 Auditee Kelompok ({p.semester})
                            </span>
                            <Badge tone="blue">
                              {p.trainingUsers.filter((tu) => tu.role === "AUDITEE").length} Auditee
                            </Badge>
                          </div>
                          <ul className="space-y-1.5 text-xs">
                            {p.trainingUsers
                              .filter((tu) => tu.role === "AUDITEE")
                              .map((tu) => {
                                const isKetuaAuditee = p.ketuaAuditeeId === tu.id;
                                return (
                                  <li
                                    key={tu.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/15 bg-white px-3 py-2"
                                  >
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="font-bold text-black">📝 {tu.nama}</span>
                                      {isKetuaAuditee && (
                                        <Badge tone="amber">⭐ Ketua Auditee</Badge>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-800">
                                        {tu.username}
                                      </code>
                                      {!isKetuaAuditee && (
                                        <form action={pilihKetuaSesiAmi}>
                                          <input type="hidden" name="periodeId" value={p.id} />
                                          <input type="hidden" name="tipe" value="AUDITEE" />
                                          <input type="hidden" name="userId" value={tu.id} />
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
                                    </div>
                                  </li>
                                );
                              })}
                          </ul>
                        </div>
                      </div>
                    ) : (
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
                    )}
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
              <div className="card space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-black text-black">
                      {activePeriodeForPantau.nama}
                    </h2>
                    {activePeriodeForPantau.sourceLocked ? (
                      <Badge tone="green">
                        🔒 Terkunci &amp; Diterbitkan ke Auditor/Auditee
                      </Badge>
                    ) : (
                      <Badge tone="amber">
                        🔓 Belum Dikunci (Belum Masuk ke Auditor/Auditee)
                      </Badge>
                    )}
                  </div>
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

                {/* Bar Kontrol Kunci Indikator & Hapus Semua Indikator */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/15 pt-2.5">
                  <div className="text-xs font-semibold text-slate-700">
                    {activePeriodeForPantau.sourceLocked
                      ? "🔒 Indikator terkunci permanen & sudah tampil di halaman Auditor dan Auditee."
                      : "🔓 Setelah selesai mengisi/mengimport indikator, klik Kunci agar indikator tampil di halaman Auditor & Auditee."}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!activePeriodeForPantau.sourceLocked && (
                      <form action={toggleKunciIndikator}>
                        <input type="hidden" name="periodeId" value={activePeriodeForPantau.id} />
                        <input type="hidden" name="lockAction" value="DRAFT" />
                        <input
                          type="hidden"
                          name="returnTo"
                          value={`/lpm?tab=pantau&periodeId=${activePeriodeForPantau.id}`}
                        />
                        <button className="btn-secondary text-xs">
                          💾 Simpan sebagai Draft
                        </button>
                      </form>
                    )}

                    <form action={toggleKunciIndikator}>
                      <input type="hidden" name="periodeId" value={activePeriodeForPantau.id} />
                      <input
                        type="hidden"
                        name="lockAction"
                        value={activePeriodeForPantau.sourceLocked ? "UNLOCK" : "LOCK"}
                      />
                      <input
                        type="hidden"
                        name="returnTo"
                        value={`/lpm?tab=pantau&periodeId=${activePeriodeForPantau.id}`}
                      />
                      <button
                        className={
                          activePeriodeForPantau.sourceLocked
                            ? "btn-secondary text-xs"
                            : "btn-success text-xs"
                        }
                      >
                        {activePeriodeForPantau.sourceLocked
                          ? "🔓 Buka Kunci (Kembali ke Draft / Edit)"
                          : "🔒 Kunci & Terbitkan ke Auditor/Auditee"}
                      </button>
                    </form>

                    {!activePeriodeForPantau.sourceLocked &&
                      activePeriodeForPantau.indikator.length > 0 && (
                        <form action={hapusSemuaIndikator}>
                          <input
                            type="hidden"
                            name="periodeId"
                            value={activePeriodeForPantau.id}
                          />
                          <input
                            type="hidden"
                            name="returnTo"
                            value={`/lpm?tab=pantau&periodeId=${activePeriodeForPantau.id}`}
                          />
                          <button className="btn-danger text-xs">
                            🗑️ Hapus Semua Indikator ({activePeriodeForPantau.indikator.length})
                          </button>
                        </form>
                      )}
                  </div>
                </div>
              </div>

              {!activePeriodeForPantau.sourceLocked && (
                <>
                  {/* Import Indikator via Excel (Aman & Anti Tumpang Tindih) */}
                  <ImportIndikatorExcel
                    periodes={periodes.map((p) => ({
                      id: p.id,
                      nama: p.nama,
                      existingCodes: p.indikator.map(
                        (i) => `${i.standar.toUpperCase()}|||${i.kode.toUpperCase()}`
                      ),
                    }))}
                    defaultPeriodeId={activePeriodeForPantau.id}
                  />

                  {/* Form Bertahap Manual: 1. Standar -> 2. Pernyataan Standar -> 3. Indikator */}
                  <FormStandarBertahap
                    returnTo={`/lpm?tab=pantau&periodeId=${activePeriodeForPantau.id}`}
                    periodes={periodes.map((p) => ({ id: p.id, nama: p.nama }))}
                    defaultPeriodeId={activePeriodeForPantau.id}
                    existingStandarList={(() => {
                      const stdMap = new Map<string, Set<string>>();
                      const cntMap = new Map<string, number>();
                      for (const ind of activePeriodeForPantau.indikator) {
                        if (!ind.standar) continue;
                        if (!stdMap.has(ind.standar)) stdMap.set(ind.standar, new Set<string>());
                        if (ind.pernyataanStandar) stdMap.get(ind.standar)!.add(ind.pernyataanStandar);
                        cntMap.set(ind.standar, (cntMap.get(ind.standar) ?? 0) + 1);
                      }
                      const list: ExistingStandarInfo[] = Array.from(stdMap.entries()).map(
                        ([standar, psSet]) => ({
                          standar,
                          pernyataanStandarList: Array.from(psSet),
                          nextIkNumber: (cntMap.get(standar) ?? 0) + 1,
                        })
                      );
                      return list;
                    })()}
                  />
                </>
              )}

              {/* Filter / Sort Indikator per Standar (Dropdown 1 Baris Minimalis + Print & Excel) */}
              {activePeriodeForPantau.indikator.length > 0 && (
                <LpmStandarFilterBar
                  periodeId={activePeriodeForPantau.id}
                  standarFilter={standarFilter}
                  totalIndikator={activePeriodeForPantau.indikator.length}
                  groups={groupIndikatorByStandar(activePeriodeForPantau.indikator).map((g) => ({
                    standar: g.standar,
                    startIndex: g.startIndex,
                    endIndex: g.endIndex,
                    count: g.items.length,
                  }))}
                />
              )}

              {/* Daftar Indikator Dikelompokkan per Standar + Pekerjaan Auditee + Pekerjaan Auditor */}
              {activePeriodeForPantau.indikator.length === 0 ? (
                <Empty>Belum ada indikator.</Empty>
              ) : (
                groupIndikatorByStandar(activePeriodeForPantau.indikator)
                  .filter((g) => standarFilter === "ALL" || g.standar === standarFilter)
                  .map((group) => (
                    <details
                      key={group.standar}
                      open={standarFilter !== "ALL"}
                      className="card group overflow-x-auto py-3"
                    >
                      <summary className="flex cursor-pointer list-none select-none flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-black bg-white text-xs font-black text-black">
                            <span className="group-open:hidden">▶</span>
                            <span className="hidden group-open:inline">▼</span>
                          </span>
                          <span className="rounded-xl border border-black bg-[#FEF08A] px-3 py-1 text-xs font-black text-black">
                            📂 {group.standar}
                          </span>
                          <Badge tone="blue">
                            Indikator #{group.startIndex} – #{group.endIndex} ({group.items.length} Butir)
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-xl border border-black bg-white px-2.5 py-1 text-[11px] font-black text-black">
                            <span className="group-open:hidden">▼ Buka Standar</span>
                            <span className="hidden group-open:inline">▲ Minimize</span>
                          </span>
                          {!activePeriodeForPantau.sourceLocked && (
                            <form action={hapusStandarEmergency}>
                              <input type="hidden" name="periodeId" value={activePeriodeForPantau.id} />
                              <input type="hidden" name="standar" value={group.standar} />
                              <input
                                type="hidden"
                                name="returnTo"
                                value={`/lpm?tab=pantau&periodeId=${activePeriodeForPantau.id}`}
                              />
                              <button className="btn-danger text-xs">
                                🗑️ Hapus Standar Ini
                              </button>
                            </form>
                          )}
                        </div>
                      </summary>

                      <div className="mt-3 border-t border-black/15 pt-3">
                        <table>
                        <thead>
                          <tr>
                            <th className="w-64">Indikator</th>
                            <th>Isian Auditee</th>
                            <th>Penilaian Auditor</th>
                            <th className="w-24 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map(({ item: ind, noUrut }) => {
                            const isian =
                              ind.isian.find((i) =>
                                activePeriodeForPantau.unitId
                                  ? i.unitId === activePeriodeForPantau.unitId
                                  : true
                              ) ?? ind.isian[0];

                            return (
                              <tr key={ind.id}>
                                <td>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <Badge tone="purple">#{noUrut}</Badge>
                                    <code className="rounded-lg border border-black/30 bg-[#BAE6FD] px-2 py-0.5 text-xs font-black text-black">
                                      {ind.kode}
                                    </code>
                                    {ind.buktiDiminta && (
                                      <Badge tone="slate">📋 {ind.buktiDiminta}</Badge>
                                    )}
                                  </div>
                                  {ind.pernyataanStandar && (
                                    <div className="mt-1.5 text-sm font-semibold leading-relaxed text-black">
                                      <strong className="font-black">Pernyataan Standar:</strong> {ind.pernyataanStandar}
                                    </div>
                                  )}
                                  <div className="mt-1.5 text-sm font-semibold leading-relaxed text-black">
                                    <strong className="font-black">Indikator ({ind.kode}):</strong> {ind.pernyataan}
                                  </div>
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
                                              isian.klasifikasi === "MELAMPAUI" ||
                                              isian.klasifikasi === "MENCAPAI"
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
                                          <Badge
                                            tone={
                                              isian.rtlStatus === "TERVERIFIKASI"
                                                ? "green"
                                                : "amber"
                                            }
                                          >
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
                                  {!activePeriodeForPantau.sourceLocked ? (
                                    <form action={hapusIndikator}>
                                      <input type="hidden" name="indikatorId" value={ind.id} />
                                      <input
                                        type="hidden"
                                        name="returnTo"
                                        value={`/lpm?tab=pantau&periodeId=${activePeriodeForPantau.id}`}
                                      />
                                      <button className="btn-danger text-xs">🗑️ Hapus</button>
                                    </form>
                                  ) : (
                                    <Badge tone="slate">🔒 Terkunci</Badge>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      </div>
                    </details>
                  ))
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
