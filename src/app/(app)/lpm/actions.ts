"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PRODI_LIST } from "@/lib/roles";
import { catat, fail, ok, str } from "@/lib/actions";

const DEFAULT_INDIKATOR = [
  {
    kode: "STD-PEND-01",
    standar: "Standar Isi Pembelajaran",
    pernyataan:
      "Ketersediaan dokumen Kurikulum Berbasis OBE dan RPS lengkap untuk seluruh mata kuliah aktif semester berjalan.",
    target: "100% Mata Kuliah",
    buktiDiminta: "Folder Google Drive berisi SK Kurikulum OBE, Matriks CPL, dan file RPS seluruh mata kuliah.",
    urutan: 1,
  },
  {
    kode: "STD-PEND-02",
    standar: "Standar Proses Pembelajaran",
    pernyataan:
      "Pelaksanaan monitoring kehadiran dosen dan kesesuaian materi perkuliahan minimal 14-16 pertemuan per semester beserta berita acara.",
    target: ">= 95% Kehadiran",
    buktiDiminta: "Folder Google Drive berisi rekap presensi perkuliahan, jurnal perkuliahan, dan laporan monev pembelajaran.",
    urutan: 2,
  },
  {
    kode: "STD-PENEL-01",
    standar: "Standar Penelitian & PKM",
    pernyataan:
      "Keterlibatan mahasiswa dalam peta jalan penelitian dosen tetap program studi yang dibuktikan dengan SK/Kontrak atau publikasi bersama.",
    target: ">= 30% Penelitian Dosen",
    buktiDiminta: "Folder Google Drive berisi SK/Kontrak penelitian dosen melibatkan mahasiswa dan artikel luaran.",
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

  // Ambil template indikator dari sesi terakhir jika ada, atau gunakan default
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

  await catat(user.id, "BUAT_SESI_AMI", `${p.nama}`);
  revalidatePath("/lpm");
  revalidatePath("/lpm/indikator");
  ok("/lpm", `Sesi "${p.nama}" berhasil dibuat. Auditor & Auditee dari Prodi ${unit.nama} otomatis terhubung.`);
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
  ok("/lpm", `Sesi "${p.nama}" sekarang ${nextAktif ? "TERBUKA (Aktif)" : "TERKUNCI (Selesai)"}.`);
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
  ok("/lpm", `Sesi "${p.nama}" berhasil dihapus.`);
}

// ====================================================
// 2. TAMBAH & HAPUS INDIKATOR SPMI (LPM)
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
    fail(returnTo, "Belum ada Sesi AMI. Buat Sesi AMI terlebih dahulu.");
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
  ok(returnTo, `Indikator "${kode}" berhasil ditambahkan.`);
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
  ok(returnTo, `Indikator "${ind.kode}" berhasil dihapus.`);
}

// ====================================================
// 3. PENGESAHAN LAPORAN AMI
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
  ok("/lpm/rekap", `Laporan AMI "${periode.nama}" resmi disahkan oleh ${user.nama}.`);
}
