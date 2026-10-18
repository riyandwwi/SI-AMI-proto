"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { encryptPassword } from "@/lib/crypto";
import { catat, fail, ok, str } from "@/lib/actions";

export async function gantiPasswordSendiri(fd: FormData) {
  const user = await requireUser();
  const lama = str(fd, "lama", 200);
  const baru = str(fd, "baru", 200);
  const ulang = str(fd, "ulang", 200);

  if (!(await bcrypt.compare(lama, user.passwordHash))) fail("/akun", "Password lama salah.");
  if (baru.length < 6) fail("/akun", "Password baru minimal 6 karakter.");
  if (baru !== ulang) fail("/akun", "Konfirmasi password tidak sama.");

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(baru, 10), passwordEnc: encryptPassword(baru) },
  });
  await catat(user.id, "GANTI_PASSWORD_SENDIRI");
  ok("/akun", "Password berhasil diganti.");
}
