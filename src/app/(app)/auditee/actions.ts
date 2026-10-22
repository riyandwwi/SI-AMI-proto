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
}

/**
 * Menyimpan satu atau beberapa isian indikator Auditee sekaligus tanpa redirect
 * agar input di indikator lain yang sedang diketik tidak pernah hilang/ter-reset.
 */
export async function simpanBatchIsianAuditee(
  items: IsianInputItem[],
  targetIndikatorId?: string
): Promise<ActionResult> {
  const user = await requireUser("AUDITEE");
  if (!user.unitId) {
    return { ok: false, error: "Akun Auditee Anda belum terhubung ke Program Studi." };
  }

  if (!items || items.length === 0) {
    return { ok: false, error: "Tidak ada data indikator yang dikirim untuk disimpan." };
  }

  // Jika user klik tombol Simpan pada satu indikator spesifik, validasi indikator tersebut terlebih dahulu
  if (targetIndikatorId) {
    const target = items.find((i) => i.indikatorId === targetIndikatorId);
    if (!target || !target.klaim.trim() || !target.linkDrive.trim()) {
      return {
        ok: false,
        error: "Klaim evaluasi diri dan tautan Google Drive pada indikator ini wajib diisi.",
      };
    }
    if (!isGoogleDriveLink(target.linkDrive.trim())) {
      return {
        ok: false,
        error:
          "Tautan bukti wajib berupa link resmi Google Drive / Google Docs (https://drive.google.com/... atau https://docs.google.com/...).",
      };
    }
  }

  // Filter semua item yang sudah lengkap & valid untuk ikut disimpan sekaligus
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
      error:
        "Pastikan Klaim Evaluasi Diri telah diisi dan Tautan Bukti menggunakan link Google Drive / Google Docs yang valid (https://drive.google.com/...).",
    };
  }

  const indikatorList = await prisma.indikator.findMany({
    where: { id: { in: validItems.map((v) => v.indikatorId) } },
    include: { periode: true },
  });

  if (indikatorList.length === 0) {
    return { ok: false, error: "Indikator tidak ditemukan." };
  }

  const locked = indikatorList.find((ind) => !ind.periode.aktif);
  if (locked) {
    return { ok: false, error: "Sesi AMI ini sedang dikunci oleh LPM." };
  }

  const validIndMap = new Map(indikatorList.map((ind) => [ind.id, ind]));
  const savedCodes: string[] = [];
  const savedIds: string[] = [];

  for (const item of validItems) {
    const ind = validIndMap.get(item.indikatorId);
    if (!ind) continue;

    await prisma.isian.upsert({
      where: { indikatorId_unitId: { indikatorId: item.indikatorId, unitId: user.unitId } },
      create: {
        indikatorId: item.indikatorId,
        unitId: user.unitId,
        klaim: item.klaim,
        linkDrive: item.linkDrive,
      },
      update: {
        klaim: item.klaim,
        linkDrive: item.linkDrive,
      },
    });

    savedCodes.push(ind.kode);
    savedIds.push(ind.id);
  }

  await catat(
    user.id,
    "ISI_BUKTI_DRIVE",
    `${user.unit?.nama ?? ""}: ${savedCodes.join(", ")}`
  );

  revalidatePath("/auditee");
  revalidatePath("/lpm");

  return {
    ok: true,
    savedIds,
    message:
      savedCodes.length === 1
        ? `Bukti Google Drive untuk indikator "${savedCodes[0]}" berhasil disimpan.`
        : `${savedCodes.length} indikator (${savedCodes.join(", ")}) berhasil disimpan sekaligus.`,
  };
}

export async function simpanRtlAuditeeClient(payload: {
  isianId: string;
  rtlRencana: string;
  rtlLinkBukti: string;
}): Promise<ActionResult> {
  const user = await requireUser("AUDITEE");
  if (!user.unitId) {
    return { ok: false, error: "Akun Auditee Anda belum terhubung ke Program Studi." };
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
      error: "Bukti tindak lanjut wajib menggunakan link Google Drive / Google Docs.",
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
    return { ok: false, error: "Indikator ini tidak memerlukan tindak lanjut perbaikan." };
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

  return {
    ok: true,
    message: `Tindak lanjut (RTL) untuk "${isian.indikator.kode}" berhasil disimpan.`,
  };
}

// Fallback form actions jika dipanggil via progressive enhancement
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
