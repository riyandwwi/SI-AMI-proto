"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Klasifikasi, StatusDokumen, StatusRtl } from "@prisma/client";
import { BUTUH_RTL, KLASIFIKASI_LABEL, RTL_LABEL, STATUS_DOK_LABEL } from "@/lib/periode";
import { Badge } from "@/components/ui";
import { simpanBatchIsianAuditee, simpanRtlAuditeeClient } from "./actions";

export interface AuditeeIndikatorItem {
  id: string;
  kode: string;
  standar: string;
  pernyataan: string;
  target: string;
  buktiDiminta: string | null;
  isian: {
    id: string;
    klaim: string | null;
    linkDrive: string | null;
    statusDokumen: StatusDokumen;
    catatanDokumen: string | null;
    klasifikasi: Klasifikasi | null;
    catatanLapangan: string | null;
    rekomendasi: string | null;
    rtlRencana: string | null;
    rtlLinkBukti: string | null;
    rtlStatus: StatusRtl;
    rtlCatatanAuditor: string | null;
  } | null;
}

interface DraftEntry {
  klaim: string;
  linkDrive: string;
  rtlRencana: string;
  rtlLinkBukti: string;
}

export default function AuditeeClient({
  periodeId,
  unitId,
  buka,
  indikator,
}: {
  periodeId: string;
  unitId: string;
  buka: boolean;
  indikator: AuditeeIndikatorItem[];
}) {
  const router = useRouter();
  const storageKey = `ami_auditee_draft_${periodeId}_${unitId}`;

  // Inisialisasi state dari data database
  const [values, setValues] = useState<Record<string, DraftEntry>>(() => {
    const init: Record<string, DraftEntry> = {};
    for (const ind of indikator) {
      init[ind.id] = {
        klaim: ind.isian?.klaim ?? "",
        linkDrive: ind.isian?.linkDrive ?? "",
        rtlRencana: ind.isian?.rtlRencana ?? "",
        rtlLinkBukti: ind.isian?.rtlLinkBukti ?? "",
      };
    }
    return init;
  });

  // Lacak nilai yang sudah tersimpan di server agar tahu mana yang masih berupa draft belum disimpan
  const [savedValues, setSavedValues] = useState<Record<string, { klaim: string; linkDrive: string }>>(() => {
    const init: Record<string, { klaim: string; linkDrive: string }> = {};
    for (const ind of indikator) {
      init[ind.id] = {
        klaim: ind.isian?.klaim ?? "",
        linkDrive: ind.isian?.linkDrive ?? "",
      };
    }
    return init;
  });

  const [notice, setNotice] = useState<{ ok?: string; err?: string } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Pulihkan draft yang belum disimpan dari localStorage saat halaman dibuka
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, Partial<DraftEntry>>;
      setValues((prev) => {
        const next = { ...prev };
        for (const ind of indikator) {
          const d = parsed[ind.id];
          if (!d) continue;
          const dbKlaim = ind.isian?.klaim ?? "";
          const dbLink = ind.isian?.linkDrive ?? "";
          const dbRtlRencana = ind.isian?.rtlRencana ?? "";
          const dbRtlLink = ind.isian?.rtlLinkBukti ?? "";
          next[ind.id] = {
            klaim: d.klaim !== undefined && d.klaim !== "" ? d.klaim : dbKlaim,
            linkDrive: d.linkDrive !== undefined && d.linkDrive !== "" ? d.linkDrive : dbLink,
            rtlRencana: d.rtlRencana !== undefined && d.rtlRencana !== "" ? d.rtlRencana : dbRtlRencana,
            rtlLinkBukti: d.rtlLinkBukti !== undefined && d.rtlLinkBukti !== "" ? d.rtlLinkBukti : dbRtlLink,
          };
        }
        return next;
      });
    } catch {
      // Abaikan jika localStorage tidak tersedia
    }
  }, [storageKey, indikator]);

  // Simpan draft otomatis ke localStorage setiap ada ketikan
  const updateField = (indId: string, field: keyof DraftEntry, val: string) => {
    setValues((prev) => {
      const current = prev[indId] ?? { klaim: "", linkDrive: "", rtlRencana: "", rtlLinkBukti: "" };
      const next = {
        ...prev,
        [indId]: { ...current, [field]: val },
      };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Abaikan jika gagal menyimpan ke localStorage
      }
      return next;
    });
  };

  // Cek apakah sebuah indikator memiliki perubahan yang belum disimpan ke DB
  const isDirty = (indId: string) => {
    const cur = values[indId];
    const sav = savedValues[indId];
    if (!cur || !sav) return false;
    return cur.klaim.trim() !== sav.klaim.trim() || cur.linkDrive.trim() !== sav.linkDrive.trim();
  };

  const dirtyIds = indikator.map((i) => i.id).filter(isDirty);

  // Simpan satu indikator (sekaligus indikator lain yang sudah lengkap & belum disimpan)
  const handleSaveIndikator = (targetIndikatorId?: string) => {
    setNotice(null);
    setSavingId(targetIndikatorId ?? "ALL");

    startTransition(async () => {
      // Kumpulkan indikator yang ditargetkan + semua indikator lain yang mengalami perubahan (dirty)
      const payloadItems = indikator
        .filter((ind) => ind.id === targetIndikatorId || isDirty(ind.id))
        .map((ind) => ({
          indikatorId: ind.id,
          klaim: values[ind.id]?.klaim ?? "",
          linkDrive: values[ind.id]?.linkDrive ?? "",
        }));

      const res = await simpanBatchIsianAuditee(payloadItems, targetIndikatorId);
      setSavingId(null);

      if (!res.ok) {
        setNotice({ err: res.error ?? "Gagal menyimpan data." });
        return;
      }

      // Perbarui daftar nilai yang sudah tersimpan tanpa mereset input indikator lain yang masih diketik sebagian
      if (res.savedIds && res.savedIds.length > 0) {
        setSavedValues((prev) => {
          const next = { ...prev };
          for (const id of res.savedIds!) {
            next[id] = {
              klaim: values[id]?.klaim ?? "",
              linkDrive: values[id]?.linkDrive ?? "",
            };
          }
          return next;
        });

        // Bersihkan draft localStorage hanya untuk indikator yang sudah tersimpan ke DB,
        // sedangkan indikator lain yang baru diisi sebagian tetap aman di localStorage
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw) as Record<string, DraftEntry>;
            for (const id of res.savedIds) {
              delete parsed[id];
            }
            localStorage.setItem(storageKey, JSON.stringify(parsed));
          }
        } catch {
          // Abaikan
        }
      }

      setNotice({ ok: res.message ?? "Berhasil disimpan." });
      router.refresh();
    });
  };

  const handleSaveRtl = (indId: string, isianId: string) => {
    setNotice(null);
    setSavingId(`RTL_${indId}`);

    startTransition(async () => {
      const cur = values[indId];
      const res = await simpanRtlAuditeeClient({
        isianId,
        rtlRencana: cur?.rtlRencana ?? "",
        rtlLinkBukti: cur?.rtlLinkBukti ?? "",
      });
      setSavingId(null);

      if (!res.ok) {
        setNotice({ err: res.error ?? "Gagal menyimpan RTL." });
        return;
      }

      setNotice({ ok: res.message ?? "Tindak lanjut (RTL) berhasil disimpan." });
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {notice?.ok && (
        <div className="rounded-2xl border-2 border-black bg-[#D9F99D] px-4 py-3 text-sm font-black text-black shadow-[4px_4px_0px_#000]">
          ✓ {notice.ok}
        </div>
      )}
      {notice?.err && (
        <div className="rounded-2xl border-2 border-black bg-[#FECDD3] px-4 py-3 text-sm font-black text-black shadow-[4px_4px_0px_#000]">
          ⚠️ {notice.err}
        </div>
      )}

      {buka && dirtyIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-black bg-[#FEF08A] px-4 py-3 text-xs shadow-[4px_4px_0px_#000]">
          <div className="font-black text-black">
            📝 Ada <strong>{dirtyIds.length} indikator</strong> yang sedang Anda isi / ubah. Ketikan Anda tersimpan otomatis sebagai draft dan tidak akan hilang.
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleSaveIndikator(undefined)}
            className="btn text-xs"
          >
            {isPending && savingId === "ALL" ? "Menyimpan..." : `💾 Simpan Semua yang Terisi (${dirtyIds.length})`}
          </button>
        </div>
      )}

      {indikator.map((ind) => {
        const isian = ind.isian;
        const cur = values[ind.id] ?? { klaim: "", linkDrive: "", rtlRencana: "", rtlLinkBukti: "" };
        const sav = savedValues[ind.id] ?? { klaim: "", linkDrive: "" };
        const dirty = isDirty(ind.id);
        const hasSavedDrive = Boolean(sav.linkDrive.trim());
        const perluRtl = isian?.klasifikasi && BUTUH_RTL.includes(isian.klasifikasi);

        return (
          <div
            key={ind.id}
            className={`card space-y-3 transition ${dirty ? "ring-2 ring-amber-300" : ""}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-xl border-2 border-black bg-[#BAE6FD] px-2.5 py-0.5 text-xs font-black text-black shadow-[1.5px_1.5px_0px_#000]">
                  {ind.kode}
                </code>
                <span className="text-sm font-bold text-slate-900">{ind.standar}</span>
                <span className="text-xs text-slate-500">• Target: {ind.target}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {dirty && (
                  <Badge tone="amber">📝 Draft Belum Disimpan</Badge>
                )}
                <Badge tone={hasSavedDrive ? "green" : "amber"}>
                  {hasSavedDrive ? "✓ Link Drive Tersimpan" : "⚠️ Belum Ada Link Drive"}
                </Badge>
                {isian && (
                  <Badge
                    tone={
                      isian.statusDokumen === "LENGKAP"
                        ? "green"
                        : isian.statusDokumen === "PERLU_KLARIFIKASI"
                          ? "amber"
                          : "slate"
                    }
                  >
                    Desk Audit: {STATUS_DOK_LABEL[isian.statusDokumen]}
                  </Badge>
                )}
                {isian?.klasifikasi && (
                  <Badge
                    tone={
                      isian.klasifikasi === "MELAMPAUI" || isian.klasifikasi === "MENCAPAI"
                        ? "green"
                        : isian.klasifikasi === "OBSERVASI"
                          ? "blue"
                          : isian.klasifikasi === "KTS_MINOR"
                            ? "amber"
                            : "red"
                    }
                  >
                    Hasil: {KLASIFIKASI_LABEL[isian.klasifikasi]}
                  </Badge>
                )}
              </div>
            </div>

            <p className="text-sm text-slate-800">{ind.pernyataan}</p>
            {ind.buktiDiminta && (
              <p className="text-xs text-slate-500">
                <strong>Dokumen Bukti yang Diminta di Google Drive:</strong> {ind.buktiDiminta}
              </p>
            )}

            {/* Form Evaluasi Diri & Link Google Drive */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveIndikator(ind.id);
              }}
              className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-2"
            >
              <div className="space-y-1">
                <label>Klaim Evaluasi Diri Auditee</label>
                <textarea
                  name="klaim"
                  rows={2}
                  required
                  disabled={!buka}
                  value={cur.klaim}
                  onChange={(e) => updateField(ind.id, "klaim", e.target.value)}
                  placeholder="Jelaskan pemenuhan standar di prodi Anda..."
                  className="w-full"
                />
              </div>
              <div className="space-y-1">
                <label>🔗 Tautan Bukti Google Drive (https://drive.google.com/...)</label>
                <div className="flex gap-2">
                  <input
                    name="linkDrive"
                    type="url"
                    required
                    disabled={!buka}
                    value={cur.linkDrive}
                    onChange={(e) => updateField(ind.id, "linkDrive", e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/..."
                    className="w-full font-mono text-xs"
                  />
                  {buka && (
                    <button
                      type="submit"
                      disabled={isPending}
                      className="btn shrink-0"
                    >
                      {isPending && (savingId === ind.id || savingId === "ALL")
                        ? "Menyimpan..."
                        : "Simpan"}
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-slate-500">
                    Pastikan akses folder/file Drive disetel Viewer untuk Auditor.
                  </span>
                  {(sav.linkDrive || cur.linkDrive) && (
                    <a
                      href={cur.linkDrive || sav.linkDrive}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-blue-600 hover:underline"
                    >
                      ↗ Buka Link Drive
                    </a>
                  )}
                </div>
              </div>
            </form>

            {/* Catatan Auditor (Jika sudah diperiksa) */}
            {(isian?.catatanDokumen || isian?.catatanLapangan || isian?.rekomendasi) && (
              <div className="rounded-2xl border-2 border-black bg-[#FAF7EE] p-4 text-xs space-y-1.5 shadow-[2px_2px_0px_#000]">
                {isian.catatanDokumen && (
                  <div>
                    <strong className="font-black text-black">Catatan Audit Dokumen (Auditor):</strong> {isian.catatanDokumen}
                  </div>
                )}
                {isian.catatanLapangan && (
                  <div>
                    <strong className="font-black text-black">Temuan / Catatan Audit Lapangan:</strong> {isian.catatanLapangan}
                  </div>
                )}
                {isian.rekomendasi && (
                  <div>
                    <strong className="font-black text-black">Rekomendasi Perbaikan:</strong> {isian.rekomendasi}
                  </div>
                )}
              </div>
            )}

            {/* Form Rencana Tindak Lanjut (RTL) jika terdapat temuan OB / KTS */}
            {isian && perluRtl && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveRtl(ind.id, isian.id);
                }}
                className="rounded-2xl border-2 border-black bg-[#FEF08A]/30 p-4 space-y-3 shadow-[2.5px_2.5px_0px_#000]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-900">
                    🛠️ Rencana Tindak Lanjut (RTL) atas Temuan {KLASIFIKASI_LABEL[isian.klasifikasi!]}
                  </span>
                  <Badge tone={isian.rtlStatus === "TERVERIFIKASI" ? "green" : "amber"}>
                    Status RTL: {RTL_LABEL[isian.rtlStatus]}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label>Rencana / Tindakan Perbaikan Auditee</label>
                    <input
                      name="rtlRencana"
                      required
                      disabled={!buka || isian.rtlStatus === "TERVERIFIKASI"}
                      value={cur.rtlRencana}
                      onChange={(e) => updateField(ind.id, "rtlRencana", e.target.value)}
                      placeholder="Uraikan tindakan koreksi yang dilakukan..."
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-1">
                    <label>Link Google Drive Bukti Perbaikan (RTL)</label>
                    <div className="flex gap-2">
                      <input
                        name="rtlLinkBukti"
                        type="url"
                        disabled={!buka || isian.rtlStatus === "TERVERIFIKASI"}
                        value={cur.rtlLinkBukti}
                        onChange={(e) => updateField(ind.id, "rtlLinkBukti", e.target.value)}
                        placeholder="https://drive.google.com/drive/folders/..."
                        className="w-full font-mono text-xs"
                      />
                      {buka && isian.rtlStatus !== "TERVERIFIKASI" && (
                        <button
                          type="submit"
                          disabled={isPending}
                          className="btn shrink-0 text-xs"
                        >
                          {isPending && savingId === `RTL_${ind.id}` ? "Menyimpan..." : "Simpan RTL"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {isian.rtlCatatanAuditor && (
                  <div className="text-xs text-slate-700">
                    <strong>Catatan Verifikasi RTL Auditor:</strong> {isian.rtlCatatanAuditor}
                  </div>
                )}
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
