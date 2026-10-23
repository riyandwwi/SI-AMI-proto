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
  toggleVerifikasiAuditor,
  toggleVerifikasiLapangan,
  toggleVerifikasiRtl,
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
    diisiOleh: string | null;
    statusDokumen: StatusDokumen;
    catatanDokumen: string | null;
    klasifikasi: Klasifikasi | null;
    catatanLapangan: string | null;
    rekomendasi: string | null;
    diperiksaOleh: string | null;
    terverifikasiAuditor: boolean;
    terverifikasiLapangan: boolean;
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
  const [verifiedMap, setVerifiedMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const ind of indikator) {
      m[ind.id] = Boolean(ind.isian?.terverifikasiAuditor);
    }
    return m;
  });
  const [verifiedLapanganMap, setVerifiedLapanganMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const ind of indikator) {
      m[ind.id] = Boolean(ind.isian?.terverifikasiLapangan);
    }
    return m;
  });
  const [verifiedRtlMap, setVerifiedRtlMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const ind of indikator) {
      m[ind.id] = ind.isian?.rtlStatus === "TERVERIFIKASI";
    }
    return m;
  });

  const [notice, setNotice] = useState<{ ok?: string; err?: string } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
      // Abaikan
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
    if (mode === "rtl") return isDirtyRtl(indId);
    return false;
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

  const handleSaveDokumen = (targetIndikatorId?: string, lockDokumen?: boolean) => {
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

      const res = await simpanBatchAuditDokumen(periodeId, unitId, itemsToSave, lockDokumen);
      setSavingId(null);

      if (!res.ok) {
        setNotice({ err: res.error ?? "Gagal menyimpan." });
        return;
      }

      if (res.savedIds) {
        clearSavedFromStorage(res.savedIds);
        if (lockDokumen !== undefined) {
          setVerifiedMap((prev) => {
            const next = { ...prev };
            for (const id of res.savedIds!) next[id] = lockDokumen;
            return next;
          });
        }
      }
      setNotice({ ok: res.message ?? "Tersimpan." });
      router.refresh();
    });
  };

  const handleSaveLapangan = (targetIndikatorId?: string, lockLapangan?: boolean) => {
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

      const res = await simpanBatchAuditLapangan(periodeId, unitId, itemsToSave, lockLapangan);
      setSavingId(null);

      if (!res.ok) {
        setNotice({ err: res.error ?? "Gagal menyimpan." });
        return;
      }

      if (res.savedIds) {
        clearSavedFromStorage(res.savedIds);
        if (lockLapangan !== undefined) {
          setVerifiedLapanganMap((prev) => {
            const next = { ...prev };
            for (const id of res.savedIds!) next[id] = lockLapangan;
            return next;
          });
          if (lockLapangan) {
            setVerifiedMap((prev) => {
              const next = { ...prev };
              for (const id of res.savedIds!) next[id] = true;
              return next;
            });
          }
        }
      }
      setNotice({ ok: res.message ?? "Tersimpan." });
      router.refresh();
    });
  };

  const handleSaveRtl = (targetIndikatorId?: string, forceVerifyLock?: boolean) => {
    setNotice(null);
    setSavingId(targetIndikatorId ?? "ALL");

    startTransition(async () => {
      const itemsToSave = indikator
        .filter((ind) => ind.isian && (ind.id === targetIndikatorId || isDirtyRtl(ind.id)))
        .map((ind) => ({
          indikatorId: ind.id,
          isianId: ind.isian!.id,
          rtlStatus: forceVerifyLock
            ? ("TERVERIFIKASI" as StatusRtl)
            : (values[ind.id]?.rtlStatus ?? "PROSES"),
          rtlCatatanAuditor: values[ind.id]?.rtlCatatanAuditor ?? "",
        }));

      const res = await simpanBatchVerifikasiRtl(periodeId, itemsToSave);
      setSavingId(null);

      if (!res.ok) {
        setNotice({ err: res.error ?? "Gagal menyimpan." });
        return;
      }

      if (res.savedIds) {
        clearSavedFromStorage(res.savedIds);
        if (forceVerifyLock) {
          setVerifiedRtlMap((prev) => {
            const next = { ...prev };
            for (const id of res.savedIds!) next[id] = true;
            return next;
          });
          for (const id of res.savedIds) {
            updateField(id, "rtlStatus", "TERVERIFIKASI");
          }
        }
      }
      setNotice({ ok: res.message ?? "Tersimpan." });
      router.refresh();
    });
  };

  const handleToggleLock = (targetIds: string[], lock: boolean) => {
    setNotice(null);
    setSavingId("LOCK");

    startTransition(async () => {
      const res = await toggleVerifikasiAuditor(periodeId, unitId, targetIds, lock);
      setSavingId(null);

      if (!res.ok) {
        setNotice({ err: res.error ?? "Gagal mengubah status kunci dokumen." });
        return;
      }

      setVerifiedMap((prev) => {
        const next = { ...prev };
        for (const id of targetIds) {
          next[id] = lock;
        }
        return next;
      });

      setNotice({ ok: res.message ?? "Status kunci dokumen diperbarui." });
      router.refresh();
    });
  };

  const handleToggleLockLapangan = (targetIds: string[], lock: boolean) => {
    setNotice(null);
    setSavingId("LOCK_LAPANGAN");

    startTransition(async () => {
      const res = await toggleVerifikasiLapangan(periodeId, unitId, targetIds, lock);
      setSavingId(null);

      if (!res.ok) {
        setNotice({ err: res.error ?? "Gagal mengubah status verifikasi lapangan." });
        return;
      }

      setVerifiedLapanganMap((prev) => {
        const next = { ...prev };
        for (const id of targetIds) next[id] = lock;
        return next;
      });
      if (lock) {
        setVerifiedMap((prev) => {
          const next = { ...prev };
          for (const id of targetIds) next[id] = true;
          return next;
        });
      }

      setNotice({ ok: res.message ?? "Status verifikasi lapangan diperbarui." });
      router.refresh();
    });
  };

  const handleToggleLockRtl = (targetIds: string[], lock: boolean) => {
    setNotice(null);
    setSavingId("LOCK_RTL");

    startTransition(async () => {
      const res = await toggleVerifikasiRtl(periodeId, unitId, targetIds, lock);
      setSavingId(null);

      if (!res.ok) {
        setNotice({ err: res.error ?? "Gagal mengubah status verifikasi RTL." });
        return;
      }

      setVerifiedRtlMap((prev) => {
        const next = { ...prev };
        for (const id of targetIds) next[id] = lock;
        return next;
      });
      for (const id of targetIds) {
        updateField(id, "rtlStatus", lock ? "TERVERIFIKASI" : "PROSES");
      }

      setNotice({ ok: res.message ?? "Status verifikasi RTL diperbarui." });
      router.refresh();
    });
  };

  const rtlCount = indikator.filter((ind) => {
    const k = savedValues[ind.id]?.klasifikasi ?? ind.isian?.klasifikasi;
    return k && BUTUH_RTL.includes(k);
  }).length;

  // Ringkasan siapa Auditee dan siapa Auditor yang sudah mengerjakan
  const auditeeKontrib = new Map<string, string[]>();
  const auditorKontrib = new Map<string, string[]>();
  for (const ind of indikator) {
    if (ind.isian?.diisiOleh) {
      const list = auditeeKontrib.get(ind.isian.diisiOleh) ?? [];
      list.push(ind.kode);
      auditeeKontrib.set(ind.isian.diisiOleh, list);
    }
    if (ind.isian?.diperiksaOleh) {
      const list = auditorKontrib.get(ind.isian.diperiksaOleh) ?? [];
      list.push(ind.kode);
      auditorKontrib.set(ind.isian.diperiksaOleh, list);
    }
  }

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

      {/* Bar Verifikasi & Kunci Semua + Ringkasan Siapa yang Menyimpan */}
      <div className="card flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {auditeeKontrib.size > 0 && (
            <>
              <span className="font-black uppercase text-black">Auditee:</span>
              {Array.from(auditeeKontrib.entries()).map(([nama, kodes]) => (
                <Badge key={nama} tone="blue">
                  👤 {nama}: {kodes.join(", ")}
                </Badge>
              ))}
            </>
          )}
          {auditorKontrib.size > 0 && (
            <>
              <span className="ml-2 font-black uppercase text-black">Auditor:</span>
              {Array.from(auditorKontrib.entries()).map(([nama, kodes]) => (
                <Badge key={nama} tone="purple">
                  🕵️ {nama}: {kodes.join(", ")}
                </Badge>
              ))}
            </>
          )}
        </div>

        {buka && mode === "dokumen" && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleToggleLock(indikator.map((i) => i.id), true)}
              className="btn text-xs"
            >
              🔒 Kunci Semua Dokumen (Tutup Upload Dosen)
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleToggleLock(indikator.map((i) => i.id), false)}
              className="btn-secondary text-xs"
            >
              🔓 Buka Kunci Dokumen
            </button>
          </div>
        )}

        {buka && mode === "lapangan" && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleToggleLockLapangan(indikator.map((i) => i.id), true)}
              className="btn text-xs"
            >
              🔒 Verifikasi &amp; Kunci Semua Lapangan
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleToggleLockLapangan(indikator.map((i) => i.id), false)}
              className="btn-secondary text-xs"
            >
              🔓 Buka Kunci Lapangan
            </button>
          </div>
        )}

        {buka && mode === "rtl" && rtlCount > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                handleToggleLockRtl(
                  indikator
                    .filter((ind) => ind.isian?.klasifikasi && BUTUH_RTL.includes(ind.isian.klasifikasi))
                    .map((i) => i.id),
                  true
                )
              }
              className="btn text-xs"
            >
              🔒 Verifikasi &amp; Kunci Semua RTL
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                handleToggleLockRtl(
                  indikator
                    .filter((ind) => ind.isian?.klasifikasi && BUTUH_RTL.includes(ind.isian.klasifikasi))
                    .map((i) => i.id),
                  false
                )
              }
              className="btn-secondary text-xs"
            >
              🔓 Buka Kunci RTL
            </button>
          </div>
        )}
      </div>

      {buka && dirtyIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-black bg-[#FEF08A] px-4 py-3 text-xs shadow-[4px_4px_0px_#000]">
          <div className="font-black text-black">
            📝 {dirtyIds.length} indikator belum disimpan
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
              ? "..."
              : `💾 Simpan Semua (${dirtyIds.length})`}
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
        const isVerifiedDokumen = Boolean(verifiedMap[ind.id]);
        const isVerifiedLapangan = Boolean(verifiedLapanganMap[ind.id]);
        const isVerifiedRtl = Boolean(verifiedRtlMap[ind.id]) || cur.rtlStatus === "TERVERIFIKASI";

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
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/15 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-xl border border-black/30 bg-[#BAE6FD] px-2.5 py-0.5 text-xs font-black text-black">
                  {ind.kode}
                </code>
                <span className="text-sm font-black text-black">{ind.standar}</span>
                <Badge tone="slate">Target: {ind.target}</Badge>
                {isian?.diisiOleh && <Badge tone="blue">👤 {isian.diisiOleh}</Badge>}
                {isian?.diperiksaOleh && <Badge tone="purple">🕵️ {isian.diperiksaOleh}</Badge>}
                {dirty && <Badge tone="amber">📝 Belum Disimpan</Badge>}
                {isFokus && <Badge tone="amber">🎯 Fokus Lapangan</Badge>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {buka && mode === "dokumen" && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleToggleLock([ind.id], !isVerifiedDokumen)}
                    className={isVerifiedDokumen ? "btn-purple text-xs" : "btn-secondary text-xs"}
                  >
                    {isVerifiedDokumen
                      ? "🔒 Dokumen Terkunci (Buka Kunci)"
                      : "🔒 Kunci Upload Dosen"}
                  </button>
                )}
                {buka && mode === "lapangan" && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleToggleLockLapangan([ind.id], !isVerifiedLapangan)}
                    className={isVerifiedLapangan ? "btn-purple text-xs" : "btn-secondary text-xs"}
                  >
                    {isVerifiedLapangan
                      ? "🔒 Lapangan Terkunci (Buka Kunci)"
                      : "🔒 Kunci Lapangan"}
                  </button>
                )}
                {buka && mode === "rtl" && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleToggleLockRtl([ind.id], !isVerifiedRtl)}
                    className={isVerifiedRtl ? "btn-purple text-xs" : "btn-secondary text-xs"}
                  >
                    {isVerifiedRtl ? "🔒 RTL Terkunci (Buka Kunci)" : "🔒 Kunci RTL"}
                  </button>
                )}
                {isian?.linkDrive ? (
                  <a
                    href={isian.linkDrive}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary text-xs"
                  >
                    📂 Buka Drive ↗
                  </a>
                ) : (
                  <Badge tone="red">Belum Ada Drive</Badge>
                )}
              </div>
            </div>

            <p className="text-sm font-semibold text-slate-900">{ind.pernyataan}</p>

            {/* Kotak Klaim & Link Drive Auditee */}
            <div className="rounded-2xl border border-black/15 bg-[#FAF7EE] p-3.5 text-xs space-y-1">
              <div>
                <strong>Evaluasi Diri Auditee{isian?.diisiOleh ? ` (${isian.diisiOleh})` : ""}:</strong>{" "}
                {isian?.klaim ? (
                  isian.klaim
                ) : (
                  <em className="text-slate-400">Belum diisi</em>
                )}
              </div>
              {isian?.linkDrive && (
                <div className="truncate">
                  <strong>Drive:</strong>{" "}
                  <a
                    href={isian.linkDrive}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-blue-700 underline"
                  >
                    {isian.linkDrive}
                  </a>
                </div>
              )}
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
                    <label>Status Dokumen</label>
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
                      <option value="LENGKAP">✅ Lengkap &amp; Sesuai</option>
                      <option value="PERLU_KLARIFIKASI">
                        🎯 Perlu Klarifikasi Lapangan
                      </option>
                    </select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label>
                      Catatan Audit Dokumen &amp; Daftar Pertanyaan Audit Lapangan
                    </label>
                    <textarea
                      name="catatanDokumen"
                      rows={4}
                      disabled={!buka}
                      value={cur.catatanDokumen}
                      onChange={(e) => updateField(ind.id, "catatanDokumen", e.target.value)}
                      placeholder="Catatan dokumen & daftar pertanyaan lapangan..."
                      className="w-full text-sm leading-relaxed"
                    />
                    {buka && (
                      <div className="flex flex-wrap justify-end gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={isPending}
                          className="btn-secondary shrink-0 text-xs"
                        >
                          {isPending && (savingId === ind.id || savingId === "ALL")
                            ? "..."
                            : "Simpan"}
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleSaveDokumen(ind.id, true)}
                          className="btn shrink-0 text-xs"
                        >
                          🔒 Simpan &amp; Kunci Dokumen
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
                <div className="rounded-2xl border border-black/15 bg-[#BAE6FD]/45 p-3.5 text-xs whitespace-pre-wrap">
                  <strong className="font-black text-black">
                    Catatan Dokumen ({STATUS_DOK_LABEL[sav.statusDokumen]}):
                  </strong>{" "}
                  {sav.catatanDokumen || cur.catatanDokumen || "—"}
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
                      <label>Klasifikasi Temuan</label>
                      <select
                        name="klasifikasi"
                        disabled={!buka || isVerifiedLapangan}
                        value={cur.klasifikasi}
                        onChange={(e) =>
                          updateField(ind.id, "klasifikasi", e.target.value as Klasifikasi)
                        }
                        className="w-full font-semibold"
                      >
                        <option value="MELAMPAUI">🌟 Melampaui</option>
                        <option value="MENCAPAI">✅ Mencapai</option>
                        <option value="OBSERVASI">👀 Observasi (OB)</option>
                        <option value="KTS_MINOR">⚠️ KTS Minor</option>
                        <option value="KTS_MAYOR">🚨 KTS Mayor</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label>Temuan Lapangan</label>
                      <textarea
                        name="catatanLapangan"
                        rows={3}
                        disabled={!buka || isVerifiedLapangan}
                        value={cur.catatanLapangan}
                        onChange={(e) => updateField(ind.id, "catatanLapangan", e.target.value)}
                        placeholder="Temuan lapangan..."
                        className="w-full text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label>Rekomendasi</label>
                      <textarea
                        name="rekomendasi"
                        rows={3}
                        disabled={!buka || isVerifiedLapangan}
                        value={cur.rekomendasi}
                        onChange={(e) => updateField(ind.id, "rekomendasi", e.target.value)}
                        placeholder="Rekomendasi perbaikan..."
                        className="w-full text-sm"
                      />
                      {buka && !isVerifiedLapangan && (
                        <div className="flex flex-wrap justify-end gap-2 pt-1">
                          <button
                            type="submit"
                            disabled={isPending}
                            className="btn-secondary shrink-0 text-xs"
                          >
                            {isPending && (savingId === ind.id || savingId === "ALL")
                              ? "..."
                              : "Simpan"}
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleSaveLapangan(ind.id, true)}
                            className="btn-success shrink-0 text-xs"
                          >
                            🔒 Simpan &amp; Kunci Lapangan
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
                <div className="rounded-2xl border border-black/15 bg-[#FEF08A]/45 p-3.5 text-xs space-y-1">
                  <div>
                    <strong>Temuan:</strong> {KLASIFIKASI_LABEL[isian.klasifikasi!]} — {isian.catatanLapangan}
                  </div>
                  <div>
                    <strong>RTL Auditee:</strong> {isian.rtlRencana ?? "—"}
                  </div>
                  {isian.rtlLinkBukti && (
                    <div>
                      <strong>Drive RTL:</strong>{" "}
                      <a
                        href={isian.rtlLinkBukti}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-blue-700 underline"
                      >
                        {isian.rtlLinkBukti}
                      </a>
                    </div>
                  )}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveRtl(ind.id);
                  }}
                  className="grid grid-cols-1 gap-3 md:grid-cols-3"
                >
                  <div className="space-y-1">
                    <label>Status RTL ({RTL_LABEL[isian.rtlStatus]})</label>
                    <select
                      name="rtlStatus"
                      disabled={!buka}
                      value={cur.rtlStatus}
                      onChange={(e) =>
                        updateField(ind.id, "rtlStatus", e.target.value as StatusRtl)
                      }
                      className="w-full"
                    >
                      <option value="PROSES">⏳ Proses</option>
                      <option value="TERVERIFIKASI">✅ Terverifikasi (Kunci RTL)</option>
                    </select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label>Catatan Verifikasi RTL</label>
                    <textarea
                      name="rtlCatatanAuditor"
                      rows={3}
                      disabled={!buka}
                      value={cur.rtlCatatanAuditor}
                      onChange={(e) => updateField(ind.id, "rtlCatatanAuditor", e.target.value)}
                      placeholder="Catatan verifikasi RTL..."
                      className="w-full text-sm"
                    />
                    {buka && (
                      <div className="flex flex-wrap justify-end gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={isPending}
                          className="btn-secondary shrink-0 text-xs"
                        >
                          {isPending && (savingId === ind.id || savingId === "ALL")
                            ? "..."
                            : "Simpan"}
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleSaveRtl(ind.id, true)}
                          className="btn-success shrink-0 text-xs"
                        >
                          🔒 Simpan &amp; Kunci RTL
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
        <Empty>Tidak ada temuan yang memerlukan RTL.</Empty>
      )}
    </div>
  );
}
