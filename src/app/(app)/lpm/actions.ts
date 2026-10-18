"use server";

import { revalidatePath } from "next/cache";
import type { Tahap } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getActivePeriode, TAHAP_LABEL, TAHAP_URUT } from "@/lib/periode";
import { parseDate, parseDateTime } from "@/lib/format";
import { buatUsulanTim } from "@/lib/planner";
import { cekKonsistensi, isuBlokir } from "@/lib/qc";
import { catat, fail, ok, str } from "@/lib/actions";

// ====================================================
// 1. PERIODE, SESI (STAGE GATE), & SOURCE-LOCK
// ====================================================
export async function buatPeriode(fd: FormData) {
  const user = await requireUser("LPM");
  const nama = str(fd, "nama", 120);
  const tahun = str(fd, "tahun", 32);
  if (!nama || !tahun) fail("/lpm", "Nama periode dan tahun wajib diisi.");

  await prisma.periode.updateMany({ data: { aktif: false } });
  const p = await prisma.periode.create({
    data: { nama, tahun, tahap: "PERSIAPAN", sourceLocked: false, aktif: true },
  });

  await catat(user.id, "BUAT_PERIODE", `${p.nama} (${p.tahun})`);
  revalidatePath("/lpm");
  ok("/lpm", `Periode "${p.nama}" dibuat dan diaktifkan.`);
}

export async function ubahTahapPeriode(fd: FormData) {
  const user = await requireUser("LPM");
  const tahapBaru = str(fd, "tahap", 40) as Tahap;
  if (!TAHAP_URUT.includes(tahapBaru)) fail("/lpm", "Tahap tidak valid.");

  const periode = await getActivePeriode();
  if (!periode) fail("/lpm", "Belum ada periode aktif.");

  // Jika maju dari PERSIAPAN ke PENGISIAN atau tahap berikutnya, wajib mengunci sumber (source-lock) dulu
  if (tahapBaru !== "PERSIAPAN" && !periode.sourceLocked) {
    await prisma.periode.update({
      where: { id: periode.id },
      data: { tahap: tahapBaru, sourceLocked: true },
    });
    await catat(user.id, "UBAH_TAHAP_DAN_LOCK", `${periode.nama} -> ${TAHAP_LABEL[tahapBaru]} (otomatis Source-Lock)`);
    revalidatePath("/lpm");
    ok("/lpm", `Sesi dipindahkan ke "${TAHAP_LABEL[tahapBaru]}" dan Source-Lock otomatis diaktifkan.`);
  }

  await prisma.periode.update({
    where: { id: periode.id },
    data: { tahap: tahapBaru },
  });
  await catat(user.id, "UBAH_TAHAP_SESI", `${periode.nama} -> ${TAHAP_LABEL[tahapBaru]}`);
  revalidatePath("/lpm");
  ok("/lpm", `Sesi aktif berhasil diubah ke "${TAHAP_LABEL[tahapBaru]}".`);
}

export async function toggleSourceLock() {
  const user = await requireUser("LPM");
  const periode = await getActivePeriode();
  if (!periode) fail("/lpm", "Belum ada periode aktif.");

  const nextLocked = !periode.sourceLocked;
  if (nextLocked) {
    const jmlIndikator = await prisma.indikator.count({ where: { periodeId: periode.id } });
    if (jmlIndikator === 0) fail("/lpm", "Tambahkan minimal 1 indikator sebelum mengaktifkan Source-Lock.");
  }

  await prisma.periode.update({
    where: { id: periode.id },
    data: { sourceLocked: nextLocked },
  });
  await catat(user.id, nextLocked ? "AKTIFKAN_SOURCE_LOCK" : "BUKA_SOURCE_LOCK", periode.nama);
  revalidatePath("/lpm");
  revalidatePath("/lpm/indikator");
  revalidatePath("/lpm/unit");
  ok(
    "/lpm",
    nextLocked
      ? "Source-Lock DIAKTIFKAN: Daftar indikator & unit dikunci sebagai sumber resmi."
      : "Source-Lock DIBUKA: LPM dapat mengedit kembali indikator dan unit.",
  );
}

export async function simpanTanggalPeriode(fd: FormData) {
  const user = await requireUser("LPM");
  const periode = await getActivePeriode();
  if (!periode) fail("/lpm", "Belum ada periode aktif.");

  const tglMulaiPengisian = parseDate(fd.get("tglMulaiPengisian"), false);
  const tglCutOff = parseDate(fd.get("tglCutOff"), true);
  const tglOpening = parseDate(fd.get("tglOpening"), false);
  const tglClosing = parseDate(fd.get("tglClosing"), false);

  await prisma.periode.update({
    where: { id: periode.id },
    data: { tglMulaiPengisian, tglCutOff, tglOpening, tglClosing },
  });

  await catat(user.id, "SIMPAN_KALENDER_AMI", periode.nama);
  revalidatePath("/lpm");
  ok("/lpm", "Kalender dan batas cut-off periode AMI berhasil disimpan.");
}

// ====================================================
// 2. MASTER UNIT / AUDITEE ITBMP
// ====================================================
export async function tambahUnit(fd: FormData) {
  const user = await requireUser("LPM");
  const periode = await getActivePeriode();
  if (periode?.sourceLocked) {
    fail("/lpm/unit", "Data sumber sedang terkunci (Source-Lock). Buka kunci di halaman Sesi & Periode terlebih dahulu.");
  }

  const kode = str(fd, "kode", 24).toUpperCase().replace(/\s+/g, "-");
  const nama = str(fd, "nama", 120);
  const jenis = str(fd, "jenis", 40) || "PRODI";
  if (!kode || !nama) fail("/lpm/unit", "Kode dan nama unit wajib diisi.");

  const exists = await prisma.unit.findUnique({ where: { kode } });
  if (exists) fail("/lpm/unit", `Unit dengan kode "${kode}" sudah ada.`);

  await prisma.unit.create({ data: { kode, nama, jenis, diaudit: true } });
  await catat(user.id, "TAMBAH_UNIT", `[${kode}] ${nama}`);
  revalidatePath("/lpm/unit");
  ok("/lpm/unit", `Unit "${nama}" berhasil ditambahkan.`);
}

export async function toggleUnitDiaudit(fd: FormData) {
  const user = await requireUser("LPM");
  const periode = await getActivePeriode();
  if (periode?.sourceLocked) {
    fail("/lpm/unit", "Data sumber sedang terkunci (Source-Lock). Buka kunci terlebih dahulu.");
  }

  const unitId = str(fd, "unitId", 64);
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) fail("/lpm/unit", "Unit tidak ditemukan.");

  const next = !unit.diaudit;
  await prisma.unit.update({ where: { id: unitId }, data: { diaudit: next } });
  await catat(user.id, "UBAH_CAKUPAN_UNIT", `${unit.nama} -> ${next ? "DIAUDIT" : "TIDAK_DIAUDIT"}`);
  revalidatePath("/lpm/unit");
  ok("/lpm/unit", `Status cakupan audit "${unit.nama}" diperbarui.`);
}

// ====================================================
// 3. MASTER INDIKATOR SPMI ITBMP
// ====================================================
export async function tambahIndikator(fd: FormData) {
  const user = await requireUser("LPM");
  const periode = await getActivePeriode();
  if (!periode) fail("/lpm/indikator", "Belum ada periode aktif.");
  if (periode.sourceLocked) {
    fail("/lpm/indikator", "Indikator sedang terkunci (Source-Lock). Buka Source-Lock terlebih dahulu jika ingin menambah indikator.");
  }

  const kode = str(fd, "kode", 32).toUpperCase().replace(/\s+/g, "-");
  const standar = str(fd, "standar", 120);
  const pernyataan = str(fd, "pernyataan", 1000);
  const target = str(fd, "target", 120);
  const buktiDiminta = str(fd, "buktiDiminta", 400) || null;

  if (!kode || !standar || !pernyataan || !target) {
    fail("/lpm/indikator", "Kode, standar, pernyataan, dan target wajib diisi.");
  }

  const jml = await prisma.indikator.count({ where: { periodeId: periode.id } });
  await prisma.indikator.create({
    data: {
      periodeId: periode.id,
      kode,
      standar,
      pernyataan,
      target,
      buktiDiminta,
      urutan: jml + 1,
    },
  });

  await catat(user.id, "TAMBAH_INDIKATOR", `[${kode}] ${standar}`);
  revalidatePath("/lpm/indikator");
  ok("/lpm/indikator", `Indikator "${kode}" berhasil ditambahkan.`);
}

export async function hapusIndikator(fd: FormData) {
  const user = await requireUser("LPM");
  const periode = await getActivePeriode();
  if (!periode) fail("/lpm/indikator", "Belum ada periode aktif.");
  if (periode.sourceLocked) {
    fail("/lpm/indikator", "Indikator sedang terkunci (Source-Lock). Buka Source-Lock terlebih dahulu.");
  }

  const indikatorId = str(fd, "indikatorId", 64);
  const ind = await prisma.indikator.findUnique({ where: { id: indikatorId } });
  if (!ind) fail("/lpm/indikator", "Indikator tidak ditemukan.");

  await prisma.indikator.delete({ where: { id: indikatorId } });
  await catat(user.id, "HAPUS_INDIKATOR", ind.kode);
  revalidatePath("/lpm/indikator");
  ok("/lpm/indikator", `Indikator "${ind.kode}" dihapus.`);
}

// ====================================================
// 4. PENUGASAN TIM, VALIDASI CoI, JADWAL, & APPROVAL
// ====================================================
export async function jalankanUsulanTimOtomatis() {
  const user = await requireUser("LPM");
  const periode = await getActivePeriode();
  if (!periode) fail("/lpm/penugasan", "Belum ada periode aktif.");
  if (!periode.sourceLocked) {
    fail("/lpm/penugasan", "Prinsip Source-Lock: Kunci sumber data (Indikator & Unit) terlebih dahulu sebelum membuat usulan tim otomatis.");
  }

  const { dibuat, dilewati } = await buatUsulanTim(periode.id);
  await catat(user.id, "USULAN_TIM_OTOMATIS", `Dibuat: ${dibuat.length} unit, Dilewati: ${dilewati.length}`);
  revalidatePath("/lpm/penugasan");

  if (dibuat.length === 0 && dilewati.length === 0) {
    ok("/lpm/penugasan", "Seluruh unit sasaran sudah memiliki tim auditor.");
  }
  const msg = [
    dibuat.length ? `Usulan tim dibuat untuk ${dibuat.length} unit (${dibuat.join(", ")}).` : "",
    dilewati.length ? `Dilewati: ${dilewati.map((d) => `${d.unit} (${d.alasan})`).join("; ")}.` : "",
    "Silakan lengkapi tanggal jadwal dan sahkan.",
  ]
    .filter(Boolean)
    .join(" ");
  ok("/lpm/penugasan", msg);
}

export async function simpanPenugasanManual(fd: FormData) {
  const user = await requireUser("LPM");
  const periode = await getActivePeriode();
  if (!periode) fail("/lpm/penugasan", "Belum ada periode aktif.");

  const unitId = str(fd, "unitId", 64);
  const ketuaId = str(fd, "ketuaId", 64);
  const anggotaId = str(fd, "anggotaId", 64);
  const alasanPerubahan = str(fd, "alasanPerubahan", 300) || null;
  const jadwalDokumenMulai = parseDate(fd.get("jadwalDokumenMulai"), false);
  const jadwalDokumenSelesai = parseDate(fd.get("jadwalDokumenSelesai"), true);
  const jadwalLapanganMulai = parseDateTime(fd.get("jadwalLapanganMulai"));
  const jadwalLapanganSelesai = parseDateTime(fd.get("jadwalLapanganSelesai"));

  if (!unitId || !ketuaId || !anggotaId) {
    fail("/lpm/penugasan", "Unit, Ketua Auditor, dan Anggota Auditor wajib dipilih.");
  }
  if (ketuaId === anggotaId) {
    fail("/lpm/penugasan", "Ketua dan Anggota Auditor tidak boleh orang yang sama.");
  }

  const [unit, ketua, anggota, existing] = await Promise.all([
    prisma.unit.findUnique({ where: { id: unitId } }),
    prisma.user.findUnique({ where: { id: ketuaId } }),
    prisma.user.findUnique({ where: { id: anggotaId } }),
    prisma.penugasan.findUnique({
      where: { periodeId_unitId: { periodeId: periode.id, unitId } },
      include: { tim: true },
    }),
  ]);

  if (!unit || !ketua || !anggota) fail("/lpm/penugasan", "Data unit atau auditor tidak ditemukan.");

  // Validasi Conflict of Interest (CoI) keras
  if (ketua.unitId === unitId || anggota.unitId === unitId) {
    fail(
      "/lpm/penugasan",
      `Conflict of Interest terdeteksi: Auditor tidak boleh ditugaskan mengaudit unit asalnya sendiri (${unit.nama}).`,
    );
  }

  // Prinsip Team Continuity: jika penugasan sudah pernah disahkan dan anggota tim berubah, wajib isi alasan resmi
  if (existing && existing.disahkan) {
    const oldKetua = existing.tim.find((t) => t.peran === "KETUA")?.auditorId;
    const oldAnggota = existing.tim.find((t) => t.peran === "ANGGOTA")?.auditorId;
    const timBerubah = oldKetua !== ketuaId || oldAnggota !== anggotaId;
    if (timBerubah && !alasanPerubahan) {
      fail(
        "/lpm/penugasan",
        "Prinsip Team Continuity: Mengubah tim auditor yang sudah disahkan wajib mencantumkan Alasan Resmi Perubahan Tim.",
      );
    }
  }

  if (existing) {
    await prisma.$transaction([
      prisma.penugasanAuditor.deleteMany({ where: { penugasanId: existing.id } }),
      prisma.penugasan.update({
        where: { id: existing.id },
        data: {
          jadwalDokumenMulai,
          jadwalDokumenSelesai,
          jadwalLapanganMulai,
          jadwalLapanganSelesai,
          alasanPerubahan,
          sumber: "MANUAL",
          disahkan: false,
          tim: {
            create: [
              { auditorId: ketuaId, peran: "KETUA" },
              { auditorId: anggotaId, peran: "ANGGOTA" },
            ],
          },
        },
      }),
    ]);
  } else {
    await prisma.penugasan.create({
      data: {
        periodeId: periode.id,
        unitId,
        jadwalDokumenMulai,
        jadwalDokumenSelesai,
        jadwalLapanganMulai,
        jadwalLapanganSelesai,
        alasanPerubahan,
        sumber: "MANUAL",
        disahkan: false,
        tim: {
          create: [
            { auditorId: ketuaId, peran: "KETUA" },
            { auditorId: anggotaId, peran: "ANGGOTA" },
          ],
        },
      },
    });
  }

  await catat(user.id, "SIMPAN_PENUGASAN", `${unit.nama}: ${ketua.nama} (K) & ${anggota.nama} (A)`);
  revalidatePath("/lpm/penugasan");
  ok("/lpm/penugasan", `Penugasan dan jadwal untuk "${unit.nama}" disimpan. Silakan klik Sahkan jika sudah diverifikasi.`);
}

export async function sahkanPenugasan(fd: FormData) {
  const user = await requireUser("LPM");
  const periode = await getActivePeriode();
  if (!periode) fail("/lpm/penugasan", "Belum ada periode aktif.");

  const penugasanId = str(fd, "penugasanId", 64);
  const p = await prisma.penugasan.findUnique({ where: { id: penugasanId }, include: { unit: true } });
  if (!p) fail("/lpm/penugasan", "Penugasan tidak ditemukan.");

  const { isu } = await cekKonsistensi(periode.id);
  const blokir = isuBlokir(isu, p.unitId);
  if (blokir.length > 0) {
    fail("/lpm/penugasan", `Belum dapat disahkan: ${blokir.map((b) => b.pesan).join(" | ")}`);
  }

  await prisma.penugasan.update({ where: { id: penugasanId }, data: { disahkan: true } });
  await catat(user.id, "SAHKAN_PENUGASAN", p.unit.nama);
  revalidatePath("/lpm/penugasan");
  ok("/lpm/penugasan", `Penugasan "${p.unit.nama}" resmi disahkan oleh LPM.`);
}
