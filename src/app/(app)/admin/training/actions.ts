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

export interface NewGroupMemberInput {
  nama: string;
  username?: string;
  nimNuptk?: string;
}

export async function simpanKelompokTrainingLengkap(payload: {
  namaKelompok: string;
  auditors: NewGroupMemberInput[];
  auditees: NewGroupMemberInput[];
  existingAuditorIds?: string[];
  existingAuditeeIds?: string[];
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  const admin = await requireUser("SUPER_ADMIN", "LPM");
  const rawName = (payload.namaKelompok ?? "").trim().slice(0, 100);
  if (!rawName) {
    return { ok: false, error: "Nama Kelompok wajib diisi." };
  }

  const cleanAuditors = (payload.auditors ?? []).filter((a) => a.nama.trim().length > 0);
  const cleanAuditees = (payload.auditees ?? []).filter((a) => a.nama.trim().length > 0);
  const existingAuditorIds = (payload.existingAuditorIds ?? []).filter(Boolean);
  const existingAuditeeIds = (payload.existingAuditeeIds ?? []).filter(Boolean);

  if (
    cleanAuditors.length === 0 &&
    cleanAuditees.length === 0 &&
    existingAuditorIds.length === 0 &&
    existingAuditeeIds.length === 0
  ) {
    return {
      ok: false,
      error: "Masukkan minimal 1 peserta di sisi Auditor (Kiri) atau Auditee (Kanan).",
    };
  }

  const units = await ensureTrainingUnits();
  const defaultUnit = units[0];
  const masterIndikator = await getMasterIndikatorFromLpm();

  const existingTraining = await prisma.periode.findMany({
    where: { isTraining: true },
  });
  const nomorKelompok = existingTraining.length + 1;
  const namaLengkapPeriode = rawName.startsWith("🎓") ? rawName : `🎓 Pelatihan AMI — ${rawName}`;

  const trainingUnitKode = `TRAINING-KELOMPOK-${nomorKelompok}-${Date.now().toString().slice(-4)}`;
  const trainingUnit = await prisma.unit.create({
    data: {
      kode: trainingUnitKode,
      nama: `${rawName} (Training)`,
      jenis: "TRAINING",
      diaudit: true,
    },
  });

  const newPeriode = await prisma.periode.create({
    data: {
      nama: namaLengkapPeriode,
      tahun: "Training",
      semester: rawName,
      isTraining: true,
      unitId: trainingUnit.id ?? defaultUnit.id,
      tahap: "PENGISIAN",
      aktif: true,
      sourceLocked: true,
    },
  });

  if (masterIndikator.length > 0) {
    await prisma.indikator.createMany({
      data: masterIndikator.map((m, idx) => ({
        periodeId: newPeriode.id,
        kode: m.kode,
        standar: m.standar,
        pernyataanStandar: m.pernyataanStandar,
        pernyataan: m.pernyataan,
        buktiDiminta: m.buktiDiminta,
        urutan: idx + 1,
      })),
    });
  }

  const [passwordHash, allUsers] = await Promise.all([
    bcrypt.hash(DEFAULT_PASSWORD, 10),
    prisma.user.findMany({ select: { username: true } }),
  ]);
  const passwordEnc = encryptPassword(DEFAULT_PASSWORD);
  const usedUsernames = new Set(allUsers.map((u) => u.username.toLowerCase()));

  const makeUniqueUsername = (rawUname: string | undefined, nama: string, rolePrefix: string, idx: number) => {
    let base = (rawUname ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "");
    if (!base) {
      const slug = nama
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 10);
      base = slug ? `${slug}_${rolePrefix}` : `${rolePrefix}_k${nomorKelompok}_${idx + 1}`;
    }
    let candidate = base;
    let suffix = 1;
    while (usedUsernames.has(candidate)) {
      candidate = `${base}${suffix}`;
      suffix++;
    }
    usedUsernames.add(candidate);
    return candidate;
  };

  const toCreateUsers: {
    nama: string;
    nimNuptk: string;
    username: string;
    passwordHash: string;
    passwordEnc: string;
    role: "AUDITOR" | "AUDITEE";
    isTraining: boolean;
    trainingPeriodeId: string;
    unitId: string;
    aktif: boolean;
  }[] = [];

  cleanAuditors.forEach((a, idx) => {
    const nama = a.nama.trim().slice(0, 120);
    const uname = makeUniqueUsername(a.username, nama, "auditor", idx);
    const nimNuptk = (a.nimNuptk ?? "").trim().slice(0, 64) || `TRN-AUD-${nomorKelompok}${idx + 1}`;
    toCreateUsers.push({
      nama,
      nimNuptk,
      username: uname,
      passwordHash,
      passwordEnc,
      role: "AUDITOR",
      isTraining: true,
      trainingPeriodeId: newPeriode.id,
      unitId: trainingUnit.id,
      aktif: true,
    });
  });

  cleanAuditees.forEach((a, idx) => {
    const nama = a.nama.trim().slice(0, 120);
    const uname = makeUniqueUsername(a.username, nama, "auditee", idx);
    const nimNuptk = (a.nimNuptk ?? "").trim().slice(0, 64) || `TRN-ADE-${nomorKelompok}${idx + 1}`;
    toCreateUsers.push({
      nama,
      nimNuptk,
      username: uname,
      passwordHash,
      passwordEnc,
      role: "AUDITEE",
      isTraining: true,
      trainingPeriodeId: newPeriode.id,
      unitId: trainingUnit.id,
      aktif: true,
    });
  });

  if (toCreateUsers.length > 0) {
    await prisma.user.createMany({
      data: toCreateUsers,
      skipDuplicates: true,
    });
  }

  if (existingAuditorIds.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: existingAuditorIds }, isTraining: true },
      data: {
        role: "AUDITOR",
        trainingPeriodeId: newPeriode.id,
        unitId: trainingUnit.id,
      },
    });
  }

  if (existingAuditeeIds.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: existingAuditeeIds }, isTraining: true },
      data: {
        role: "AUDITEE",
        trainingPeriodeId: newPeriode.id,
        unitId: trainingUnit.id,
      },
    });
  }

  // Set default Ketua Auditor & Ketua Auditee kelompok ini
  const groupMembers = await prisma.user.findMany({
    where: { trainingPeriodeId: newPeriode.id, isTraining: true },
    orderBy: { createdAt: "asc" },
  });
  const firstAuditor = groupMembers.find((m) => m.role === "AUDITOR");
  const firstAuditee = groupMembers.find((m) => m.role === "AUDITEE");

  await prisma.periode.update({
    where: { id: newPeriode.id },
    data: {
      ketuaAuditorId: firstAuditor?.id ?? null,
      ketuaAuditorNama: firstAuditor?.nama ?? null,
      ketuaAuditorNip: firstAuditor?.nimNuptk ?? null,
      ketuaAuditeeId: firstAuditee?.id ?? null,
      ketuaAuditeeNama: firstAuditee?.nama ?? null,
      ketuaAuditeeNip: firstAuditee?.nimNuptk ?? null,
    },
  });

  await catat(
    admin.id,
    "SIMPAN_KELOMPOK_TRAINING",
    `${namaLengkapPeriode}: ${groupMembers.filter((m) => m.role === "AUDITOR").length} Auditor, ${groupMembers.filter((m) => m.role === "AUDITEE").length} Auditee`
  );

  revalidatePath("/admin/training");
  revalidatePath("/lpm");
  revalidatePath("/lpm/indikator");
  revalidatePath("/lpm/rekap");

  return {
    ok: true,
    message: `Kelompok "${rawName}" berhasil disimpan (${groupMembers.filter((m) => m.role === "AUDITOR").length} Auditor di Kiri, ${groupMembers.filter((m) => m.role === "AUDITEE").length} Auditee di Kanan, + ${masterIndikator.length} Indikator LPM).`,
  };
}

export async function pindahkanAkunTrainingClient(payload: {
  userId: string;
  targetPeriodeId: string | null;
  targetRole: "AUDITOR" | "AUDITEE";
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  const admin = await requireUser("SUPER_ADMIN", "LPM");
  const { userId, targetPeriodeId, targetRole } = payload;

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser || !targetUser.isTraining) {
    return { ok: false, error: "Akun training tidak ditemukan." };
  }

  if (!targetPeriodeId) {
    await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        trainingPeriodeId: null,
        unitId: null,
      },
    });
    revalidatePath("/admin/training");
    revalidatePath("/lpm");
    return { ok: true, message: `${targetUser.nama} dikeluarkan dari kelompok.` };
  }

  const periode = await prisma.periode.findUnique({ where: { id: targetPeriodeId } });
  if (!periode || !periode.isTraining) {
    return { ok: false, error: "Kelompok tujuan tidak ditemukan." };
  }

  const role = targetRole === "AUDITOR" ? "AUDITOR" : "AUDITEE";

  await prisma.user.update({
    where: { id: targetUser.id },
    data: {
      role,
      trainingPeriodeId: periode.id,
      unitId: periode.unitId,
    },
  });

  if (role === "AUDITOR" && !periode.ketuaAuditorId) {
    await prisma.periode.update({
      where: { id: periode.id },
      data: {
        ketuaAuditorId: targetUser.id,
        ketuaAuditorNama: targetUser.nama,
        ketuaAuditorNip: targetUser.nimNuptk || null,
      },
    });
  } else if (role === "AUDITEE" && !periode.ketuaAuditeeId) {
    await prisma.periode.update({
      where: { id: periode.id },
      data: {
        ketuaAuditeeId: targetUser.id,
        ketuaAuditeeNama: targetUser.nama,
        ketuaAuditeeNip: targetUser.nimNuptk || null,
      },
    });
  }

  await catat(
    admin.id,
    "PINDAH_ANGGOTA_TRAINING",
    `${targetUser.nama} -> ${periode.semester} (${role})`
  );
  revalidatePath("/admin/training");
  revalidatePath("/lpm");
  return {
    ok: true,
    message: `${targetUser.nama} dipindahkan ke ${periode.semester} sebagai ${role === "AUDITOR" ? "🕵️ Auditor (Kiri)" : "📝 Auditee (Kanan)"}.`,
  };
}

export async function masukkanAkunKeKelompokTraining(fd: FormData) {
  const admin = await requireUser("SUPER_ADMIN", "LPM");
  const periodeId = str(fd, "periodeId", 64);
  const userId = str(fd, "userId", 64);
  const role = str(fd, "role", 16) === "AUDITOR" ? "AUDITOR" : "AUDITEE";

  const [periode, targetUser] = await Promise.all([
    prisma.periode.findUnique({ where: { id: periodeId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  if (!periode || !periode.isTraining || !targetUser || !targetUser.isTraining) {
    fail("/admin/training", "Kelompok atau akun training tidak ditemukan.");
  }

  await prisma.user.update({
    where: { id: targetUser.id },
    data: {
      role,
      trainingPeriodeId: periode.id,
      unitId: periode.unitId,
    },
  });

  if (role === "AUDITOR" && !periode.ketuaAuditorId) {
    await prisma.periode.update({
      where: { id: periode.id },
      data: {
        ketuaAuditorId: targetUser.id,
        ketuaAuditorNama: targetUser.nama,
        ketuaAuditorNip: targetUser.nimNuptk || null,
      },
    });
  } else if (role === "AUDITEE" && !periode.ketuaAuditeeId) {
    await prisma.periode.update({
      where: { id: periode.id },
      data: {
        ketuaAuditeeId: targetUser.id,
        ketuaAuditeeNama: targetUser.nama,
        ketuaAuditeeNip: targetUser.nimNuptk || null,
      },
    });
  }

  await catat(admin.id, "ASSIGN_TRAINING_MEMBER", `${targetUser.nama} -> ${periode.nama} (${role})`);
  revalidatePath("/admin/training");
  revalidatePath("/lpm");
  ok("/admin/training", `${targetUser.nama} dimasukkan ke ${periode.semester} sebagai ${role}.`);
}

export async function tambahAkunBaruKeKelompokTraining(fd: FormData) {
  const admin = await requireUser("SUPER_ADMIN", "LPM");
  const periodeId = str(fd, "periodeId", 64);
  const role = str(fd, "role", 16) === "AUDITOR" ? "AUDITOR" : "AUDITEE";
  const nama = str(fd, "nama", 120);
  const rawUname = str(fd, "username", 64).toLowerCase().replace(/[^a-z0-9._-]/g, "");

  if (!periodeId || !nama) {
    fail("/admin/training", "Nama peserta wajib diisi.");
  }

  const periode = await prisma.periode.findUnique({ where: { id: periodeId } });
  if (!periode || !periode.isTraining) {
    fail("/admin/training", "Kelompok training tidak ditemukan.");
  }

  const slug = nama.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
  let uname = rawUname || (slug ? `${slug}_${role.toLowerCase()}` : `peserta_${Date.now().toString().slice(-4)}`);
  const exists = await prisma.user.findUnique({ where: { username: uname } });
  if (exists) {
    uname = `${uname}${Math.floor(10 + Math.random() * 89)}`;
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const passwordEnc = encryptPassword(DEFAULT_PASSWORD);

  const created = await prisma.user.create({
    data: {
      nama,
      nimNuptk: `TRN-${role.slice(0, 3)}-${Date.now().toString().slice(-3)}`,
      username: uname,
      passwordHash,
      passwordEnc,
      role,
      isTraining: true,
      trainingPeriodeId: periode.id,
      unitId: periode.unitId,
      aktif: true,
    },
  });

  if (role === "AUDITOR" && !periode.ketuaAuditorId) {
    await prisma.periode.update({
      where: { id: periode.id },
      data: {
        ketuaAuditorId: created.id,
        ketuaAuditorNama: created.nama,
        ketuaAuditorNip: created.nimNuptk,
      },
    });
  } else if (role === "AUDITEE" && !periode.ketuaAuditeeId) {
    await prisma.periode.update({
      where: { id: periode.id },
      data: {
        ketuaAuditeeId: created.id,
        ketuaAuditeeNama: created.nama,
        ketuaAuditeeNip: created.nimNuptk,
      },
    });
  }

  await catat(admin.id, "TAMBAH_ANGGOTA_TRAINING", `${created.nama} (${created.username}) -> ${periode.nama} (${role})`);
  revalidatePath("/admin/training");
  revalidatePath("/lpm");
  ok("/admin/training", `Akun ${role} "${created.nama}" (${created.username}) berhasil ditambahkan ke ${periode.semester}.`);
}

export async function lepasAkunDariKelompokTraining(fd: FormData) {
  await requireUser("SUPER_ADMIN", "LPM");
  const userId = str(fd, "userId", 64);
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u || !u.isTraining) {
    fail("/admin/training", "Akun training tidak ditemukan.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      trainingPeriodeId: null,
      unitId: null,
    },
  });

  revalidatePath("/admin/training");
  revalidatePath("/lpm");
  ok("/admin/training", `${u.nama} dikeluarkan dari kelompok.`);
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

    if (masterIndikator.length > 0) {
      await prisma.indikator.createMany({
        data: masterIndikator.map((m, idx) => ({
          periodeId: newPeriode.id,
          kode: m.kode,
          standar: m.standar,
          pernyataanStandar: m.pernyataanStandar,
          pernyataan: m.pernyataan,
          buktiDiminta: m.buktiDiminta,
          urutan: idx + 1,
        })),
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

    const toCreate: {
      periodeId: string;
      kode: string;
      standar: string;
      pernyataanStandar: string | null;
      pernyataan: string;
      buktiDiminta: string | null;
      urutan: number;
    }[] = [];

    const updatePromises: Promise<unknown>[] = [];

    for (let idx = 0; idx < masterIndikator.length; idx++) {
      const m = masterIndikator[idx];
      const key = `${m.standar.toUpperCase()}|||${m.kode.toUpperCase()}`;
      const found = existingMap.get(key);
      if (found) {
        updatePromises.push(
          prisma.indikator.update({
            where: { id: found.id },
            data: {
              standar: m.standar,
              pernyataanStandar: m.pernyataanStandar,
              pernyataan: m.pernyataan,
              buktiDiminta: m.buktiDiminta,
              urutan: idx + 1,
            },
          })
        );
      } else {
        toCreate.push({
          periodeId: tp.id,
          kode: m.kode,
          standar: m.standar,
          pernyataanStandar: m.pernyataanStandar,
          pernyataan: m.pernyataan,
          buktiDiminta: m.buktiDiminta,
          urutan: idx + 1,
        });
      }
      synced++;
    }

    if (toCreate.length > 0) {
      await prisma.indikator.createMany({ data: toCreate });
    }
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
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
  const count = Math.max(1, Math.min(150, Number.isFinite(rawCount) ? rawCount : 25));
  const prefix = (str(fd, "prefixUsername", 24) || "peserta")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") || "peserta";

  const [passwordHash, existingUsers] = await Promise.all([
    bcrypt.hash(DEFAULT_PASSWORD, 10),
    prisma.user.findMany({ select: { username: true } }),
  ]);
  const passwordEnc = encryptPassword(DEFAULT_PASSWORD);
  const existingSet = new Set(existingUsers.map((u) => u.username.toLowerCase()));

  const batchToCreate: {
    nama: string;
    nimNuptk: string;
    username: string;
    passwordHash: string;
    passwordEnc: string;
    role: "AUDITEE";
    isTraining: boolean;
    aktif: boolean;
  }[] = [];

  let seq = 1;
  while (batchToCreate.length < count && seq <= 1000) {
    const uname = `${prefix}${seq}`;
    if (!existingSet.has(uname)) {
      existingSet.add(uname);
      batchToCreate.push({
        nama: `Peserta Pelatihan ${seq}`,
        nimNuptk: `TRN-${String(seq).padStart(3, "0")}`,
        username: uname,
        passwordHash,
        passwordEnc,
        role: "AUDITEE",
        isTraining: true,
        aktif: true,
      });
    }
    seq++;
  }

  if (batchToCreate.length > 0) {
    await prisma.user.createMany({
      data: batchToCreate,
      skipDuplicates: true,
    });
  }

  await catat(admin.id, "GENERATE_AKUN_TRAINING", `${batchToCreate.length} akun dummy training dibuat`);
  revalidatePath("/admin/training");
  ok(
    "/admin/training",
    `Berhasil membuat ${batchToCreate.length} akun peserta training (Password default: 123).`
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

  const [passwordHash, existingUsers] = await Promise.all([
    bcrypt.hash(DEFAULT_PASSWORD, 10),
    prisma.user.findMany({ select: { id: true, username: true, isTraining: true } }),
  ]);
  const passwordEnc = encryptPassword(DEFAULT_PASSWORD);
  const existingMap = new Map(existingUsers.map((u) => [u.username.toLowerCase(), u]));

  const toCreate: {
    nama: string;
    nimNuptk: string;
    username: string;
    passwordHash: string;
    passwordEnc: string;
    role: "AUDITEE";
    isTraining: boolean;
    aktif: boolean;
  }[] = [];
  const updatePromises: Promise<unknown>[] = [];

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

    const existing = existingMap.get(baseUname);
    if (existing) {
      if (existing.isTraining) {
        updatePromises.push(
          prisma.user.update({
            where: { id: existing.id },
            data: { nama, nimNuptk, aktif: true },
          })
        );
      } else {
        const altUname = `${baseUname}_trn${i + 1}`;
        if (!existingMap.has(altUname)) {
          existingMap.set(altUname, { id: "", username: altUname, isTraining: true });
          toCreate.push({
            nama,
            nimNuptk,
            username: altUname,
            passwordHash,
            passwordEnc,
            role: "AUDITEE",
            isTraining: true,
            aktif: true,
          });
        }
      }
    } else {
      existingMap.set(baseUname, { id: "", username: baseUname, isTraining: true });
      toCreate.push({
        nama,
        nimNuptk,
        username: baseUname,
        passwordHash,
        passwordEnc,
        role: "AUDITEE",
        isTraining: true,
        aktif: true,
      });
    }
  }

  if (toCreate.length > 0) {
    await prisma.user.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
  }
  if (updatePromises.length > 0) {
    await Promise.all(updatePromises);
  }

  const created = toCreate.length;
  const updated = updatePromises.length;

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
