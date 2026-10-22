"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Klasifikasi, StatusDokumen, StatusRtl } from "@prisma/client";
import {
  BUTUH_RTL,
  KLASIFIKASI_LABEL,
  RTL_LABEL,
  STATUS_DOK_LABEL,
} from "@/lib/periode";
import { Badge, Empty } from "@/components/ui";
import {
  simpanBatchAuditDokumen,
  simpanBatchAuditLapangan,
  simpanBatchVerifikasiRtl,
} from "../actions";

export interface AuditorIndikatorItem {
  id: string;
  kode: string;
  standar: string;
  pernyataan: string;
  target: string;
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

interface AuditorDraftEntry {
  statusDokumen: StatusDokumen;
  catatanDokumen: string;
  klasifikasi: Klasifikasi;
  catatanLapangan: string;
  rekomendasi: string;
  rtlStatus: StatusRtl;
  rtlCatatanAuditor: string;
}

export default function AuditorClient({
  periodeId,
  unitId,
  mode,
  buka,
  indikator,
}: {
  periodeId: string;
  unitId: string;
  mode: string;
  buka: boolean;
  indikator: AuditorIndikatorItem[];
}) {
  const router = useRouter();
  const storageKey = `ami_auditor_draft_${periodeId}_${unitId}`;

  const buildInitialMap = (items: AuditorIndikatorItem[]) => {
    const map: Record<string, AuditorDraftEntry> = {};
    for (const ind of items) {
      map[ind.id] = {
        statusDokumen: ind.isian?.statusDokumen ?? "BELUM_DICEK",
        catatanDokumen: ind.isian?.catatanDokumen ?? "",
        klasifikasi: ind.isian?.klasifikasi ?? "MENCAPAI",
        catatanLapangan: ind.isian?.catatanLapangan ?? "",
        rekomendasi: ind.isian?.rekomendasi ?? "",
        rtlStatus: ind.isian?.rtlStatus === "TERVERIFIKASI" ? "TERVERIFIKASI" : "PROSES",
        rtlCatatanAuditor: ind.isian?.rtlCatatanAuditor ?? "",
      };
    }
    return map;
  };

  const [values, setValues] = useState<Record<string, AuditorDraftEntry>>(() =>
    buildInitialMap(indikator)
  );
  const [savedValues, setSavedValues] = useState<Record<string, AuditorDraftEntry>>(() =>
    buildInitialMap(indikator)
  );

  const [notice, setNotice] = useState<{ ok?: string; err?: string } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Pulihkan draft yang belum disimpan dari localStorage saat halaman dibuka
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, Partial<AuditorDraftEntry>>;
      setValues((prev) => {
        const next = { ...prev };
        for (const ind of indikator) {
          const d = parsed[ind.id];
          if (!d) continue;
          const cur = next[ind.id];
          if (!cur) continue;
          next[ind.id] = {
            statusDokumen: d.statusDokumen ?? cur.statusDokumen,
            catatanDokumen:
              d.catatanDokumen !== undefined && d.catatanDokumen !== ""
                ? d.catatanDokumen
                : cur.catatanDokumen,
            klasifikasi: d.klasifikasi ?? cur.klasifikasi,
            catatanLapangan:
              d.catatanLapangan !== undefined && d.catatanLapangan !== ""
                ? d.catatanLapangan
                : cur.catatanLapangan,
            rekomendasi:
              d.rekomendasi !== undefined && d.rekomendasi !== ""
                ? d.rekomendasi
                : cur.rekomendasi,
            rtlStatus: d.rtlStatus ?? cur.rtlStatus,
            rtlCatatanAuditor:
              d.rtlCatatanAuditor !== undefined && d.rtlCatatanAuditor !== ""
                ? d.rtlCatatanAuditor
                : cur.rtlCatatanAuditor,
          };
        }
        return next;
      });
    } catch {
      // Abaikan jika localStorage tidak tersedia
    }
  }, [storageKey, indikator]);

  const updateField = <K extends keyof AuditorDraftEntry>(
    indId: string,
    field: K,
    val: AuditorDraftEntry[K]
  ) => {
    setValues((prev) => {
      const current = prev[indId];
      if (!current) return prev;
      const next = {
        ...prev,
        [indId]: { ...current, [field]: val },
      };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Abaikan
      }
      return next;
    });
  };

  const isDirtyDokumen = (indId: string) => {
    const cur = values[indId];
    const sav = savedValues[indId];
    if (!cur || !sav) return false;
    return (
      cur.statusDokumen !== sav.statusDokumen ||
      cur.catatanDokumen.trim() !== sav.catatanDokumen.trim()
    );
  };

  const isDirtyLapangan = (indId: string) => {
    const cur = values[indId];
    const sav = savedValues[indId];
    if (!cur || !sav) return false;
    return (
      cur.klasifikasi !== sav.klasifikasi ||
      cur.catatanLapangan.trim() !== sav.catatanLapangan.trim() ||
      cur.rekomendasi.trim() !== sav.rekomendasi.trim()
    );
  };

  const isDirtyRtl = (indId: string) => {
    const cur = values[indId];
    const sav = savedValues[indId];
    if (!cur || !sav) return false;
    return (
      cur.rtlStatus !== sav.rtlStatus ||
      cur.rtlCatatanAuditor.trim() !== sav.rtlCatatanAuditor.trim()
    );
  };

  const isDirtyMode = (indId: string) => {
    if (mode === "dokumen") return isDirtyDokumen(indId);
    if (mode === "lapangan") return isDirtyLapangan(indId);
    return isDirtyRtl(indId);
  };

  const dirtyIds = indikator.map((i) => i.id).filter(isDirtyMode);

  const clearSavedFromStorage = (savedIds: string[]) => {
    setSavedValues((prev) => {
      const next = { ...prev };
      for (const id of savedIds) {
        if (values[id]) {
          next[id] = { ...values[id] };
        }
      }
      return next;
    });

    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, AuditorDraftEntry>;
        for (const id of savedIds) {
          delete parsed[id];
        }
        localStorage.setItem(storageKey, JSON.stringify(parsed));
      }
    } catch {
      // Abaikan
    }
  };

  const handleSaveDokumen = (targetIndikatorId?: string) => {
    setNotice(null);
    setSavingId(targetIndikatorId ?? "ALL");

    startTransition(async () => {
      const itemsToSave = indikator
        .filter((ind) => ind.id === targetIndikatorId || isDirtyDokumen(ind.id))
        .map((ind) => ({
          indikatorId: ind.id,
          statusDokumen: values[ind.id]?.statusDokumen ?? "BELUM_DICEK",
          catatanDokumen: values[ind.id]?.catatanDokumen ?? "",
        }));

      const res = await simpanBatchAuditDokumen(periodeId, unitId, itemsToSave);
      setSavingId(null);

      if (!res.ok) {
        setNotice({ err: res.error ?? "Gagal menyimpan Audit Dokumen." });
        return;
      }

      if (res.savedIds) clearSavedFromStorage(res.savedIds);
      setNotice({ ok: res.message ?? "Audit Dokumen berhasil disimpan." });
      router.refresh();
    });
  };

  const handleSaveLapangan = (targetIndikatorId?: string) => {
    setNotice(null);
    setSavingId(targetIndikatorId ?? "ALL");

    startTransition(async () => {
      const itemsToSave = indikator
        .filter((ind) => ind.id === targetIndikatorId || isDirtyLapangan(ind.id))
        .map((ind) => ({
          indikatorId: ind.id,
          klasifikasi: values[ind.id]?.klasifikasi ?? "MENCAPAI",
          catatanLapangan: values[ind.id]?.catatanLapangan ?? "",
          rekomendasi: values[ind.id]?.rekomendasi ?? "",
        }));

      const res = await simpanBatchAuditLapangan(periodeId, unitId, itemsToSave);
      setSavingId(null);

      if (!res.ok) {
        setNotice({ err: res.error ?? "Gagal menyimpan Audit Lapangan." });
        return;
      }

      if (res.savedIds) clearSavedFromStorage(res.savedIds);
      setNotice({ ok: res.message ?? "Temuan Audit Lapangan berhasil disimpan." });
      router.refresh();
    });
  };

  const handleSaveRtl = (targetIndikatorId?: string) => {
    setNotice(null);
    setSavingId(targetIndikatorId ?? "ALL");

    startTransition(async () => {
      const itemsToSave = indikator
        .filter(
          (ind) =>
            ind.isian &&
            (ind.id === targetIndikatorId || isDirtyRtl(ind.id))
        )
        .map((ind) => ({
          indikatorId: ind.id,
          isianId: ind.isian!.id,
          rtlStatus: values[ind.id]?.rtlStatus ?? "PROSES",
          rtlCatatanAuditor: values[ind.id]?.rtlCatatanAuditor ?? "",
        }));

      const res = await simpanBatchVerifikasiRtl(periodeId, itemsToSave);
      setSavingId(null);

      if (!res.ok) {
        setNotice({ err: res.error ?? "Gagal menyimpan verifikasi RTL." });
        return;
      }

      if (res.savedIds) clearSavedFromStorage(res.savedIds);
      setNotice({ ok: res.message ?? "Verifikasi RTL berhasil disimpan." });
      router.refresh();
    });
  };

  const rtlCount = indikator.filter((ind) => {
    const k = savedValues[ind.id]?.klasifikasi ?? ind.isian?.klasifikasi;
    return k && BUTUH_RTL.includes(k);
  }).length;

  return (
    <div className="space-y-4">
      {notice?.ok && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800">
          ✓ {notice.ok}
        </div>
      )}
      {notice?.err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-800">
          ⚠️ {notice.err}
        </div>
      )}

      {buka && dirtyIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs">
          <div className="font-medium text-amber-900">
            📝 Ada <strong>{dirtyIds.length} indikator</strong> yang sedang Anda isi / ubah. Ketikan Anda tersimpan otomatis sebagai draft dan tidak akan hilang.
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (mode === "dokumen") handleSaveDokumen(undefined);
              else if (mode === "lapangan") handleSaveLapangan(undefined);
              else handleSaveRtl(undefined);
            }}
            className="btn text-xs"
          >
            {isPending && savingId === "ALL"
              ? "Menyimpan..."
              : `💾 Simpan Semua Perubahan (${dirtyIds.length})`}
          </button>
        </div>
      )}

      {indikator.map((ind) => {
        const isian = ind.isian;
        const cur = values[ind.id];
        const sav = savedValues[ind.id];
        if (!cur || !sav) return null;

        const isFokus = sav.statusDokumen === "PERLU_KLARIFIKASI" || cur.statusDokumen === "PERLU_KLARIFIKASI";
        const butuhRtl = isian?.klasifikasi && BUTUH_RTL.includes(isian.klasifikasi);
        const dirty = isDirtyMode(ind.id);

        if (mode === "rtl" && !butuhRtl) {
          return null;
        }

        return (
          <div
            key={ind.id}
            className={`card space-y-3 transition ${
              mode === "lapangan" && isFokus ? "border-amber-400 bg-amber-50/30" : ""
            } ${dirty ? "ring-2 ring-amber-300" : ""}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                  {ind.kode}
                </code>
                <span className="text-sm font-bold text-slate-900">{ind.standar}</span>
                <span className="text-xs text-slate-500">• Target: {ind.target}</span>
                {dirty && <Badge tone="amber">📝 Draft Belum Disimpan</Badge>}
                {isFokus && <Badge tone="amber">🎯 Fokus Konfirmasi Audit Lapangan</Badge>}
              </div>
              <div className="flex items-center gap-2">
                {isian?.linkDrive ? (
                  <a
                    href={isian.linkDrive}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary text-xs"
                  >
                    📂 Buka Link Google Drive Bukti Auditee ↗
                  </a>
                ) : (
                  <Badge tone="red">⚠️ Auditee Belum Mengisi Link Drive</Badge>
                )}
              </div>
            </div>

            <p className="text-sm text-slate-800">{ind.pernyataan}</p>

            {/* Kotak Klaim & Link Drive Auditee */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
              <div>
                <strong>Klaim Evaluasi Diri Auditee:</strong>{" "}
                {isian?.klaim ? (
                  isian.klaim
                ) : (
                  <em className="text-slate-400">Belum diisi oleh Auditee</em>
                )}
              </div>
              <div className="truncate">
                <strong>Tautan Google Drive:</strong>{" "}
                {isian?.linkDrive ? (
                  <a
                    href={isian.linkDrive}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-blue-600 underline"
                  >
                    {isian.linkDrive}
                  </a>
                ) : (
                  <em className="text-slate-400">Belum ada link</em>
                )}
              </div>
            </div>

            {/* MODE 1: AUDIT DOKUMEN (DESK AUDIT) */}
            {mode === "dokumen" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveDokumen(ind.id);
                }}
                className="space-y-3 pt-1"
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <label>Status Kecukupan Bukti Drive (Desk Audit)</label>
                    <select
                      name="statusDokumen"
                      disabled={!buka}
                      value={cur.statusDokumen}
                      onChange={(e) =>
                        updateField(ind.id, "statusDokumen", e.target.value as StatusDokumen)
                      }
                      className="w-full"
                    >
                      <option value="BELUM_DICEK">⏳ Belum Diperiksa</option>
                      <option value="LENGKAP">✅ Bukti Drive Lengkap &amp; Sesuai</option>
                      <option value="PERLU_KLARIFIKASI">
                        🎯 Perlu Klarifikasi di Audit Lapangan
                      </option>
                    </select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label>
                      Catatan Audit Dokumen &amp; Daftar Pertanyaan untuk Audit Lapangan
                    </label>
                    <textarea
                      name="catatanDokumen"
                      rows={4}
                      disabled={!buka}
                      value={cur.catatanDokumen}
                      onChange={(e) => updateField(ind.id, "catatanDokumen", e.target.value)}
                      placeholder="Tulis hasil pemeriksaan dokumen Google Drive serta daftar pertanyaan yang akan dikonfirmasi saat Audit Lapangan..."
                      className="w-full text-sm leading-relaxed"
                    />
                    {buka && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="submit"
                          disabled={isPending}
                          className="btn shrink-0"
                        >
                          {isPending && (savingId === ind.id || savingId === "ALL")
                            ? "Menyimpan..."
                            : "Simpan Desk Audit"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </form>
            )}

            {/* MODE 2: AUDIT LAPANGAN & KLASIFIKASI TEMUAN */}
            {mode === "lapangan" && (
              <>
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs whitespace-pre-wrap">
                  <strong>
                    Catatan &amp; Daftar Pertanyaan dari Audit Dokumen (
                    {STATUS_DOK_LABEL[sav.statusDokumen]}):
                  </strong>{" "}
                  {sav.catatanDokumen || cur.catatanDokumen || "Belum ada catatan audit dokumen."}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveLapangan(ind.id);
                  }}
                  className="space-y-3 pt-1"
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="space-y-1">
                      <label>Klasifikasi Hasil / Temuan Audit</label>
                      <select
                        name="klasifikasi"
                        disabled={!buka}
                        value={cur.klasifikasi}
                        onChange={(e) =>
                          updateField(ind.id, "klasifikasi", e.target.value as Klasifikasi)
                        }
                        className="w-full font-semibold"
                      >
                        <option value="MELAMPAUI">🌟 Melampaui Standar</option>
                        <option value="MENCAPAI">✅ Mencapai Standar</option>
                        <option value="OBSERVASI">👀 Observasi (OB)</option>
                        <option value="KTS_MINOR">⚠️ KTS Minor</option>
                        <option value="KTS_MAYOR">🚨 KTS Mayor</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label>Fakta Lapangan / Akar Masalah</label>
                      <textarea
                        name="catatanLapangan"
                        rows={3}
                        disabled={!buka}
                        value={cur.catatanLapangan}
                        onChange={(e) => updateField(ind.id, "catatanLapangan", e.target.value)}
                        placeholder="Catat hasil konfirmasi wawancara/observasi lapangan..."
                        className="w-full text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label>Rekomendasi Perbaikan Auditor</label>
                      <textarea
                        name="rekomendasi"
                        rows={3}
                        disabled={!buka}
                        value={cur.rekomendasi}
                        onChange={(e) => updateField(ind.id, "rekomendasi", e.target.value)}
                        placeholder="Rekomendasi tindak lanjut perbaikan..."
                        className="w-full text-sm"
                      />
                      {buka && (
                        <div className="flex justify-end pt-1">
                          <button
                            type="submit"
                            disabled={isPending}
                            className="btn-success shrink-0"
                          >
                            {isPending && (savingId === ind.id || savingId === "ALL")
                              ? "Menyimpan..."
                              : "Simpan Temuan"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </form>
              </>
            )}

            {/* MODE 3: VERIFIKASI TINDAK LANJUT (RTL) */}
            {mode === "rtl" && isian && (
              <div className="space-y-3 pt-1">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs space-y-1">
                  <div>
                    <strong>Klasifikasi Temuan:</strong>{" "}
                    {KLASIFIKASI_LABEL[isian.klasifikasi!]} — {isian.catatanLapangan}
                  </div>
                  <div>
                    <strong>Rencana Tindak Lanjut Auditee:</strong>{" "}
                    {isian.rtlRencana ?? "Belum diisi Auditee"}
                  </div>
                  <div>
                    <strong>Link Google Drive Bukti Perbaikan:</strong>{" "}
                    {isian.rtlLinkBukti ? (
                      <a
                        href={isian.rtlLinkBukti}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-blue-600 underline"
                      >
                        {isian.rtlLinkBukti}
                      </a>
                    ) : (
                      "Belum diunggah Auditee"
                    )}
                  </div>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveRtl(ind.id);
                  }}
                  className="grid grid-cols-1 gap-3 md:grid-cols-3"
                >
                  <div className="space-y-1">
                    <label>Keputusan Verifikasi RTL ({RTL_LABEL[isian.rtlStatus]})</label>
                    <select
                      name="rtlStatus"
                      disabled={!buka}
                      value={cur.rtlStatus}
                      onChange={(e) =>
                        updateField(ind.id, "rtlStatus", e.target.value as StatusRtl)
                      }
                      className="w-full"
                    >
                      <option value="PROSES">⏳ Masih Perlu Perbaikan (Proses)</option>
                      <option value="TERVERIFIKASI">✅ Closed / Terverifikasi Selesai</option>
                    </select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label>Catatan Verifikasi RTL Auditor</label>
                    <textarea
                      name="rtlCatatanAuditor"
                      rows={3}
                      disabled={!buka}
                      value={cur.rtlCatatanAuditor}
                      onChange={(e) => updateField(ind.id, "rtlCatatanAuditor", e.target.value)}
                      placeholder="Catatan hasil pengecekan bukti perbaikan..."
                      className="w-full text-sm"
                    />
                    {buka && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="submit"
                          disabled={isPending}
                          className="btn-success shrink-0"
                        >
                          {isPending && (savingId === ind.id || savingId === "ALL")
                            ? "Menyimpan..."
                            : "Simpan Verifikasi"}
                        </button>
                      </div>
                    )}
                  </div>
                </form>
              </div>
            )}
          </div>
        );
      })}

      {mode === "rtl" && rtlCount === 0 && (
        <Empty>
          Tidak ada temuan Observasi / KTS yang memerlukan verifikasi RTL pada sesi ini.
        </Empty>
      )}
    </div>
  );
}
