"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import {
  simpanIdentitasPenandatanganSesi,
  simpanTtdSesi,
} from "@/app/(app)/lpm/actions";
import { pilihKetuaTrainingClient } from "@/app/(app)/admin/training/actions";

export interface LpmCandidateItem {
  id: string;
  nama: string;
  username: string;
  role?: string;
}

export interface SignatureSessionInfo {
  periodeId: string;
  periodeNama: string;
  isTraining?: boolean;
  ketuaAuditeeId: string | null;
  ketuaAuditeeNama: string | null;
  ketuaAuditeeNip: string | null;
  hasTtdAuditee: boolean;
  ttdAuditeePreview?: string | null;
  ketuaAuditorId: string | null;
  ketuaAuditorNama: string | null;
  ketuaAuditorNip: string | null;
  hasTtdAuditor: boolean;
  ttdAuditorPreview?: string | null;
  kepalaLpmNama: string | null;
  kepalaLpmNip: string | null;
  hasTtdLpm: boolean;
  ttdLpmPreview?: string | null;
}

/**
 * Mengubah file gambar tanda tangan (termasuk foto kertas putih) menjadi PNG transparan kecil (~8-15KB)
 */
async function processImageToTransparentPng(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Format gambar tidak didukung."));
      img.onload = () => {
        const maxW = 280;
        const maxH = 110;
        let w = img.width;
        let h = img.height;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.max(1, Math.round(w * ratio));
          h = Math.max(1, Math.round(h * ratio));
        }

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas tidak tersedia."));
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // Ubah piksel putih/terang kertas menjadi transparan dan pertegas tinta gelap
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a < 20) continue;
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          if (brightness > 215) {
            data[i + 3] = 0; // Transparan untuk latar kertas putih
          } else if (brightness > 180) {
            data[i + 3] = Math.round(((215 - brightness) / 35) * a);
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function SignaturePadCard({
  session,
  currentUserId,
  currentRole,
  lpmCandidates = [],
}: {
  session: SignatureSessionInfo;
  currentUserId: string;
  currentRole: "AUDITEE" | "AUDITOR" | "LPM";
  lpmCandidates?: LpmCandidateItem[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  const [activeSignRole, setActiveSignRole] = useState<"AUDITEE" | "AUDITOR" | "LPM">(currentRole);
  const [showCanvas, setShowCanvas] = useState(false);
  const [notice, setNotice] = useState<{ ok?: string; err?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // State input langsung Nama, Gelar & NUPTK 3 Penandatangan + Kota/Tanggal Cetak
  const [auditeeNamaInput, setAuditeeNamaInput] = useState(session.ketuaAuditeeNama ?? "");
  const [auditeeNipInput, setAuditeeNipInput] = useState(session.ketuaAuditeeNip ?? "");
  const [auditorNamaInput, setAuditorNamaInput] = useState(session.ketuaAuditorNama ?? "");
  const [auditorNipInput, setAuditorNipInput] = useState(session.ketuaAuditorNip ?? "");
  const [lpmNamaInput, setLpmNamaInput] = useState(session.kepalaLpmNama ?? "");
  const [lpmNipInput, setLpmNipInput] = useState(session.kepalaLpmNip ?? "");
  const [tglCetak, setTglCetak] = useState(() => {
    const d = new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return `Banyuwangi, ${d}`;
  });

  useEffect(() => {
    setAuditeeNamaInput(session.ketuaAuditeeNama ?? "");
    setAuditeeNipInput(session.ketuaAuditeeNip ?? "");
    setAuditorNamaInput(session.ketuaAuditorNama ?? "");
    setAuditorNipInput(session.ketuaAuditorNip ?? "");
    setLpmNamaInput(session.kepalaLpmNama ?? "");
    setLpmNipInput(session.kepalaLpmNip ?? "");
  }, [
    session.ketuaAuditeeNama,
    session.ketuaAuditeeNip,
    session.ketuaAuditorNama,
    session.ketuaAuditorNip,
    session.kepalaLpmNama,
    session.kepalaLpmNip,
  ]);

  const targetSignRole = session.isTraining ? activeSignRole : currentRole;

  const canSignAsAuditee =
    targetSignRole === "AUDITEE" &&
    (session.isTraining || !session.ketuaAuditeeId || session.ketuaAuditeeId === currentUserId);
  const canSignAsAuditor =
    targetSignRole === "AUDITOR" &&
    (session.isTraining || !session.ketuaAuditorId || session.ketuaAuditorId === currentUserId);
  const canSignAsLpm = targetSignRole === "LPM" && (session.isTraining || currentRole === "LPM");

  const canSign = canSignAsAuditee || canSignAsAuditor || canSignAsLpm;

  const myCurrentTtd =
    targetSignRole === "AUDITEE"
      ? session.ttdAuditeePreview
      : targetSignRole === "AUDITOR"
        ? session.ttdAuditorPreview
        : session.ttdLpmPreview;

  const myHasTtd =
    targetSignRole === "AUDITEE"
      ? session.hasTtdAuditee
      : targetSignRole === "AUDITOR"
        ? session.hasTtdAuditor
        : session.hasTtdLpm;

  const handlePilihLpm = (userId: string) => {
    if (!userId) return;
    setNotice(null);
    startTransition(async () => {
      const res = await pilihKetuaTrainingClient({
        periodeId: session.periodeId,
        tipe: "LPM",
        userId,
      });
      if (!res.ok) {
        setNotice({ err: res.error ?? "Gagal memilih Kepala LPM." });
        return;
      }
      setNotice({ ok: res.message ?? "Kepala LPM diperbarui." });
      router.refresh();
    });
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNotice(null);

    try {
      const dataUrl = await processImageToTransparentPng(file);
      startTransition(async () => {
        const res = await simpanTtdSesi(session.periodeId, targetSignRole, dataUrl);
        if (fileRef.current) fileRef.current.value = "";
        if (!res.ok) {
          setNotice({ err: res.error ?? "Gagal menempel tanda tangan." });
          return;
        }
        setNotice({ ok: res.message ?? "Tanda tangan berhasil ditempel." });
        router.refresh();
      });
    } catch (err) {
      setNotice({
        err: err instanceof Error ? err.message : "Gagal memproses gambar tanda tangan.",
      });
    }
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    isDrawingRef.current = true;
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const endDraw = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveCanvasTtd = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    setNotice(null);
    startTransition(async () => {
      const res = await simpanTtdSesi(session.periodeId, targetSignRole, dataUrl);
      if (!res.ok) {
        setNotice({ err: res.error ?? "Gagal menyimpan tanda tangan." });
        return;
      }
      setShowCanvas(false);
      setNotice({ ok: res.message ?? "Tanda tangan berhasil ditempel." });
      router.refresh();
    });
  };

  const handleDeleteTtd = () => {
    setNotice(null);
    startTransition(async () => {
      const res = await simpanTtdSesi(session.periodeId, targetSignRole, null);
      if (!res.ok) {
        setNotice({ err: res.error ?? "Gagal menghapus tanda tangan." });
        return;
      }
      setNotice({ ok: res.message ?? "Tanda tangan dihapus." });
      router.refresh();
    });
  };

  const handleSaveIdentitas = () => {
    setNotice(null);
    startTransition(async () => {
      const res = await simpanIdentitasPenandatanganSesi({
        periodeId: session.periodeId,
        ketuaAuditeeNama: auditeeNamaInput,
        ketuaAuditeeNip: auditeeNipInput,
        ketuaAuditorNama: auditorNamaInput,
        ketuaAuditorNip: auditorNipInput,
        kepalaLpmNama: lpmNamaInput,
        kepalaLpmNip: lpmNipInput,
      });
      if (!res.ok) {
        setNotice({ err: res.error ?? "Gagal menyimpan identitas penandatangan." });
        return;
      }
      setNotice({ ok: res.message ?? "Identitas penandatangan berhasil disimpan." });
      router.refresh();
    });
  };

  const selectedLpmCandidate = lpmCandidates.find(
    (c) => c.nama === session.kepalaLpmNama
  );

  const printRekapHref = `/api/rekap-excel?periodeId=${encodeURIComponent(session.periodeId)}&print=1${
    tglCetak.trim() ? `&tgl=${encodeURIComponent(tglCetak.trim())}` : ""
  }`;
  const excelRekapHref = `/api/rekap-excel?periodeId=${encodeURIComponent(session.periodeId)}${
    tglCetak.trim() ? `&tgl=${encodeURIComponent(tglCetak.trim())}` : ""
  }`;

  return (
    <div className="card space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/15 pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-black text-black">
            ✍️ Pengaturan &amp; Tanda Tangan Lembar Pengesahan ({session.periodeNama})
          </h3>
          <Badge tone="green">
            ✓ Tersimpan Permanen (Bisa TTD Digital atau Kosongkan untuk TTD Basah)
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={printRekapHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn text-xs"
          >
            🖨️ Lihat &amp; Print Lembar Pengesahan
          </a>
          <a href={excelRekapHref} className="btn-secondary text-xs">
            📥 Download Excel
          </a>
        </div>
      </div>

      {notice?.ok && (
        <div className="rounded-xl border border-black bg-[#D9F99D] px-3 py-2 text-xs font-black text-black">
          ✓ {notice.ok}
        </div>
      )}
      {notice?.err && (
        <div className="rounded-xl border border-black bg-[#FECDD3] px-3 py-2 text-xs font-black text-black">
          ⚠️ {notice.err}
        </div>
      )}

      {/* Status & Edit Cepat Nama/Gelar & NUPTK 3 Pihak (Kiri: Auditee, Kanan: Auditor, Tengah Bawah: LPM) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
        {/* 1. KETUA AUDITEE */}
        <div className="rounded-xl border border-black/20 bg-[#FAF7EE] p-3 space-y-2">
          <div className="flex items-center justify-between gap-1">
            <span className="font-black uppercase text-slate-800">1. Ketua Auditee (Kiri)</span>
            <Badge tone={session.hasTtdAuditee ? "green" : "slate"}>
              {session.hasTtdAuditee ? "✅ TTD Digital" : "📝 TTD Manual / Kosong"}
            </Badge>
          </div>
          <div className="space-y-1.5">
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-600">
                Nama &amp; Gelar Ketua Auditee
              </label>
              <input
                value={auditeeNamaInput}
                onChange={(e) => setAuditeeNamaInput(e.target.value)}
                placeholder="Nama lengkap & gelar..."
                className="w-full rounded-lg border border-black/30 bg-white px-2.5 py-1 text-xs font-bold text-black"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-600">
                NUPTK / NIP Ketua Auditee
              </label>
              <input
                value={auditeeNipInput}
                onChange={(e) => setAuditeeNipInput(e.target.value)}
                placeholder="Contoh: 198801..."
                className="w-full rounded-lg border border-black/30 bg-white px-2.5 py-1 font-mono text-xs font-bold text-black"
              />
            </div>
          </div>
          {session.ttdAuditeePreview && (
            <div className="mt-1 inline-block rounded border border-black/15 bg-white px-2 py-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={session.ttdAuditeePreview} alt="TTD Auditee" className="h-9 w-auto object-contain" />
            </div>
          )}
        </div>

        {/* 2. KETUA AUDITOR */}
        <div className="rounded-xl border border-black/20 bg-[#FAF7EE] p-3 space-y-2">
          <div className="flex items-center justify-between gap-1">
            <span className="font-black uppercase text-slate-800">2. Ketua Auditor (Kanan)</span>
            <Badge tone={session.hasTtdAuditor ? "green" : "slate"}>
              {session.hasTtdAuditor ? "✅ TTD Digital" : "📝 TTD Manual / Kosong"}
            </Badge>
          </div>
          <div className="space-y-1.5">
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-600">
                Nama &amp; Gelar Ketua Auditor
              </label>
              <input
                value={auditorNamaInput}
                onChange={(e) => setAuditorNamaInput(e.target.value)}
                placeholder="Nama lengkap & gelar..."
                className="w-full rounded-lg border border-black/30 bg-white px-2.5 py-1 text-xs font-bold text-black"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-600">
                NUPTK / NIP Ketua Auditor
              </label>
              <input
                value={auditorNipInput}
                onChange={(e) => setAuditorNipInput(e.target.value)}
                placeholder="Contoh: 198504..."
                className="w-full rounded-lg border border-black/30 bg-white px-2.5 py-1 font-mono text-xs font-bold text-black"
              />
            </div>
          </div>
          {session.ttdAuditorPreview && (
            <div className="mt-1 inline-block rounded border border-black/15 bg-white px-2 py-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={session.ttdAuditorPreview} alt="TTD Auditor" className="h-9 w-auto object-contain" />
            </div>
          )}
        </div>

        {/* 3. KEPALA LPM */}
        <div className="rounded-xl border border-black/20 bg-[#FAF7EE] p-3 space-y-2">
          <div className="flex items-center justify-between gap-1">
            <span className="font-black uppercase text-slate-800">3. Kepala LPM (Tengah Bawah)</span>
            <Badge tone={session.hasTtdLpm ? "green" : "slate"}>
              {session.hasTtdLpm ? "✅ TTD Digital" : "📝 TTD Manual / Kosong"}
            </Badge>
          </div>

          {/* Di Sesi Training: Bisa pilih LPM penandatangan Rekap langsung dari dropdown */}
          {session.isTraining && lpmCandidates.length > 0 && (
            <div className="space-y-1">
              <label className="block text-[10px] font-black uppercase text-[#581C87]">
                🏛️ Pilih Cepat dari Akun:
              </label>
              <select
                value={selectedLpmCandidate?.id ?? ""}
                disabled={isPending}
                onChange={(e) => handlePilihLpm(e.target.value)}
                className="w-full rounded-lg border border-black/40 bg-white px-2 py-1 text-xs font-bold text-black"
              >
                <option value="">
                  {session.kepalaLpmNama
                    ? `Pilih akun lain (${session.kepalaLpmNama})`
                    : "-- Pilih Akun LPM Penandatangan --"}
                </option>
                {lpmCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nama} ({c.username})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-600">
                Nama &amp; Gelar Kepala LPM
              </label>
              <input
                value={lpmNamaInput}
                onChange={(e) => setLpmNamaInput(e.target.value)}
                placeholder="Nama lengkap & gelar Kepala LPM..."
                className="w-full rounded-lg border border-black/30 bg-white px-2.5 py-1 text-xs font-bold text-black"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-600">
                NUPTK / NIP Kepala LPM
              </label>
              <input
                value={lpmNipInput}
                onChange={(e) => setLpmNipInput(e.target.value)}
                placeholder="Contoh: 197908..."
                className="w-full rounded-lg border border-black/30 bg-white px-2.5 py-1 font-mono text-xs font-bold text-black"
              />
            </div>
          </div>

          {session.ttdLpmPreview && (
            <div className="mt-1 inline-block rounded border border-black/15 bg-white px-2 py-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={session.ttdLpmPreview} alt="TTD LPM" className="h-9 w-auto object-contain" />
            </div>
          )}
        </div>
      </div>

      {/* Baris Kota & Tanggal Cetak + Tombol Simpan Nama/Gelar/NUPTK */}
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-black/20 bg-white p-3 text-xs">
        <div className="min-w-[240px] flex-1 space-y-1">
          <label className="block text-[11px] font-black uppercase text-slate-700">
            📅 Kota &amp; Tanggal Cetak di Lembar Pengesahan Rekap:
          </label>
          <input
            value={tglCetak}
            onChange={(e) => setTglCetak(e.target.value)}
            placeholder="Contoh: Banyuwangi, 2 November 2026"
            className="w-full max-w-md rounded-lg border border-black/30 bg-[#FAF7EE] px-3 py-1.5 text-xs font-bold text-black"
          />
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={handleSaveIdentitas}
          className="btn-success text-xs"
        >
          {isPending ? "Menyimpan..." : "💾 Simpan Nama, Gelar & NUPTK Penandatangan"}
        </button>
      </div>

      {/* Di Sesi Training: Bisa pilih ingin menempel TTD sebagai Peran Anda atau Kepala LPM */}
      {session.isTraining && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-black/15 bg-[#FEF9C3] px-3 py-2 text-xs">
          <span className="font-black text-black">🎓 Mode Training — Pilih Posisi TTD yang Ingin Diisi:</span>
          <button
            type="button"
            onClick={() => setActiveSignRole(currentRole)}
            className={targetSignRole === currentRole ? "btn px-2.5 py-1 text-xs" : "btn-secondary px-2.5 py-1 text-xs"}
          >
            {currentRole === "AUDITEE" ? "1. Ketua Auditee" : currentRole === "AUDITOR" ? "2. Ketua Auditor" : "3. Kepala LPM"}
          </button>
          {currentRole !== "LPM" && (
            <button
              type="button"
              onClick={() => setActiveSignRole("LPM")}
              className={targetSignRole === "LPM" ? "btn px-2.5 py-1 text-xs" : "btn-secondary px-2.5 py-1 text-xs"}
            >
              🏛️ 3. Kepala LPM ({session.kepalaLpmNama ?? "LPM"})
            </button>
          )}
        </div>
      )}

      {/* Panel Tempel TTD untuk Ketua yang Sedang Login */}
      {canSign ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/15 bg-[#FAF7EE] p-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {myCurrentTtd && (
              <div className="rounded-lg border border-black/20 bg-white px-2 py-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={myCurrentTtd}
                  alt="TTD"
                  className="h-10 w-auto object-contain"
                />
              </div>
            )}
            <div>
              <div className="font-black text-black">
                Tempel Tanda Tangan ({targetSignRole === "AUDITEE" ? "Ketua Auditee" : targetSignRole === "AUDITOR" ? "Ketua Auditor" : `Kepala LPM — ${session.kepalaLpmNama ?? "LPM"}`}):
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={isPending}
                onChange={handleUploadFile}
                className="mt-1 text-xs file:mr-2 file:rounded-lg file:border file:border-black file:bg-[#FEF08A] file:px-2.5 file:py-1 file:text-xs file:font-black"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => setShowCanvas((v) => !v)}
              className="btn-secondary text-xs"
            >
              {showCanvas ? "Tutup Papan TTD" : "✍️ Coret TTD di Layar"}
            </button>
            {myHasTtd && (
              <button
                type="button"
                disabled={isPending}
                onClick={handleDeleteTtd}
                className="btn-danger text-xs"
              >
                🗑️ Hapus TTD
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="text-xs font-bold text-slate-700">
          ℹ️ Penempelan TTD {targetSignRole === "AUDITEE" ? "Auditee" : "Auditor"} pada sesi ini diwakili oleh Ketua yang ditunjuk LPM (
          {targetSignRole === "AUDITEE" ? session.ketuaAuditeeNama : session.ketuaAuditorNama}).
        </div>
      )}

      {showCanvas && canSign && (
        <div className="space-y-2 rounded-xl border border-black/20 bg-white p-3">
          <div className="text-xs font-black text-black">
            Coret tanda tangan di kotak bawah ini:
          </div>
          <canvas
            ref={canvasRef}
            width={280}
            height={110}
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
            className="touch-none rounded-xl border-2 border-dashed border-black/40 bg-[#FAF7EE] cursor-crosshair"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={clearCanvas}
              className="btn-secondary text-xs"
            >
              Bersihkan
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={saveCanvasTtd}
              className="btn-success text-xs"
            >
              ✅ Tempel TTD ke Laporan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
