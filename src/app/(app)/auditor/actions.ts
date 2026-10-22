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
}

export async function simpanBatchAuditDokumen(
  periodeId: string,
  unitId: string,
  items: Array<{
    indikatorId: string;
    statusDokumen: StatusDokumen;
    catatanDokumen: string;
  }>
): Promise<AuditorActionResult> {
  const user = await requireUser("AUDITOR");
  if (!periodeId || !unitId || !items.length) {
    return { ok: false, error: "Data audit dokumen tidak lengkap." };
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

    await prisma.isian.upsert({
      where: { indikatorId_unitId: { indikatorId: ind.id, unitId } },
      create: {
        indikatorId: ind.id,
        unitId,
        statusDokumen,
        catatanDokumen,
      },
      update: {
        statusDokumen,
        catatanDokumen,
      },
    });

    savedIds.push(ind.id);
    savedCodes.push(ind.kode);
  }

  await catat(user.id, "AUDIT_DOKUMEN", `Simpan Desk Audit: ${savedCodes.join(", ")}`);
  revalidatePath(`/auditor/${periodeId}`);
  revalidatePath("/auditee");
  revalidatePath("/lpm");

  return {
    ok: true,
    savedIds,
    message:
      savedCodes.length === 1
        ? `Hasil Audit Dokumen "${savedCodes[0]}" disimpan & disinkronkan ke Audit Lapangan.`
        : `${savedCodes.length} catatan Audit Dokumen (${savedCodes.join(", ")}) berhasil disimpan sekaligus.`,
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
  }>
): Promise<AuditorActionResult> {
  const user = await requireUser("AUDITOR");
  if (!periodeId || !unitId || !items.length) {
    return { ok: false, error: "Data audit lapangan tidak lengkap." };
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
      },
      update: {
        klasifikasi,
        catatanLapangan,
        rekomendasi,
      },
    });

    savedIds.push(ind.id);
    savedCodes.push(ind.kode);
  }

  await catat(user.id, "AUDIT_LAPANGAN", `Simpan Audit Lapangan: ${savedCodes.join(", ")}`);
  revalidatePath(`/auditor/${periodeId}`);
  revalidatePath("/auditee");
  revalidatePath("/lpm");

  return {
    ok: true,
    savedIds,
    message:
      savedCodes.length === 1
        ? `Klasifikasi temuan "${savedCodes[0]}" berhasil disimpan.`
        : `${savedCodes.length} temuan Audit Lapangan (${savedCodes.join(", ")}) berhasil disimpan sekaligus.`,
  };
}

export async function simpanBatchVerifikasiRtl(
  periodeId: string,
  items: Array<{
    indikatorId: string;
    isianId: string;
    rtlStatus: StatusRtl;
    rtlCatatanAuditor: string;
  }>
): Promise<AuditorActionResult> {
  const user = await requireUser("AUDITOR");
  if (!periodeId || !items.length) {
    return { ok: false, error: "Data verifikasi RTL tidak lengkap." };
  }

  const savedIds: string[] = [];
  const savedCodes: string[] = [];

  for (const item of items) {
    const isian = await prisma.isian.findUnique({
      where: { id: item.isianId },
      include: { indikator: { include: { periode: true } } },
    });
    if (!isian) continue;
    if (!isian.indikator.periode.aktif) {
      return { ok: false, error: "Sesi AMI sedang dikunci oleh LPM." };
    }

    const rtlStatus = VALID_RTL.includes(item.rtlStatus) ? item.rtlStatus : "PROSES";
    const rtlCatatanAuditor = item.rtlCatatanAuditor.trim().slice(0, 4000) || null;

    await prisma.isian.update({
      where: { id: isian.id },
      data: { rtlStatus, rtlCatatanAuditor },
    });

    savedIds.push(item.indikatorId);
    savedCodes.push(isian.indikator.kode);
  }

  await catat(user.id, "VERIFIKASI_RTL", `Verifikasi RTL: ${savedCodes.join(", ")}`);
  revalidatePath(`/auditor/${periodeId}`);
  revalidatePath("/auditee");
  revalidatePath("/lpm");

  return {
    ok: true,
    savedIds,
    message:
      savedCodes.length === 1
        ? `Verifikasi RTL "${savedCodes[0]}" berhasil disimpan.`
        : `${savedCodes.length} verifikasi RTL (${savedCodes.join(", ")}) berhasil disimpan sekaligus.`,
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
  const isianId = str(fd, "isianId", 64);
  const rtlStatus = str(fd, "rtlStatus", 32) as StatusRtl;
  const rtlCatatanAuditor = str(fd, "rtlCatatanAuditor", 4000);
  const path = `/auditor/${periodeId}?mode=rtl`;

  const res = await simpanBatchVerifikasiRtl(periodeId, [
    { indikatorId: "", isianId, rtlStatus, rtlCatatanAuditor },
  ]);
  if (!res.ok) fail(path, res.error ?? "Gagal menyimpan.");
  ok(path, res.message ?? "Berhasil disimpan.");
}
