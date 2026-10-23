"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { encryptPassword } from "@/lib/crypto";
import { HOMEBASE_LIST, PRODI_LIST } from "@/lib/roles";
import { catat, fail, ok, str } from "@/lib/actions";

const DEFAULT_PASSWORD = "123";

const DEFAULT_INDIKATOR = [
  {
    kode: "STD-PEND-01",
    standar: "Standar Isi Pembelajaran",
    pernyataan:
      "Ketersediaan dokumen Kurikulum Berbasis OBE dan RPS lengkap untuk seluruh mata kuliah aktif semester berjalan.",
    target: "100% Mata Kuliah",
    buktiDiminta: null,
    urutan: 1,
  },
  {
    kode: "STD-PEND-02",
    standar: "Standar Proses Pembelajaran",
    pernyataan:
      "Pelaksanaan monitoring kehadiran dosen dan kesesuaian materi perkuliahan minimal 14-16 pertemuan per semester beserta berita acara.",
    target: ">= 95% Kehadiran",
    buktiDiminta: null,
    urutan: 2,
  },
  {
    kode: "STD-PENEL-01",
    standar: "Standar Penelitian & PKM",
    pernyataan:
      "Keterlibatan mahasiswa dalam peta jalan penelitian dosen tetap program studi yang dibuktikan dengan SK/Kontrak atau publikasi bersama.",
    target: ">= 30% Penelitian Dosen",
    buktiDiminta: null,
    urutan: 3,
  },
];

// ====================================================
// 1. KELOLA SESI AMI (TAHUN AKADEMIK, SEMESTER, PRODI)
// ====================================================
export async function buatSesiAmi(fd: FormData) {
  const user = await requireUser("LPM");
  const tahun = str(fd, "tahun", 32);
  const semester = str(fd, "semester", 16);
  const prodiKode = str(fd, "prodiKode", 32);

  if (!tahun || !semester || !prodiKode) {
    fail("/lpm", "Tahun Akademik, Semester, dan Program Studi wajib diisi.");
  }
  if (semester !== "Ganjil" && semester !== "Genap") {
    fail("/lpm", "Semester harus Ganjil atau Genap.");
  }

  const prodiDef = PRODI_LIST.find((p) => p.kode === prodiKode);
  if (!prodiDef) fail("/lpm", "Program Studi tidak valid.");

  const unit = await prisma.unit.upsert({
    where: { kode: prodiDef.kode },
    update: { nama: prodiDef.nama },
    create: { kode: prodiDef.kode, nama: prodiDef.nama, jenis: "PRODI", diaudit: true },
  });

  const lastPeriode = await prisma.periode.findFirst({
    include: { indikator: { orderBy: { urutan: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  const sourceIndikator =
    lastPeriode && lastPeriode.indikator.length > 0
      ? lastPeriode.indikator.map((i, idx) => ({
          kode: i.kode,
          standar: i.standar,
          pernyataan: i.pernyataan,
          target: i.target,
          buktiDiminta: i.buktiDiminta,
          urutan: idx + 1,
        }))
      : DEFAULT_INDIKATOR;

  const nama = `AMI ${unit.nama} — ${tahun} (${semester})`;
  const p = await prisma.periode.create({
    data: {
      nama,
      tahun,
      semester,
      unitId: unit.id,
      tahap: "PENGISIAN",
      sourceLocked: false,
      aktif: true,
      indikator: {
        create: sourceIndikator,
      },
    },
  });

  // Buat Penugasan dan otomatis tugaskan Auditor lintas-prodi (yang BUKAN dari prodi ini)
  const crossProdiAuditors = await prisma.user.findMany({
    where: {
      role: "AUDITOR",
      aktif: true,
      NOT: { unitId: unit.id },
    },
    orderBy: { nama: "asc" },
    take: 2,
  });

  const penugasan = await prisma.penugasan.create({
    data: {
      periodeId: p.id,
      unitId: unit.id,
      disahkan: true,
    },
  });

  for (let i = 0; i < crossProdiAuditors.length; i++) {
    await prisma.penugasanAuditor.create({
      data: {
        penugasanId: penugasan.id,
        auditorId: crossProdiAuditors[i].id,
        peran: i === 0 ? "KETUA" : "ANGGOTA",
      },
    });
  }

  await catat(user.id, "BUAT_SESI_AMI", `${p.nama}`);
  revalidatePath("/lpm");
  revalidatePath("/lpm/indikator");
  revalidatePath("/auditor");
  revalidatePath("/auditee");
  ok("/lpm", `Sesi "${p.nama}" berhasil dibuat.`);
}

export async function toggleStatusSesi(fd: FormData) {
  const user = await requireUser("LPM");
  const periodeId = str(fd, "periodeId", 64);
  const p = await prisma.periode.findUnique({ where: { id: periodeId } });
  if (!p) fail("/lpm", "Sesi AMI tidak ditemukan.");

  const nextAktif = !p.aktif;
  await prisma.periode.update({
    where: { id: periodeId },
    data: { aktif: nextAktif },
  });

  await catat(user.id, nextAktif ? "BUKA_SESI_AMI" : "KUNCI_SESI_AMI", p.nama);
  revalidatePath("/lpm");
  revalidatePath("/auditor");
  revalidatePath("/auditee");
  ok("/lpm", `Sesi "${p.nama}" ${nextAktif ? "DIBUKA" : "DIKUNCI"}.`);
}

export async function hapusSesiAmi(fd: FormData) {
  const user = await requireUser("LPM");
  const periodeId = str(fd, "periodeId", 64);
  const p = await prisma.periode.findUnique({ where: { id: periodeId } });
  if (!p) fail("/lpm", "Sesi AMI tidak ditemukan.");

  await prisma.periode.delete({ where: { id: periodeId } });
  await catat(user.id, "HAPUS_SESI_AMI", p.nama);
  revalidatePath("/lpm");
  revalidatePath("/lpm/indikator");
  revalidatePath("/auditor");
  revalidatePath("/auditee");
  ok("/lpm", `Sesi "${p.nama}" dihapus.`);
}

// ====================================================
// 2. PENUGASAN AUDITOR LINTAS PRODI (TIDAK BOLEH SATU PRODI)
// ====================================================
export async function tugaskanAuditorKeSesi(fd: FormData) {
  const lpm = await requireUser("LPM");
  const returnTo = str(fd, "returnTo", 200) || "/lpm";
  const periodeId = str(fd, "periodeId", 64);
  const auditorId = str(fd, "auditorId", 64);

  if (!periodeId || !auditorId) {
    fail(returnTo, "Pilih Sesi AMI dan Auditor terlebih dahulu.");
  }

  const [periode, auditor] = await Promise.all([
    prisma.periode.findUnique({ where: { id: periodeId }, include: { unit: true } }),
    prisma.user.findUnique({ where: { id: auditorId }, include: { unit: true } }),
  ]);

  if (!periode || !periode.unitId) fail(returnTo, "Sesi AMI tidak valid.");
  if (!auditor || auditor.role !== "AUDITOR") fail(returnTo, "Akun Auditor tidak valid.");

  // ATURAN UTAMA: Auditor TIDAK BOLEH satu prodi dengan Prodi Sesi AMI yang diaudit
  if (auditor.unitId && auditor.unitId === periode.unitId) {
    fail(
      returnTo,
      `Ditolak: Auditor "${auditor.nama}" berasal dari Prodi ${auditor.unit?.nama}. Auditor tidak boleh mengaudit prodinya sendiri!`
    );
  }

  const penugasan = await prisma.penugasan.upsert({
    where: { periodeId_unitId: { periodeId: periode.id, unitId: periode.unitId } },
    update: {},
    create: {
      periodeId: periode.id,
      unitId: periode.unitId,
      disahkan: true,
    },
  });

  await prisma.penugasanAuditor.upsert({
    where: {
      penugasanId_auditorId: {
        penugasanId: penugasan.id,
        auditorId: auditor.id,
      },
    },
    update: {},
    create: {
      penugasanId: penugasan.id,
      auditorId: auditor.id,
      peran: "ANGGOTA",
    },
  });

  await catat(
    lpm.id,
    "TUGASKAN_AUDITOR_LINTAS_PRODI",
    `${auditor.nama} (Asal: ${auditor.unit?.nama ?? "-"}) -> ${periode.nama}`
  );
  revalidatePath("/lpm");
  revalidatePath("/auditor");
  revalidatePath("/auditee");
  ok(returnTo, `Auditor "${auditor.nama}" (${auditor.unit?.nama ?? "Lintas Prodi"}) ditugaskan ke ${periode.nama}.`);
}

export async function lepasAuditorDariSesi(fd: FormData) {
  const lpm = await requireUser("LPM");
  const returnTo = str(fd, "returnTo", 200) || "/lpm";
  const periodeId = str(fd, "periodeId", 64);
  const auditorId = str(fd, "auditorId", 64);

  const penugasan = await prisma.penugasan.findFirst({
    where: { periodeId },
  });
  if (!penugasan) fail(returnTo, "Penugasan tidak ditemukan.");

  await prisma.penugasanAuditor.deleteMany({
    where: { penugasanId: penugasan.id, auditorId },
  });

  await catat(lpm.id, "LEPAS_AUDITOR_SESI", `Periode ${periodeId} - Auditor ${auditorId}`);
  revalidatePath("/lpm");
  revalidatePath("/auditor");
  revalidatePath("/auditee");
  ok(returnTo, "Auditor dilepas dari sesi ini.");
}

// ====================================================
// 3. FITUR EMERGENCY LPM: TAMBAH & HAPUS AUDITOR / AUDITEE
// ====================================================
export async function tambahUserEmergencyOlehLpm(fd: FormData) {
  const lpm = await requireUser("LPM");
  const returnTo = str(fd, "returnTo", 200) || "/lpm";
  const roleRaw = str(fd, "role", 32) || "AUDITOR";
  const nama = str(fd, "nama", 120);
  const nimNuptk = str(fd, "nimNuptk", 64);
  const prodiKode = str(fd, "prodiKode", 32);
  const username = str(fd, "username", 64).toLowerCase().replace(/\s+/g, "");
  const assignPeriodeId = str(fd, "assignPeriodeId", 64);

  if (roleRaw !== "AUDITOR" && roleRaw !== "AUDITEE") {
    fail(returnTo, "LPM hanya dapat menambahkan akun Auditor atau Auditee.");
  }

  if (!nama || !nimNuptk || !prodiKode || !username) {
    fail(returnTo, "Nama, NIDN/NUPTK, Prodi, dan Username wajib diisi.");
  }

  const prodiDef = HOMEBASE_LIST.find((p) => p.kode === prodiKode);
  if (!prodiDef) {
    fail(returnTo, "Homebase / Program Studi tidak valid.");
  }

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) {
    fail(returnTo, `Username "${username}" sudah digunakan.`);
  }

  const unit = await prisma.unit.upsert({
    where: { kode: prodiDef.kode },
    update: { nama: prodiDef.nama },
    create: {
      kode: prodiDef.kode,
      nama: prodiDef.nama,
      jenis: prodiDef.jenis,
      diaudit: prodiDef.jenis === "PRODI",
    },
  });

  // Jika LPM membuat Auditor langsung dari kartu Sesi AMI tertentu, pastikan tidak satu prodi!
  if (roleRaw === "AUDITOR" && assignPeriodeId) {
    const targetPeriode = await prisma.periode.findUnique({
      where: { id: assignPeriodeId },
      include: { unit: true },
    });
    if (targetPeriode?.unitId === unit.id) {
      fail(
        returnTo,
        `Ditolak: Untuk mengaudit ${targetPeriode.unit?.nama}, Prodi asal Auditor harus dari Prodi lain (tidak boleh satu prodi)!`
      );
    }
  }

  const newUser = await prisma.user.create({
    data: {
      nama,
      nimNuptk,
      username,
      passwordHash: await bcrypt.hash(DEFAULT_PASSWORD, 10),
      passwordEnc: encryptPassword(DEFAULT_PASSWORD),
      role: roleRaw,
      unitId: unit.id,
      aktif: true,
    },
  });

  // Jika membuat Auditor dari kartu Sesi AMI, langsung tugaskan ke sesi tersebut
  if (roleRaw === "AUDITOR" && assignPeriodeId) {
    const targetPeriode = await prisma.periode.findUnique({ where: { id: assignPeriodeId } });
    if (targetPeriode && targetPeriode.unitId && targetPeriode.unitId !== unit.id) {
      const penugasan = await prisma.penugasan.upsert({
        where: {
          periodeId_unitId: { periodeId: targetPeriode.id, unitId: targetPeriode.unitId },
        },
        update: {},
        create: {
          periodeId: targetPeriode.id,
          unitId: targetPeriode.unitId,
          disahkan: true,
        },
      });
      await prisma.penugasanAuditor.create({
        data: {
          penugasanId: penugasan.id,
          auditorId: newUser.id,
          peran: "ANGGOTA",
        },
      });
    }
  }

  await catat(
    lpm.id,
    `LPM_TAMBAH_${roleRaw}`,
    `${nama} (${username} - Prodi ${prodiDef.nama})`
  );
  revalidatePath("/lpm");
  revalidatePath("/admin");
  revalidatePath("/auditor");
  revalidatePath("/auditee");
  ok(returnTo, `Akun ${roleRaw} "${nama}" (${username}) dibuat (password: ${DEFAULT_PASSWORD}).`);
}

export async function hapusUserEmergencyOlehLpm(fd: FormData) {
  const lpm = await requireUser("LPM");
  const returnTo = str(fd, "returnTo", 200) || "/lpm";
  const userId = str(fd, "userId", 64);

  if (!userId) fail(returnTo, "ID akun tidak valid.");

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) fail(returnTo, "Akun tidak ditemukan.");
  if (target.role !== "AUDITOR" && target.role !== "AUDITEE") {
    fail(returnTo, "LPM hanya dapat menghapus akun Auditor atau Auditee.");
  }

  await prisma.user.delete({ where: { id: userId } });
  await catat(lpm.id, `LPM_HAPUS_${target.role}`, `${target.nama} (${target.username})`);
  revalidatePath("/lpm");
  revalidatePath("/admin");
  revalidatePath("/auditor");
  revalidatePath("/auditee");
  ok(returnTo, `Akun ${target.role} "${target.nama}" (${target.username}) berhasil dihapus.`);
}

// Backward-compatible aliases
export const tambahAuditorOlehLpm = tambahUserEmergencyOlehLpm;
export const hapusAuditorOlehLpm = hapusUserEmergencyOlehLpm;

// ====================================================
// 4. TAMBAH & HAPUS INDIKATOR SPMI (LPM)
// ====================================================
export async function tambahIndikator(fd: FormData) {
  const user = await requireUser("LPM");
  const returnTo = str(fd, "returnTo", 200) || "/lpm/indikator";
  const targetPeriodeId = str(fd, "periodeId", 64) || "ALL";
  const kode = str(fd, "kode", 32).toUpperCase().replace(/\s+/g, "-");
  const standar = str(fd, "standar", 120);
  const pernyataan = str(fd, "pernyataan", 1000);
  const target = str(fd, "target", 120);
  const buktiDiminta = str(fd, "buktiDiminta", 400) || null;

  if (!kode || !standar || !pernyataan || !target) {
    fail(returnTo, "Kode, standar, pernyataan, dan target indikator wajib diisi.");
  }

  const periodes =
    targetPeriodeId === "ALL"
      ? await prisma.periode.findMany({ orderBy: { createdAt: "desc" } })
      : await prisma.periode.findMany({ where: { id: targetPeriodeId } });

  if (periodes.length === 0) {
    fail(returnTo, "Belum ada Sesi AMI.");
  }

  for (const p of periodes) {
    const jml = await prisma.indikator.count({ where: { periodeId: p.id } });
    await prisma.indikator.upsert({
      where: { periodeId_kode: { periodeId: p.id, kode } },
      update: { standar, pernyataan, target, buktiDiminta },
      create: {
        periodeId: p.id,
        kode,
        standar,
        pernyataan,
        target,
        buktiDiminta,
        urutan: jml + 1,
      },
    });
  }

  await catat(user.id, "TAMBAH_INDIKATOR", `[${kode}] ${standar}`);
  revalidatePath("/lpm/indikator");
  revalidatePath("/lpm");
  revalidatePath("/auditee");
  revalidatePath("/auditor");
  ok(returnTo, `Indikator "${kode}" ditambahkan.`);
}

export async function editIndikator(fd: FormData) {
  const user = await requireUser("LPM");
  const returnTo = str(fd, "returnTo", 200) || "/lpm/indikator";
  const indikatorId = str(fd, "indikatorId", 64);
  const kode = str(fd, "kode", 32).toUpperCase().replace(/\s+/g, "-");
  const standar = str(fd, "standar", 120);
  const pernyataan = str(fd, "pernyataan", 1000);
  const target = str(fd, "target", 120);

  if (!indikatorId || !kode || !standar || !pernyataan || !target) {
    fail(returnTo, "Kode, standar, pernyataan, dan target indikator wajib diisi.");
  }

  const existing = await prisma.indikator.findUnique({ where: { id: indikatorId } });
  if (!existing) fail(returnTo, "Indikator tidak ditemukan.");

  // Cek duplikat kode dalam sesi yang sama jika kode diubah
  if (kode !== existing.kode) {
    const duplicate = await prisma.indikator.findUnique({
      where: { periodeId_kode: { periodeId: existing.periodeId, kode } },
    });
    if (duplicate) {
      fail(returnTo, `Kode indikator "${kode}" sudah digunakan pada sesi ini.`);
    }
  }

  await prisma.indikator.update({
    where: { id: indikatorId },
    data: { kode, standar, pernyataan, target },
  });

  await catat(user.id, "EDIT_INDIKATOR", `[${kode}] ${standar}`);
  revalidatePath("/lpm/indikator");
  revalidatePath("/lpm");
  revalidatePath("/auditee");
  revalidatePath("/auditor");
  ok(returnTo, `Indikator "${kode}" berhasil diperbarui.`);
}

export async function hapusIndikator(fd: FormData) {
  const user = await requireUser("LPM");
  const returnTo = str(fd, "returnTo", 200) || "/lpm/indikator";
  const indikatorId = str(fd, "indikatorId", 64);
  const ind = await prisma.indikator.findUnique({ where: { id: indikatorId } });
  if (!ind) fail(returnTo, "Indikator tidak ditemukan.");

  await prisma.indikator.delete({ where: { id: indikatorId } });
  await catat(user.id, "HAPUS_INDIKATOR", ind.kode);
  revalidatePath("/lpm/indikator");
  revalidatePath("/lpm");
  revalidatePath("/auditee");
  revalidatePath("/auditor");
  ok(returnTo, `Indikator "${ind.kode}" dihapus.`);
}

// ====================================================
// 5. PENGESAHAN LAPORAN AMI
// ====================================================
export async function sahkanLaporanAkhir(fd: FormData) {
  const user = await requireUser("LPM");
  const periodeId = str(fd, "periodeId", 64);
  const periode = periodeId
    ? await prisma.periode.findUnique({ where: { id: periodeId } })
    : await prisma.periode.findFirst({ orderBy: { createdAt: "desc" } });

  if (!periode) fail("/lpm/rekap", "Belum ada Sesi AMI.");

  await prisma.periode.update({
    where: { id: periode.id },
    data: {
      disahkanAt: new Date(),
      disahkanOleh: user.nama,
    },
  });

  await catat(user.id, "SAHKAN_LAPORAN_AMI", `Laporan ${periode.nama} disahkan oleh ${user.nama}`);
  revalidatePath("/lpm/rekap");
  ok("/lpm/rekap", `Laporan "${periode.nama}" disahkan oleh ${user.nama}.`);
}
