"use server";

import { revalidatePath } from "next/cache";
import type { Klasifikasi, StatusDokumen, StatusRtl } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { catat, fail, ok, str } from "@/lib/actions";

const VALID_DOK: StatusDokumen[] = ["BELUM_DICEK", "LENGKAP", "PERLU_KLARIFIKASI"];
const VALID_KLAS: Klasifikasi[] = ["MELAMPAUI", "MENCAPAI", "OBSERVASI", "KTS_MINOR", "KTS_MAYOR"];
const VALID_RTL: StatusRtl[] = ["PROSES", "TERVERIFIKASI"];

export interface AuditorActionResult {
  ok: boolean;
  message?: string;
  error?: string;
  savedIds?: string[];
  diperiksaOleh?: string;
}

export async function simpanBatchAuditDokumen(
  periodeId: string,
  unitId: string,
  items: Array<{
    indikatorId: string;
    statusDokumen: StatusDokumen;
    catatanDokumen: string;
    buktiDiminta?: string;
  }>,
  lockDokumen?: boolean
): Promise<AuditorActionResult> {
  const user = await requireUser("AUDITOR");
  if (!periodeId || !unitId || !items.length) {
    return { ok: false, error: "Data tidak lengkap." };
  }

  const indikatorList = await prisma.indikator.findMany({
    where: { id: { in: items.map((i) => i.indikatorId) } },
    include: { periode: true },
  });
  if (indikatorList.length === 0) {
    return { ok: false, error: "Indikator tidak ditemukan." };
  }
  if (indikatorList.some((ind) => !ind.periode.aktif)) {
    return { ok: false, error: "Sesi AMI sedang dikunci oleh LPM." };
  }

  const indMap = new Map(indikatorList.map((ind) => [ind.id, ind]));
  const savedIds: string[] = [];
  const savedCodes: string[] = [];

  for (const item of items) {
    const ind = indMap.get(item.indikatorId);
    if (!ind) continue;
    const statusDokumen = VALID_DOK.includes(item.statusDokumen) ? item.statusDokumen : "BELUM_DICEK";
    const catatanDokumen = item.catatanDokumen.trim().slice(0, 4000) || null;

    if (item.buktiDiminta !== undefined) {
      const buktiDiminta = item.buktiDiminta.trim().slice(0, 500) || null;
      await prisma.indikator.update({
        where: { id: ind.id },
        data: { buktiDiminta },
      });
    }

    await prisma.isian.upsert({
      where: { indikatorId_unitId: { indikatorId: ind.id, unitId } },
      create: {
        indikatorId: ind.id,
        unitId,
        statusDokumen,
        catatanDokumen,
        diperiksaOleh: user.nama,
        ...(lockDokumen !== undefined ? { terverifikasiAuditor: lockDokumen } : {}),
      },
      update: {
        statusDokumen,
        catatanDokumen,
        diperiksaOleh: user.nama,
        ...(lockDokumen !== undefined ? { terverifikasiAuditor: lockDokumen } : {}),
      },
    });

    savedIds.push(ind.id);
    savedCodes.push(ind.kode);
  }

  await catat(
    user.id,
    lockDokumen ? "AUDIT_DOKUMEN_KUNCI" : "AUDIT_DOKUMEN",
    `${user.nama}: ${savedCodes.join(", ")}`
  );

  return {
    ok: true,
    savedIds,
    diperiksaOleh: user.nama,
    message: lockDokumen
      ? `Audit Dokumen disimpan & Upload Dosen dikunci (${savedCodes.join(", ")}) oleh ${user.nama}.`
      : `Audit Dokumen disimpan (${savedCodes.join(", ")}) oleh ${user.nama}.`,
  };
}

export async function simpanBatchAuditLapangan(
  periodeId: string,
  unitId: string,
  items: Array<{
    indikatorId: string;
    klasifikasi: Klasifikasi;
    catatanLapangan: string;
    rekomendasi: string;
  }>,
  lockLapangan?: boolean
): Promise<AuditorActionResult> {
  const user = await requireUser("AUDITOR");
  if (!periodeId || !unitId || !items.length) {
    return { ok: false, error: "Data tidak lengkap." };
  }

  const indikatorList = await prisma.indikator.findMany({
    where: { id: { in: items.map((i) => i.indikatorId) } },
    include: { periode: true },
  });
  if (indikatorList.length === 0) {
    return { ok: false, error: "Indikator tidak ditemukan." };
  }
  if (indikatorList.some((ind) => !ind.periode.aktif)) {
    return { ok: false, error: "Sesi AMI sedang dikunci oleh LPM." };
  }

  const indMap = new Map(indikatorList.map((ind) => [ind.id, ind]));
  const savedIds: string[] = [];
  const savedCodes: string[] = [];

  for (const item of items) {
    const ind = indMap.get(item.indikatorId);
    if (!ind) continue;
    const klasifikasi = VALID_KLAS.includes(item.klasifikasi) ? item.klasifikasi : "MENCAPAI";
    const catatanLapangan = item.catatanLapangan.trim().slice(0, 4000) || null;
    const rekomendasi = item.rekomendasi.trim().slice(0, 4000) || null;

    await prisma.isian.upsert({
      where: { indikatorId_unitId: { indikatorId: ind.id, unitId } },
      create: {
        indikatorId: ind.id,
        unitId,
        klasifikasi,
        catatanLapangan,
        rekomendasi,
        diperiksaOleh: user.nama,
        ...(lockLapangan !== undefined
          ? { terverifikasiLapangan: lockLapangan, ...(lockLapangan ? { terverifikasiAuditor: true } : {}) }
          : {}),
      },
      update: {
        klasifikasi,
        catatanLapangan,
        rekomendasi,
        diperiksaOleh: user.nama,
        ...(lockLapangan !== undefined
          ? { terverifikasiLapangan: lockLapangan, ...(lockLapangan ? { terverifikasiAuditor: true } : {}) }
          : {}),
      },
    });

    savedIds.push(ind.id);
    savedCodes.push(ind.kode);
  }

  await catat(
    user.id,
    lockLapangan ? "AUDIT_LAPANGAN_KUNCI" : "AUDIT_LAPANGAN",
    `${user.nama}: ${savedCodes.join(", ")}`
  );

  return {
    ok: true,
    savedIds,
    diperiksaOleh: user.nama,
    message: lockLapangan
      ? `Temuan Lapangan disimpan & dikunci (${savedCodes.join(", ")}) oleh ${user.nama}.`
      : `Temuan Lapangan disimpan (${savedCodes.join(", ")}) oleh ${user.nama}.`,
  };
}

export async function simpanBatchVerifikasiRtl(
  periodeId: string,
  unitId: string,
  items: Array<{
    indikatorId: string;
    isianId?: string;
    rtlStatus: StatusRtl;
    rtlCatatanAuditor: string;
  }>
): Promise<AuditorActionResult> {
  const user = await requireUser("AUDITOR");
  if (!periodeId || !unitId || !items.length) {
    return { ok: false, error: "Data tidak lengkap." };
  }

  const indikatorList = await prisma.indikator.findMany({
    where: { id: { in: items.map((i) => i.indikatorId) } },
    include: { periode: true },
  });
  if (indikatorList.length === 0) {
    return { ok: false, error: "Indikator tidak ditemukan." };
  }
  if (indikatorList.some((ind) => !ind.periode.aktif)) {
    return { ok: false, error: "Sesi AMI sedang dikunci oleh LPM." };
  }
  const indMap = new Map(indikatorList.map((ind) => [ind.id, ind]));

  const savedIds: string[] = [];
  const savedCodes: string[] = [];

  for (const item of items) {
    const ind = indMap.get(item.indikatorId);
    if (!ind) continue;

    const rtlStatus = VALID_RTL.includes(item.rtlStatus) ? item.rtlStatus : "PROSES";
    const rtlCatatanAuditor = item.rtlCatatanAuditor.trim().slice(0, 4000) || null;

    await prisma.isian.upsert({
      where: { indikatorId_unitId: { indikatorId: ind.id, unitId } },
      create: {
        indikatorId: ind.id,
        unitId,
        rtlStatus,
        rtlCatatanAuditor,
        diperiksaOleh: user.nama,
      },
      update: {
        rtlStatus,
        rtlCatatanAuditor,
        diperiksaOleh: user.nama,
      },
    });

    savedIds.push(ind.id);
    savedCodes.push(ind.kode);
  }

  await catat(user.id, "VERIFIKASI_RTL", `${user.nama}: ${savedCodes.join(", ")}`);

  return {
    ok: true,
    savedIds,
    diperiksaOleh: user.nama,
    message: `RTL diverifikasi (${savedCodes.join(", ")}) oleh ${user.nama}.`,
  };
}

/**
 * Verifikasi & Kunci Isian Auditee oleh Auditor (agar Auditee tidak bisa mengubah isian lagi)
 */
export async function toggleVerifikasiAuditor(
  periodeId: string,
  unitId: string,
  indikatorIds: string[],
  lock: boolean
): Promise<AuditorActionResult> {
  const user = await requireUser("AUDITOR");
  if (!periodeId || !unitId || !indikatorIds.length) {
    return { ok: false, error: "Pilih indikator terlebih dahulu." };
  }

  const indikatorList = await prisma.indikator.findMany({
    where: { id: { in: indikatorIds } },
    include: { periode: true },
  });
  if (indikatorList.length === 0) {
    return { ok: false, error: "Indikator tidak ditemukan." };
  }

  const savedIds: string[] = [];
  const savedCodes: string[] = [];

  for (const ind of indikatorList) {
    await prisma.isian.upsert({
      where: { indikatorId_unitId: { indikatorId: ind.id, unitId } },
      create: {
        indikatorId: ind.id,
        unitId,
        terverifikasiAuditor: lock,
        diperiksaOleh: user.nama,
      },
      update: {
        terverifikasiAuditor: lock,
        diperiksaOleh: user.nama,
      },
    });
    savedIds.push(ind.id);
    savedCodes.push(ind.kode);
  }

  await catat(
    user.id,
    lock ? "VERIFIKASI_KUNCI_AUDITOR" : "BUKA_KUNCI_AUDITOR",
    `${user.nama}: ${savedCodes.join(", ")}`
  );
  revalidatePath(`/auditor/${periodeId}`);
  revalidatePath("/auditee");
  revalidatePath("/lpm");

  return {
    ok: true,
    savedIds,
    diperiksaOleh: user.nama,
    message: lock
      ? `Dokumen Dosen pada (${savedCodes.join(", ")}) dikunci oleh ${user.nama} (Dosen tidak bisa upload lagi).`
      : `Kunci Dokumen Dosen pada (${savedCodes.join(", ")}) dibuka oleh ${user.nama}.`,
  };
}

/**
 * Verifikasi & Kunci Audit Lapangan oleh Auditor per bagian
 */
export async function toggleVerifikasiLapangan(
  periodeId: string,
  unitId: string,
  indikatorIds: string[],
  lock: boolean
): Promise<AuditorActionResult> {
  const user = await requireUser("AUDITOR");
  if (!periodeId || !unitId || !indikatorIds.length) {
    return { ok: false, error: "Pilih indikator terlebih dahulu." };
  }

  const indikatorList = await prisma.indikator.findMany({
    where: { id: { in: indikatorIds } },
    include: { periode: true },
  });
  if (indikatorList.length === 0) {
    return { ok: false, error: "Indikator tidak ditemukan." };
  }

  const savedIds: string[] = [];
  const savedCodes: string[] = [];

  for (const ind of indikatorList) {
    await prisma.isian.upsert({
      where: { indikatorId_unitId: { indikatorId: ind.id, unitId } },
      create: {
        indikatorId: ind.id,
        unitId,
        terverifikasiLapangan: lock,
        ...(lock ? { terverifikasiAuditor: true } : {}),
        diperiksaOleh: user.nama,
      },
      update: {
        terverifikasiLapangan: lock,
        ...(lock ? { terverifikasiAuditor: true } : {}),
        diperiksaOleh: user.nama,
      },
    });
    savedIds.push(ind.id);
    savedCodes.push(ind.kode);
  }

  await catat(
    user.id,
    lock ? "VERIFIKASI_KUNCI_LAPANGAN" : "BUKA_KUNCI_LAPANGAN",
    `${user.nama}: ${savedCodes.join(", ")}`
  );
  revalidatePath(`/auditor/${periodeId}`);
  revalidatePath("/auditee");
  revalidatePath("/lpm");

  return {
    ok: true,
    savedIds,
    diperiksaOleh: user.nama,
    message: lock
      ? `Audit Lapangan (${savedCodes.join(", ")}) telah diverifikasi & dikunci oleh ${user.nama}.`
      : `Kunci Audit Lapangan (${savedCodes.join(", ")}) dibuka oleh ${user.nama}.`,
  };
}

/**
 * Verifikasi & Kunci RTL oleh Auditor per bagian
 */
export async function toggleVerifikasiRtl(
  periodeId: string,
  unitId: string,
  indikatorIds: string[],
  lock: boolean
): Promise<AuditorActionResult> {
  const user = await requireUser("AUDITOR");
  if (!periodeId || !unitId || !indikatorIds.length) {
    return { ok: false, error: "Pilih indikator terlebih dahulu." };
  }

  const indikatorList = await prisma.indikator.findMany({
    where: { id: { in: indikatorIds } },
    include: { periode: true },
  });
  if (indikatorList.length === 0) {
    return { ok: false, error: "Indikator tidak ditemukan." };
  }

  const savedIds: string[] = [];
  const savedCodes: string[] = [];
  const nextStatus: StatusRtl = lock ? "TERVERIFIKASI" : "PROSES";

  for (const ind of indikatorList) {
    await prisma.isian.upsert({
      where: { indikatorId_unitId: { indikatorId: ind.id, unitId } },
      create: {
        indikatorId: ind.id,
        unitId,
        rtlStatus: nextStatus,
        diperiksaOleh: user.nama,
      },
      update: {
        rtlStatus: nextStatus,
        diperiksaOleh: user.nama,
      },
    });
    savedIds.push(ind.id);
    savedCodes.push(ind.kode);
  }

  await catat(
    user.id,
    lock ? "VERIFIKASI_KUNCI_RTL" : "BUKA_KUNCI_RTL",
    `${user.nama}: ${savedCodes.join(", ")}`
  );
  revalidatePath(`/auditor/${periodeId}`);
  revalidatePath("/auditee");
  revalidatePath("/lpm");

  return {
    ok: true,
    savedIds,
    diperiksaOleh: user.nama,
    message: lock
      ? `RTL (${savedCodes.join(", ")}) telah diverifikasi & dikunci oleh ${user.nama}.`
      : `Kunci RTL (${savedCodes.join(", ")}) dibuka oleh ${user.nama}.`,
  };
}

// Fallback form actions
export async function simpanAuditDokumen(fd: FormData) {
  const periodeId = str(fd, "periodeId", 64);
  const unitId = str(fd, "unitId", 64);
  const indikatorId = str(fd, "indikatorId", 64);
  const statusDokumen = str(fd, "statusDokumen", 32) as StatusDokumen;
  const catatanDokumen = str(fd, "catatanDokumen", 4000);
  const path = `/auditor/${periodeId}?mode=dokumen`;

  const res = await simpanBatchAuditDokumen(periodeId, unitId, [
    { indikatorId, statusDokumen, catatanDokumen },
  ]);
  if (!res.ok) fail(path, res.error ?? "Gagal menyimpan.");
  ok(path, res.message ?? "Berhasil disimpan.");
}

export async function simpanAuditLapangan(fd: FormData) {
  const periodeId = str(fd, "periodeId", 64);
  const unitId = str(fd, "unitId", 64);
  const indikatorId = str(fd, "indikatorId", 64);
  const klasifikasi = str(fd, "klasifikasi", 32) as Klasifikasi;
  const catatanLapangan = str(fd, "catatanLapangan", 4000);
  const rekomendasi = str(fd, "rekomendasi", 4000);
  const path = `/auditor/${periodeId}?mode=lapangan`;

  const res = await simpanBatchAuditLapangan(periodeId, unitId, [
    { indikatorId, klasifikasi, catatanLapangan, rekomendasi },
  ]);
  if (!res.ok) fail(path, res.error ?? "Gagal menyimpan.");
  ok(path, res.message ?? "Berhasil disimpan.");
}

export async function verifikasiRtlAuditor(fd: FormData) {
  const periodeId = str(fd, "periodeId", 64);
  const unitId = str(fd, "unitId", 64);
  const indikatorId = str(fd, "indikatorId", 64);
  const isianId = str(fd, "isianId", 64);
  const rtlStatus = str(fd, "rtlStatus", 32) as StatusRtl;
  const rtlCatatanAuditor = str(fd, "rtlCatatanAuditor", 4000);
  const path = `/auditor/${unitId}?periodeId=${periodeId}&mode=rtl`;

  const res = await simpanBatchVerifikasiRtl(periodeId, unitId, [
    { indikatorId, isianId, rtlStatus, rtlCatatanAuditor },
  ]);
  if (!res.ok) fail(path, res.error ?? "Gagal menyimpan.");
  ok(path, res.message ?? "Berhasil disimpan.");
}
