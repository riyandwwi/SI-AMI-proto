import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";
import { encryptPassword } from "../src/lib/crypto";

const prisma = new PrismaClient();
const DEFAULT_PASS = "123";

async function main() {
  console.log("🌱 Seeding data awal SI-AMI ITBMP (3 Prodi, 4 Role, password default: 123)...");

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

  // 2. Buat Akun untuk 4 Role (SUPER_ADMIN, LPM, AUDITOR, AUDITEE) jika belum ada
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
      nimNuptk: "0401018501",
      role: "LPM",
      prodiKode: "PRODI-BD",
    },
    {
      username: "auditor_bd",
      nama: "Dr. Hendra Wijaya, M.M",
      nimNuptk: "0412038602",
      role: "AUDITOR",
      prodiKode: "PRODI-BD",
    },
    {
      username: "auditor_akt",
      nama: "Siti Aminah, M.Si",
      nimNuptk: "0421078901",
      role: "AUDITOR",
      prodiKode: "PRODI-AKT",
    },
    {
      username: "auditor_pwk",
      nama: "Dr. Budi Santoso, M.T",
      nimNuptk: "0405118403",
      role: "AUDITOR",
      prodiKode: "PRODI-PWK",
    },
    {
      username: "auditee_bd",
      nama: "Kaprodi Bisnis Digital",
      nimNuptk: "0414029001",
      role: "AUDITEE",
      prodiKode: "PRODI-BD",
    },
    {
      username: "auditee_akt",
      nama: "Kaprodi Aktuaria",
      nimNuptk: "0418069102",
      role: "AUDITEE",
      prodiKode: "PRODI-AKT",
    },
    {
      username: "auditee_pwk",
      nama: "Kaprodi Perancangan Wilayah dan Kota",
      nimNuptk: "0425098804",
      role: "AUDITEE",
      prodiKode: "PRODI-PWK",
    },
  ];

  for (const a of akunAwal) {
    const existing = await prisma.user.findUnique({ where: { username: a.username } });
    if (!existing) {
      await prisma.user.create({
        data: {
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
    }
  }

  // 3. Buat Sesi AMI Awal & Indikator Contoh HANYA jika belum ada Sesi AMI untuk Prodi tersebut
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

  for (const prodi of prodiData) {
    const unitId = units[prodi.kode];
    const existingPeriode = await prisma.periode.findFirst({ where: { unitId } });
    if (!existingPeriode) {
      const p = await prisma.periode.create({
        data: {
          nama: `AMI ${prodi.nama} — 2026/2027 (Ganjil)`,
          tahun: "2026/2027",
          semester: "Ganjil",
          unitId,
          tahap: "PENGISIAN",
          sourceLocked: false,
          aktif: true,
        },
      });

      for (const ind of daftarIndikator) {
        const savedInd = await prisma.indikator.create({
          data: { ...ind, periodeId: p.id },
        });

        if (prodi.kode === "PRODI-BD" && ind.kode === "STD-PEND-01") {
          await prisma.isian.create({
            data: {
              indikatorId: savedInd.id,
              unitId,
              klaim: "Seluruh mata kuliah aktif Prodi Bisnis Digital telah memiliki RPS OBE di Google Drive.",
              linkDrive: "https://drive.google.com/drive/folders/1ITBMP_RPS_OBE_2026_BD",
              statusDokumen: "LENGKAP",
              catatanDokumen: "Dokumen SK Kurikulum dan seluruh file RPS di Google Drive lengkap dan sesuai template SPMI.",
              klasifikasi: "MENCAPAI",
              catatanLapangan: "Terverifikasi sesuai saat pemeriksaan lapangan.",
            },
          });
        }
      }
    }
  }

  console.log("✅ Seed selesai!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
