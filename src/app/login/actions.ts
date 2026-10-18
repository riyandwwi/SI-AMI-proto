"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/session";
import { ROLE_HOME } from "@/lib/roles";
import { catat, str } from "@/lib/actions";

export type LoginState = { error?: string };

export async function login(_: LoginState, fd: FormData): Promise<LoginState> {
  const username = str(fd, "username", 64).toLowerCase();
  const password = str(fd, "password", 200);
  if (!username || !password) return { error: "Username dan password wajib diisi." };

  const user = await prisma.user.findUnique({ where: { username } });
  const valid = user && user.aktif && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !valid) return { error: "Username atau password salah, atau akun nonaktif." };

  const token = await signSession({ uid: user.id, role: user.role });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  await catat(user.id, "LOGIN");
  redirect(ROLE_HOME[user.role]);
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
