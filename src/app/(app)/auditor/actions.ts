"use server";

import { revalidatePath } from "next/cache";
import type { Klasifikasi, StatusDokumen, StatusRtl } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getActivePeriode } from "@/lib/periode";
import { catat, fail, ok, str } from "@/lib/actions";

const VALID_DOK: StatusDokumen[] = ["BELUM_DICEK", "LENGKAP", "PERLU_KLARIFIKASI"];
const VALID_KLAS: Klasifikasi[] = ["MELAMPAUI", "MENCAPAI", "OBSERVASI", "KTS_MINOR", "KTS_MAYOR"];
const VALID_RTL: StatusRtl[] = ["PROSES", "TERVERIFIKASI"];

async function pastikanAuditorBertugas(auditorId: string, auditorUnitId: string | null, periodeId: string, unitId: string) {
  if (auditorUnitId && auditorUnitId === unitId) {
    fail("/auditor", "Conflict of Interest: Anda tidak diizinkan mengaudit unit asal Anda sendiri.");
  }
  const penugasan = await prisma.penugasan.findUnique({
    where: { periodeId_unitId: { periodeId, unitId } },
    include: { tim: true, unit: true },
  });
  if (!penugasan || !penugasan.tim.some((t) => t.auditorId === auditorId)) {
    fail("/auditor", "Anda tidak terdaftar dalam tim auditor untuk unit ini.");
  }
  return penugasan;
}

export async function simpanAuditDokumen(fd: FormData) {
  const user = await requireUser("AUDITOR");
  const periode = await getActivePeriode();
  const unitId = str(fd, "unitId", 64);
  const indikatorId = str(fd, "indikatorId", 64);
  const statusDokumen = str(fd, "statusDokumen", 32) as StatusDokumen;
  const catatanDokumen = str(fd, "catatanDokumen", 2000) || null;
  const path = `/auditor/${unitId}?mode=dokumen`;

  if (!periode) fail(path, "Belum ada periode aktif.");
  if (!VALID_DOK.includes(statusDokumen)) fail(path, "Status dokumen tidak valid.");

  const penugasan = await pastikanAuditorBertugas(user.id, user.unitId, periode.id, unitId);
  const ind = await prisma.indikator.findUnique({ where: { id: indikatorId } });
  if (!ind || ind.periodeId !== periode.id) fail(path, "Indikator tidak ditemukan.");

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

  await catat(user.id, "AUDIT_DOKUMEN", `${penugasan.unit.kode} · ${ind.kode} -> ${statusDokumen}`);
  revalidatePath(`/auditor/${unitId}`);
  ok(path, `Hasil Audit Dokumen "${ind.kode}" disimpan & disinkronkan ke Audit Lapangan.`);
}

export async function simpanAuditLapangan(fd: FormData) {
  const user = await requireUser("AUDITOR");
  const periode = await getActivePeriode();
  const unitId = str(fd, "unitId", 64);
  const indikatorId = str(fd, "indikatorId", 64);
  const klasifikasi = str(fd, "klasifikasi", 32) as Klasifikasi;
  const catatanLapangan = str(fd, "catatanLapangan", 2000) || null;
  const rekomendasi = str(fd, "rekomendasi", 2000) || null;
  const path = `/auditor/${unitId}?mode=lapangan`;

  if (!periode) fail(path, "Belum ada periode aktif.");
  if (!VALID_KLAS.includes(klasifikasi)) fail(path, "Klasifikasi temuan tidak valid.");

  const penugasan = await pastikanAuditorBertugas(user.id, user.unitId, periode.id, unitId);
  const ind = await prisma.indikator.findUnique({ where: { id: indikatorId } });
  if (!ind || ind.periodeId !== periode.id) fail(path, "Indikator tidak ditemukan.");

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

  await catat(user.id, "AUDIT_LAPANGAN", `${penugasan.unit.kode} · ${ind.kode} -> ${klasifikasi}`);
  revalidatePath(`/auditor/${unitId}`);
  ok(path, `Klasifikasi temuan "${ind.kode}" (${klasifikasi}) berhasil disimpan.`);
}

export async function verifikasiRtlAuditor(fd: FormData) {
  const user = await requireUser("AUDITOR");
  const periode = await getActivePeriode();
  const unitId = str(fd, "unitId", 64);
  const isianId = str(fd, "isianId", 64);
  const rtlStatus = str(fd, "rtlStatus", 32) as StatusRtl;
  const rtlCatatanAuditor = str(fd, "rtlCatatanAuditor", 2000) || null;
  const path = `/auditor/${unitId}?mode=rtl`;

  if (!periode) fail(path, "Belum ada periode aktif.");
  if (!VALID_RTL.includes(rtlStatus)) fail(path, "Status verifikasi RTL tidak valid.");

  const penugasan = await pastikanAuditorBertugas(user.id, user.unitId, periode.id, unitId);
  const isian = await prisma.isian.findUnique({ where: { id: isianId }, include: { indikator: true } });
  if (!isian || isian.unitId !== unitId) fail(path, "Data isian tidak ditemukan.");

  await prisma.isian.update({
    where: { id: isianId },
    data: { rtlStatus, rtlCatatanAuditor },
  });

  await catat(user.id, "VERIFIKASI_RTL", `${penugasan.unit.kode} · ${isian.indikator.kode} -> ${rtlStatus}`);
  revalidatePath(`/auditor/${unitId}`);
  ok(path, `Verifikasi RTL "${isian.indikator.kode}" disimpan.`);
}
