import { prisma } from "./prisma";

/** Batas waktu simpan tanda tangan (TTD) = 3 menit (180.000 ms) agar hemat server Vercel & database */
export const TTD_MAX_AGE_MS = 3 * 60 * 1000;

let lastCleanupAt = 0;

/**
 * Tanda tangan digital kini disimpan permanen sampai dihapus manual oleh pengguna
 * agar tanda tangan pihak pertama tidak hilang saat menunggu pihak lain menandatangani.
 */
export async function cleanupExpiredSignatures(): Promise<void> {
  return;
}
