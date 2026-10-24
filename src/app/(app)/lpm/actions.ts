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
    target: "-",
    buktiDiminta: "SK Kurikulum OBE, Matriks CPL, dan RPS",
    urutan: 1,
  },
  {
    kode: "STD-PEND-02",
    standar: "Standar Proses Pembelajaran",
    pernyataan:
      "Pelaksanaan monitoring kehadiran dosen dan kesesuaian materi perkuliahan minimal 14-16 pertemuan per semester beserta berita acara.",
    target: "-",
    buktiDiminta: "Rekap Presensi, Jurnal Perkuliahan, Laporan Monev",
    urutan: 2,
  },
  {
    kode: "STD-PENEL-01",
    standar: "Standar Penelitian & PKM",
    pernyataan:
      "Keterlibatan mahasiswa dalam peta jalan penelitian dosen tetap program studi yang dibuktikan dengan SK/Kontrak atau publikasi bersama.",
    target: "-",
    buktiDiminta: "SK/Kontrak Penelitian, Artikel Publikasi",
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
  const standarPilihan = str(fd, "standar", 120);
  const standarBaru = str(fd, "standarBaru", 120);
  const standar = standarBaru || standarPilihan;
  const pernyataan = str(fd, "pernyataan", 1000);
  const buktiDiminta = str(fd, "buktiDiminta", 500) || null;

  if (!kode || !standar || !pernyataan) {
    fail(returnTo, "Kode, standar, dan pernyataan indikator wajib diisi.");
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
      update: { standar, pernyataan, buktiDiminta },
      create: {
        periodeId: p.id,
        kode,
        standar,
        pernyataan,
        target: "-",
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
  const buktiDiminta = str(fd, "buktiDiminta", 500) || null;

  if (!indikatorId || !kode || !standar || !pernyataan) {
    fail(returnTo, "Kode, standar, dan pernyataan indikator wajib diisi.");
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
    data: { kode, standar, pernyataan, buktiDiminta },
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

/**
 * Ubah nama Standar sekaligus untuk semua indikator yang berada di bawah Standar tersebut
 */
export async function ubahNamaStandar(fd: FormData) {
  const user = await requireUser("LPM");
  const returnTo = str(fd, "returnTo", 200) || "/lpm/indikator";
  const periodeId = str(fd, "periodeId", 64) || "ALL";
  const standarLama = str(fd, "standarLama", 120);
  const standarBaru = str(fd, "standarBaru", 120);

  if (!standarLama || !standarBaru) {
    fail(returnTo, "Nama standar lama dan baru wajib diisi.");
  }

  await prisma.indikator.updateMany({
    where: {
      standar: standarLama,
      ...(periodeId !== "ALL" ? { periodeId } : {}),
    },
    data: { standar: standarBaru },
  });

  await catat(user.id, "UBAH_NAMA_STANDAR", `"${standarLama}" -> "${standarBaru}"`);
  revalidatePath("/lpm/indikator");
  revalidatePath("/lpm");
  revalidatePath("/auditee");
  revalidatePath("/auditor");
  ok(returnTo, `Standar "${standarLama}" berhasil diubah menjadi "${standarBaru}".`);
}

/**
 * Emergency LPM: Hapus 1 kelompok Standar beserta seluruh indikator di dalamnya
 */
export async function hapusStandarEmergency(fd: FormData) {
  const user = await requireUser("LPM");
  const returnTo = str(fd, "returnTo", 200) || "/lpm/indikator";
  const periodeId = str(fd, "periodeId", 64);
  const standar = str(fd, "standar", 120);

  if (!standar) {
    fail(returnTo, "Nama standar tidak valid.");
  }

  const deleted = await prisma.indikator.deleteMany({
    where: {
      standar,
      ...(periodeId && periodeId !== "ALL" ? { periodeId } : {}),
    },
  });

  await catat(
    user.id,
    "HAPUS_STANDAR_EMERGENCY",
    `Hapus Standar "${standar}" (${deleted.count} indikator)`
  );
  revalidatePath("/lpm/indikator");
  revalidatePath("/lpm");
  revalidatePath("/auditee");
  revalidatePath("/auditor");
  ok(returnTo, `Standar "${standar}" (${deleted.count} indikator) berhasil dihapus.`);
}

export interface ExcelIndikatorRowInput {
  kode: string;
  standar: string;
  pernyataan: string;
  buktiDiminta: string;
}

export async function importBatchIndikatorExcel(
  targetPeriodeId: string,
  rows: ExcelIndikatorRowInput[],
  mode: "SKIP_EXISTING" | "UPDATE_EXISTING" = "SKIP_EXISTING"
): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
  addedCount?: number;
  updatedCount?: number;
  skippedCount?: number;
}> {
  const user = await requireUser("LPM");
  if (!rows || rows.length === 0) {
    return { ok: false, error: "Tidak ada baris indikator yang valid untuk diimport." };
  }

  const periodes =
    targetPeriodeId === "ALL"
      ? await prisma.periode.findMany({
          include: { indikator: true },
          orderBy: { createdAt: "desc" },
        })
      : await prisma.periode.findMany({
          where: { id: targetPeriodeId },
          include: { indikator: true },
        });

  if (periodes.length === 0) {
    return { ok: false, error: "Sesi AMI belum ditemukan. Buat Sesi AMI terlebih dahulu." };
  }

  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const p of periodes) {
    const existingMap = new Map(p.indikator.map((ind) => [ind.kode.toUpperCase(), ind]));
    let nextUrutan = p.indikator.length + 1;

    for (const raw of rows) {
      const kode = (raw.kode || "").trim().toUpperCase().replace(/\s+/g, "-").slice(0, 32);
      const standar = (raw.standar || "").trim().slice(0, 120);
      const pernyataan = (raw.pernyataan || "").trim().slice(0, 1000);
      const buktiDiminta = (raw.buktiDiminta || "").trim().slice(0, 500) || null;

      if (!kode || !standar || !pernyataan) {
        skippedCount++;
        continue;
      }

      const existing = existingMap.get(kode);
      if (existing) {
        if (mode === "SKIP_EXISTING") {
          skippedCount++;
          continue;
        } else {
          await prisma.indikator.update({
            where: { id: existing.id },
            data: { standar, pernyataan, buktiDiminta },
          });
          updatedCount++;
        }
      } else {
        const created = await prisma.indikator.create({
          data: {
            periodeId: p.id,
            kode,
            standar,
            pernyataan,
            target: "-",
            buktiDiminta,
            urutan: nextUrutan++,
          },
        });
        existingMap.set(kode, created);
        addedCount++;
      }
    }
  }

  await catat(
    user.id,
    "IMPORT_EXCEL_INDIKATOR",
    `Import Excel: +${addedCount} baru, ${updatedCount} diperbarui, ${skippedCount} dilewati`
  );
  revalidatePath("/lpm/indikator");
  revalidatePath("/lpm");
  revalidatePath("/auditee");
  revalidatePath("/auditor");

  return {
    ok: true,
    addedCount,
    updatedCount,
    skippedCount,
    message: `Import selesai: ${addedCount} indikator baru ditambahkan, ${updatedCount} diperbarui, ${skippedCount} dilewati (indikator manual aman).`,
  };
}

// ====================================================
// 5. PENGESAHAN LAPORAN AMI, PILIH KETUA & TEMPEL TTD
// ====================================================
export async function pilihKetuaSesiAmi(fd: FormData) {
  const lpm = await requireUser("LPM");
  const returnTo = str(fd, "returnTo", 200) || "/lpm";
  const periodeId = str(fd, "periodeId", 64);
  const tipe = str(fd, "tipe", 16); // "AUDITEE" | "AUDITOR"
  const userId = str(fd, "userId", 64);

  if (!periodeId || !userId || (tipe !== "AUDITEE" && tipe !== "AUDITOR")) {
    fail(returnTo, "Data pemilihan ketua tidak lengkap.");
  }

  const [periode, targetUser] = await Promise.all([
    prisma.periode.findUnique({ where: { id: periodeId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  if (!periode || !targetUser) {
    fail(returnTo, "Sesi atau pengguna tidak ditemukan.");
  }

  if (tipe === "AUDITEE") {
    await prisma.periode.update({
      where: { id: periodeId },
      data: {
        ketuaAuditeeId: targetUser.id,
        ketuaAuditeeNama: targetUser.nama,
        ketuaAuditeeNip: targetUser.nimNuptk || null,
      },
    });
  } else {
    await prisma.periode.update({
      where: { id: periodeId },
      data: {
        ketuaAuditorId: targetUser.id,
        ketuaAuditorNama: targetUser.nama,
        ketuaAuditorNip: targetUser.nimNuptk || null,
      },
    });
  }

  await catat(lpm.id, `PILIH_KETUA_${tipe}`, `${targetUser.nama} -> ${periode.nama}`);
  revalidatePath("/lpm");
  revalidatePath("/lpm/rekap");
  revalidatePath("/auditor");
  revalidatePath(`/auditor/${periodeId}`);
  revalidatePath("/auditee");
  ok(returnTo, `Ketua ${tipe === "AUDITEE" ? "Auditee" : "Auditor"} ditetapkan: ${targetUser.nama}.`);
}

export async function simpanTtdSesi(
  periodeId: string,
  tipe: "AUDITEE" | "AUDITOR" | "LPM",
  ttdDataUrl: string | null
): Promise<{ ok: boolean; message?: string; error?: string }> {
  const user = await requireUser("LPM", "AUDITOR", "AUDITEE");
  if (!periodeId) return { ok: false, error: "Sesi AMI tidak ditemukan." };

  const periode = await prisma.periode.findUnique({ where: { id: periodeId } });
  if (!periode) return { ok: false, error: "Sesi AMI tidak ditemukan." };

  if (ttdDataUrl && ttdDataUrl.length > 250_000) {
    return { ok: false, error: "Ukuran tanda tangan terlalu besar." };
  }

  const now = ttdDataUrl ? new Date() : null;

  if (tipe === "AUDITEE") {
    if (user.role !== "AUDITEE" && user.role !== "LPM") {
      return { ok: false, error: "Hanya Ketua Auditee yang dapat menempel TTD Auditee." };
    }
    if (user.role === "AUDITEE" && periode.ketuaAuditeeId && periode.ketuaAuditeeId !== user.id) {
      return {
        ok: false,
        error: `Hanya Ketua Auditee (${periode.ketuaAuditeeNama}) yang ditunjuk LPM yang dapat menempel TTD pada sesi ini.`,
      };
    }

    await prisma.periode.update({
      where: { id: periodeId },
      data: {
        ketuaAuditeeId: periode.ketuaAuditeeId ?? user.id,
        ketuaAuditeeNama: periode.ketuaAuditeeNama ?? user.nama,
        ketuaAuditeeNip: periode.ketuaAuditeeNip ?? (user.nimNuptk || null),
        ttdAuditee: ttdDataUrl,
        ttdAuditeeAt: now,
      },
    });
  } else if (tipe === "AUDITOR") {
    if (user.role !== "AUDITOR" && user.role !== "LPM") {
      return { ok: false, error: "Hanya Ketua Auditor yang dapat menempel TTD Auditor." };
    }
    if (user.role === "AUDITOR" && periode.ketuaAuditorId && periode.ketuaAuditorId !== user.id) {
      return {
        ok: false,
        error: `Hanya Ketua Auditor (${periode.ketuaAuditorNama}) yang ditunjuk LPM yang dapat menempel TTD pada sesi ini.`,
      };
    }

    await prisma.periode.update({
      where: { id: periodeId },
      data: {
        ketuaAuditorId: periode.ketuaAuditorId ?? user.id,
        ketuaAuditorNama: periode.ketuaAuditorNama ?? user.nama,
        ketuaAuditorNip: periode.ketuaAuditorNip ?? (user.nimNuptk || null),
        ttdAuditor: ttdDataUrl,
        ttdAuditorAt: now,
      },
    });
  } else if (tipe === "LPM") {
    if (user.role !== "LPM") {
      return { ok: false, error: "Hanya Kepala LPM yang dapat menempel TTD LPM." };
    }

    await prisma.periode.update({
      where: { id: periodeId },
      data: {
        kepalaLpmNama: user.nama,
        kepalaLpmNip: user.nimNuptk || null,
        ttdLpm: ttdDataUrl,
        ttdLpmAt: now,
        ...(ttdDataUrl
          ? { disahkanAt: periode.disahkanAt ?? now, disahkanOleh: user.nama }
          : {}),
      },
    });
  }

  await catat(
    user.id,
    ttdDataUrl ? `TEMPEL_TTD_${tipe}` : `HAPUS_TTD_${tipe}`,
    `${user.nama} pada ${periode.nama}`
  );
  revalidatePath("/lpm");
  revalidatePath("/lpm/rekap");
  revalidatePath("/auditor");
  revalidatePath(`/auditor/${periodeId}`);
  revalidatePath("/auditee");

  return {
    ok: true,
    message: ttdDataUrl
      ? `Tanda tangan ${tipe} berhasil ditempel oleh ${user.nama}.`
      : `Tanda tangan ${tipe} dihapus.`,
  };
}

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
      kepalaLpmNama: user.nama,
      kepalaLpmNip: user.nimNuptk || null,
    },
  });

  await catat(user.id, "SAHKAN_LAPORAN_AMI", `Laporan ${periode.nama} disahkan oleh ${user.nama}`);
  revalidatePath("/lpm/rekap");
  ok("/lpm/rekap", `Laporan "${periode.nama}" disahkan oleh ${user.nama}.`);
}
