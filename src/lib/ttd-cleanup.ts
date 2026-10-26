import { prisma } from "./prisma";

/** Batas waktu simpan tanda tangan (TTD) = 3 menit (180.000 ms) agar hemat server Vercel & database */
export const TTD_MAX_AGE_MS = 3 * 60 * 1000;

let lastCleanupAt = 0;

/**
 * Menghapus otomatis gambar tanda tangan (ttdAuditee, ttdAuditor, ttdLpm) yang sudah lewat dari 3 menit.
 * Diberi throttle 15 detik agar tetap sangat ringan saat diakses 50+ peserta bersamaan.
 */
export async function cleanupExpiredSignatures(): Promise<void> {
  const nowMs = Date.now();
  if (nowMs - lastCleanupAt < 15_000) return;
  lastCleanupAt = nowMs;

  try {
    const cutoff = new Date(nowMs - TTD_MAX_AGE_MS);

    await Promise.all([
      prisma.periode.updateMany({
        where: {
          ttdAuditee: { not: null },
          OR: [{ ttdAuditeeAt: { lt: cutoff } }, { ttdAuditeeAt: null }],
        },
        data: {
          ttdAuditee: null,
          ttdAuditeeAt: null,
        },
      }),
      prisma.periode.updateMany({
        where: {
          ttdAuditor: { not: null },
          OR: [{ ttdAuditorAt: { lt: cutoff } }, { ttdAuditorAt: null }],
        },
        data: {
          ttdAuditor: null,
          ttdAuditorAt: null,
        },
      }),
      prisma.periode.updateMany({
        where: {
          ttdLpm: { not: null },
          OR: [{ ttdLpmAt: { lt: cutoff } }, { ttdLpmAt: null }],
        },
        data: {
          ttdLpm: null,
          ttdLpmAt: null,
        },
      }),
    ]);
  } catch {
    // Abaikan jika gagal cleanup non-kritis
  }
}
