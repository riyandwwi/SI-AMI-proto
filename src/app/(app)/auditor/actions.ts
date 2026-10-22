"use server";

import { revalidatePath } from "next/cache";
import type { Klasifikasi, StatusDokumen, StatusRtl } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { catat, fail, ok, str } from "@/lib/actions";

const VALID_DOK: StatusDokumen[] = ["BELUM_DICEK", "LENGKAP", "PERLU_KLARIFIKASI"];
const VALID_KLAS: Klasifikasi[] = ["MELAMPAUI", "MENCAPAI", "OBSERVASI", "KTS_MINOR", "KTS_MAYOR"];
const VALID_RTL: StatusRtl[] = ["PROSES", "TERVERIFIKASI"];

export async function simpanAuditDokumen(fd: FormData) {
  const user = await requireUser("AUDITOR");
  const periodeId = str(fd, "periodeId", 64);
  const unitId = str(fd, "unitId", 64);
  const indikatorId = str(fd, "indikatorId", 64);
  const statusDokumen = str(fd, "statusDokumen", 32) as StatusDokumen;
  const catatanDokumen = str(fd, "catatanDokumen", 2000) || null;
  const path = `/auditor/${periodeId}?mode=dokumen`;

  if (!VALID_DOK.includes(statusDokumen)) fail(path, "Status dokumen tidak valid.");

  const ind = await prisma.indikator.findUnique({
    where: { id: indikatorId },
    include: { periode: true },
  });
  if (!ind) fail(path, "Indikator tidak ditemukan.");
  if (!ind.periode.aktif) fail(path, "Sesi AMI sedang dikunci oleh LPM.");

  await prisma.isian.upsert({
    where: { indikatorId_unitId: { indikatorId, unitId } },
    create: {
      indikatorId,
      unitId,
      statusDokumen,
      catatanDokumen,
    },
    update: {
      statusDokumen,
      catatanDokumen,
    },
  });

  await catat(user.id, "AUDIT_DOKUMEN", `${ind.kode} -> ${statusDokumen}`);
  revalidatePath(`/auditor/${periodeId}`);
  revalidatePath("/lpm");
  ok(path, `Hasil Audit Dokumen "${ind.kode}" disimpan & disinkronkan ke Audit Lapangan.`);
}

export async function simpanAuditLapangan(fd: FormData) {
  const user = await requireUser("AUDITOR");
  const periodeId = str(fd, "periodeId", 64);
  const unitId = str(fd, "unitId", 64);
  const indikatorId = str(fd, "indikatorId", 64);
  const klasifikasi = str(fd, "klasifikasi", 32) as Klasifikasi;
  const catatanLapangan = str(fd, "catatanLapangan", 2000) || null;
  const rekomendasi = str(fd, "rekomendasi", 2000) || null;
  const path = `/auditor/${periodeId}?mode=lapangan`;

  if (!VALID_KLAS.includes(klasifikasi)) fail(path, "Klasifikasi temuan tidak valid.");

  const ind = await prisma.indikator.findUnique({
    where: { id: indikatorId },
    include: { periode: true },
  });
  if (!ind) fail(path, "Indikator tidak ditemukan.");
  if (!ind.periode.aktif) fail(path, "Sesi AMI sedang dikunci oleh LPM.");

  await prisma.isian.upsert({
    where: { indikatorId_unitId: { indikatorId, unitId } },
    create: {
      indikatorId,
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

  await catat(user.id, "AUDIT_LAPANGAN", `${ind.kode} -> ${klasifikasi}`);
  revalidatePath(`/auditor/${periodeId}`);
  revalidatePath("/lpm");
  ok(path, `Klasifikasi temuan "${ind.kode}" (${klasifikasi}) berhasil disimpan.`);
}

export async function verifikasiRtlAuditor(fd: FormData) {
  const user = await requireUser("AUDITOR");
  const periodeId = str(fd, "periodeId", 64);
  const isianId = str(fd, "isianId", 64);
  const rtlStatus = str(fd, "rtlStatus", 32) as StatusRtl;
  const rtlCatatanAuditor = str(fd, "rtlCatatanAuditor", 2000) || null;
  const path = `/auditor/${periodeId}?mode=rtl`;

  if (!VALID_RTL.includes(rtlStatus)) fail(path, "Status verifikasi RTL tidak valid.");

  const isian = await prisma.isian.findUnique({
    where: { id: isianId },
    include: { indikator: { include: { periode: true } } },
  });
  if (!isian) fail(path, "Data isian tidak ditemukan.");
  if (!isian.indikator.periode.aktif) fail(path, "Sesi AMI sedang dikunci oleh LPM.");

  await prisma.isian.update({
    where: { id: isianId },
    data: { rtlStatus, rtlCatatanAuditor },
  });

  await catat(user.id, "VERIFIKASI_RTL", `${isian.indikator.kode} -> ${rtlStatus}`);
  revalidatePath(`/auditor/${periodeId}`);
  revalidatePath("/lpm");
  ok(path, `Verifikasi RTL "${isian.indikator.kode}" disimpan.`);
}
