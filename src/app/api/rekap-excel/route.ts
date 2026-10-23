import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { KLASIFIKASI_LABEL, RTL_LABEL, STATUS_DOK_LABEL } from "@/lib/periode";
import { fmtWaktu } from "@/lib/format";

function esc(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(req: NextRequest) {
  await requireUser("LPM", "SUPER_ADMIN", "AUDITOR");

  const periodeId = req.nextUrl.searchParams.get("periodeId");
  const isPrint = req.nextUrl.searchParams.get("print") === "1";

  const periodes = await prisma.periode.findMany({
    where: periodeId ? { id: periodeId } : undefined,
    include: {
      unit: true,
      indikator: {
        orderBy: [{ urutan: "asc" }, { kode: "asc" }],
        include: { isian: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  let rowsHtml = "";
  let no = 1;

  for (const p of periodes) {
    for (const ind of p.indikator) {
      const isian = ind.isian.find((i) => !p.unitId || i.unitId === p.unitId) ?? ind.isian[0];
      const statusSah = p.disahkanAt
        ? `Disahkan oleh ${p.disahkanOleh ?? "LPM"} (${fmtWaktu(p.disahkanAt)})`
        : "Belum Disahkan";

      rowsHtml += `
        <tr>
          <td style="text-align:center;">${no++}</td>
          <td>${esc(p.nama)}</td>
          <td>${esc(p.tahun)}</td>
          <td>${esc(p.semester)}</td>
          <td>${esc(p.unit?.nama ?? "-")}</td>
          <td><b>${esc(ind.kode)}</b></td>
          <td>${esc(ind.standar)}</td>
          <td>${esc(ind.pernyataan)}</td>
          <td>${esc(ind.target)}</td>
          <td>${esc(isian?.klaim ?? "-")}</td>
          <td>${esc(isian?.linkDrive ?? "-")}</td>
          <td><b>${esc(isian?.diisiOleh ?? "-")}</b></td>
          <td>${esc(isian ? STATUS_DOK_LABEL[isian.statusDokumen] : "Belum Diperiksa")}</td>
          <td>${esc(isian?.catatanDokumen ?? "-")}</td>
          <td><b>${esc(isian?.klasifikasi ? KLASIFIKASI_LABEL[isian.klasifikasi] : "-")}</b></td>
          <td>${esc(isian?.catatanLapangan ?? "-")}</td>
          <td>${esc(isian?.rekomendasi ?? "-")}</td>
          <td><b>${esc(isian?.diperiksaOleh ?? "-")}</b></td>
          <td>${isian?.terverifikasiAuditor ? "Terverifikasi & Terkunci" : "Belum Dikunci"}</td>
          <td>${esc(isian?.rtlRencana ?? "-")}</td>
          <td>${esc(isian?.rtlLinkBukti ?? "-")}</td>
          <td>${esc(isian ? RTL_LABEL[isian.rtlStatus] : "-")}</td>
          <td>${esc(isian?.rtlCatatanAuditor ?? "-")}</td>
          <td>${esc(statusSah)}</td>
        </tr>
      `;
    }
  }

  const excelHref = `/api/rekap-excel${periodeId ? `?periodeId=${encodeURIComponent(periodeId)}` : ""}`;

  const html = `
    <!DOCTYPE html>
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <title>Rekap Hasil AMI ITBMP</title>
        <style>
          @page { size: landscape; margin: 12mm; }
          body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; background: #fff; margin: 16px; }
          h2 { margin: 0 0 12px 0; font-size: 14pt; }
          .toolbar { display: flex; gap: 10px; margin-bottom: 16px; align-items: center; }
          .btn-print { background: #FF5C38; color: #fff; border: 2px solid #000; padding: 8px 14px; border-radius: 8px; font-weight: bold; cursor: pointer; text-decoration: none; font-size: 10pt; box-shadow: 2px 2px 0 #000; }
          .btn-excel { background: #D9F99D; color: #000; border: 2px solid #000; padding: 8px 14px; border-radius: 8px; font-weight: bold; cursor: pointer; text-decoration: none; font-size: 10pt; box-shadow: 2px 2px 0 #000; }
          table { width: 100%; border-collapse: collapse; font-size: 9pt; }
          th { background-color: #FEF08A; color: #000000; font-weight: bold; border: 1px solid #000000; padding: 6px; text-align: left; }
          td { border: 1px solid #000000; padding: 5px; vertical-align: top; word-break: break-word; }
          @media print {
            .no-print { display: none !important; }
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        ${
          isPrint
            ? `<div class="toolbar no-print">
                <button type="button" class="btn-print" onclick="window.print()">🖨️ Print / Simpan PDF</button>
                <a class="btn-excel" href="${excelHref}">📥 Download Excel (.xls)</a>
              </div>
              <script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script>`
            : ""
        }
        <h2>REKAPITULASI HASIL AUDIT MUTU INTERNAL (SI-AMI ITBMP)</h2>
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Sesi AMI</th>
              <th>Tahun Akademik</th>
              <th>Semester</th>
              <th>Program Studi</th>
              <th>Kode Indikator</th>
              <th>Standar SPMI</th>
              <th>Pernyataan Indikator</th>
              <th>Target</th>
              <th>Evaluasi Diri Auditee</th>
              <th>Link Google Drive Bukti</th>
              <th>Disimpan Oleh (Auditee)</th>
              <th>Status Audit Dokumen</th>
              <th>Catatan Audit Dokumen</th>
              <th>Klasifikasi Temuan</th>
              <th>Temuan Lapangan</th>
              <th>Rekomendasi Auditor</th>
              <th>Diperiksa Oleh (Auditor)</th>
              <th>Verifikasi Auditor</th>
              <th>Tindak Lanjut (RTL) Auditee</th>
              <th>Link Drive Bukti RTL</th>
              <th>Status RTL</th>
              <th>Catatan RTL Auditor</th>
              <th>Status Pengesahan LPM</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
    </html>
  `;

  if (isPrint) {
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  }

  return new NextResponse(html, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="Rekap-Hasil-AMI-ITBMP.xls"`,
    },
  });
}
