import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";
import { encryptPassword } from "../src/lib/crypto";

const prisma = new PrismaClient();
const DEFAULT_PASS = "123";

async function main() {
  console.log("🌱 Seeding data awal SI-AMI ITBMP (3 Prodi & 4 Role, password default: 123)...");

  // 1. Buat 3 Program Studi Resmi Kampus ITBMP
  const prodiData = [
    { kode: "PRODI-BD", nama: "Bisnis Digital", jenis: "PRODI", diaudit: true },
    { kode: "PRODI-AKT", nama: "Aktuaria", jenis: "PRODI", diaudit: true },
    { kode: "PRODI-PWK", nama: "Perancangan Wilayah dan Kota", jenis: "PRODI", diaudit: true },
  ];

  const units: Record<string, string> = {};
  for (const u of prodiData) {
    const saved = await prisma.unit.upsert({
      where: { kode: u.kode },
      update: { nama: u.nama, jenis: u.jenis, diaudit: u.diaudit },
      create: u,
    });
    units[u.kode] = saved.id;
  }

  // 2. Buat Akun untuk 4 Role (SUPER_ADMIN, LPM, AUDITOR, AUDITEE) dengan password default "123"
  const akunAwal: {
    username: string;
    nama: string;
    nimNuptk: string;
    role: Role;
    prodiKode: string;
  }[] = [
    {
      username: "superadmin",
      nama: "Super Admin ITBMP",
      nimNuptk: "9900000001",
      role: "SUPER_ADMIN",
      prodiKode: "PRODI-BD",
    },
    {
      username: "lpm",
      nama: "Agus Kurniawan, M.Kom (Kepala LPM)",
      nimNuptk: "198501012015041001",
      role: "LPM",
      prodiKode: "PRODI-BD",
    },
    {
      username: "auditor_bd",
      nama: "Dr. Hendra Wijaya, M.M",
      nimNuptk: "198603122016041002",
      role: "AUDITOR",
      prodiKode: "PRODI-BD",
    },
    {
      username: "auditor_akt",
      nama: "Siti Aminah, M.Si",
      nimNuptk: "198907212018042001",
      role: "AUDITOR",
      prodiKode: "PRODI-AKT",
    },
    {
      username: "auditor_pwk",
      nama: "Dr. Budi Santoso, M.T",
      nimNuptk: "198411052014041003",
      role: "AUDITOR",
      prodiKode: "PRODI-PWK",
    },
    {
      username: "auditee_bd",
      nama: "Kaprodi Bisnis Digital",
      nimNuptk: "199002142019041001",
      role: "AUDITEE",
      prodiKode: "PRODI-BD",
    },
    {
      username: "auditee_akt",
      nama: "Kaprodi Aktuaria",
      nimNuptk: "199106182020042002",
      role: "AUDITEE",
      prodiKode: "PRODI-AKT",
    },
    {
      username: "auditee_pwk",
      nama: "Kaprodi Perancangan Wilayah dan Kota",
      nimNuptk: "198809252017041004",
      role: "AUDITEE",
      prodiKode: "PRODI-PWK",
    },
  ];

  const userIds: Record<string, string> = {};
  for (const a of akunAwal) {
    const u = await prisma.user.upsert({
      where: { username: a.username },
      update: {
        nama: a.nama,
        nimNuptk: a.nimNuptk,
        role: a.role,
        unitId: units[a.prodiKode],
        passwordHash: await bcrypt.hash(DEFAULT_PASS, 10),
        passwordEnc: encryptPassword(DEFAULT_PASS),
        aktif: true,
      },
      create: {
        nama: a.nama,
        nimNuptk: a.nimNuptk,
        username: a.username,
        role: a.role,
        unitId: units[a.prodiKode],
        passwordHash: await bcrypt.hash(DEFAULT_PASS, 10),
        passwordEnc: encryptPassword(DEFAULT_PASS),
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

  // 4. Contoh Penugasan Tim Auditor Bebas Conflict of Interest:
  // Prodi Bisnis Digital diaudit oleh Siti (Aktuaria) & Budi (PWK)
  await prisma.penugasan.upsert({
    where: { periodeId_unitId: { periodeId: periode.id, unitId: units["PRODI-BD"] } },
    update: {},
    create: {
      periodeId: periode.id,
      unitId: units["PRODI-BD"],
      jadwalDokumenMulai: new Date("2026-11-16T00:00:00+07:00"),
      jadwalDokumenSelesai: new Date("2026-11-17T23:59:59+07:00"),
      jadwalLapanganMulai: new Date("2026-11-20T09:00:00+07:00"),
      jadwalLapanganSelesai: new Date("2026-11-20T12:00:00+07:00"),
      sumber: "USULAN_OTOMATIS",
      disahkan: true,
      tim: {
        create: [
          { auditorId: userIds["auditor_akt"], peran: "KETUA" },
          { auditorId: userIds["auditor_pwk"], peran: "ANGGOTA" },
        ],
      },
    },
  });

  // 5. Contoh Isian Bukti Google Drive Prodi Bisnis Digital
  await prisma.isian.upsert({
    where: { indikatorId_unitId: { indikatorId: indIds["STD-PEND-01"], unitId: units["PRODI-BD"] } },
    update: {},
    create: {
      indikatorId: indIds["STD-PEND-01"],
      unitId: units["PRODI-BD"],
      klaim: "Seluruh mata kuliah aktif Prodi Bisnis Digital telah memiliki RPS OBE yang disahkan Kaprodi di Google Drive.",
      linkDrive: "https://drive.google.com/drive/folders/1ITBMP_RPS_OBE_2026_BD",
      statusDokumen: "LENGKAP",
      catatanDokumen: "Dokumen SK Kurikulum dan seluruh file RPS di Google Drive lengkap dan sesuai template SPMI.",
      klasifikasi: "MENCAPAI",
      catatanLapangan: "Terverifikasi sesuai saat pemeriksaan lapangan.",
    },
  });

  console.log("✅ Seed selesai! Semua akun awal menggunakan password default: 123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
