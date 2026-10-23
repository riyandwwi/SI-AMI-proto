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
  BELUM: "Belum ada RTL",
  PROSES: "Dalam proses",
  SELESAI_AUDITEE: "Diajukan selesai",
  TERVERIFIKASI: "Terverifikasi",
};

/** Klasifikasi yang wajib ditindaklanjuti dengan RTL. */
export const BUTUH_RTL: Klasifikasi[] = ["OBSERVASI", "KTS_MINOR", "KTS_MAYOR"];

export function tahapIndex(t: Tahap) {
  return TAHAP_URUT.indexOf(t);
}

/** Isian auditee hanya bisa diubah pada tahap PENGISIAN dan sebelum tanggal cut-off. */
export function pengisianTerbuka(p: { tahap: Tahap; tglCutOff: Date | null }) {
  if (p.tahap !== "PENGISIAN") return false;
  return !p.tglCutOff || Date.now() <= p.tglCutOff.getTime();
}
