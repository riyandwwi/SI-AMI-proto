"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { BUTUH_RTL } from "@/lib/periode";
import { catat, fail, isGoogleDriveLink, ok, str } from "@/lib/actions";

export interface IsianInputItem {
  indikatorId: string;
  klaim: string;
  linkDrive: string;
}

export interface ActionResult {
  ok: boolean;
  message?: string;
  error?: string;
  savedIds?: string[];
  diisiOleh?: string;
}

export async function simpanBatchIsianAuditee(
  items: IsianInputItem[],
  targetIndikatorId?: string
): Promise<ActionResult> {
  const user = await requireUser("AUDITEE");
  if (!user.unitId) {
    return { ok: false, error: "Akun Auditee belum terhubung ke Program Studi." };
  }

  if (!items || items.length === 0) {
    return { ok: false, error: "Tidak ada data indikator untuk disimpan." };
  }

  if (targetIndikatorId) {
    const target = items.find((i) => i.indikatorId === targetIndikatorId);
    if (!target || !target.klaim.trim() || !target.linkDrive.trim()) {
      return {
        ok: false,
        error: "Klaim evaluasi diri dan link Google Drive wajib diisi.",
      };
    }
    if (!isGoogleDriveLink(target.linkDrive.trim())) {
      return {
        ok: false,
        error: "Link wajib berupa tautan Google Drive / Google Docs (https://drive.google.com/...).",
      };
    }
  }

  const validItems = items
    .map((item) => ({
      indikatorId: item.indikatorId.trim().slice(0, 64),
      klaim: item.klaim.trim().slice(0, 2000),
      linkDrive: item.linkDrive.trim().slice(0, 500),
    }))
    .filter((item) => item.indikatorId && item.klaim && item.linkDrive && isGoogleDriveLink(item.linkDrive));

  if (validItems.length === 0) {
    return {
      ok: false,
      error: "Pastikan Klaim dan Link Google Drive sudah diisi dengan benar.",
    };
  }

  const indikatorList = await prisma.indikator.findMany({
    where: { id: { in: validItems.map((v) => v.indikatorId) } },
    include: {
      periode: true,
      isian: { where: { unitId: user.unitId } },
    },
  });

  if (indikatorList.length === 0) {
    return { ok: false, error: "Indikator tidak ditemukan." };
  }

  const lockedPeriode = indikatorList.find((ind) => !ind.periode.aktif);
  if (lockedPeriode) {
    return { ok: false, error: "Sesi AMI sedang dikunci oleh LPM." };
  }

  // Cek apakah indikator yang diklik sudah diverifikasi Auditor
  if (targetIndikatorId) {
    const targetInd = indikatorList.find((ind) => ind.id === targetIndikatorId);
    if (targetInd?.isian[0]?.terverifikasiAuditor || targetInd?.isian[0]?.terverifikasiLapangan) {
      return {
        ok: false,
        error: `Indikator "${targetInd.kode}" sudah dikunci oleh Auditor sehingga Dosen tidak dapat upload/mengubah lagi.`,
      };
    }
  }

  const validIndMap = new Map(indikatorList.map((ind) => [ind.id, ind]));
  const savedCodes: string[] = [];
  const savedIds: string[] = [];

  for (const item of validItems) {
    const ind = validIndMap.get(item.indikatorId);
    if (!ind) continue;
    // Lewati indikator yang sudah diverifikasi/dikunci oleh Auditor
    if (ind.isian[0]?.terverifikasiAuditor || ind.isian[0]?.terverifikasiLapangan) continue;

    await prisma.isian.upsert({
      where: { indikatorId_unitId: { indikatorId: item.indikatorId, unitId: user.unitId } },
      create: {
        indikatorId: item.indikatorId,
        unitId: user.unitId,
        klaim: item.klaim,
        linkDrive: item.linkDrive,
        diisiOleh: user.nama,
      },
      update: {
        klaim: item.klaim,
        linkDrive: item.linkDrive,
        diisiOleh: user.nama,
      },
    });

    savedCodes.push(ind.kode);
    savedIds.push(ind.id);
  }

  if (savedIds.length === 0) {
    return {
      ok: false,
      error: "Indikator sudah diverifikasi oleh Auditor sehingga tidak dapat diubah.",
    };
  }

  await catat(
    user.id,
    "ISI_BUKTI_DRIVE",
    `${user.nama} (${user.unit?.nama ?? ""}): ${savedCodes.join(", ")}`
  );

  revalidatePath("/auditee");
  revalidatePath("/auditee/detail");
  revalidatePath("/auditor");
  revalidatePath("/lpm");

  return {
    ok: true,
    savedIds,
    diisiOleh: user.nama,
    message: `Tersimpan (${savedCodes.join(", ")}) oleh ${user.nama}.`,
  };
}

export async function simpanRtlAuditeeClient(payload: {
  isianId: string;
  rtlRencana: string;
  rtlLinkBukti: string;
}): Promise<ActionResult> {
  const user = await requireUser("AUDITEE");
  if (!user.unitId) {
    return { ok: false, error: "Akun Auditee belum terhubung ke Program Studi." };
  }

  const isianId = payload.isianId.trim().slice(0, 64);
  const rtlRencana = payload.rtlRencana.trim().slice(0, 2000);
  const rtlLinkBukti = payload.rtlLinkBukti.trim().slice(0, 500);

  if (!isianId || !rtlRencana) {
    return { ok: false, error: "Rencana tindak lanjut wajib diisi." };
  }
  if (rtlLinkBukti && !isGoogleDriveLink(rtlLinkBukti)) {
    return {
      ok: false,
      error: "Link bukti wajib menggunakan Google Drive / Google Docs.",
    };
  }

  const isian = await prisma.isian.findUnique({
    where: { id: isianId },
    include: { indikator: { include: { periode: true } } },
  });
  if (!isian || isian.unitId !== user.unitId) {
    return { ok: false, error: "Data isian tidak ditemukan." };
  }
  if (!isian.indikator.periode.aktif) {
    return { ok: false, error: "Sesi AMI sedang dikunci oleh LPM." };
  }
  if (!isian.klasifikasi || !BUTUH_RTL.includes(isian.klasifikasi)) {
    return { ok: false, error: "Indikator ini tidak memerlukan RTL." };
  }
  if (isian.rtlStatus === "TERVERIFIKASI") {
    return { ok: false, error: "RTL sudah diverifikasi & dikunci oleh Auditor sehingga tidak dapat diubah lagi." };
  }

  const nextStatus = rtlLinkBukti ? "SELESAI_AUDITEE" : "PROSES";
  await prisma.isian.update({
    where: { id: isianId },
    data: {
      rtlRencana,
      rtlLinkBukti: rtlLinkBukti || null,
      rtlStatus: nextStatus,
      diisiOleh: user.nama,
    },
  });

  await catat(user.id, "ISI_RTL_AUDITEE", `${user.nama}: ${isian.indikator.kode} -> ${nextStatus}`);
  revalidatePath("/auditee");
  revalidatePath("/auditee/detail");
  revalidatePath("/auditor");
  revalidatePath("/lpm");

  return {
    ok: true,
    diisiOleh: user.nama,
    message: `RTL "${isian.indikator.kode}" disimpan oleh ${user.nama}.`,
  };
}

export async function simpanIsianAuditee(fd: FormData) {
  const indikatorId = str(fd, "indikatorId", 64);
  const klaim = str(fd, "klaim", 2000);
  const linkDrive = str(fd, "linkDrive", 500);
  const res = await simpanBatchIsianAuditee([{ indikatorId, klaim, linkDrive }], indikatorId);
  if (!res.ok) fail("/auditee", res.error ?? "Gagal menyimpan.");
  ok("/auditee", res.message ?? "Berhasil disimpan.");
}

export async function simpanRtlAuditee(fd: FormData) {
  const isianId = str(fd, "isianId", 64);
  const rtlRencana = str(fd, "rtlRencana", 2000);
  const rtlLinkBukti = str(fd, "rtlLinkBukti", 500);
  const res = await simpanRtlAuditeeClient({ isianId, rtlRencana, rtlLinkBukti });
  if (!res.ok) fail("/auditee", res.error ?? "Gagal menyimpan RTL.");
  ok("/auditee", res.message ?? "RTL berhasil disimpan.");
}
