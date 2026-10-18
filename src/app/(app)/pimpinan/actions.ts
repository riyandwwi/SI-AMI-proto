"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getActivePeriode } from "@/lib/periode";
import { catat, fail, ok } from "@/lib/actions";

export async function sahkanLaporanInstitusi() {
  const user = await requireUser("PIMPINAN");
  const periode = await getActivePeriode();
  if (!periode) fail("/pimpinan", "Belum ada periode AMI aktif.");

  await prisma.periode.update({
    where: { id: periode.id },
    data: {
      disahkanAt: new Date(),
      disahkanOleh: user.nama,
    },
  });

  await catat(user.id, "PENGESAHAN_PIMPINAN", `Laporan AMI ${periode.nama} disahkan oleh ${user.nama}`);
  revalidatePath("/pimpinan");
  revalidatePath("/lpm/rekap");
  ok("/pimpinan", `Laporan Akhir AMI "${periode.nama}" resmi disahkan oleh ${user.nama}.`);
}
