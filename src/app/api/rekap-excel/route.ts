import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  KLASIFIKASI_LABEL,
  RTL_LABEL,
  STATUS_DOK_LABEL,
  groupIndikatorByStandar,
  sortPeriodesChronological,
} from "@/lib/periode";
import { fmtWaktu } from "@/lib/format";
import { cleanupExpiredSignatures } from "@/lib/ttd-cleanup";

function esc(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(req: NextRequest) {
  const user = await requireUser("LPM", "SUPER_ADMIN", "AUDITOR", "AUDITEE");
  await cleanupExpiredSignatures();

  const periodeId = req.nextUrl.searchParams.get("periodeId");
  const isPrint = req.nextUrl.searchParams.get("print") === "1";
  const tglParam = req.nextUrl.searchParams.get("tgl")?.trim() ?? "";

  const rawPeriodes = await prisma.periode.findMany({
    where: user.isTraining
      ? { id: user.trainingPeriodeId ?? "__NONE__", isTraining: true }
      : periodeId
        ? { id: periodeId }
        : undefined,
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
    const groups = groupIndikatorByStandar(p.indikator);
    for (const grp of groups) {
      rowsHtml += `
        <tr style="background-color:#E0F2FE; font-weight:bold;">
          <td colspan="25" style="padding:6px 8px; border:1px solid #000000;">
            📂 STANDAR SPMI: ${esc(grp.standar)} — Indikator ${grp.startIndex} s/d ${grp.endIndex} (${grp.items.length} Indikator) | ${esc(p.nama)} (${esc(p.unit?.nama ?? "-")})
          </td>
        </tr>
      `;
      for (const { item: ind } of grp.items) {
        const isian = ind.isian.find((i) => !p.unitId || i.unitId === p.unitId) ?? ind.isian[0];
        const namaLpmRow = p.kepalaLpmNama || p.disahkanOleh || "LPM";
        const statusSah = p.disahkanAt
          ? `Disahkan oleh ${namaLpmRow} (${fmtWaktu(p.disahkanAt)})`
          : p.kepalaLpmNama
            ? `Kepala LPM: ${p.kepalaLpmNama}`
            : "Belum Disahkan";

        rowsHtml += `
          <tr>
            <td style="text-align:center;">${no++}</td>
            <td><b>${esc(ind.standar)}</b></td>
            <td>${esc(ind.pernyataanStandar ?? "-")}</td>
            <td><b>${esc(ind.kode)}</b></td>
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
            <td>${esc(p.nama)}</td>
            <td>${esc(p.tahun)}</td>
            <td>${esc(p.semester)}</td>
            <td>${esc(p.unit?.nama ?? "-")}</td>
            <td>${esc(statusSah)}</td>
          </tr>
        `;
      }
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

  if (targetSignPeriode) {
    const [ketuaAuditeeUser, ketuaAuditorUser, lpmUser, chosenLpmUser] = await Promise.all([
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
      lpmNama
        ? prisma.user.findFirst({
            where: { nama: lpmNama },
          })
        : null,
    ]);

    if (!auditeeNama && ketuaAuditeeUser) auditeeNama = ketuaAuditeeUser.nama;
    if (!auditeeNuptk && ketuaAuditeeUser) auditeeNuptk = ketuaAuditeeUser.nimNuptk;
    if (!auditorNama && ketuaAuditorUser) auditorNama = ketuaAuditorUser.nama;
    if (!auditorNuptk && ketuaAuditorUser) auditorNuptk = ketuaAuditorUser.nimNuptk;
    if (lpmNama) {
      if (!lpmNuptk && chosenLpmUser) lpmNuptk = chosenLpmUser.nimNuptk;
    } else if (lpmUser) {
      lpmNama = lpmUser.nama;
      if (!lpmNuptk) lpmNuptk = lpmUser.nimNuptk;
    }
  }

  const tanggalCetakDisplay =
    tglParam ||
    `Banyuwangi, ${new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`;

  const sigSlotControls = (slot: "auditee" | "auditor" | "lpm", label: string) =>
    isPrint
      ? `<div class="sig-actions no-print">
          <label class="sig-mini-btn">📁 Upload TTD<input type="file" accept="image/*" style="display:none" onchange="uploadSigImage(event, '${slot}')" /></label>
          <button type="button" class="sig-mini-btn" onclick="openSigPad('${slot}', '${label}')">✍️ Gambar</button>
          <button type="button" class="sig-mini-btn sig-mini-del" onclick="clearSigSlot('${slot}')" title="Hapus TTD">✕</button>
        </div>`
      : "";

  const editableAttr = isPrint ? ' contenteditable="true" title="Klik untuk langsung mengubah teks"' : "";

  const signatureHtml =
    targetSignPeriode
      ? `
      <div class="sig-wrapper">
        <div id="sig-date-row" class="sig-date-row"${isPrint ? ' contenteditable="true" title="Klik untuk langsung ubah tempat &amp; tanggal"' : ""}>${esc(tanggalCetakDisplay)}</div>
        <div class="sig-top-row">
          <!-- KIRI: KETUA AUDITEE -->
          <div class="sig-box">
            <div class="sig-role">Pihak Terperiksa (Auditee),</div>
            <div class="sig-title">Ketua Auditee ${esc(targetSignPeriode.unit?.nama ?? "")}</div>
            <div id="sig-area-auditee" class="sig-img-area">
              ${
                targetSignPeriode.ttdAuditee
                  ? `<img src="${targetSignPeriode.ttdAuditee}" alt="TTD Auditee" class="sig-img" />`
                  : ""
              }
            </div>
            ${sigSlotControls("auditee", "Ketua Auditee")}
            <div class="sig-name"${editableAttr}>${esc(auditeeNama || "........................................")}</div>
            <div class="sig-nip"${editableAttr}>NUPTK: ${esc(auditeeNuptk || "........................")}</div>
          </div>

          <!-- KANAN: KETUA AUDITOR -->
          <div class="sig-box">
            <div class="sig-role">Diperiksa &amp; Diverifikasi Oleh,</div>
            <div class="sig-title">Ketua Tim Auditor AMI</div>
            <div id="sig-area-auditor" class="sig-img-area">
              ${
                targetSignPeriode.ttdAuditor
                  ? `<img src="${targetSignPeriode.ttdAuditor}" alt="TTD Auditor" class="sig-img" />`
                  : ""
              }
            </div>
            ${sigSlotControls("auditor", "Ketua Tim Auditor AMI")}
            <div class="sig-name"${editableAttr}>${esc(auditorNama || "........................................")}</div>
            <div class="sig-nip"${editableAttr}>NUPTK: ${esc(auditorNuptk || "........................")}</div>
          </div>
        </div>

        <!-- TENGAH AGAK BAWAH: KEPALA LPM -->
        <div class="sig-bottom-center">
          <div class="sig-box">
            <div class="sig-role">Mengetahui &amp; Mengesahkan,</div>
            <div class="sig-title">Kepala Lembaga Penjaminan Mutu (LPM) ITBMP</div>
            <div id="sig-area-lpm" class="sig-img-area">
              ${
                targetSignPeriode.ttdLpm
                  ? `<img src="${targetSignPeriode.ttdLpm}" alt="TTD Kepala LPM" class="sig-img" />`
                  : ""
              }
            </div>
            ${sigSlotControls("lpm", "Kepala LPM ITBMP")}
            <div class="sig-name"${editableAttr}>${esc(lpmNama || "........................................")}</div>
            <div class="sig-nip"${editableAttr}>NUPTK: ${esc(lpmNuptk || "........................")}</div>
          </div>
        </div>
      </div>
      `
      : "";

  const excelQuery = new URLSearchParams();
  if (periodeId) excelQuery.set("periodeId", periodeId);
  if (tglParam) excelQuery.set("tgl", tglParam);
  const excelHref = `/api/rekap-excel${excelQuery.toString() ? `?${excelQuery.toString()}` : ""}`;

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
          .toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; align-items: center; background: #FAF7EE; border: 2px solid #000; padding: 10px 12px; border-radius: 12px; }
          .date-edit-box { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 260px; }
          .date-edit-box label { font-weight: bold; font-size: 9.5pt; white-space: nowrap; }
          .date-edit-box input { flex: 1; min-width: 200px; padding: 7px 10px; border: 2px solid #000; border-radius: 8px; font-size: 10pt; font-weight: bold; background: #fff; color: #000; }
          .btn-print { background: #FF5C38; color: #fff; border: 2px solid #000; padding: 8px 14px; border-radius: 8px; font-weight: bold; cursor: pointer; text-decoration: none; font-size: 10pt; box-shadow: 2px 2px 0 #000; }
          .btn-excel { background: #D9F99D; color: #000; border: 2px solid #000; padding: 8px 14px; border-radius: 8px; font-weight: bold; cursor: pointer; text-decoration: none; font-size: 10pt; box-shadow: 2px 2px 0 #000; }
          table { width: 100%; border-collapse: collapse; font-size: 9pt; }
          th { background-color: #FEF08A; color: #000000; font-weight: bold; border: 1px solid #000000; padding: 6px; text-align: left; }
          td { border: 1px solid #000000; padding: 5px; vertical-align: top; word-break: break-word; }
          .sig-wrapper { margin-top: 28px; page-break-inside: avoid; width: 100%; }
          .sig-date-row { text-align: right; padding: 0 50px 10px 50px; font-size: 10pt; font-weight: bold; }
          .sig-date-row[contenteditable="true"]:hover { background: #FEF9C3; cursor: text; border-radius: 6px; }
          .sig-date-row[contenteditable="true"]:focus { outline: 2px dashed #2563EB; background: #FEF9C3; border-radius: 6px; }
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
          .sig-name[contenteditable="true"]:hover, .sig-nip[contenteditable="true"]:hover { background: #FEF9C3; cursor: text; border-radius: 4px; }
          .sig-name[contenteditable="true"]:focus, .sig-nip[contenteditable="true"]:focus { outline: 2px dashed #2563EB; background: #FEF9C3; border-radius: 4px; }
          .sig-actions { display: flex; justify-content: center; gap: 5px; margin-bottom: 6px; }
          .sig-mini-btn { display: inline-flex; align-items: center; gap: 3px; background: #fff; color: #000; border: 1.5px solid #000; border-radius: 6px; padding: 3px 7px; font-size: 8pt; font-weight: bold; cursor: pointer; }
          .sig-mini-btn:hover { background: #FEF08A; }
          .sig-mini-del { background: #FEE2E2; color: #991B1B; }
          .sig-mini-del:hover { background: #FCA5A5; }
          .sig-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: none; align-items: center; justify-content: center; z-index: 9999; padding: 16px; }
          .sig-modal-backdrop.open { display: flex; }
          .sig-modal-card { background: #fff; border: 2px solid #000; border-radius: 14px; box-shadow: 4px 4px 0 #000; width: 100%; max-width: 480px; padding: 16px; }
          .sig-modal-title { font-weight: bold; font-size: 11pt; margin-bottom: 10px; }
          .sig-canvas { width: 100%; height: 200px; border: 2px dashed #64748B; border-radius: 10px; background: #FAFAFA; touch-action: none; cursor: crosshair; display: block; }
          .sig-modal-btns { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
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
                <div class="date-edit-box">
                  <label for="input-tgl-cetak">📍 Tempat &amp; Tanggal:</label>
                  <input id="input-tgl-cetak" type="text" value="${esc(tanggalCetakDisplay)}" placeholder="Contoh: Banyuwangi, 27 November 2026" />
                </div>
                <button type="button" class="btn-print" onclick="window.print()">🖨️ Print / Simpan PDF</button>
                <a id="btn-download-excel" class="btn-excel" href="${excelHref}">📥 Download Excel (.xls)</a>
              </div>`
            : ""
        }
        <h2>REKAPITULASI HASIL AUDIT MUTU INTERNAL (SI-AMI ITBMP)</h2>
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Standar SPMI</th>
              <th>Isi Pernyataan Standar</th>
              <th>Kode Indikator (IK)</th>
              <th>Indikator Kinerja</th>
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
              <th>Sesi AMI</th>
              <th>Tahun Akademik</th>
              <th>Semester</th>
              <th>Program Studi</th>
              <th>Status Pengesahan LPM</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        ${signatureHtml}
        ${
          isPrint
            ? `
        <div id="sig-modal" class="sig-modal-backdrop no-print" onclick="if(event.target===this) closeSigPad()">
          <div class="sig-modal-card">
            <div id="sig-modal-title" class="sig-modal-title">✍️ Gambar Tanda Tangan</div>
            <canvas id="sig-canvas" class="sig-canvas" width="440" height="200"></canvas>
            <div class="sig-modal-btns">
              <button type="button" class="sig-mini-btn" onclick="clearSigCanvas()">🧹 Bersihkan</button>
              <button type="button" class="sig-mini-btn" onclick="closeSigPad()">Batal</button>
              <button type="button" class="btn-print" style="padding:5px 12px;font-size:9pt;" onclick="applySigCanvas()">✅ Pasang TTD</button>
            </div>
          </div>
        </div>
        <script>
          (function() {
            var inputEl = document.getElementById("input-tgl-cetak");
            var dateRowEl = document.getElementById("sig-date-row");
            var excelBtn = document.getElementById("btn-download-excel");
            var periodeId = ${JSON.stringify(periodeId ?? "")};

            function updateExcelHref(val) {
              if (!excelBtn) return;
              var params = new URLSearchParams();
              if (periodeId) params.set("periodeId", periodeId);
              if (val && val.trim()) params.set("tgl", val.trim());
              var qs = params.toString();
              excelBtn.setAttribute("href", "/api/rekap-excel" + (qs ? "?" + qs : ""));
            }

            if (inputEl) {
              inputEl.addEventListener("input", function() {
                var v = inputEl.value;
                if (dateRowEl) dateRowEl.textContent = v;
                updateExcelHref(v);
              });
            }

            if (dateRowEl) {
              dateRowEl.addEventListener("input", function() {
                var v = dateRowEl.textContent || "";
                if (inputEl) inputEl.value = v;
                updateExcelHref(v);
              });
            }

            // === Upload & Gambar Tanda Tangan Langsung di Halaman Cetak ===
            var activeSlot = null;
            var modal = document.getElementById("sig-modal");
            var modalTitle = document.getElementById("sig-modal-title");
            var canvas = document.getElementById("sig-canvas");
            var ctx = canvas ? canvas.getContext("2d") : null;
            var drawing = false;
            var hasStroke = false;

            function setSlotImage(slot, dataUrl) {
              var area = document.getElementById("sig-area-" + slot);
              if (!area) return;
              area.innerHTML = dataUrl ? '<img src="' + dataUrl + '" alt="TTD" class="sig-img" />' : "";
            }

            window.uploadSigImage = function(ev, slot) {
              var file = ev.target && ev.target.files ? ev.target.files[0] : null;
              if (!file) return;
              var reader = new FileReader();
              reader.onload = function(e) {
                if (e.target && typeof e.target.result === "string") {
                  setSlotImage(slot, e.target.result);
                }
              };
              reader.readAsDataURL(file);
              ev.target.value = "";
            };

            window.clearSigSlot = function(slot) {
              setSlotImage(slot, "");
            };

            window.clearSigCanvas = function() {
              if (!ctx || !canvas) return;
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              hasStroke = false;
            };

            window.openSigPad = function(slot, label) {
              activeSlot = slot;
              if (modalTitle) modalTitle.textContent = "✍️ Gambar Tanda Tangan — " + label;
              window.clearSigCanvas();
              if (modal) modal.classList.add("open");
            };

            window.closeSigPad = function() {
              if (modal) modal.classList.remove("open");
              activeSlot = null;
            };

            window.applySigCanvas = function() {
              if (!activeSlot || !canvas) return;
              if (hasStroke) {
                setSlotImage(activeSlot, canvas.toDataURL("image/png"));
              }
              window.closeSigPad();
            };

            if (canvas && ctx) {
              ctx.lineWidth = 2.6;
              ctx.lineCap = "round";
              ctx.lineJoin = "round";
              ctx.strokeStyle = "#0F172A";

              function getPos(e) {
                var rect = canvas.getBoundingClientRect();
                var scaleX = canvas.width / rect.width;
                var scaleY = canvas.height / rect.height;
                return {
                  x: (e.clientX - rect.left) * scaleX,
                  y: (e.clientY - rect.top) * scaleY
                };
              }

              canvas.addEventListener("pointerdown", function(e) {
                drawing = true;
                hasStroke = true;
                canvas.setPointerCapture(e.pointerId);
                var p = getPos(e);
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
              });

              canvas.addEventListener("pointermove", function(e) {
                if (!drawing) return;
                var p = getPos(e);
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
              });

              canvas.addEventListener("pointerup", function() {
                drawing = false;
              });

              canvas.addEventListener("pointercancel", function() {
                drawing = false;
              });
            }
          })();
        </script>
        `
            : ""
        }
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
