import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";

/** Kembali ke halaman dengan pesan sukses / gagal (dibaca komponen <Flash>). */
export function ok(path: string, msg: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}ok=${encodeURIComponent(msg)}`);
}
export function fail(path: string, msg: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}err=${encodeURIComponent(msg)}`);
}

/** Jejak audit (prinsip ketertelusuran). */
export async function catat(userId: string | null, aksi: string, detail?: string) {
  await prisma.auditLog.create({ data: { userId, aksi, detail } });
}

export function str(fd: FormData, name: string, max = 2000) {
  const v = fd.get(name);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function isGoogleDriveLink(v: string) {
  try {
    const u = new URL(v);
    return u.protocol === "https:" && (u.hostname === "drive.google.com" || u.hostname === "docs.google.com");
  } catch {
    return false;
  }
}
