import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { KLASIFIKASI_LABEL, RTL_LABEL, STATUS_DOK_LABEL, parseRtlData } from "@/lib/periode";

export const dynamic = "force-dynamic";

function sanitizeSheetName(name: string, fallbackIndex: number): string {
  const cleaned = name
    .replace(/🎓|Pelatihan AMI —/gi, "")
    .replace(/[\\/?*[\]:]/g, " ")
    .trim();
  const short = cleaned.slice(0, 28).trim();
  return short || `Kelompok ${fallbackIndex}`;
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/🎓/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.uid },
  });
  if (!user || !user.aktif) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "SUPER_ADMIN" && user.role !== "LPM") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const periodeId = searchParams.get("periodeId");
  const unitIdParam = searchParams.get("unitId");
  const trainingAll = searchParams.get("training") === "all";
  const roleFilter = searchParams.get("role"); // "auditee" | "auditor" | null (semua)

  const wb = XLSX.utils.book_new();

  if (trainingAll) {
    const trainingPeriodes = await prisma.periode.findMany({
      where: { isTraining: true },
      include: {
        indikator: {
          orderBy: [{ urutan: "asc" }, { kode: "asc" }],
          include: {
            isian: true,
          },
        },
        trainingUsers: {
          orderBy: { nama: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const summaryRows: Record<string, string | number>[] = [];

    trainingPeriodes.forEach((tp, idx) => {
      const totalInd = tp.indikator.length;
      let filledCount = 0;
      let checkedCount = 0;

      const rows = tp.indikator.map((ind, i) => {
        const isian =
          (tp.unitId
            ? ind.isian.find((is) => is.unitId === tp.unitId)
            : ind.isian[0]) ?? ind.isian[0];

        const isFilled = Boolean(
          isian?.klaim?.trim() || isian?.linkDrive?.trim(),
        );
        if (isFilled) filledCount++;

        const isChecked = Boolean(
          isian?.diperiksaOleh?.trim() ||
            (isian && isian.statusDokumen !== "BELUM_DICEK") ||
            isian?.klasifikasi ||
            isian?.terverifikasiAuditor,
        );
        if (isChecked) checkedCount++;

        const parsedRtl = parseRtlData(isian?.rtlRencana);

        return {
          No: i + 1,
          "Kelompok Training": tp.nama,
          "Standar SPMI": ind.standar,
          "Kode Indikator": ind.kode,
          "Pernyataan Standar": ind.pernyataanStandar ?? "-",
          "Indikator Kinerja": ind.pernyataan,
          "Dokumen Bukti yang Diminta": ind.buktiDiminta ?? "-",
          "Status Isian Auditee": isFilled ? "SUDAH DIISI" : "BELUM DIISI",
          "Evaluasi Diri Auditee": isian?.klaim ?? "",
          "Link Google Drive Bukti": isian?.linkDrive ?? "",
          "Diisi Oleh (Auditee)": isian?.diisiOleh ?? "-",
          "Status Dokumen (Auditor)": isian
            ? STATUS_DOK_LABEL[isian.statusDokumen]
            : "Belum Diperiksa",
          "Catatan Audit Dokumen": isian?.catatanDokumen ?? "",
          "Klasifikasi Temuan": isian?.klasifikasi
            ? KLASIFIKASI_LABEL[isian.klasifikasi]
            : "-",
          "Catatan Audit Lapangan": isian?.catatanLapangan ?? "",
          "Rekomendasi Auditor": isian?.rekomendasi ?? "",
          "Diperiksa Oleh (Auditor)": isian?.diperiksaOleh ?? "-",
          "PIC Tindak Perbaikan": parsedRtl.pic,
          "Tindakan Perbaikan (RTL)": parsedRtl.rencana,
          "Link Bukti Drive RTL": isian?.rtlLinkBukti ?? "",
          "Status Perbaikan RTL": isian ? RTL_LABEL[isian.rtlStatus] : "-",
          "Catatan Verifikasi RTL Auditor": isian?.rtlCatatanAuditor ?? "",
          "Waktu Simpan Terakhir": isian?.updatedAt
            ? new Date(isian.updatedAt).toLocaleString("id-ID")
            : "-",
        };
      });

      const pctAuditee =
        totalInd > 0 ? Math.round((filledCount / totalInd) * 1000) / 10 : 0;
      const pctAuditor =
        totalInd > 0 ? Math.round((checkedCount / totalInd) * 1000) / 10 : 0;

      summaryRows.push({
        No: idx + 1,
        "Nama Kelompok": tp.nama,
        "Anggota Auditee": tp.trainingUsers
          .filter((u) => u.role === "AUDITEE")
          .map((u) => u.nama)
          .join(", "),
        "Anggota Auditor": tp.trainingUsers
          .filter((u) => u.role === "AUDITOR")
          .map((u) => u.nama)
          .join(", "),
        "Total Indikator": totalInd,
        "Indikator Diisi Auditee": filledCount,
        "Progres Auditee (%)": `${pctAuditee}%`,
        "Indikator Dicek Auditor": checkedCount,
        "Progres Auditor (%)": `${pctAuditor}%`,
      });

      const ws = XLSX.utils.json_to_sheet(
        rows.length > 0
          ? rows
          : [{ Info: "Belum ada indikator di kelompok ini" }],
      );
      ws["!cols"] = [
        { wch: 6 },
        { wch: 28 },
        { wch: 28 },
        { wch: 14 },
        { wch: 40 },
        { wch: 45 },
        { wch: 35 },
        { wch: 16 },
        { wch: 45 },
        { wch: 40 },
        { wch: 26 },
        { wch: 22 },
        { wch: 35 },
        { wch: 20 },
        { wch: 35 },
        { wch: 35 },
        { wch: 26 },
        { wch: 22 },
      ];

      let sheetName = sanitizeSheetName(tp.nama, idx + 1);
      if (wb.SheetNames.includes(sheetName)) {
        sheetName = `${sheetName.slice(0, 25)}_${idx + 1}`;
      }
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    const summarySheet = XLSX.utils.json_to_sheet(
      summaryRows.length > 0
        ? summaryRows
        : [{ Info: "Belum ada kelompok training" }],
    );
    summarySheet["!cols"] = [
      { wch: 6 },
      { wch: 32 },
      { wch: 40 },
      { wch: 40 },
      { wch: 16 },
      { wch: 22 },
      { wch: 18 },
      { wch: 24 },
      { wch: 18 },
    ];

    wb.SheetNames.unshift("Rekap Semua Kelompok");
    wb.Sheets["Rekap Semua Kelompok"] = summarySheet;

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Hasil_Isian_Semua_Kelompok_Training.xlsx"`,
      },
    });
  }

  if (!periodeId) {
    return NextResponse.json(
      { error: "Parameter periodeId wajib diisi" },
      { status: 400 },
    );
  }

  const periode = await prisma.periode.findUnique({
    where: { id: periodeId },
    include: {
      unit: true,
      indikator: {
        orderBy: [{ urutan: "asc" }, { kode: "asc" }],
        include: {
          isian: true,
        },
      },
      trainingUsers: {
        orderBy: { nama: "asc" },
      },
    },
  });

  if (!periode) {
    return NextResponse.json(
      { error: "Sesi / Kelompok tidak ditemukan" },
      { status: 404 },
    );
  }

  const targetUnitId = unitIdParam || periode.unitId;
  const kontributorAuditee = new Map<string, number>();
  const kontributorAuditor = new Map<string, number>();

  const rows = periode.indikator.map((ind, idx) => {
    const isian =
      (targetUnitId
        ? ind.isian.find((is) => is.unitId === targetUnitId)
        : ind.isian[0]) ?? ind.isian[0];

    const isFilled = Boolean(
      isian?.klaim?.trim() || isian?.linkDrive?.trim(),
    );
    if (isFilled && isian?.diisiOleh) {
      kontributorAuditee.set(
        isian.diisiOleh,
        (kontributorAuditee.get(isian.diisiOleh) ?? 0) + 1,
      );
    }

    const isChecked = Boolean(
      isian?.diperiksaOleh?.trim() ||
        (isian && isian.statusDokumen !== "BELUM_DICEK") ||
        isian?.klasifikasi ||
        isian?.terverifikasiAuditor,
    );
    if (isChecked && isian?.diperiksaOleh) {
      kontributorAuditor.set(
        isian.diperiksaOleh,
        (kontributorAuditor.get(isian.diperiksaOleh) ?? 0) + 1,
      );
    }

    const parsedRtl = parseRtlData(isian?.rtlRencana);

    if (roleFilter === "auditee") {
      return {
        No: idx + 1,
        "Sesi / Kelompok": periode.nama,
        "Standar SPMI": ind.standar,
        "Kode Indikator": ind.kode,
        "Pernyataan Standar": ind.pernyataanStandar ?? "-",
        "Indikator Kinerja": ind.pernyataan,
        "Dokumen Bukti yang Diminta": ind.buktiDiminta ?? "-",
        "Status Isian Auditee": isFilled ? "SUDAH DIISI" : "BELUM DIISI",
        "Evaluasi Diri Auditee": isian?.klaim ?? "",
        "Link Google Drive Bukti": isian?.linkDrive ?? "",
        "Diisi Oleh (Auditee)": isian?.diisiOleh ?? "-",
        "PIC Tindak Perbaikan": parsedRtl.pic,
        "Tindakan Perbaikan (RTL)": parsedRtl.rencana,
        "Link Bukti Drive RTL": isian?.rtlLinkBukti ?? "",
        "Status Perbaikan RTL": isian ? RTL_LABEL[isian.rtlStatus] : "-",
        "Waktu Simpan Terakhir": isian?.updatedAt
          ? new Date(isian.updatedAt).toLocaleString("id-ID")
          : "-",
      };
    }

    if (roleFilter === "auditor") {
      return {
        No: idx + 1,
        "Sesi / Kelompok": periode.nama,
        "Standar SPMI": ind.standar,
        "Kode Indikator": ind.kode,
        "Indikator Kinerja": ind.pernyataan,
        "Evaluasi Diri Auditee": isian?.klaim ?? "",
        "Link Google Drive Bukti": isian?.linkDrive ?? "",
        "Diisi Oleh (Auditee)": isian?.diisiOleh ?? "-",
        "Status Pengecekan Auditor": isChecked ? "SUDAH DICEK" : "BELUM DICEK",
        "Status Dokumen (Auditor)": isian
          ? STATUS_DOK_LABEL[isian.statusDokumen]
          : "Belum Diperiksa",
        "Catatan Audit Dokumen": isian?.catatanDokumen ?? "",
        "Klasifikasi Temuan": isian?.klasifikasi
          ? KLASIFIKASI_LABEL[isian.klasifikasi]
          : "-",
        "Catatan Audit Lapangan": isian?.catatanLapangan ?? "",
        "Rekomendasi Auditor": isian?.rekomendasi ?? "",
        "Diperiksa Oleh (Auditor)": isian?.diperiksaOleh ?? "-",
        "PIC Tindak Perbaikan": parsedRtl.pic,
        "Tindakan Perbaikan (RTL)": parsedRtl.rencana,
        "Link Bukti Drive RTL": isian?.rtlLinkBukti ?? "",
        "Status Perbaikan RTL": isian ? RTL_LABEL[isian.rtlStatus] : "-",
        "Catatan Verifikasi RTL Auditor": isian?.rtlCatatanAuditor ?? "",
        "Waktu Simpan Terakhir": isian?.updatedAt
          ? new Date(isian.updatedAt).toLocaleString("id-ID")
          : "-",
      };
    }

    return {
      No: idx + 1,
      "Sesi / Kelompok": periode.nama,
      "Standar SPMI": ind.standar,
      "Kode Indikator": ind.kode,
      "Pernyataan Standar": ind.pernyataanStandar ?? "-",
      "Indikator Kinerja": ind.pernyataan,
      "Dokumen Bukti yang Diminta": ind.buktiDiminta ?? "-",
      "Status Isian Auditee": isFilled ? "SUDAH DIISI" : "BELUM DIISI",
      "Evaluasi Diri Auditee": isian?.klaim ?? "",
      "Link Google Drive Bukti": isian?.linkDrive ?? "",
      "Diisi Oleh (Auditee)": isian?.diisiOleh ?? "-",
      "Status Dokumen (Auditor)": isian
        ? STATUS_DOK_LABEL[isian.statusDokumen]
        : "Belum Diperiksa",
      "Catatan Audit Dokumen": isian?.catatanDokumen ?? "",
      "Klasifikasi Temuan": isian?.klasifikasi
        ? KLASIFIKASI_LABEL[isian.klasifikasi]
        : "-",
      "Catatan Audit Lapangan": isian?.catatanLapangan ?? "",
      "Rekomendasi Auditor": isian?.rekomendasi ?? "",
      "Diperiksa Oleh (Auditor)": isian?.diperiksaOleh ?? "-",
      "PIC Tindak Perbaikan": parsedRtl.pic,
      "Tindakan Perbaikan (RTL)": parsedRtl.rencana,
      "Link Bukti Drive RTL": isian?.rtlLinkBukti ?? "",
      "Status Perbaikan RTL": isian ? RTL_LABEL[isian.rtlStatus] : "-",
      "Catatan Verifikasi RTL Auditor": isian?.rtlCatatanAuditor ?? "",
      "Waktu Simpan Terakhir": isian?.updatedAt
        ? new Date(isian.updatedAt).toLocaleString("id-ID")
        : "-",
    };
  });

  const sheetTitle =
    roleFilter === "auditee"
      ? "Hasil Isian Auditee"
      : roleFilter === "auditor"
        ? "Hasil Pengecekan Auditor"
        : "Hasil Isian & Audit";

  const wsMain = XLSX.utils.json_to_sheet(
    rows.length > 0 ? rows : [{ Info: "Belum ada indikator" }],
  );
  wsMain["!cols"] = [
    { wch: 6 },
    { wch: 28 },
    { wch: 28 },
    { wch: 14 },
    { wch: 40 },
    { wch: 45 },
    { wch: 35 },
    { wch: 18 },
    { wch: 45 },
    { wch: 40 },
    { wch: 26 },
    { wch: 22 },
    { wch: 35 },
    { wch: 20 },
    { wch: 35 },
    { wch: 35 },
    { wch: 26 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMain, sheetTitle);

  // Sheet ke-2: Rekap Kontribusi Per Orang di Kelompok Ini
  const rekapOrangRows: Record<string, string | number>[] = [];
  if (roleFilter !== "auditor") {
    Array.from(kontributorAuditee.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([nama, jml], i) => {
        rekapOrangRows.push({
          No: i + 1,
          "Nama Peserta": nama,
          Peran: "AUDITEE (Pengisi Instrumen)",
          "Jumlah Indikator Disimpan": jml,
        });
      });
  }

  if (roleFilter !== "auditee") {
    Array.from(kontributorAuditor.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([nama, jml], i) => {
        rekapOrangRows.push({
          No: i + 1,
          "Nama Peserta": nama,
          Peran: "AUDITOR (Pemeriksa)",
          "Jumlah Indikator Disimpan": jml,
        });
      });
  }

  if (rekapOrangRows.length > 0) {
    const wsRekap = XLSX.utils.json_to_sheet(rekapOrangRows);
    wsRekap["!cols"] = [{ wch: 6 }, { wch: 32 }, { wch: 28 }, { wch: 26 }];
    XLSX.utils.book_append_sheet(wb, wsRekap, "Rekap Kontributor");
  }

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const safeName = sanitizeFileName(periode.nama) || "Kelompok";
  const rolePrefix =
    roleFilter === "auditee"
      ? "Isian_Auditee_"
      : roleFilter === "auditor"
        ? "Pengecekan_Auditor_"
        : "Hasil_Lengkap_";

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${rolePrefix}${safeName}.xlsx"`,
    },
  });
}
