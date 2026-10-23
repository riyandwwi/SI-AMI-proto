import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  KLASIFIKASI_LABEL,
  RTL_LABEL,
  STATUS_DOK_LABEL,
  sortPeriodesChronological,
} from "@/lib/periode";
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
  await requireUser("LPM", "SUPER_ADMIN", "AUDITOR", "AUDITEE");

  const periodeId = req.nextUrl.searchParams.get("periodeId");
  const isPrint = req.nextUrl.searchParams.get("print") === "1";

  const rawPeriodes = await prisma.periode.findMany({
    where: periodeId ? { id: periodeId } : undefined,
    include: {
      unit: true,
      indikator: {
        orderBy: [{ urutan: "asc" }, { kode: "asc" }],
        include: { isian: true },
      },
    },
  });

  // Urutkan kronologis: 2025/2026 Ganjil -> 2025/2026 Genap -> 2026/2027 Ganjil -> 2026/2027 Genap
  const periodes = sortPeriodesChronological(rawPeriodes);

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
          <td>${esc(ind.buktiDiminta ?? "-")}</td>
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

  // Ambil data tanda tangan dari sesi yang dicetak (atau sesi terakhir jika semua)
  const targetSignPeriode = periodes[periodes.length - 1] ?? null;

  let auditeeNama = targetSignPeriode?.ketuaAuditeeNama ?? "";
  let auditeeNuptk = targetSignPeriode?.ketuaAuditeeNip ?? "";
  let auditorNama = targetSignPeriode?.ketuaAuditorNama ?? "";
  let auditorNuptk = targetSignPeriode?.ketuaAuditorNip ?? "";
  let lpmNama = targetSignPeriode?.kepalaLpmNama || targetSignPeriode?.disahkanOleh || "";
  let lpmNuptk = targetSignPeriode?.kepalaLpmNip ?? "";

  if (isPrint && targetSignPeriode) {
    const [ketuaAuditeeUser, ketuaAuditorUser, lpmUser] = await Promise.all([
      targetSignPeriode.ketuaAuditeeId
        ? prisma.user.findUnique({ where: { id: targetSignPeriode.ketuaAuditeeId } })
        : targetSignPeriode.unitId
          ? prisma.user.findFirst({
              where: { role: "AUDITEE", unitId: targetSignPeriode.unitId, aktif: true },
              orderBy: { createdAt: "asc" },
            })
          : null,
      targetSignPeriode.ketuaAuditorId
        ? prisma.user.findUnique({ where: { id: targetSignPeriode.ketuaAuditorId } })
        : null,
      prisma.user.findFirst({
        where: { role: "LPM", aktif: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    if (!auditeeNama && ketuaAuditeeUser) auditeeNama = ketuaAuditeeUser.nama;
    if (!auditeeNuptk && ketuaAuditeeUser) auditeeNuptk = ketuaAuditeeUser.nimNuptk;
    if (!auditorNama && ketuaAuditorUser) auditorNama = ketuaAuditorUser.nama;
    if (!auditorNuptk && ketuaAuditorUser) auditorNuptk = ketuaAuditorUser.nimNuptk;
    if (!lpmNama && lpmUser) lpmNama = lpmUser.nama;
    if (!lpmNuptk && lpmUser) lpmNuptk = lpmUser.nimNuptk;
  }

  const signatureHtml =
    isPrint && targetSignPeriode
      ? `
      <div class="sig-wrapper">
        <div class="sig-top-row">
          <!-- KIRI: KETUA AUDITEE -->
          <div class="sig-box">
            <div class="sig-role">Pihak Terperiksa (Auditee),</div>
            <div class="sig-title">Ketua Auditee ${esc(targetSignPeriode.unit?.nama ?? "")}</div>
            <div class="sig-img-area">
              ${
                targetSignPeriode.ttdAuditee
                  ? `<img src="${targetSignPeriode.ttdAuditee}" alt="TTD Auditee" class="sig-img" />`
                  : `<div class="sig-empty">( Belum TTD )</div>`
              }
            </div>
            <div class="sig-name">${esc(auditeeNama || "........................................")}</div>
            <div class="sig-nip">NUPTK: ${esc(auditeeNuptk || "........................")}</div>
          </div>

          <!-- KANAN: KETUA AUDITOR -->
          <div class="sig-box">
            <div class="sig-role">Diperiksa &amp; Diverifikasi Oleh,</div>
            <div class="sig-title">Ketua Tim Auditor AMI</div>
            <div class="sig-img-area">
              ${
                targetSignPeriode.ttdAuditor
                  ? `<img src="${targetSignPeriode.ttdAuditor}" alt="TTD Auditor" class="sig-img" />`
                  : `<div class="sig-empty">( Belum TTD )</div>`
              }
            </div>
            <div class="sig-name">${esc(auditorNama || "........................................")}</div>
            <div class="sig-nip">NUPTK: ${esc(auditorNuptk || "........................")}</div>
          </div>
        </div>

        <!-- TENGAH AGAK BAWAH: KEPALA LPM -->
        <div class="sig-bottom-center">
          <div class="sig-box">
            <div class="sig-role">Mengetahui &amp; Mengesahkan,</div>
            <div class="sig-title">Kepala Lembaga Penjaminan Mutu (LPM) ITBMP</div>
            <div class="sig-img-area">
              ${
                targetSignPeriode.ttdLpm
                  ? `<img src="${targetSignPeriode.ttdLpm}" alt="TTD Kepala LPM" class="sig-img" />`
                  : `<div class="sig-empty">( Belum TTD )</div>`
              }
            </div>
            <div class="sig-name">${esc(lpmNama || "........................................")}</div>
            <div class="sig-nip">NUPTK: ${esc(lpmNuptk || "........................")}</div>
          </div>
        </div>
      </div>
      `
      : "";

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
          .sig-wrapper { margin-top: 28px; page-break-inside: avoid; width: 100%; }
          .sig-top-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 0 40px; }
          .sig-bottom-center { display: flex; justify-content: center; margin-top: 18px; }
          .sig-box { width: 280px; text-align: center; font-size: 10pt; }
          .sig-role { font-size: 9.5pt; color: #222; }
          .sig-title { font-weight: bold; margin-top: 2px; }
          .sig-img-area { height: 78px; display: flex; align-items: center; justify-content: center; margin: 6px 0; }
          .sig-img { max-height: 74px; max-width: 220px; object-fit: contain; }
          .sig-empty { font-size: 8.5pt; color: #888; font-style: italic; }
          .sig-name { font-weight: bold; text-decoration: underline; }
          .sig-nip { font-size: 9pt; margin-top: 2px; }
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
              <script>window.onload = function() { setTimeout(function() { window.print(); }, 350); };</script>`
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
              <th>Dokumen Bukti</th>
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
        ${signatureHtml}
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
