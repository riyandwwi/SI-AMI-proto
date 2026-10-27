"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Klasifikasi, StatusDokumen, StatusRtl } from "@prisma/client";
import {
  BUTUH_RTL,
  KLASIFIKASI_LABEL,
  RTL_LABEL,
  STATUS_DOK_LABEL,
  groupIndikatorByStandar,
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
  pernyataanStandar: string | null;
  pernyataan: string;
  target: string;
  buktiDiminta: string | null;
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
    updatedAt?: string;
  } | null;
}

interface AuditorDraftEntry {
  buktiDiminta: string;
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
        buktiDiminta: ind.buktiDiminta ?? "",
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
  const savedValuesRef = useRef<Record<string, AuditorDraftEntry>>(savedValues);
  useEffect(() => {
    savedValuesRef.current = savedValues;
  }, [savedValues]);

  const [diperiksaOlehMap, setDiperiksaOlehMap] = useState<Record<string, string | null>>(() => {
    const m: Record<string, string | null> = {};
    for (const ind of indikator) {
      m[ind.id] = ind.isian?.diperiksaOleh ?? null;
    }
    return m;
  });

  const [savedLapanganMap, setSavedLapanganMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const ind of indikator) {
      m[ind.id] = Boolean(
        ind.isian?.klasifikasi ||
          ind.isian?.catatanLapangan?.trim() ||
          ind.isian?.rekomendasi?.trim() ||
          ind.isian?.terverifikasiLapangan
      );
    }
    return m;
  });

  const [lastSavedManualAuditor, setLastSavedManualAuditor] = useState<{
    nama: string;
    kode: string;
  } | null>(null);

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
  const [filterStandar, setFilterStandar] = useState<string>("SEMUA");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ADA_BUKTI" | "BELUM_VERIF" | "SUDAH_VERIF">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const standarGroups = groupIndikatorByStandar(indikator);

  // Muat draft localStorage HANYA sekali saat komponen pertama kali dibuka (jangan jalankan ulang saat indikator prop berubah)
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
            buktiDiminta:
              d.buktiDiminta !== undefined && d.buktiDiminta !== ""
                ? d.buktiDiminta
                : cur.buktiDiminta,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Sinkronisasi Aman: Saat prop `indikator` berubah dari server, jangan pernah menimpa indikator yang sedang diubah oleh Auditor
  useEffect(() => {
    setVerifiedMap(() => {
      const m: Record<string, boolean> = {};
      for (const ind of indikator) m[ind.id] = Boolean(ind.isian?.terverifikasiAuditor);
      return m;
    });
    setVerifiedLapanganMap(() => {
      const m: Record<string, boolean> = {};
      for (const ind of indikator) m[ind.id] = Boolean(ind.isian?.terverifikasiLapangan);
      return m;
    });
    setVerifiedRtlMap(() => {
      const m: Record<string, boolean> = {};
      for (const ind of indikator) m[ind.id] = ind.isian?.rtlStatus === "TERVERIFIKASI";
      return m;
    });
    setDiperiksaOlehMap((prev) => {
      const next = { ...prev };
      for (const ind of indikator) {
        if (ind.isian?.diperiksaOleh) {
          next[ind.id] = ind.isian.diperiksaOleh;
        }
      }
      return next;
    });
    setSavedLapanganMap((prev) => {
      const next = { ...prev };
      for (const ind of indikator) {
        if (
          ind.isian?.klasifikasi ||
          ind.isian?.catatanLapangan?.trim() ||
          ind.isian?.rekomendasi?.trim() ||
          ind.isian?.terverifikasiLapangan
        ) {
          next[ind.id] = true;
        }
      }
      return next;
    });

    const freshMap = buildInitialMap(indikator);
    const currentSavMap = savedValuesRef.current;

    setValues((prev) => {
      const next = { ...prev };
      for (const ind of indikator) {
        const cur = prev[ind.id];
        const prevSav = currentSavMap[ind.id];
        const dirty =
          cur &&
          prevSav &&
          (cur.buktiDiminta.trim() !== prevSav.buktiDiminta.trim() ||
            cur.statusDokumen !== prevSav.statusDokumen ||
            cur.catatanDokumen.trim() !== prevSav.catatanDokumen.trim() ||
            cur.klasifikasi !== prevSav.klasifikasi ||
            cur.catatanLapangan.trim() !== prevSav.catatanLapangan.trim() ||
            cur.rekomendasi.trim() !== prevSav.rekomendasi.trim() ||
            cur.rtlStatus !== prevSav.rtlStatus ||
            cur.rtlCatatanAuditor.trim() !== prevSav.rtlCatatanAuditor.trim());

        if (!cur || !dirty) {
          next[ind.id] = freshMap[ind.id];
        }
      }
      return next;
    });

    setSavedValues(freshMap);
    savedValuesRef.current = freshMap;
  }, [indikator]);

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
      cur.buktiDiminta.trim() !== sav.buktiDiminta.trim() ||
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

  const clearSavedFromStorage = (savedIds: string[], pemeriksaNama?: string) => {
    setSavedValues((prev) => {
      const next = { ...prev };
      for (const id of savedIds) {
        if (values[id]) {
          next[id] = { ...values[id] };
        }
      }
      savedValuesRef.current = next;
      return next;
    });

    if (pemeriksaNama) {
      setDiperiksaOlehMap((prev) => {
        const next = { ...prev };
        for (const id of savedIds) {
          next[id] = pemeriksaNama;
        }
        return next;
      });
      const lastId = savedIds[savedIds.length - 1];
      const lastInd = indikator.find((i) => i.id === lastId);
      if (lastInd) {
        setLastSavedManualAuditor({ nama: pemeriksaNama, kode: lastInd.kode });
      }
    }

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
      // Jika klik Simpan di 1 kartu indikator, HANYA simpan 1 indikator itu saja.
      // Jika klik Simpan Semua (targetIndikatorId === undefined), baru simpan semua indikator yang dirty.
      const itemsToSave = indikator
        .filter((ind) => (targetIndikatorId ? ind.id === targetIndikatorId : isDirtyDokumen(ind.id)))
        .map((ind) => ({
          indikatorId: ind.id,
          buktiDiminta: values[ind.id]?.buktiDiminta ?? "",
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
        clearSavedFromStorage(res.savedIds, res.diperiksaOleh);
        if (lockDokumen !== undefined) {
          setVerifiedMap((prev) => {
            const next = { ...prev };
            for (const id of res.savedIds!) next[id] = lockDokumen;
            return next;
          });
        }
      }
      setNotice({ ok: res.message ?? "Tersimpan." });
    });
  };

  const handleSaveLapangan = (targetIndikatorId?: string, lockLapangan?: boolean) => {
    setNotice(null);
    setSavingId(targetIndikatorId ?? "ALL");

    startTransition(async () => {
      const itemsToSave = indikator
        .filter((ind) => (targetIndikatorId ? ind.id === targetIndikatorId : isDirtyLapangan(ind.id)))
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
        clearSavedFromStorage(res.savedIds, res.diperiksaOleh);
        setSavedLapanganMap((prev) => {
          const next = { ...prev };
          for (const id of res.savedIds!) next[id] = true;
          return next;
        });
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
    });
  };

  const handleSaveRtl = (targetIndikatorId?: string, forceVerifyLock?: boolean) => {
    setNotice(null);
    setSavingId(targetIndikatorId ?? "ALL");

    startTransition(async () => {
      const itemsToSave = indikator
        .filter((ind) => ind.isian && (targetIndikatorId ? ind.id === targetIndikatorId : isDirtyRtl(ind.id)))
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
        clearSavedFromStorage(res.savedIds, res.diperiksaOleh);
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

  // Cari hanya 1 Save Terakhir Auditee & 1 Save Terakhir Auditor + Statistik Progres Pengecekan Auditor
  let latestAuditeeSave: { nama: string; kode: string; ts: number } | null = null;
  let latestAuditorDbSave: { nama: string; kode: string; ts: number } | null = null;
  let totalAdaBuktiAuditee = 0;
  let totalSudahDicekMode = 0;

  const isItemCheckedInMode = (indId: string) => {
    const sav = savedValues[indId];
    if (mode === "dokumen") {
      return Boolean(
        diperiksaOlehMap[indId] ||
          (sav && sav.statusDokumen !== "BELUM_DICEK") ||
          sav?.catatanDokumen?.trim() ||
          verifiedMap[indId]
      );
    }
    if (mode === "lapangan") {
      return Boolean(
        savedLapanganMap[indId] ||
          sav?.catatanLapangan?.trim() ||
          sav?.rekomendasi?.trim() ||
          verifiedLapanganMap[indId]
      );
    }
    return Boolean(
      sav?.rtlStatus === "TERVERIFIKASI" ||
        sav?.rtlCatatanAuditor?.trim() ||
        verifiedRtlMap[indId]
    );
  };

  for (const ind of indikator) {
    if (ind.isian?.linkDrive?.trim()) totalAdaBuktiAuditee++;
    if (isItemCheckedInMode(ind.id)) totalSudahDicekMode++;

    const ts = ind.isian?.updatedAt ? new Date(ind.isian.updatedAt).getTime() : 1;
    if (ind.isian?.diisiOleh) {
      if (!latestAuditeeSave || ts >= latestAuditeeSave.ts) {
        latestAuditeeSave = { nama: ind.isian.diisiOleh, kode: ind.kode, ts };
      }
    }
    if (ind.isian?.diperiksaOleh) {
      if (!latestAuditorDbSave || ts >= latestAuditorDbSave.ts) {
        latestAuditorDbSave = { nama: ind.isian.diperiksaOleh, kode: ind.kode, ts };
      }
    }
  }

  const latestAuditorSave =
    lastSavedManualAuditor ??
    (latestAuditorDbSave
      ? { nama: latestAuditorDbSave.nama, kode: latestAuditorDbSave.kode }
      : null);

  const totalTargetMode = mode === "rtl" ? rtlCount : indikator.length;
  const totalBelumDicekMode = Math.max(0, totalTargetMode - totalSudahDicekMode);
  const persenBuktiAuditee =
    indikator.length > 0 ? Math.round((totalAdaBuktiAuditee / indikator.length) * 100) : 0;
  const persenDicekAuditor =
    totalTargetMode > 0 ? Math.round((totalSudahDicekMode / totalTargetMode) * 100) : 0;

  const qNorm = searchQuery.trim().toLowerCase();
  const matchesAuditorFilter = (ind: AuditorIndikatorItem, noUrut: number) => {
    const hasBukti = Boolean(ind.isian?.linkDrive?.trim());
    const sudahDicek = isItemCheckedInMode(ind.id);

    if (statusFilter === "ADA_BUKTI" && !hasBukti) return false;
    if (statusFilter === "BELUM_VERIF" && sudahDicek) return false;
    if (statusFilter === "SUDAH_VERIF" && !sudahDicek) return false;

    if (qNorm) {
      const hay = `#${noUrut} ${ind.kode} ${ind.standar} ${ind.pernyataanStandar ?? ""} ${ind.pernyataan} ${ind.buktiDiminta ?? ""} ${ind.isian?.klaim ?? ""}`.toLowerCase();
      if (!hay.includes(qNorm)) return false;
    }
    return true;
  };

  const visibleGroups =
    filterStandar === "SEMUA"
      ? standarGroups
      : standarGroups.filter((g) => g.standar === filterStandar);

  const nextUnverifiedItem = indikator.find((ind) => {
    if (mode === "rtl") {
      const k = savedValues[ind.id]?.klasifikasi ?? ind.isian?.klasifikasi;
      if (!k || !BUTUH_RTL.includes(k)) return false;
    }
    return !isItemCheckedInMode(ind.id);
  });

  return (
    <div className="space-y-4">
      {/* Bar Melayang (Floating Bottom-Right) agar munculnya notifikasi / tombol Simpan Semua TIDAK menggeser posisi layar */}
      {(notice?.ok || notice?.err || (buka && dirtyIds.length > 0)) && (
        <div className="fixed bottom-4 right-4 z-50 flex max-w-md flex-col items-end gap-2">
          {notice?.ok && (
            <div className="rounded-2xl border-2 border-black bg-[#D9F99D] px-4 py-2.5 text-sm font-black text-black shadow-[4px_4px_0px_#000]">
              ✓ {notice.ok}
            </div>
          )}
          {notice?.err && (
            <div className="rounded-2xl border-2 border-black bg-[#FECDD3] px-4 py-2.5 text-sm font-black text-black shadow-[4px_4px_0px_#000]">
              ⚠️ {notice.err}
            </div>
          )}
          {buka && dirtyIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-black bg-[#CBD5E1] px-4 py-2.5 text-xs shadow-[4px_4px_0px_#000]">
              <div className="font-black text-[#0F172A]">
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
        </div>
      )}

      {/* Bar Verifikasi & Kunci Semua + Ringkasan 1 Save Terakhir */}
      <div className="card flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <a
            href={`/api/export-isian?periodeId=${encodeURIComponent(periodeId)}&unitId=${encodeURIComponent(unitId)}`}
            className="btn-success px-3 py-1 text-xs"
          >
            📥 Download Excel Isian
          </a>
          {latestAuditeeSave && (
            <>
              <span className="font-black uppercase text-[#0F172A]">🕒 Save Terakhir Auditee:</span>
              <Badge tone="blue">
                👤 {latestAuditeeSave.nama} — {latestAuditeeSave.kode}
              </Badge>
            </>
          )}
          {latestAuditorSave && (
            <>
              <span className="ml-2 font-black uppercase text-[#0F172A]">🕒 Save Terakhir Auditor:</span>
              <Badge tone="purple">
                🕵️ {latestAuditorSave.nama} — {latestAuditorSave.kode}
              </Badge>
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

      {standarGroups.length > 0 && (
        <div className="card space-y-3 py-3.5 text-xs">
          {/* 1. Progress Bar Visual Kesiapan Bukti Auditee & Pemeriksaan Auditor */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="rounded-xl border-2 border-black bg-[#FAF7EE] p-2.5 space-y-1.5">
              <div className="flex items-center justify-between font-black text-black">
                <span>📥 Bukti Drive Auditee Masuk</span>
                <span>
                  {totalAdaBuktiAuditee} / {indikator.length} Indikator ({persenBuktiAuditee}%)
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full border border-black bg-white">
                <div
                  className="h-full bg-[#4ADE80] transition-all duration-300"
                  style={{ width: `${persenBuktiAuditee}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl border-2 border-black bg-[#FAF7EE] p-2.5 space-y-1.5">
              <div className="flex items-center justify-between font-black text-black">
                <span>
                  🕵️ Progres Pengecekan Auditor ({mode === "dokumen" ? "Dokumen" : mode === "lapangan" ? "Lapangan" : "RTL"})
                </span>
                <span>
                  {totalSudahDicekMode} / {totalTargetMode} Indikator ({persenDicekAuditor}%)
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full border border-black bg-white">
                <div
                  className="h-full bg-[#38BDF8] transition-all duration-300"
                  style={{ width: `${persenDicekAuditor}%` }}
                />
              </div>
            </div>
          </div>

          {/* 2. Dropdown Filter Standar SPMI + Tombol Lompat ke Belum Diperiksa */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <label htmlFor="auditor-select-standar" className="shrink-0 font-black uppercase text-black">
                📂 Filter Standar SPMI:
              </label>
              <select
                id="auditor-select-standar"
                value={filterStandar}
                onChange={(e) => setFilterStandar(e.target.value)}
                className="min-w-[240px] max-w-full flex-1 rounded-xl border-2 border-black bg-white px-3 py-1.5 text-xs font-black text-black sm:max-w-md"
              >
                <option value="SEMUA">
                  Semua Standar ({standarGroups.length} Standar — {indikator.length} Indikator)
                </option>
                {standarGroups.map((g, idx) => (
                  <option key={g.standar} value={g.standar}>
                    {idx + 1}. {g.standar} (Indikator #{g.startIndex}–#{g.endIndex})
                  </option>
                ))}
              </select>
              {filterStandar !== "SEMUA" && (
                <button
                  type="button"
                  onClick={() => setFilterStandar("SEMUA")}
                  className="btn-secondary px-2.5 py-1 text-xs"
                >
                  ✕ Semua
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {nextUnverifiedItem && (
                <button
                  type="button"
                  onClick={() => {
                    if (filterStandar !== "SEMUA" || statusFilter === "SUDAH_VERIF") {
                      setFilterStandar("SEMUA");
                      setStatusFilter("ALL");
                    }
                    setTimeout(() => {
                      document
                        .getElementById(`auditor-ind-${nextUnverifiedItem.id}`)
                        ?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }, 80);
                  }}
                  className="btn px-3 py-1 text-xs"
                >
                  ⏭️ Lompat ke Belum Dicek Berikutnya
                </button>
              )}
              <Badge tone="blue">{standarGroups.length} Standar SPMI</Badge>
            </div>
          </div>

          {/* 3. Filter Status Cepat + Kotak Cari Kata Kunci */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/15 pt-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-black uppercase text-black">Filter Status:</span>
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={statusFilter === "ALL" ? "btn px-2.5 py-1 text-xs" : "btn-secondary px-2.5 py-1 text-xs"}
              >
                Semua ({totalTargetMode})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("ADA_BUKTI")}
                className={statusFilter === "ADA_BUKTI" ? "btn px-2.5 py-1 text-xs" : "btn-secondary px-2.5 py-1 text-xs"}
              >
                📥 Ada Bukti Auditee ({totalAdaBuktiAuditee})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("BELUM_VERIF")}
                className={statusFilter === "BELUM_VERIF" ? "btn px-2.5 py-1 text-xs" : "btn-secondary px-2.5 py-1 text-xs"}
              >
                ⏳ Belum Dicek ({totalBelumDicekMode})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("SUDAH_VERIF")}
                className={statusFilter === "SUDAH_VERIF" ? "btn px-2.5 py-1 text-xs" : "btn-secondary px-2.5 py-1 text-xs"}
              >
                ✅ Sudah Dicek ({totalSudahDicekMode})
              </button>
            </div>

            <div className="flex min-w-[220px] flex-1 items-center gap-1.5 sm:max-w-xs">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Cari kode / indikator / klaim..."
                className="w-full rounded-xl border-2 border-black bg-white px-3 py-1 text-xs font-bold text-black"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="btn-secondary px-2 py-1 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {visibleGroups.map((group) => {
        const baseItems =
          mode === "rtl"
            ? group.items.filter(
                (entry) =>
                  entry.item.isian?.klasifikasi &&
                  BUTUH_RTL.includes(entry.item.isian.klasifikasi)
              )
            : group.items;
        const groupItems = baseItems.filter(({ item, noUrut }) => matchesAuditorFilter(item, noUrut));

        if (groupItems.length === 0) return null;

        return (
          <div key={group.standar} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-black bg-[#CBD5E1] px-4 py-2.5 shadow-[3px_3px_0px_#000]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-black text-[#0F172A]">📂 {group.standar}</span>
                <span className="rounded-lg border border-black bg-[#EDF2F7] px-2 py-0.5 text-xs font-black text-[#0F172A]">
                  Indikator {group.startIndex} – {group.endIndex}
                </span>
              </div>
              <span className="text-xs font-bold text-slate-800">
                {groupItems.length} indikator
              </span>
            </div>

            {groupItems.map(({ item: ind, noUrut }) => {
              const isian = ind.isian;
              const cur = values[ind.id];
              const sav = savedValues[ind.id];
              if (!cur || !sav) return null;

              const isFokus =
                sav.statusDokumen === "PERLU_KLARIFIKASI" ||
                cur.statusDokumen === "PERLU_KLARIFIKASI";
              const dirty = isDirtyMode(ind.id);
              const isCheckedInMode = isItemCheckedInMode(ind.id);
              const namaPemeriksa = diperiksaOlehMap[ind.id] ?? isian?.diperiksaOleh;
              const isVerifiedDokumen = Boolean(verifiedMap[ind.id]);
              const isVerifiedLapangan = Boolean(verifiedLapanganMap[ind.id]);
              const isVerifiedRtl =
                Boolean(verifiedRtlMap[ind.id]) || cur.rtlStatus === "TERVERIFIKASI";

              return (
                <div
                  key={ind.id}
                  id={`auditor-ind-${ind.id}`}
                  className={`card space-y-3 transition ${
                    mode === "lapangan" && isFokus ? "border-amber-400 bg-amber-50/30" : ""
                  } ${dirty ? "ring-2 ring-amber-300" : ""}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/15 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg border border-black bg-black px-2 py-0.5 text-xs font-black text-white">
                        #{noUrut}
                      </span>
                      <code className="rounded-xl border border-black/30 bg-[#BAE6FD] px-2.5 py-0.5 text-sm font-black text-black">
                        {ind.kode}
                      </code>
                      <span className="text-base font-black text-black">{ind.standar}</span>
                {isian?.diisiOleh && <Badge tone="blue">👤 {isian.diisiOleh}</Badge>}
                {namaPemeriksa && <Badge tone="purple">🕵️ {namaPemeriksa}</Badge>}
                {isCheckedInMode ? (
                  <Badge tone="green">✅ Sudah Dicek</Badge>
                ) : (
                  <Badge tone="amber">⏳ Belum Dicek</Badge>
                )}
                {dirty && <Badge tone="amber">📝 Belum Disimpan</Badge>}
                {isFokus && <Badge tone="amber">🎯 Fokus Lapangan</Badge>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
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

            {ind.pernyataanStandar && (
              <div className="rounded-xl border border-black/25 bg-[#EDF2F7] px-4 py-3 text-base font-semibold leading-relaxed text-[#0F172A]">
                <strong className="font-black text-[#0F172A]">📜 Isi Pernyataan Standar:</strong>{" "}
                {ind.pernyataanStandar}
              </div>
            )}

            {/* Kotak Gabungan Ter-Highlight: Indikator Kinerja + Dokumen Diminta + Evaluasi Diri Auditee & Link Drive */}
            <div className="rounded-2xl border-2 border-[#1E3A8A] border-l-8 border-l-[#1D4ED8] bg-[#DCE5EF] p-4 space-y-2.5 text-[#0F172A] shadow-sm">
              <div className="text-base font-bold leading-relaxed">
                <strong className="font-black text-[#0F172A]">
                  🎯 Indikator Kinerja ({ind.kode}):
                </strong>{" "}
                {ind.pernyataan}
              </div>

              {(sav.buktiDiminta || ind.buktiDiminta) && (
                <div className="text-[15px] font-semibold leading-relaxed text-[#1E293B]">
                  <strong className="font-black text-[#0F172A]">
                    📋 Dokumen Bukti yang Diminta:
                  </strong>{" "}
                  {sav.buktiDiminta || ind.buktiDiminta}
                </div>
              )}

              <div className="border-t-2 border-[#94A3B8] pt-2.5 space-y-1.5">
                <div className="rounded-xl border border-[#1E3A8A]/40 bg-[#DBEAFE] px-3.5 py-2.5 text-base font-semibold leading-relaxed text-[#0F172A]">
                  <div>
                    <strong className="font-black text-[#1E3A8A]">
                      ✍️ Evaluasi Diri Auditee{isian?.diisiOleh ? ` (${isian.diisiOleh})` : ""}:
                    </strong>{" "}
                    {isian?.klaim ? (
                      <span className="font-bold text-[#0F172A]">{isian.klaim}</span>
                    ) : (
                      <em className="font-semibold text-[#64748B]">Belum diisi oleh Auditee</em>
                    )}
                  </div>
                  {isian?.linkDrive && (
                    <div className="mt-1 truncate text-sm">
                      <strong className="font-black text-[#1E3A8A]">📂 Link Bukti Drive:</strong>{" "}
                      <a
                        href={isian.linkDrive}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono font-bold text-[#1D4ED8] underline hover:text-[#1E3A8A]"
                      >
                        {isian.linkDrive}
                      </a>
                    </div>
                  )}
                </div>
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
                  <div className="space-y-2">
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
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label>
                      Catatan Audit Dokumen &amp; Daftar Pertanyaan Audit Lapangan
                    </label>
                    <textarea
                      name="catatanDokumen"
                      rows={3}
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
                          className="btn shrink-0 text-xs"
                        >
                          {isPending && (savingId === ind.id || savingId === "ALL")
                            ? "..."
                            : "💾 Simpan"}
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
                            className="btn shrink-0 text-xs"
                          >
                            {isPending && (savingId === ind.id || savingId === "ALL")
                              ? "..."
                              : "💾 Simpan"}
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
                          className="btn shrink-0 text-xs"
                        >
                          {isPending && (savingId === ind.id || savingId === "ALL")
                            ? "..."
                            : "💾 Simpan"}
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
          </div>
        );
      })}

      {mode === "rtl" && rtlCount === 0 && (
        <Empty>Tidak ada temuan yang memerlukan RTL.</Empty>
      )}
    </div>
  );
}
