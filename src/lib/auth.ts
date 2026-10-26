import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { SESSION_COOKIE, verifySession } from "./session";
import type { RoleName } from "./roles";

export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySession(token) : null;
}

/** Ambil user login dari DB (bukan hanya dari token) agar akun nonaktif langsung tertolak. */
export async function requireUser(...roles: RoleName[]) {
  const s = await getSession();
  if (!s) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: s.uid }, include: { unit: true } });
  if (!user || !user.aktif) redirect("/login?err=" + encodeURIComponent("Sesi tidak valid, silakan login ulang"));
  // Akun Sesi Training boleh mengakses fitur AUDITEE sekaligus AUDITOR di dalam Kelompok Trainingnya
  if (user.isTraining && (roles.includes("AUDITEE") || roles.includes("AUDITOR"))) {
    return user;
  }
  if (roles.length && !roles.includes(user.role)) redirect("/");
  return user;
}

export type CurrentUser = Awaited<ReturnType<typeof requireUser>>;
