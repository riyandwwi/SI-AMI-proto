"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { encryptPassword } from "@/lib/crypto";
import { isCreatableRole, HOMEBASE_LIST } from "@/lib/roles";
import { catat, fail, ok, str } from "@/lib/actions";

const DEFAULT_PASSWORD = "123";

export async function tambahUser(fd: FormData) {
  const admin = await requireUser("SUPER_ADMIN");
  const nama = str(fd, "nama", 120);
  const nimNuptk = str(fd, "nimNuptk", 64);
  const prodiKode = str(fd, "prodiKode", 32);
  const roleRaw = str(fd, "role", 32);
  const username = str(fd, "username", 64).toLowerCase().replace(/\s+/g, "");

  if (!nama || !nimNuptk || !prodiKode || !roleRaw || !username) {
    fail("/admin", "Nama, NIDN/NUPTK, Homebase/Prodi, Role, dan Username wajib diisi.");
  }

  // Super Admin tidak boleh membuat akun dengan role Super Admin
  if (!isCreatableRole(roleRaw)) {
    fail("/admin", "Super Admin hanya dapat membuat akun dengan role LPM, Auditor, atau Auditee.");
  }

  const homebaseDef = HOMEBASE_LIST.find((p) => p.kode === prodiKode);
  if (!homebaseDef) {
    fail("/admin", "Homebase / Program Studi tidak valid.");
  }

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) fail("/admin", `Username "${username}" sudah digunakan.`);

  // Pastikan unit Homebase/Prodi terdaftar di tabel Unit
  const unit = await prisma.unit.upsert({
    where: { kode: homebaseDef.kode },
    update: { nama: homebaseDef.nama },
    create: {
      kode: homebaseDef.kode,
      nama: homebaseDef.nama,
      jenis: homebaseDef.jenis,
      diaudit: homebaseDef.jenis === "PRODI",
    },
  });

  await prisma.user.create({
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

  await catat(admin.id, "TAMBAH_USER", `Tambah akun ${username} (${roleRaw} - ${homebaseDef.nama}, NIM/NUPTK: ${nimNuptk})`);
  revalidatePath("/admin");
  revalidatePath("/lpm");
  ok("/admin", `Akun "${username}" berhasil dibuat dengan password default "${DEFAULT_PASSWORD}".`);
}

export async function ubahHomebaseUser(fd: FormData) {
  const admin = await requireUser("SUPER_ADMIN");
  const userId = str(fd, "userId", 64);
  const prodiKode = str(fd, "prodiKode", 32);

  if (!userId || !prodiKode) {
    fail("/admin", "Pilih pengguna dan Homebase terlebih dahulu.");
  }

  const homebaseDef = HOMEBASE_LIST.find((p) => p.kode === prodiKode);
  if (!homebaseDef) {
    fail("/admin", "Homebase / Program Studi tidak valid.");
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) fail("/admin", "Pengguna tidak ditemukan.");

  const unit = await prisma.unit.upsert({
    where: { kode: homebaseDef.kode },
    update: { nama: homebaseDef.nama },
    create: {
      kode: homebaseDef.kode,
      nama: homebaseDef.nama,
      jenis: homebaseDef.jenis,
      diaudit: homebaseDef.jenis === "PRODI",
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { unitId: unit.id },
  });

  await catat(admin.id, "UBAH_HOMEBASE_USER", `Ubah homebase ${target.username} -> ${homebaseDef.nama}`);
  revalidatePath("/admin");
  revalidatePath("/lpm");
  revalidatePath("/auditor");
  revalidatePath("/auditee");
  ok("/admin", `Homebase untuk "${target.nama}" berhasil diubah ke "${homebaseDef.nama}".`);
}

export async function gantiPasswordUser(fd: FormData) {
  const admin = await requireUser("SUPER_ADMIN");
  const userId = str(fd, "userId", 64);
  const passwordBaru = str(fd, "passwordBaru", 200);

  if (!userId || passwordBaru.length < 3) {
    fail("/admin", "Password baru minimal 3 karakter.");
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) fail("/admin", "Pengguna tidak ditemukan.");

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await bcrypt.hash(passwordBaru, 10),
      passwordEnc: encryptPassword(passwordBaru),
    },
  });

  await catat(admin.id, "RESET_PASSWORD_USER", `Ubah password akun ${target.username}`);
  revalidatePath("/admin");
  ok("/admin", `Password untuk "${target.username}" berhasil diubah menjadi "${passwordBaru}".`);
}

export async function hapusUser(fd: FormData) {
  const admin = await requireUser("SUPER_ADMIN");
  const userId = str(fd, "userId", 64);
  if (!userId) fail("/admin", "ID akun tidak valid.");
  if (userId === admin.id) fail("/admin", "Tidak dapat menghapus akun Super Admin Anda sendiri.");

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) fail("/admin", "Pengguna tidak ditemukan.");
  if (target.role === "SUPER_ADMIN") {
    fail("/admin", "Akun dengan role Super Admin tidak dapat dihapus.");
  }

  await prisma.user.delete({ where: { id: userId } });
  await catat(admin.id, "HAPUS_USER", `Hapus akun ${target.username} (${target.nama})`);
  revalidatePath("/admin");
  ok("/admin", `Akun "${target.username}" (${target.nama}) berhasil dihapus.`);
}
