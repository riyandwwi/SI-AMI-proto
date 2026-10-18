import "server-only";
import type { Klasifikasi, StatusRtl } from "@prisma/client";
import { prisma } from "./prisma";
import { BUTUH_RTL } from "./periode";

export type RekapUnit = {
  unitId: string;
  kode: string;
  nama: string;
  tim: string;
  jmlIndikator: number;
  terisiLink: number;
  klasifikasi: Record<Klasifikasi, number>;
  belumDinilai: number;
  rtl: Record<StatusRtl, number>;
  temuanTerbuka: number;
};

const nolKlas = (): Record<Klasifikasi, number> => ({ MELAMPAUI: 0, MENCAPAI: 0, OBSERVASI: 0, KTS_MINOR: 0, KTS_MAYOR: 0 });
const nolRtl = (): Record<StatusRtl, number> => ({ BELUM: 0, PROSES: 0, SELESAI_AUDITEE: 0, TERVERIFIKASI: 0 });

export async function getRekap(periodeId: string) {
  const [units, indikator, isian, penugasan] = await Promise.all([
    prisma.unit.findMany({ where: { diaudit: true }, orderBy: { kode: "asc" } }),
    prisma.indikator.count({ where: { periodeId } }),
    prisma.isian.findMany({ where: { indikator: { periodeId } } }),
    prisma.penugasan.findMany({ where: { periodeId }, include: { tim: { include: { auditor: true } } } }),
  ]);
  const timByUnit = new Map(
    penugasan.map((p) => [
      p.unitId,
      p.tim
        .slice()
        .sort((a, b) => Number(b.peran === "KETUA") - Number(a.peran === "KETUA"))
        .map((t) => `${t.auditor.nama}${t.peran === "KETUA" ? " (K)" : ""}`)
        .join(", "),
    ]),
  );

  const rows: RekapUnit[] = units.map((u) => {
    const mine = isian.filter((i) => i.unitId === u.id);
    const klasifikasi = nolKlas();
    const rtl = nolRtl();
    let temuanTerbuka = 0;
    for (const i of mine) {
      if (i.klasifikasi) {
        klasifikasi[i.klasifikasi]++;
        if (BUTUH_RTL.includes(i.klasifikasi)) {
          rtl[i.rtlStatus]++;
          if (i.rtlStatus !== "TERVERIFIKASI") temuanTerbuka++;
        }
      }
    }
    return {
      unitId: u.id,
      kode: u.kode,
      nama: u.nama,
      tim: timByUnit.get(u.id) ?? "—",
      jmlIndikator: indikator,
      terisiLink: mine.filter((i) => i.linkDrive).length,
      klasifikasi,
      belumDinilai: indikator - mine.filter((i) => i.klasifikasi).length,
      rtl,
      temuanTerbuka,
    };
  });

  const total = {
    unit: rows.length,
    indikator,
    slot: rows.length * indikator,
    terisiLink: rows.reduce((s, r) => s + r.terisiLink, 0),
    klasifikasi: rows.reduce((acc, r) => {
      for (const k of Object.keys(acc) as Klasifikasi[]) acc[k] += r.klasifikasi[k];
      return acc;
    }, nolKlas()),
    temuanTerbuka: rows.reduce((s, r) => s + r.temuanTerbuka, 0),
  };
  const dinilai = Object.values(total.klasifikasi).reduce((a, b) => a + b, 0);
  const tercapai = total.klasifikasi.MELAMPAUI + total.klasifikasi.MENCAPAI;
  return { rows, total, persenCapaian: dinilai ? Math.round((tercapai / dinilai) * 1000) / 10 : null };
}
