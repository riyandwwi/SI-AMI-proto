import "server-only";
import { prisma } from "./prisma";

// Pemeriksaan silang (quality control) rencana AMI — rule-based, deterministik.
// Mengikuti buku: data yang tidak tersedia ditandai "Perlu verifikasi manual", bukan ditebak.

export type Isu = { level: "ERROR" | "WARNING"; unitId?: string; pesan: string };
export type Beban = { auditorId: string; nama: string; total: number; ketua: number };

const DURASI_DEFAULT_MS = 3 * 3600 * 1000;

export async function cekKonsistensi(periodeId: string) {
  const [units, penugasan, auditors, jmlIndikator] = await Promise.all([
    prisma.unit.findMany({ where: { diaudit: true }, orderBy: { kode: "asc" } }),
    prisma.penugasan.findMany({
      where: { periodeId },
      include: { unit: true, tim: { include: { auditor: true } } },
    }),
    prisma.user.findMany({ where: { role: "AUDITOR", aktif: true }, orderBy: { nama: "asc" } }),
    prisma.indikator.count({ where: { periodeId } }),
  ]);

  const isu: Isu[] = [];
  if (jmlIndikator === 0) isu.push({ level: "ERROR", pesan: "Belum ada indikator pada periode ini." });
  if (auditors.length < 2) isu.push({ level: "ERROR", pesan: "Auditor aktif kurang dari 2." });

  const byUnit = new Map(penugasan.map((p) => [p.unitId, p]));
  for (const u of units) {
    if (!byUnit.has(u.id)) isu.push({ level: "ERROR", unitId: u.id, pesan: `${u.nama}: belum memiliki tim auditor.` });
  }

  for (const p of penugasan) {
    const nama = p.unit.nama;
    if (!p.unit.diaudit) isu.push({ level: "WARNING", unitId: p.unitId, pesan: `${nama}: unit ini ditandai tidak diaudit tetapi masih punya tim.` });
    const ketua = p.tim.filter((t) => t.peran === "KETUA");
    if (ketua.length !== 1) isu.push({ level: "ERROR", unitId: p.unitId, pesan: `${nama}: harus ada tepat 1 ketua tim (sekarang ${ketua.length}).` });
    if (p.tim.length < 2) isu.push({ level: "WARNING", unitId: p.unitId, pesan: `${nama}: tim hanya ${p.tim.length} auditor.` });
    for (const t of p.tim) {
      if (t.auditor.unitId === p.unitId)
        isu.push({ level: "ERROR", unitId: p.unitId, pesan: `${nama}: conflict of interest — ${t.auditor.nama} berasal dari unit ini.` });
      if (!t.auditor.aktif) isu.push({ level: "ERROR", unitId: p.unitId, pesan: `${nama}: ${t.auditor.nama} sudah nonaktif.` });
    }
    if (!p.jadwalDokumenMulai || !p.jadwalDokumenSelesai)
      isu.push({ level: "ERROR", unitId: p.unitId, pesan: `${nama}: jadwal audit dokumen — Perlu verifikasi manual.` });
    if (!p.jadwalLapanganMulai)
      isu.push({ level: "ERROR", unitId: p.unitId, pesan: `${nama}: jadwal audit lapangan — Perlu verifikasi manual.` });
    if (p.jadwalDokumenSelesai && p.jadwalLapanganMulai && p.jadwalLapanganMulai < p.jadwalDokumenSelesai)
      isu.push({ level: "ERROR", unitId: p.unitId, pesan: `${nama}: audit lapangan dijadwalkan sebelum audit dokumen selesai.` });
  }

  // Bentrok jadwal lapangan per auditor
  const sesiAuditor = new Map<string, { unitId: string; nama: string; mulai: number; selesai: number }[]>();
  for (const p of penugasan) {
    if (!p.jadwalLapanganMulai) continue;
    const mulai = p.jadwalLapanganMulai.getTime();
    const selesai = p.jadwalLapanganSelesai?.getTime() ?? mulai + DURASI_DEFAULT_MS;
    for (const t of p.tim) {
      const arr = sesiAuditor.get(t.auditorId) ?? [];
      arr.push({ unitId: p.unitId, nama: p.unit.nama, mulai, selesai });
      sesiAuditor.set(t.auditorId, arr);
    }
  }
  const namaAuditor = new Map(auditors.map((a) => [a.id, a.nama]));
  for (const [aid, sesi] of sesiAuditor) {
    sesi.sort((a, b) => a.mulai - b.mulai);
    for (let i = 1; i < sesi.length; i++) {
      if (sesi[i].mulai < sesi[i - 1].selesai) {
        const msg = `Jadwal lapangan bentrok untuk ${namaAuditor.get(aid) ?? "auditor"}: ${sesi[i - 1].nama} & ${sesi[i].nama}.`;
        isu.push({ level: "ERROR", unitId: sesi[i].unitId, pesan: msg });
        isu.push({ level: "ERROR", unitId: sesi[i - 1].unitId, pesan: msg });
      }
    }
  }

  // Keseimbangan beban
  const beban: Beban[] = auditors.map((a) => {
    const tugas = penugasan.flatMap((p) => p.tim.filter((t) => t.auditorId === a.id));
    return { auditorId: a.id, nama: a.nama, total: tugas.length, ketua: tugas.filter((t) => t.peran === "KETUA").length };
  });
  if (beban.length) {
    const max = Math.max(...beban.map((b) => b.total));
    const min = Math.min(...beban.map((b) => b.total));
    if (max - min > 1) isu.push({ level: "WARNING", pesan: `Beban auditor tidak seimbang (min ${min}, maks ${max} auditee).` });
  }

  return { isu, beban };
}

export function isuBlokir(isu: Isu[], unitId: string) {
  return isu.filter((i) => i.level === "ERROR" && i.unitId === unitId);
}
