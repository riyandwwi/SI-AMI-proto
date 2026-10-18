"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { encryptPassword } from "@/lib/crypto";
import { isRole } from "@/lib/roles";
import { catat, fail, ok, str } from "@/lib/actions";

export async function tambahUser(fd: FormData) {
  const admin = await requireUser("SUPER_ADMIN");
  const nama = str(fd, "nama", 120);
  const username = str(fd, "username", 64).toLowerCase().replace(/\s+/g, "");
  const password = str(fd, "password", 200);
  const roleRaw = str(fd, "role", 32);
  const unitId = str(fd, "unitId", 64) || null;

  if (!nama || !username || !password) fail("/admin", "Nama, username, dan password wajib diisi.");
  if (password.length < 6) fail("/admin", "Password minimal 6 karakter.");
  if (!isRole(roleRaw)) fail("/admin", "Role tidak valid.");
  if ((roleRaw === "AUDITEE" || roleRaw === "AUDITOR") && !unitId) {
    fail("/admin", "Role Auditor dan Auditee wajib memilih Unit / Homebase ITBMP.");
  }

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) fail("/admin", `Username "${username}" sudah digunakan.`);

  await prisma.user.create({
    data: {
      nama,
      username,
      passwordHash: await bcrypt.hash(password, 10),
      passwordEnc: encryptPassword(password),
      role: roleRaw,
      unitId,
      aktif: true,
    },
  });

  await catat(admin.id, "TAMBAH_USER", `Tambah akun ${username} (${roleRaw})`);
  revalidatePath("/admin");
  ok("/admin", `Akun "${username}" berhasil ditambahkan dan langsung aktif.`);
}

export async function gantiPasswordUser(fd: FormData) {
  const admin = await requireUser("SUPER_ADMIN");
  const userId = str(fd, "userId", 64);
  const passwordBaru = str(fd, "passwordBaru", 200);

  if (!userId || passwordBaru.length < 6) {
    fail("/admin", "Password baru minimal 6 karakter.");
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
  ok("/admin", `Password untuk "${target.username}" berhasil diperbarui.`);
}

export async function toggleAktifUser(fd: FormData) {
  const admin = await requireUser("SUPER_ADMIN");
  const userId = str(fd, "userId", 64);
  if (userId === admin.id) fail("/admin", "Tidak dapat menonaktifkan akun Super Admin sendiri.");

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) fail("/admin", "Pengguna tidak ditemukan.");

  const nextStatus = !target.aktif;
  await prisma.user.update({
    where: { id: userId },
    data: { aktif: nextStatus },
  });

  await catat(admin.id, "UBAH_STATUS_USER", `${target.username} -> ${nextStatus ? "AKTIF" : "NONAKTIF"}`);
  revalidatePath("/admin");
  ok("/admin", `Status akun "${target.username}" diubah menjadi ${nextStatus ? "Aktif" : "Nonaktif"}.`);
}
