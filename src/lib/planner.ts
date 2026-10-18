import "server-only";
import { prisma } from "./prisma";

// Usulan pembagian tim otomatis (rule-based, bukan LLM).
// - Hanya memakai data yang sudah ada di DB (source-lock).
// - Tidak pernah menugaskan auditor ke unit asalnya (conflict of interest).
// - Memilih auditor dengan beban paling ringan agar seimbang.
// - TIDAK mengisi tanggal: jadwal harus ditetapkan manusia (akan muncul "Perlu verifikasi manual").
// - Hasil berstatus belum disahkan sampai LPM menyetujui.

export async function buatUsulanTim(periodeId: string) {
  const [units, sudah, auditors] = await Promise.all([
    prisma.unit.findMany({ where: { diaudit: true }, orderBy: { kode: "asc" } }),
    prisma.penugasan.findMany({ where: { periodeId }, include: { tim: true } }),
    prisma.user.findMany({ where: { role: "AUDITOR", aktif: true }, orderBy: { nama: "asc" } }),
  ]);

  const load = new Map<string, { total: number; ketua: number }>(auditors.map((a) => [a.id, { total: 0, ketua: 0 }]));
  for (const p of sudah)
    for (const t of p.tim) {
      const l = load.get(t.auditorId);
      if (l) {
        l.total++;
        if (t.peran === "KETUA") l.ketua++;
      }
    }

  const punyaTim = new Set(sudah.map((p) => p.unitId));
  const dibuat: string[] = [];
  const dilewati: { unit: string; alasan: string }[] = [];

  for (const unit of units) {
    if (punyaTim.has(unit.id)) continue;
    const eligible = auditors
      .filter((a) => a.unitId !== unit.id)
      .sort((a, b) => {
        const la = load.get(a.id)!, lb = load.get(b.id)!;
        return la.total - lb.total || la.ketua - lb.ketua || a.nama.localeCompare(b.nama);
      });
    if (eligible.length < 2) {
      dilewati.push({ unit: unit.nama, alasan: "auditor bebas conflict of interest kurang dari 2" });
      continue;
    }
    // Dari dua kandidat teringan, yang lebih jarang menjadi ketua dijadikan ketua.
    let [ketua, anggota] = eligible;
    if (load.get(anggota.id)!.ketua < load.get(ketua.id)!.ketua) [ketua, anggota] = [anggota, ketua];

    await prisma.penugasan.create({
      data: {
        periodeId,
        unitId: unit.id,
        sumber: "USULAN_OTOMATIS",
        tim: {
          create: [
            { auditorId: ketua.id, peran: "KETUA" },
            { auditorId: anggota.id, peran: "ANGGOTA" },
          ],
        },
      },
    });
    load.get(ketua.id)!.total++;
    load.get(ketua.id)!.ketua++;
    load.get(anggota.id)!.total++;
    dibuat.push(unit.nama);
  }

  return { dibuat, dilewati };
}
