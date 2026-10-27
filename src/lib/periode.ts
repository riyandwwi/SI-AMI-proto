import type { Klasifikasi, StatusDokumen, StatusRtl, Tahap } from "@prisma/client";

export const TAHAP_URUT: Tahap[] = [
  "PERSIAPAN",
  "PENGISIAN",
  "AUDIT_DOKUMEN",
  "AUDIT_LAPANGAN",
  "KALIBRASI_CLOSING",
  "PELAPORAN_RTL",
  "SELESAI",
];

export const TAHAP_LABEL: Record<Tahap, string> = {
  PERSIAPAN: "1. Persiapan & Source-lock",
  PENGISIAN: "2. Pengisian Bukti Auditee",
  AUDIT_DOKUMEN: "3. Audit Dokumen (cut-off)",
  AUDIT_LAPANGAN: "4. Audit Lapangan",
  KALIBRASI_CLOSING: "5. Rapat Internal & Closing",
  PELAPORAN_RTL: "6. Laporan & Tindak Lanjut",
  SELESAI: "7. Selesai / Evaluasi",
};

export const TAHAP_DESK: Record<Tahap, string> = {
  PERSIAPAN: "LPM menyusun indikator & daftar unit, membentuk tim, lalu mengunci sumber.",
  PENGISIAN: "Auditee mengisi klaim dan tautan Google Drive bukti sampai cut-off.",
  AUDIT_DOKUMEN: "Isian auditee terkunci. Auditor memeriksa bukti dan menandai fokus lapangan.",
  AUDIT_LAPANGAN: "Tim yang sama melakukan audit lapangan dan mencatat temuan.",
  KALIBRASI_CLOSING: "Auditor menyamakan klasifikasi temuan, lalu closing meeting.",
  PELAPORAN_RTL: "Auditee menyusun RTL atas temuan, auditor memverifikasi, pimpinan mengesahkan.",
  SELESAI: "Siklus ditutup; hasil menjadi bahan evaluasi siklus berikutnya.",
};

export const KLASIFIKASI_LABEL: Record<Klasifikasi, string> = {
  MELAMPAUI: "Melampaui",
  MENCAPAI: "Mencapai",
  OBSERVASI: "Observasi (OB)",
  KTS_MINOR: "KTS Minor",
  KTS_MAYOR: "KTS Mayor",
};

export const STATUS_DOK_LABEL: Record<StatusDokumen, string> = {
  BELUM_DICEK: "Belum diperiksa",
  LENGKAP: "Lengkap & sesuai",
  PERLU_KLARIFIKASI: "Perlu klarifikasi lapangan",
};

export const RTL_LABEL: Record<StatusRtl, string> = {
  BELUM: "Belum Diisi",
  PROSES: "⏳ Menunggu Perbaikan",
  SELESAI_AUDITEE: "✅ Selesai",
  TERVERIFIKASI: "🔒 Terverifikasi",
};

/**
 * Menyimpan PIC Tindak Perbaikan dan Isi Tindakan Perbaikan secara terstruktur
 * di dalam kolom rtlRencana tanpa perlu migrasi skema database baru.
 */
export function encodeRtlData(pic: string, rencana: string): string {
  const cleanPic = pic.replace(/[\[\]]/g, "").trim();
  const cleanRencana = rencana.trim();
  if (!cleanPic && !cleanRencana) return "";
  if (!cleanPic) return cleanRencana;
  return `[PIC: ${cleanPic}] ${cleanRencana}`.trim();
}

export function parseRtlData(raw: string | null | undefined): {
  pic: string;
  rencana: string;
} {
  const text = (raw ?? "").trim();
  const match = text.match(/^\[PIC:\s*([^\]]*)\]\s*([\s\S]*)$/);
  if (match) {
    return {
      pic: match[1].trim(),
      rencana: match[2].trim(),
    };
  }
  return {
    pic: "",
    rencana: text,
  };
}

/** Klasifikasi yang wajib ditindaklanjuti dengan RTL. */
export const BUTUH_RTL: Klasifikasi[] = ["OBSERVASI", "KTS_MINOR", "KTS_MAYOR"];

/** Daftar Standar SPMI bawaan (LPM tetap bebas menambah/mengubah/menghapus standar sendiri). */
export const DEFAULT_STANDAR_SPMI = [
  "Standar Kompetensi Lulusan",
  "Standar Isi Pembelajaran",
  "Standar Proses Pembelajaran",
  "Standar Penilaian Pembelajaran",
  "Standar Dosen dan Tenaga Kependidikan",
  "Standar Sarana dan Prasarana",
  "Standar Pengelolaan Pembelajaran",
  "Standar Pembiayaan Pembelajaran",
  "Standar Penelitian & PKM",
] as const;

export interface StandarGroup<T> {
  standar: string;
  startIndex: number; // Nomor urut indikator awal (1-based, misal 1)
  endIndex: number;   // Nomor urut indikator akhir (1-based, misal 6)
  items: Array<{ item: T; noUrut: number }>;
}

/**
 * Mengelompokkan daftar indikator berdasarkan nama Standar secara berurutan,
 * sehingga tampil: Standar A (Indikator 1-6), lanjut Standar B (Indikator 7-10), dst.
 */
export function groupIndikatorByStandar<T extends { standar: string }>(
  list: T[]
): StandarGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const item of list) {
    const key = (item.standar || "Standar Lainnya").trim();
    const arr = map.get(key) ?? [];
    arr.push(item);
    map.set(key, arr);
  }

  const groups: StandarGroup<T>[] = [];
  let counter = 1;
  for (const [standar, arr] of map.entries()) {
    const startIndex = counter;
    const numbered = arr.map((item) => ({ item, noUrut: counter++ }));
    const endIndex = counter - 1;
    groups.push({
      standar,
      startIndex,
      endIndex,
      items: numbered,
    });
  }
  return groups;
}

export function tahapIndex(t: Tahap) {
  return TAHAP_URUT.indexOf(t);
}

/** Isian auditee hanya bisa diubah pada tahap PENGISIAN dan sebelum tanggal cut-off. */
export function pengisianTerbuka(p: { tahap: Tahap; tglCutOff: Date | null }) {
  if (p.tahap !== "PENGISIAN") return false;
  return !p.tglCutOff || Date.now() <= p.tglCutOff.getTime();
}

/**
 * Mengubah string Tahun Akademik (misal "2025/2026") + Semester ("Ganjil" / "Genap")
 * menjadi angka urut kronologis (misal 20251 untuk 2025/2026 Ganjil, 20252 untuk 2025/2026 Genap).
 */
export function periodeChronologicalScore(p: { tahun: string; semester: string }): number {
  const match = (p.tahun || "").match(/(\d{4})/);
  const startYear = match ? parseInt(match[1], 10) : 0;
  const semOrder = (p.semester || "").toLowerCase().includes("genap") ? 2 : 1;
  return startYear * 10 + semOrder;
}

/**
 * Urutkan sesi secara kronologis: 2025/2026 Ganjil -> 2025/2026 Genap -> 2026/2027 Ganjil -> 2026/2027 Genap
 */
export function sortPeriodesChronological<
  T extends { tahun: string; semester: string; unit?: { nama: string } | null }
>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const scoreA = periodeChronologicalScore(a);
    const scoreB = periodeChronologicalScore(b);
    if (scoreA !== scoreB) return scoreA - scoreB;
    const unitA = a.unit?.nama ?? "";
    const unitB = b.unit?.nama ?? "";
    return unitA.localeCompare(unitB, "id");
  });
}
