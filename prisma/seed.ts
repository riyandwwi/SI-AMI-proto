import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";
import { encryptPassword } from "../src/lib/crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding data awal SI-AMI ITBMP...");

  // 1. Buat Unit / Program Studi ITBMP
  const unitData = [
    { kode: "LPM", nama: "Lembaga Penjaminan Mutu ITBMP", jenis: "UPT", diaudit: false },
    { kode: "PRODI-TI", nama: "Prodi S1 Teknik Informatika", jenis: "PRODI", diaudit: true },
    { kode: "PRODI-SI", nama: "Prodi S1 Sistem Informasi", jenis: "PRODI", diaudit: true },
    { kode: "PRODI-MNJ", nama: "Prodi S1 Manajemen", jenis: "PRODI", diaudit: true },
    { kode: "UPT-PERPUS", nama: "UPT Perpustakaan ITBMP", jenis: "UPT", diaudit: true },
  ];

  const units: Record<string, string> = {};
  for (const u of unitData) {
    const saved = await prisma.unit.upsert({
      where: { kode: u.kode },
      update: { nama: u.nama, jenis: u.jenis, diaudit: u.diaudit },
      create: u,
    });
    units[u.kode] = saved.id;
  }

  // 2. Buat Akun untuk 5 Role (Tanpa OTP, langsung aktif, password dapat dilihat Super Admin)
  const akunAwal: {
    username: string;
    password: string;
    nama: string;
    role: Role;
    unitKode?: string;
  }[] = [
    { username: "superadmin", password: "password123", nama: "Super Admin IT Support ITBMP", role: "SUPER_ADMIN" },
    { username: "lpm", password: "password123", nama: "Agus Kurniawan, M.Kom (Kepala LPM)", role: "LPM", unitKode: "LPM" },
    { username: "auditor_hendra", password: "password123", nama: "Dr. Hendra Wijaya, M.M", role: "AUDITOR", unitKode: "PRODI-MNJ" },
    { username: "auditor_siti", password: "password123", nama: "Siti Aminah, M.Kom", role: "AUDITOR", unitKode: "PRODI-SI" },
    { username: "auditor_budi", password: "password123", nama: "Dr. Budi Santoso, M.T", role: "AUDITOR", unitKode: "PRODI-TI" },
    { username: "prodi_ti", password: "password123", nama: "Ir. Rahmat Hidayat, M.T (Kaprodi TI)", role: "AUDITEE", unitKode: "PRODI-TI" },
    { username: "prodi_si", password: "password123", nama: "Rina Kartika, M.Kom (Kaprodi SI)", role: "AUDITEE", unitKode: "PRODI-SI" },
    { username: "upt_perpus", password: "password123", nama: "Kepala UPT Perpustakaan ITBMP", role: "AUDITEE", unitKode: "UPT-PERPUS" },
    { username: "pimpinan", password: "password123", nama: "Dr. Dewi Lestari, M.Si (Rektor ITBMP)", role: "PIMPINAN" },
  ];

  const userIds: Record<string, string> = {};
  for (const a of akunAwal) {
    const u = await prisma.user.upsert({
      where: { username: a.username },
      update: {
        nama: a.nama,
        role: a.role,
        unitId: a.unitKode ? units[a.unitKode] : null,
        passwordHash: await bcrypt.hash(a.password, 10),
        passwordEnc: encryptPassword(a.password),
        aktif: true,
      },
      create: {
        nama: a.nama,
        username: a.username,
        role: a.role,
        unitId: a.unitKode ? units[a.unitKode] : null,
        passwordHash: await bcrypt.hash(a.password, 10),
        passwordEnc: encryptPassword(a.password),
        aktif: true,
      },
    });
    userIds[a.username] = u.id;
  }

  // 3. Buat Periode Aktif & Indikator SPMI
  let periode = await prisma.periode.findFirst({ where: { aktif: true } });
  if (!periode) {
    periode = await prisma.periode.create({
      data: {
        nama: "AMI Siklus Tahun Akademik 2026/2027 Ganjil",
        tahun: "2026/2027",
        tahap: "PENGISIAN",
        sourceLocked: true,
        aktif: true,
        tglMulaiPengisian: new Date("2026-10-15T00:00:00+07:00"),
        tglCutOff: new Date("2026-11-15T23:59:59+07:00"),
        tglOpening: new Date("2026-11-18T00:00:00+07:00"),
        tglClosing: new Date("2026-11-28T00:00:00+07:00"),
      },
    });
  }

  const daftarIndikator = [
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

  const indIds: Record<string, string> = {};
  for (const ind of daftarIndikator) {
    const saved = await prisma.indikator.upsert({
      where: { periodeId_kode: { periodeId: periode.id, kode: ind.kode } },
      update: ind,
      create: { ...ind, periodeId: periode.id },
    });
    indIds[ind.kode] = saved.id;
  }

  // 4. Buat Penugasan Tim Auditor Bebas Conflict of Interest (Prodi TI diaudit oleh Hendra [MNJ] & Siti [SI])
  const penugasanTi = await prisma.penugasan.upsert({
    where: { periodeId_unitId: { periodeId: periode.id, unitId: units["PRODI-TI"] } },
    update: {},
    create: {
      periodeId: periode.id,
      unitId: units["PRODI-TI"],
      jadwalDokumenMulai: new Date("2026-11-16T00:00:00+07:00"),
      jadwalDokumenSelesai: new Date("2026-11-17T23:59:59+07:00"),
      jadwalLapanganMulai: new Date("2026-11-20T09:00:00+07:00"),
      jadwalLapanganSelesai: new Date("2026-11-20T12:00:00+07:00"),
      sumber: "USULAN_OTOMATIS",
      disahkan: true,
      tim: {
        create: [
          { auditorId: userIds["auditor_hendra"], peran: "KETUA" },
          { auditorId: userIds["auditor_siti"], peran: "ANGGOTA" },
        ],
      },
    },
  });

  // 5. Contoh Isian Bukti Google Drive Prodi TI
  await prisma.isian.upsert({
    where: { indikatorId_unitId: { indikatorId: indIds["STD-PEND-01"], unitId: units["PRODI-TI"] } },
    update: {},
    create: {
      indikatorId: indIds["STD-PEND-01"],
      unitId: units["PRODI-TI"],
      klaim: "Seluruh 42 mata kuliah aktif telah memiliki RPS OBE yang disahkan Kaprodi dan diunggah ke Google Drive.",
      linkDrive: "https://drive.google.com/drive/folders/1ITBMP_RPS_OBE_2026_TI",
      statusDokumen: "LENGKAP",
      catatanDokumen: "Dokumen SK Kurikulum dan 42 file RPS di Google Drive sudah lengkap dan sesuai template SPMI.",
      klasifikasi: "MENCAPAI",
      catatanLapangan: "Terverifikasi sesuai saat pemeriksaan lapangan.",
    },
  });

  await prisma.isian.upsert({
    where: { indikatorId_unitId: { indikatorId: indIds["STD-PEND-02"], unitId: units["PRODI-TI"] } },
    update: {},
    create: {
      indikatorId: indIds["STD-PEND-02"],
      unitId: units["PRODI-TI"],
      klaim: "Monitoring perkuliahan dilakukan rutin dan rekap disimpan pada Google Drive Prodi.",
      linkDrive: "https://drive.google.com/drive/folders/1ITBMP_MONEV_KULIAH_TI",
      statusDokumen: "PERLU_KLARIFIKASI",
      catatanDokumen: "Di folder Drive baru tersedia rekap minggu ke-1 s.d 8. Minggu ke-9 s.d 16 perlu dikonfirmasi saat audit lapangan.",
      klasifikasi: "KTS_MINOR",
      catatanLapangan: "Rekap minggu ke-9 s.d 14 masih berupa arsip fisik dan belum diunggah ke folder Drive Prodi.",
      rekomendasi: "Unggah scan berita acara monev minggu ke-9 s.d 16 ke folder Google Drive Prodi.",
      rtlStatus: "PROSES",
    },
  });

  console.log("✅ Seed selesai! Penugasan contoh:", penugasanTi.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
