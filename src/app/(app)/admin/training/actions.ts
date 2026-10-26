"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { encryptPassword } from "@/lib/crypto";
import { PRODI_LIST } from "@/lib/roles";
import { catat, fail, ok, str } from "@/lib/actions";

const DEFAULT_PASSWORD = "123";

async function ensureTrainingUnits() {
  const units = [];
  for (const p of PRODI_LIST) {
    const u = await prisma.unit.upsert({
      where: { kode: p.kode },
      create: { kode: p.kode, nama: p.nama, jenis: "PRODI", diaudit: true },
      update: { nama: p.nama },
    });
    units.push(u);
  }
  return units;
}

/** Ambil daftar master indikator unik yang sudah dimasukkan oleh LPM */
async function getMasterIndikatorFromLpm() {
  const allPeriodes = await prisma.periode.findMany({
    where: { isTraining: false },
    include: {
      indikator: {
        orderBy: [{ urutan: "asc" }, { kode: "asc" }],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const map = new Map<
    string,
    {
      kode: string;
      standar: string;
      pernyataanStandar: string | null;
      pernyataan: string;
      buktiDiminta: string | null;
      urutan: number;
    }
  >();

  for (const p of allPeriodes) {
    for (const ind of p.indikator) {
      const key = `${ind.standar.toUpperCase()}|||${ind.kode.toUpperCase()}`;
      if (!map.has(key)) {
        map.set(key, {
          kode: ind.kode,
          standar: ind.standar,
          pernyataanStandar: ind.pernyataanStandar,
          pernyataan: ind.pernyataan,
          buktiDiminta: ind.buktiDiminta,
          urutan: ind.urutan,
        });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.urutan - b.urutan);
}

export async function buatKelompokTraining(fd: FormData) {
  const admin = await requireUser("SUPER_ADMIN", "LPM");
  const rawJumlah = Number(str(fd, "jumlahKelompok", 10) || "5");
  const jumlah = Math.max(1, Math.min(25, Number.isFinite(rawJumlah) ? rawJumlah : 5));
  const namaEvent = str(fd, "namaEvent", 100) || "Pelatihan AMI";

  const units = await ensureTrainingUnits();
  const defaultUnit = units[0];
  const masterIndikator = await getMasterIndikatorFromLpm();

  const existingTraining = await prisma.periode.findMany({
    where: { isTraining: true },
    orderBy: { createdAt: "asc" },
  });

  const startNum = existingTraining.length + 1;
  let createdCount = 0;

  for (let i = 0; i < jumlah; i++) {
    const nomorKelompok = startNum + i;
    const namaKelompok = `🎓 ${namaEvent} — Kelompok ${nomorKelompok}`;
    // Buat unit unik per kelompok training agar isian antar kelompok tidak saling menimpa
    const trainingUnitKode = `TRAINING-KELOMPOK-${nomorKelompok}-${Date.now().toString().slice(-4)}`;
    const trainingUnit = await prisma.unit.create({
      data: {
        kode: trainingUnitKode,
        nama: `Kelompok ${nomorKelompok} (Training)`,
        jenis: "TRAINING",
        diaudit: true,
      },
    });

    const newPeriode = await prisma.periode.create({
      data: {
        nama: namaKelompok,
        tahun: "Training",
        semester: `Kelompok ${nomorKelompok}`,
        isTraining: true,
        unitId: trainingUnit.id ?? defaultUnit.id,
        tahap: "PENGISIAN",
        aktif: true,
        sourceLocked: true,
      },
    });

    for (let idx = 0; idx < masterIndikator.length; idx++) {
      const m = masterIndikator[idx];
      await prisma.indikator.create({
        data: {
          periodeId: newPeriode.id,
          kode: m.kode,
          standar: m.standar,
          pernyataanStandar: m.pernyataanStandar,
          pernyataan: m.pernyataan,
          buktiDiminta: m.buktiDiminta,
          urutan: idx + 1,
        },
      });
    }

    createdCount++;
  }

  await catat(
    admin.id,
    "BUAT_SESI_TRAINING",
    `${createdCount} Kelompok Training (${masterIndikator.length} indikator dari LPM)`
  );

  revalidatePath("/admin/training");
  revalidatePath("/lpm");
  revalidatePath("/lpm/indikator");
  revalidatePath("/lpm/rekap");
  revalidatePath("/training");
  ok(
    "/admin/training",
    `Berhasil membuat ${createdCount} Kelompok Sesi Training beserta ${masterIndikator.length} indikator dari LPM.`
  );
}

export async function sinkronkanIndikatorTraining() {
  const admin = await requireUser("SUPER_ADMIN", "LPM");
  const masterIndikator = await getMasterIndikatorFromLpm();
  const trainingPeriodes = await prisma.periode.findMany({
    where: { isTraining: true },
    include: { indikator: true },
  });

  if (trainingPeriodes.length === 0) {
    fail("/admin/training", "Belum ada Kelompok Sesi Training. Silakan buat kelompok terlebih dahulu.");
  }

  let synced = 0;
  for (const tp of trainingPeriodes) {
    await prisma.periode.update({
      where: { id: tp.id },
      data: { sourceLocked: true, aktif: true },
    });

    const existingMap = new Map(
      tp.indikator.map((ind) => [`${ind.standar.toUpperCase()}|||${ind.kode.toUpperCase()}`, ind])
    );

    for (let idx = 0; idx < masterIndikator.length; idx++) {
      const m = masterIndikator[idx];
      const key = `${m.standar.toUpperCase()}|||${m.kode.toUpperCase()}`;
      const found = existingMap.get(key);
      if (found) {
        await prisma.indikator.update({
          where: { id: found.id },
          data: {
            standar: m.standar,
            pernyataanStandar: m.pernyataanStandar,
            pernyataan: m.pernyataan,
            buktiDiminta: m.buktiDiminta,
            urutan: idx + 1,
          },
        });
      } else {
        await prisma.indikator.create({
          data: {
            periodeId: tp.id,
            kode: m.kode,
            standar: m.standar,
            pernyataanStandar: m.pernyataanStandar,
            pernyataan: m.pernyataan,
            buktiDiminta: m.buktiDiminta,
            urutan: idx + 1,
          },
        });
      }
      synced++;
    }
  }

  await catat(admin.id, "SYNC_INDIKATOR_TRAINING", `${trainingPeriodes.length} kelompok (${synced} item)`);
  revalidatePath("/admin/training");
  revalidatePath("/lpm");
  revalidatePath("/lpm/indikator");
  revalidatePath("/auditee");
  revalidatePath("/auditor");
  ok(
    "/admin/training",
    `Berhasil menyinkronkan ${masterIndikator.length} indikator LPM ke ${trainingPeriodes.length} Kelompok Training.`
  );
}

export async function generateDummyTrainingAccounts(fd: FormData) {
  const admin = await requireUser("SUPER_ADMIN", "LPM");
  const rawCount = Number(str(fd, "jumlahAkun", 10) || "25");
  const count = Math.max(1, Math.min(100, Number.isFinite(rawCount) ? rawCount : 25));
  const prefix = (str(fd, "prefixUsername", 24) || "peserta")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") || "peserta";

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const passwordEnc = encryptPassword(DEFAULT_PASSWORD);

  let created = 0;
  let seq = 1;

  while (created < count && seq <= 500) {
    const uname = `${prefix}${seq}`;
    const exists = await prisma.user.findUnique({ where: { username: uname } });
    if (!exists) {
      await prisma.user.create({
        data: {
          nama: `Peserta Pelatihan ${seq}`,
          nimNuptk: `TRN-${String(seq).padStart(3, "0")}`,
          username: uname,
          passwordHash,
          passwordEnc,
          role: "AUDITEE",
          isTraining: true,
          aktif: true,
        },
      });
      created++;
    }
    seq++;
  }

  await catat(admin.id, "GENERATE_AKUN_TRAINING", `${created} akun dummy training dibuat`);
  revalidatePath("/admin/training");
  ok(
    "/admin/training",
    `Berhasil membuat ${created} akun peserta training (Password default: 123).`
  );
}

export interface BulkTrainingUserRow {
  nama: string;
  nimNuptk?: string;
  username?: string;
}

export async function importAkunTrainingBatch(rows: BulkTrainingUserRow[]): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
}> {
  const admin = await requireUser("SUPER_ADMIN", "LPM");
  if (!rows || rows.length === 0) {
    return { ok: false, error: "Daftar akun kosong." };
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const passwordEnc = encryptPassword(DEFAULT_PASSWORD);

  let created = 0;
  let updated = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const nama = (r.nama ?? "").trim().slice(0, 120);
    if (!nama) continue;

    const nimNuptk = (r.nimNuptk ?? "").trim().slice(0, 64) || `TRN-${String(i + 1).padStart(3, "0")}`;
    let baseUname = (r.username ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "");

    if (!baseUname) {
      const slug = nama
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 12);
      baseUname = slug ? `${slug}${i + 1}` : `peserta${i + 1}`;
    }

    const existing = await prisma.user.findUnique({ where: { username: baseUname } });
    if (existing) {
      if (existing.isTraining) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { nama, nimNuptk, aktif: true },
        });
        updated++;
      } else {
        // Jangan timpa akun asli kampus, tambahkan akhiran angka
        const altUname = `${baseUname}_trn${i + 1}`;
        const altExists = await prisma.user.findUnique({ where: { username: altUname } });
        if (!altExists) {
          await prisma.user.create({
            data: {
              nama,
              nimNuptk,
              username: altUname,
              passwordHash,
              passwordEnc,
              role: "AUDITEE",
              isTraining: true,
              aktif: true,
            },
          });
          created++;
        }
      }
    } else {
      await prisma.user.create({
        data: {
          nama,
          nimNuptk,
          username: baseUname,
          passwordHash,
          passwordEnc,
          role: "AUDITEE",
          isTraining: true,
          aktif: true,
        },
      });
      created++;
    }
  }

  await catat(admin.id, "IMPORT_AKUN_TRAINING", `${created} baru, ${updated} diperbarui`);
  revalidatePath("/admin/training");
  return {
    ok: true,
    message: `Berhasil memproses akun training: ${created} akun baru dibuat, ${updated} diperbarui (Password: 123).`,
  };
}

export async function hapusSatuKelompokTraining(fd: FormData) {
  const admin = await requireUser("SUPER_ADMIN", "LPM");
  const periodeId = str(fd, "periodeId", 64);
  const p = await prisma.periode.findUnique({ where: { id: periodeId } });
  if (!p || !p.isTraining) {
    fail("/admin/training", "Kelompok training tidak ditemukan.");
  }

  // Lepaskan atau hapus unit khusus training
  const unitId = p.unitId;
  await prisma.periode.delete({ where: { id: periodeId } });
  if (unitId) {
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (unit && unit.jenis === "TRAINING") {
      await prisma.unit.delete({ where: { id: unitId } }).catch(() => {});
    }
  }

  await catat(admin.id, "HAPUS_KELOMPOK_TRAINING", p.nama);
  revalidatePath("/admin/training");
  revalidatePath("/lpm");
  revalidatePath("/lpm/indikator");
  revalidatePath("/lpm/rekap");
  revalidatePath("/training");
  ok("/admin/training", `Kelompok "${p.nama}" dihapus.`);
}

export async function hapusSatuAkunTraining(fd: FormData) {
  const admin = await requireUser("SUPER_ADMIN", "LPM");
  const userId = str(fd, "userId", 64);
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u || !u.isTraining) {
    fail("/admin/training", "Akun training tidak ditemukan.");
  }
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/training");
  ok("/admin/training", `Akun training "${u.username}" dihapus.`);
}

export async function hapusSemuaSesiDanAkunTraining() {
  const admin = await requireUser("SUPER_ADMIN", "LPM");

  const deletedUsers = await prisma.user.deleteMany({
    where: { isTraining: true },
  });
  const deletedPeriodes = await prisma.periode.deleteMany({
    where: { isTraining: true },
  });
  await prisma.unit.deleteMany({
    where: { jenis: "TRAINING" },
  });

  await catat(
    admin.id,
    "RESET_SEMUA_TRAINING",
    `${deletedPeriodes.count} kelompok & ${deletedUsers.count} akun training dihapus bersih`
  );

  revalidatePath("/admin/training");
  revalidatePath("/lpm");
  revalidatePath("/lpm/indikator");
  revalidatePath("/lpm/rekap");
  revalidatePath("/training");
  ok(
    "/admin/training",
    `Sesi Training selesai & dibersihkan: ${deletedPeriodes.count} Kelompok Training dan ${deletedUsers.count} Akun Dummy berhasil dihapus dari database.`
  );
}

export async function pilihKelompokOlehPesertaTraining(fd: FormData) {
  const user = await requireUser();
  if (!user.isTraining) {
    redirect("/");
  }

  const periodeId = str(fd, "periodeId", 64);
  const targetRole = str(fd, "targetRole", 16) || "AUDITEE";

  const periode = await prisma.periode.findUnique({
    where: { id: periodeId },
  });

  if (!periode || !periode.isTraining) {
    fail("/training", "Kelompok training tidak ditemukan.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      trainingPeriodeId: periode.id,
      unitId: periode.unitId,
    },
  });

  // Set default ketuaAuditee / ketuaAuditor di kelompok training jika masih kosong agar fitur TTD langsung aktif
  if (!periode.ketuaAuditeeId || !periode.ketuaAuditorId) {
    await prisma.periode.update({
      where: { id: periode.id },
      data: {
        ketuaAuditeeId: periode.ketuaAuditeeId ?? user.id,
        ketuaAuditeeNama: periode.ketuaAuditeeNama ?? user.nama,
        ketuaAuditeeNip: periode.ketuaAuditeeNip ?? (user.nimNuptk || "-"),
        ketuaAuditorId: periode.ketuaAuditorId ?? user.id,
        ketuaAuditorNama: periode.ketuaAuditorNama ?? user.nama,
        ketuaAuditorNip: periode.ketuaAuditorNip ?? (user.nimNuptk || "-"),
      },
    });
  }

  revalidatePath("/training");
  revalidatePath("/auditee");
  revalidatePath("/auditor");
  redirect(targetRole === "AUDITOR" ? `/auditor/${periode.id}` : "/auditee");
}
