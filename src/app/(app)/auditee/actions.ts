"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { BUTUH_RTL } from "@/lib/periode";
import { catat, fail, isGoogleDriveLink, ok, str } from "@/lib/actions";

export async function simpanIsianAuditee(fd: FormData) {
  const user = await requireUser("AUDITEE");
  if (!user.unitId) fail("/auditee", "Akun Auditee Anda belum terhubung ke Program Studi.");

  const indikatorId = str(fd, "indikatorId", 64);
  const klaim = str(fd, "klaim", 2000);
  const linkDrive = str(fd, "linkDrive", 500);

  if (!indikatorId || !klaim || !linkDrive) {
    fail("/auditee", "Klaim evaluasi diri dan tautan Google Drive wajib diisi.");
  }
  if (!isGoogleDriveLink(linkDrive)) {
    fail("/auditee", "Tautan bukti wajib berupa link resmi Google Drive / Google Docs (https://drive.google.com/... atau https://docs.google.com/...).");
  }

  const ind = await prisma.indikator.findUnique({
    where: { id: indikatorId },
    include: { periode: true },
  });
  if (!ind) fail("/auditee", "Indikator tidak ditemukan.");
  if (!ind.periode.aktif) {
    fail("/auditee", "Sesi AMI ini sedang dikunci oleh LPM.");
  }

  await prisma.isian.upsert({
    where: { indikatorId_unitId: { indikatorId, unitId: user.unitId } },
    create: {
      indikatorId,
      unitId: user.unitId,
      klaim,
      linkDrive,
    },
    update: {
      klaim,
      linkDrive,
    },
  });

  await catat(user.id, "ISI_BUKTI_DRIVE", `${user.unit?.nama ?? ""}: ${ind.kode}`);
  revalidatePath("/auditee");
  revalidatePath("/lpm");
  ok("/auditee", `Bukti Google Drive untuk indikator "${ind.kode}" berhasil disimpan.`);
}

export async function simpanRtlAuditee(fd: FormData) {
  const user = await requireUser("AUDITEE");
  if (!user.unitId) fail("/auditee", "Akun Auditee Anda belum terhubung ke Program Studi.");

  const isianId = str(fd, "isianId", 64);
  const rtlRencana = str(fd, "rtlRencana", 2000);
  const rtlLinkBukti = str(fd, "rtlLinkBukti", 500);

  if (!isianId || !rtlRencana) fail("/auditee", "Rencana tindak lanjut wajib diisi.");
  if (rtlLinkBukti && !isGoogleDriveLink(rtlLinkBukti)) {
    fail("/auditee", "Bukti tindak lanjut wajib menggunakan link Google Drive / Google Docs.");
  }

  const isian = await prisma.isian.findUnique({
    where: { id: isianId },
    include: { indikator: { include: { periode: true } } },
  });
  if (!isian || isian.unitId !== user.unitId) fail("/auditee", "Data isian tidak ditemukan.");
  if (!isian.indikator.periode.aktif) fail("/auditee", "Sesi AMI sedang dikunci oleh LPM.");
  if (!isian.klasifikasi || !BUTUH_RTL.includes(isian.klasifikasi)) {
    fail("/auditee", "Indikator ini tidak memerlukan tindak lanjut perbaikan.");
  }

  const nextStatus = rtlLinkBukti ? "SELESAI_AUDITEE" : "PROSES";
  await prisma.isian.update({
    where: { id: isianId },
    data: {
      rtlRencana,
      rtlLinkBukti: rtlLinkBukti || null,
      rtlStatus: nextStatus,
    },
  });

  await catat(user.id, "ISI_RTL_AUDITEE", `${isian.indikator.kode} -> ${nextStatus}`);
  revalidatePath("/auditee");
  revalidatePath("/lpm");
  ok("/auditee", `Tindak lanjut (RTL) untuk "${isian.indikator.kode}" berhasil disimpan.`);
}
