"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Klasifikasi, StatusDokumen, StatusRtl } from "@prisma/client";
import {
  BUTUH_RTL,
  KLASIFIKASI_LABEL,
  RTL_LABEL,
  STATUS_DOK_LABEL,
  groupIndikatorByStandar,
  parseRtlData,
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
  currentUserName,
  indikator,
}: {
  periodeId: string;
  unitId: string;
  mode: string;
  buka: boolean;
  currentUserName?: string;
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

  const [activeMode, setActiveMode] = useState<"dokumen" | "lapangan" | "rtl">(() =>
    mode === "lapangan" ? "lapangan" : mode === "rtl" ? "rtl" : "dokumen"
  );
  useEffect(() => {
    setActiveMode(mode === "lapangan" ? "lapangan" : mode === "rtl" ? "rtl" : "dokumen");
  }, [mode]);

  const [diperiksaOlehMap, setDiperiksaOlehMap] = useState<Record<string, string | null>>(() => {
    const m: Record<string, string | null> = {};
    for (const ind of indikator) {
      m[ind.id] = ind.isian?.diperiksaOleh ?? null;
    }
    return m;
  });

  // 1. Pengecekan Dokumen (Berdasarkan Save di Tab 1. Audit Dokumen)
  const [savedDokumenMap, setSavedDokumenMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const ind of indikator) {
      m[ind.id] = Boolean(
        ind.isian?.diperiksaOleh ||
          (ind.isian && ind.isian.statusDokumen !== "BELUM_DICEK") ||
          ind.isian?.catatanDokumen?.trim() ||
          ind.isian?.terverifikasiAuditor
      );
    }
    return m;
  });

  // 2. Pengecekan Lapangan (Berdasarkan Save di Tab 2. Audit Lapangan)
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

  // 3. Pengecekan RTL (Berdasarkan Save di Tab 3. Verifikasi RTL)
  const [savedRtlMap, setSavedRtlMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const ind of indikator) {
      m[ind.id] = Boolean(
        ind.isian?.rtlStatus === "TERVERIFIKASI" ||
          ind.isian?.rtlCatatanAuditor?.trim()
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
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ADA_BUKTI" | "BELUM_VERIF" | "SUDAH_VERIF" | "DICEK_SAYA"
  >("ALL");
  const [klasifikasiFilter, setKlasifikasiFilter] = useState<"ALL" | Klasifikasi>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [minimizedRtlIds, setMinimizedRtlIds] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  const toggleExpand = (indId: string) => {
    setExpandedIds((prev) => {
      const next = { ...prev };
      if (next[indId]) {
        delete next[indId];
      } else {
        next[indId] = true;
      }
      return next;
    });
  };

  const expandAllVisible = (items: AuditorIndikatorItem[]) => {
    setExpandedIds((prev) => {
      const next = { ...prev };
      for (const item of items) {
        next[item.id] = true;
      }
      return next;
    });
  };

  const minimizeAll = () => {
    setExpandedIds({});
  };

  const scrollToAndExpandIndikator = (indId: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [indId]: true,
    }));
    setTimeout(() => {
      document
        .getElementById(`auditor-ind-${indId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };

  const toggleMinimizeRtl = (indId: string) => {
    setMinimizedRtlIds((prev) => ({
      ...prev,
      [indId]: !prev[indId],
    }));
  };

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
    setSavedDokumenMap((prev) => {
      const next = { ...prev };
      for (const ind of indikator) {
        if (
          ind.isian?.diperiksaOleh ||
          (ind.isian && ind.isian.statusDokumen !== "BELUM_DICEK") ||
          ind.isian?.catatanDokumen?.trim() ||
          ind.isian?.terverifikasiAuditor
        ) {
          next[ind.id] = true;
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
    setSavedRtlMap((prev) => {
      const next = { ...prev };
      for (const ind of indikator) {
        if (
          ind.isian?.rtlStatus === "TERVERIFIKASI" ||
          ind.isian?.rtlCatatanAuditor?.trim()
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

  // Target indikator per tahapan (funnel):
  // 1. Dokumen: Semua indikator
  // 2. Lapangan: Hanya indikator yang Status Dokumen tersimpannya = PERLU_KLARIFIKASI
  // 3. RTL: Hanya indikator dari Audit Lapangan yang Klasifikasi Temuan tersimpannya = OBSERVASI / KTS_MINOR / KTS_MAYOR
  const isLapanganTarget = (indId: string) =>
    (savedValues[indId]?.statusDokumen ?? "BELUM_DICEK") === "PERLU_KLARIFIKASI";

  const isRtlTarget = (indId: string) => {
    const indObj = indikator.find((i) => i.id === indId);
    const hasSavedLapangan = Boolean(
      savedLapanganMap[indId] || verifiedLapanganMap[indId] || indObj?.isian?.klasifikasi
    );
    if (!isLapanganTarget(indId) && !indObj?.isian?.klasifikasi) return false;
    if (!hasSavedLapangan) return false;
    const k = savedValues[indId]?.klasifikasi ?? indObj?.isian?.klasifikasi;
    return Boolean(k && BUTUH_RTL.includes(k));
  };

  const isTargetInMode = (indId: string) => {
    if (activeMode === "dokumen") return true;
    if (activeMode === "lapangan") return isLapanganTarget(indId);
    return isRtlTarget(indId);
  };

  const isDirtyMode = (indId: string) => {
    if (activeMode === "dokumen") return isDirtyDokumen(indId);
    if (activeMode === "lapangan") return isDirtyLapangan(indId);
    if (activeMode === "rtl") return isDirtyRtl(indId);
    return false;
  };

  const dirtyIds = indikator
    .map((i) => i.id)
    .filter((id) => isTargetInMode(id) && isDirtyMode(id));

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
        setSavedDokumenMap((prev) => {
          const next = { ...prev };
          for (const id of res.savedIds!) next[id] = true;
          return next;
        });
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
        .filter((ind) => (targetIndikatorId ? ind.id === targetIndikatorId : isDirtyRtl(ind.id)))
        .map((ind) => ({
          indikatorId: ind.id,
          isianId: ind.isian?.id,
          rtlStatus: forceVerifyLock
            ? ("TERVERIFIKASI" as StatusRtl)
            : (values[ind.id]?.rtlStatus ?? "PROSES"),
          rtlCatatanAuditor: values[ind.id]?.rtlCatatanAuditor ?? "",
        }));

      const res = await simpanBatchVerifikasiRtl(periodeId, unitId, itemsToSave);
      setSavingId(null);

      if (!res.ok) {
        setNotice({ err: res.error ?? "Gagal menyimpan." });
        return;
      }

      if (res.savedIds) {
        clearSavedFromStorage(res.savedIds, res.diperiksaOleh);
        setSavedRtlMap((prev) => {
          const next = { ...prev };
          for (const id of res.savedIds!) next[id] = true;
          return next;
        });
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

  const isItemCheckedInMode = (indId: string) => {
    if (activeMode === "dokumen") {
      return Boolean(savedDokumenMap[indId] || verifiedMap[indId]);
    }
    if (activeMode === "lapangan") {
      return Boolean(savedLapanganMap[indId] || verifiedLapanganMap[indId]);
    }
    return Boolean(savedRtlMap[indId] || verifiedRtlMap[indId]);
  };

  const getEffectiveKlasifikasi = (indId: string): Klasifikasi | null => {
    const indObj = indikator.find((i) => i.id === indId);
    const hasSavedLapangan = Boolean(
      savedLapanganMap[indId] || verifiedLapanganMap[indId] || indObj?.isian?.klasifikasi
    );
    if (!hasSavedLapangan) return null;
    return savedValues[indId]?.klasifikasi ?? indObj?.isian?.klasifikasi ?? null;
  };

  const lapanganTargetIds = indikator.filter((ind) => isLapanganTarget(ind.id)).map((ind) => ind.id);
  const rtlTargetIds = indikator.filter((ind) => isRtlTarget(ind.id)).map((ind) => ind.id);
  const lapanganCount = lapanganTargetIds.length;
  const rtlCount = rtlTargetIds.length;

  // Cari hanya 1 Save Terakhir Auditee & 1 Save Terakhir Auditor + Statistik Progres Pengecekan Auditor sesuai mode aktif
  let latestAuditeeSave: { nama: string; kode: string; ts: number } | null = null;
  let latestAuditorDbSave: { nama: string; kode: string; ts: number } | null = null;
  let totalAdaBuktiAuditee = 0;
  let totalSudahDicekMode = 0;
  let myCheckedCountMode = 0;

  const klasifikasiCounts: Record<Klasifikasi, number> = {
    MELAMPAUI: 0,
    MENCAPAI: 0,
    OBSERVASI: 0,
    KTS_MINOR: 0,
    KTS_MAYOR: 0,
  };

  for (const ind of indikator) {
    const hasBukti = Boolean(ind.isian?.linkDrive?.trim());
    if (hasBukti) totalAdaBuktiAuditee++;

    const effKlas = getEffectiveKlasifikasi(ind.id);
    if (effKlas) {
      klasifikasiCounts[effKlas]++;
    }

    const pemeriksa = diperiksaOlehMap[ind.id] ?? ind.isian?.diperiksaOleh ?? null;

    if (isTargetInMode(ind.id) && isItemCheckedInMode(ind.id)) {
      totalSudahDicekMode++;
      if (currentUserName && pemeriksa === currentUserName) {
        myCheckedCountMode++;
      }
    }

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

  const totalTargetMode =
    activeMode === "dokumen"
      ? indikator.length
      : activeMode === "lapangan"
        ? lapanganCount
        : rtlCount;
  const totalBelumDicekMode = Math.max(0, totalTargetMode - totalSudahDicekMode);
  const persenBuktiAuditee =
    indikator.length > 0 ? Math.round((totalAdaBuktiAuditee / indikator.length) * 100) : 0;
  const persenDicekAuditor =
    totalTargetMode > 0 ? Math.round((totalSudahDicekMode / totalTargetMode) * 100) : 0;

  const qNorm = searchQuery.trim().toLowerCase();
  const matchesAuditorFilter = (ind: AuditorIndikatorItem, noUrut: number) => {
    const hasBukti = Boolean(ind.isian?.linkDrive?.trim());
    const sudahDicek = isItemCheckedInMode(ind.id);
    const pemeriksa = diperiksaOlehMap[ind.id] ?? ind.isian?.diperiksaOleh ?? null;
    const effKlas = getEffectiveKlasifikasi(ind.id);

    if (activeMode !== "lapangan" && statusFilter === "ADA_BUKTI" && !hasBukti) return false;
    if (statusFilter === "BELUM_VERIF" && sudahDicek) return false;
    if (statusFilter === "SUDAH_VERIF" && !sudahDicek) return false;
    if (statusFilter === "DICEK_SAYA" && (!sudahDicek || pemeriksa !== currentUserName)) {
      return false;
    }

    if (klasifikasiFilter !== "ALL" && effKlas !== klasifikasiFilter) {
      return false;
    }

    if (qNorm) {
      const hay = `#${noUrut} ${ind.kode} ${ind.standar} ${ind.pernyataanStandar ?? ""} ${ind.pernyataan} ${ind.buktiDiminta ?? ""} ${ind.isian?.klaim ?? ""}`.toLowerCase();
      if (!hay.includes(qNorm)) return false;
    }
    return true;
  };

  const visibleGroups = (
    filterStandar === "SEMUA"
      ? standarGroups
      : standarGroups.filter((g) => g.standar === filterStandar)
  )
    .map((group) => {
      const baseItems = group.items.filter((entry) =>
        klasifikasiFilter !== "ALL"
          ? getEffectiveKlasifikasi(entry.item.id) === klasifikasiFilter
          : isTargetInMode(entry.item.id)
      );
      const groupItems = baseItems.filter(({ item, noUrut }) =>
        matchesAuditorFilter(item, noUrut)
      );
      return { ...group, groupItems };
    })
    .filter((g) => g.groupItems.length > 0);

  const visibleFlatItems = visibleGroups.flatMap((g) => g.groupItems.map((x) => x.item));
  const allVisibleExpanded =
    visibleFlatItems.length > 0 && visibleFlatItems.every((item) => Boolean(expandedIds[item.id]));

  const nextUnverifiedItem = indikator.find((ind) => {
    if (!isTargetInMode(ind.id)) return false;
    return !isItemCheckedInMode(ind.id);
  });

  const switchMode = (nextMode: "dokumen" | "lapangan" | "rtl") => {
    setActiveMode(nextMode);
    if (nextMode === "lapangan" && statusFilter === "ADA_BUKTI") {
      setStatusFilter("ALL");
    }
    if (nextMode === "rtl") {
      if (statusFilter !== "ALL" && statusFilter !== "DICEK_SAYA") {
        setStatusFilter("ALL");
      }
      if (klasifikasiFilter === "MELAMPAUI" || klasifikasiFilter === "MENCAPAI") {
        setKlasifikasiFilter("ALL");
      }
    }
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("mode", nextMode);
      window.history.replaceState({}, "", url.toString());
    }
  };

  return (
    <div className="space-y-4">
      {/* Notifikasi Melayang (Floating Bottom-Right) agar munculnya notifikasi TIDAK menggeser posisi layar */}
      {(notice?.ok || notice?.err) && (
        <div className="fixed bottom-20 right-5 z-50 flex max-w-md flex-col items-end gap-2">
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
        </div>
      )}

      {/* Floating Tombol berlabel Indikator yang Dikerjakan Akun Auditor Ini */}
      {currentUserName && (
        <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setStatusFilter(statusFilter === "DICEK_SAYA" ? "ALL" : "DICEK_SAYA")
            }
            title={`Klik untuk melihat ${myCheckedCountMode} indikator yang dicek oleh ${currentUserName}`}
            className={`flex items-center gap-2 rounded-full border-2 border-black px-4 py-2.5 text-xs font-black text-black shadow-[4px_4px_0px_#000] transition hover:-translate-y-0.5 ${
              statusFilter === "DICEK_SAYA" ? "bg-[#4ADE80] ring-4 ring-black/20" : "bg-[#FDE047]"
            }`}
          >
            <span>🕵️ Dicek Saya: {myCheckedCountMode}</span>
            {statusFilter === "DICEK_SAYA" && <span className="ml-0.5">✕</span>}
          </button>
        </div>
      )}

      {/* Layout 2 Kolom: Sidebar Kiri Sticky (Tahapan, Progres, Filter & Aksi) + Area Tengah/Kanan Full untuk Pemeriksaan Indikator */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
        {/* SIDEBAR KIRI STICKY */}
        <aside className="space-y-3 lg:sticky lg:top-20 lg:col-span-4 xl:col-span-3">
          {/* Card 1: Tahapan Pemeriksaan + Status Sesi + Print Rekap */}
          <div className="card space-y-2.5 p-3.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-black uppercase text-[#0F172A]">🧭 Tahapan Audit</span>
              <Badge tone={buka ? "green" : "slate"}>
                {buka ? "🟢 Sesi Terbuka" : "🔒 Sesi Ditutup"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                onClick={() => switchMode("dokumen")}
                className={
                  activeMode === "dokumen"
                    ? "btn w-full justify-between text-xs"
                    : "btn-secondary w-full justify-between text-xs"
                }
              >
                <span>📄 1. Audit Dokumen</span>
                <span className="rounded-md border border-black/30 bg-white/80 px-1.5 py-0.5 text-[11px] font-black">
                  {indikator.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => switchMode("lapangan")}
                className={
                  activeMode === "lapangan"
                    ? "btn w-full justify-between text-xs"
                    : "btn-secondary w-full justify-between text-xs"
                }
              >
                <span>🏛️ 2. Audit Lapangan</span>
                <span className="rounded-md border border-black/30 bg-white/80 px-1.5 py-0.5 text-[11px] font-black">
                  {lapanganCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => switchMode("rtl")}
                className={
                  activeMode === "rtl"
                    ? "btn w-full justify-between text-xs"
                    : "btn-secondary w-full justify-between text-xs"
                }
              >
                <span>🛠️ 3. Verifikasi RTL</span>
                <span className="rounded-md border border-black/30 bg-white/80 px-1.5 py-0.5 text-[11px] font-black">
                  {rtlCount}
                </span>
              </button>
            </div>

            {/* Progress Bars */}
            <div className="space-y-2 border-t border-black/15 pt-2.5">
              <div className="rounded-xl border border-black bg-[#FAF7EE] p-2 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-black text-black">
                  <span>📥 Bukti Auditee Masuk</span>
                  <span>
                    {totalAdaBuktiAuditee}/{indikator.length} ({persenBuktiAuditee}%)
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full border border-black bg-white">
                  <div
                    className="h-full bg-[#4ADE80] transition-all duration-300"
                    style={{ width: `${persenBuktiAuditee}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-black bg-[#FAF7EE] p-2 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-black text-black">
                  <span>
                    🕵️ Dicek ({activeMode === "dokumen" ? "Dok" : activeMode === "lapangan" ? "Lap" : "RTL"})
                  </span>
                  <span>
                    {totalSudahDicekMode}/{totalTargetMode} ({persenDicekAuditor}%)
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full border border-black bg-white">
                  <div
                    className="h-full bg-[#38BDF8] transition-all duration-300"
                    style={{ width: `${persenDicekAuditor}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Pencarian, Filter Standar, Filter Status & Klasifikasi */}
          {standarGroups.length > 0 && (
            <div className="card space-y-2.5 p-3.5 text-xs">
              {/* Kotak Cari Kata Kunci */}
              <div className="space-y-1">
                <label htmlFor="auditor-search" className="text-[11px] font-black uppercase text-black">
                  🔍 Cari Indikator / Klaim
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="auditor-search"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ketik kode / kata kunci..."
                    className="w-full rounded-xl border-2 border-black bg-white px-2.5 py-1.5 text-xs font-semibold text-black"
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

              {/* Dropdown Filter Standar SPMI */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="auditor-select-standar" className="text-[11px] font-black uppercase text-black">
                    📂 Standar SPMI
                  </label>
                  {filterStandar !== "SEMUA" && (
                    <button
                      type="button"
                      onClick={() => setFilterStandar("SEMUA")}
                      className="text-[11px] font-black text-blue-700 underline"
                    >
                      Reset Semua
                    </button>
                  )}
                </div>
                <select
                  id="auditor-select-standar"
                  value={filterStandar}
                  onChange={(e) => setFilterStandar(e.target.value)}
                  className="w-full rounded-xl border-2 border-black bg-white px-2.5 py-1.5 text-xs font-bold text-black"
                >
                  <option value="SEMUA">
                    Semua Standar ({standarGroups.length} Standar — {totalTargetMode} Indikator)
                  </option>
                  {standarGroups.map((g, idx) => (
                    <option key={g.standar} value={g.standar}>
                      {idx + 1}. {g.standar} (#{g.startIndex}–#{g.endIndex})
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Status Pemeriksaan */}
              <div className="space-y-1.5 border-t border-black/15 pt-2">
                <div className="text-[11px] font-black uppercase text-black">📌 Filter Status</div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter("ALL");
                      setKlasifikasiFilter("ALL");
                    }}
                    className={
                      statusFilter === "ALL" && klasifikasiFilter === "ALL"
                        ? "btn px-2.5 py-1 text-[11px]"
                        : "btn-secondary px-2.5 py-1 text-[11px]"
                    }
                  >
                    Semua ({totalTargetMode})
                  </button>
                  {activeMode !== "rtl" && (
                    <>
                      {activeMode !== "lapangan" && (
                        <button
                          type="button"
                          onClick={() => setStatusFilter("ADA_BUKTI")}
                          className={
                            statusFilter === "ADA_BUKTI"
                              ? "btn px-2.5 py-1 text-[11px]"
                              : "btn-secondary px-2.5 py-1 text-[11px]"
                          }
                        >
                          📥 Ada Bukti ({totalAdaBuktiAuditee})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setStatusFilter("BELUM_VERIF")}
                        className={
                          statusFilter === "BELUM_VERIF"
                            ? "btn px-2.5 py-1 text-[11px]"
                            : "btn-secondary px-2.5 py-1 text-[11px]"
                        }
                      >
                        ⏳ Belum ({totalBelumDicekMode})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter("SUDAH_VERIF")}
                        className={
                          statusFilter === "SUDAH_VERIF"
                            ? "btn px-2.5 py-1 text-[11px]"
                            : "btn-secondary px-2.5 py-1 text-[11px]"
                        }
                      >
                        ✅ Dicek ({totalSudahDicekMode})
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Filter Klasifikasi Temuan */}
              <div className="space-y-1.5 border-t border-black/15 pt-2">
                <div className="text-[11px] font-black uppercase text-black">🏷️ Klasifikasi Temuan</div>
                <div className="flex flex-wrap gap-1.5">
                  {(activeMode === "rtl"
                    ? [
                        { key: "OBSERVASI" as Klasifikasi, label: "🔍 Observasi" },
                        { key: "KTS_MINOR" as Klasifikasi, label: "⚠️ KTS Minor" },
                        { key: "KTS_MAYOR" as Klasifikasi, label: "🚨 KTS Mayor" },
                      ]
                    : [
                        { key: "MELAMPAUI" as Klasifikasi, label: "🌟 Melampaui" },
                        { key: "MENCAPAI" as Klasifikasi, label: "✅ Mencapai" },
                        { key: "OBSERVASI" as Klasifikasi, label: "🔍 Observasi" },
                        { key: "KTS_MINOR" as Klasifikasi, label: "⚠️ KTS Minor" },
                        { key: "KTS_MAYOR" as Klasifikasi, label: "🚨 KTS Mayor" },
                      ]
                  ).map(({ key, label }) => {
                    const active = klasifikasiFilter === key;
                    const count = klasifikasiCounts[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setKlasifikasiFilter(active ? "ALL" : key)}
                        className={
                          active
                            ? "btn px-2.5 py-1 text-[11px]"
                            : "btn-secondary px-2.5 py-1 text-[11px]"
                        }
                      >
                        {label} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Card 3: Aksi Cepat, Buka/Minimize Semua, Simpan & Kunci */}
          <div className="card space-y-2 p-3.5 text-xs">
            <div className="text-[11px] font-black uppercase text-black">⚡ Aksi Cepat</div>

            <div className="grid grid-cols-1 gap-1.5">
              {nextUnverifiedItem && (
                <button
                  type="button"
                  onClick={() => {
                    if (filterStandar !== "SEMUA" || statusFilter === "SUDAH_VERIF") {
                      setFilterStandar("SEMUA");
                      setStatusFilter("ALL");
                    }
                    scrollToAndExpandIndikator(nextUnverifiedItem.id);
                  }}
                  className="btn w-full justify-center py-1.5 text-xs"
                >
                  ⏭️ Lompat ke Belum Dicek Berikutnya
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (allVisibleExpanded) {
                    minimizeAll();
                  } else {
                    expandAllVisible(visibleFlatItems);
                  }
                }}
                className="btn-secondary w-full justify-center py-1.5 text-xs"
              >
                {allVisibleExpanded ? "🔼 Minimize Semua Kartu" : "🔽 Buka Semua Kartu"}
              </button>

              {buka && activeMode === "dokumen" && (
                <>
                  <button
                    type="button"
                    disabled={isPending || dirtyIds.length === 0}
                    onClick={() => handleSaveDokumen(undefined)}
                    className="btn-success w-full justify-center py-1.5 text-xs disabled:opacity-50"
                  >
                    {isPending && savingId === "ALL"
                      ? "Menyimpan..."
                      : dirtyIds.length > 0
                        ? `💾 Simpan Semua (${dirtyIds.length})`
                        : "💾 Simpan Semua"}
                  </button>
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleToggleLock(indikator.map((i) => i.id), true)}
                      className="btn justify-center px-2 py-1 text-[11px]"
                      title="Kunci Semua Dokumen (Tutup Upload Dosen)"
                    >
                      🔒 Kunci Dok
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleToggleLock(indikator.map((i) => i.id), false)}
                      className="btn-secondary justify-center px-2 py-1 text-[11px]"
                    >
                      🔓 Buka Kunci
                    </button>
                  </div>
                </>
              )}

              {buka && activeMode === "lapangan" && lapanganCount > 0 && (
                <>
                  <button
                    type="button"
                    disabled={isPending || dirtyIds.length === 0}
                    onClick={() => handleSaveLapangan(undefined)}
                    className="btn-success w-full justify-center py-1.5 text-xs disabled:opacity-50"
                  >
                    {isPending && savingId === "ALL"
                      ? "Menyimpan..."
                      : dirtyIds.length > 0
                        ? `💾 Simpan Semua (${dirtyIds.length})`
                        : "💾 Simpan Semua"}
                  </button>
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleToggleLockLapangan(lapanganTargetIds, true)}
                      className="btn justify-center px-2 py-1 text-[11px]"
                    >
                      🔒 Kunci Lap
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleToggleLockLapangan(lapanganTargetIds, false)}
                      className="btn-secondary justify-center px-2 py-1 text-[11px]"
                    >
                      🔓 Buka Kunci
                    </button>
                  </div>
                </>
              )}

              {activeMode === "rtl" && rtlCount > 0 && (
                <>
                  {buka && (
                    <button
                      type="button"
                      disabled={isPending || dirtyIds.length === 0}
                      onClick={() => handleSaveRtl(undefined)}
                      className="btn-success w-full justify-center py-1.5 text-xs disabled:opacity-50"
                    >
                      {isPending && savingId === "ALL"
                        ? "Menyimpan..."
                        : dirtyIds.length > 0
                          ? `💾 Simpan Semua (${dirtyIds.length})`
                          : "💾 Simpan Semua"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const allMinimized = rtlTargetIds.every((id) => minimizedRtlIds[id]);
                      if (allMinimized) {
                        setMinimizedRtlIds({});
                      } else {
                        const next: Record<string, boolean> = {};
                        for (const id of rtlTargetIds) next[id] = true;
                        setMinimizedRtlIds(next);
                      }
                    }}
                    className="btn-secondary w-full justify-center py-1 text-[11px]"
                  >
                    {rtlTargetIds.every((id) => minimizedRtlIds[id])
                      ? "🔽 Buka Detail Perbaikan"
                      : "🔼 Ringkas Detail Perbaikan"}
                  </button>
                  {buka && (
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleToggleLockRtl(rtlTargetIds, true)}
                        className="btn justify-center px-2 py-1 text-[11px]"
                      >
                        🔒 Kunci RTL
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleToggleLockRtl(rtlTargetIds, false)}
                        className="btn-secondary justify-center px-2 py-1 text-[11px]"
                      >
                        🔓 Buka Kunci
                      </button>
                    </div>
                  )}
                </>
              )}

              <a
                href={`/api/rekap-excel?periodeId=${encodeURIComponent(periodeId)}&print=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary w-full justify-center py-1.5 text-xs"
              >
                🖨️ Print Rekap Audit
              </a>

              <Link
                href={`/auditor/${encodeURIComponent(periodeId)}/ttd`}
                className="btn w-full justify-center py-1.5 text-xs"
              >
                ✍️ Halaman Tanda Tangan
              </Link>
            </div>
          </div>
        </aside>

        {/* AREA TENGAH / KANAN FULL UNTUK MENGECEK INDIKATOR */}
        <div className="space-y-3 lg:col-span-8 xl:col-span-9">
          {visibleGroups.map((group) => {
            const { groupItems } = group;

            return (
              <div key={group.standar} className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-black bg-[#CBD5E1] px-4 py-2.5 shadow-[3px_3px_0px_#000]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black text-[#0F172A]">📂 {group.standar}</span>
                    <span className="rounded-lg border border-black bg-[#EDF2F7] px-2 py-0.5 text-xs font-black text-[#0F172A]">
                      Indikator #{group.startIndex} – #{group.endIndex}
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
                  const isVerifiedLapangan = Boolean(verifiedLapanganMap[ind.id]);
                  const effKlas = getEffectiveKlasifikasi(ind.id);
                  const isExpanded = Boolean(expandedIds[ind.id]);

                  const cardStyle = dirty
                    ? "border-l-8 border-l-[#0F172A] bg-[#E2E8F0] text-[#0F172A] ring-2 ring-[#0F172A]"
                    : isCheckedInMode
                      ? "border-l-8 border-l-[#0F172A] bg-[#EDF2F7] text-[#0F172A]"
                      : "border-l-8 border-l-slate-500 bg-[#E6ECF2] text-[#0F172A]";

                  return (
                    <div
                      key={ind.id}
                      id={`auditor-ind-${ind.id}`}
                      className={`rounded-2xl border-2 border-black px-5 shadow-[4px_4px_0px_#000000] transition ${cardStyle} ${
                        isExpanded ? "space-y-3.5 py-4" : "py-3"
                      }`}
                    >
                      {/* Baris Header Indikator (Klik untuk Buka / Minimize, seragam dengan Auditee) */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleExpand(ind.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleExpand(ind.id);
                          }
                        }}
                        className={`flex cursor-pointer select-none flex-wrap items-center justify-between gap-2 ${
                          isExpanded ? "border-b-2 border-black/15 pb-3" : ""
                        }`}
                      >
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-[#CBD5E1] text-xs font-black text-[#0F172A]">
                            {isExpanded ? "▼" : "▶"}
                          </span>
                          <Badge tone="purple">Indikator #{noUrut}</Badge>
                          <code className="rounded-xl border border-black bg-[#BAE6FD] px-2.5 py-0.5 text-sm font-black text-[#0F172A]">
                            {ind.kode}
                          </code>
                          {!isExpanded ? (
                            <span className="line-clamp-1 max-w-xl text-base font-bold text-[#0F172A]">
                              {ind.pernyataan}
                            </span>
                          ) : (
                            <span className="text-base font-black text-[#0F172A]">{ind.standar}</span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {dirty && <Badge tone="amber">📝 Belum Disimpan</Badge>}
                          {isian?.linkDrive ? (
                            <Badge tone="blue">
                              📥 Ada Bukti{isian.diisiOleh ? ` (${isian.diisiOleh})` : ""}
                            </Badge>
                          ) : (
                            <Badge tone="red">Belum Ada Bukti</Badge>
                          )}
                          {isCheckedInMode ? (
                            <Badge tone="green">
                              ✅ Dicek{namaPemeriksa ? ` (${namaPemeriksa})` : ""}
                            </Badge>
                          ) : (
                            <Badge tone="amber">⏳ Belum Dicek</Badge>
                          )}
                          {effKlas && (
                            <Badge
                              tone={
                                effKlas === "MELAMPAUI" || effKlas === "MENCAPAI"
                                  ? "green"
                                  : effKlas === "OBSERVASI"
                                    ? "blue"
                                    : effKlas === "KTS_MINOR"
                                      ? "amber"
                                      : "red"
                              }
                            >
                              {KLASIFIKASI_LABEL[effKlas]}
                            </Badge>
                          )}
                          {isFokus && activeMode === "dokumen" && (
                            <Badge tone="amber">🎯 Klarifikasi Lapangan</Badge>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(ind.id);
                            }}
                            className="rounded-xl border-2 border-black bg-white px-3 py-1 text-xs font-black text-black hover:bg-[#FEF08A]"
                          >
                            {isExpanded ? "▲ Minimize" : "▼ Buka & Periksa"}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="space-y-3.5 pt-1">
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
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
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
                                    <a
                                      href={isian.linkDrive}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn-secondary shrink-0 px-3 py-1 text-xs"
                                    >
                                      📂 Buka Bukti Drive ↗
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                  {/* MODE 1: AUDIT DOKUMEN (DESK AUDIT) */}
                  {activeMode === "dokumen" && (
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
                  {activeMode === "lapangan" && (
                    <>
                      <div className="rounded-2xl border-2 border-[#0369A1] border-l-8 border-l-[#0284C7] bg-[#E0F2FE] p-4 space-y-1.5 text-base leading-relaxed text-[#0F172A] shadow-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-[#0C4A6E]">
                            📝 Catatan Audit Dokumen &amp; Pertanyaan Lapangan:
                          </span>
                          <Badge tone="amber">{STATUS_DOK_LABEL[sav.statusDokumen]}</Badge>
                        </div>
                        <div className="whitespace-pre-line font-bold text-[#0F172A]">
                          {sav.catatanDokumen?.trim() || cur.catatanDokumen?.trim() || (
                            <em className="font-semibold text-[#64748B]">
                              Tidak ada catatan tambahan dari Audit Dokumen
                            </em>
                          )}
                        </div>
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
                  {activeMode === "rtl" && (() => {
                    const parsedRtl = parseRtlData(isian?.rtlRencana);
                    const statusRtlCurrent = isian?.rtlStatus ?? sav.rtlStatus;
                    const isRtlMinimized = Boolean(minimizedRtlIds[ind.id]);
                    return (
                      <div className="space-y-3 pt-1">
                        <div className="rounded-2xl border-2 border-[#B45309] border-l-8 border-l-[#D97706] bg-[#FEF3C7] p-4 space-y-2.5 text-base leading-relaxed text-[#0F172A] shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="space-y-1 flex-1 min-w-[220px]">
                              <div>
                                <strong className="font-black text-[#78350F]">🚨 Temuan Lapangan:</strong>{" "}
                                <span className="font-bold">
                                  {KLASIFIKASI_LABEL[sav.klasifikasi]} —{" "}
                                  {sav.catatanLapangan || isian?.catatanLapangan || "—"}
                                </span>
                              </div>
                              <div>
                                <strong className="font-black text-[#78350F]">💡 Rekomendasi Auditor:</strong>{" "}
                                <span className="font-semibold">
                                  {sav.rekomendasi || isian?.rekomendasi || "—"}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleMinimizeRtl(ind.id)}
                              className="shrink-0 rounded-xl border-2 border-black bg-white px-3 py-1.5 text-xs font-black text-black shadow-[2px_2px_0px_#000] transition hover:bg-[#FDE68A]"
                            >
                              {isRtlMinimized
                                ? "🔽 Buka Tindakan Perbaikan"
                                : "🔼 Minimize Tindakan Perbaikan"}
                            </button>
                          </div>

                          {/* Ringkasan Singkat saat Tindakan Perbaikan di-Minimize */}
                          {isRtlMinimized ? (
                            <div
                              onClick={() => toggleMinimizeRtl(ind.id)}
                              className="cursor-pointer border-t-2 border-[#D97706]/40 pt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#78350F] hover:opacity-80"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-lg border border-[#B45309]/40 bg-white/90 px-2.5 py-1 text-[#0F172A]">
                                  👤 PIC: <strong>{parsedRtl.pic || "Belum diisi"}</strong>
                                </span>
                                <Badge
                                  tone={
                                    statusRtlCurrent === "TERVERIFIKASI" ||
                                    statusRtlCurrent === "SELESAI_AUDITEE"
                                      ? "green"
                                      : "amber"
                                  }
                                >
                                  {RTL_LABEL[statusRtlCurrent]}
                                </Badge>
                                <span className="rounded-lg border border-[#B45309]/40 bg-white/90 px-2.5 py-1 text-[#0F172A]">
                                  {parsedRtl.rencana
                                    ? "🛠️ Tindakan sudah diisi"
                                    : "⏳ Tindakan belum diisi"}
                                </span>
                                {isian?.rtlLinkBukti && (
                                  <span className="rounded-lg border border-[#B45309]/40 bg-[#DBEAFE] px-2.5 py-1 text-[#1E3A8A]">
                                    📂 Ada Link Bukti RTL
                                  </span>
                                )}
                              </div>
                              <span className="underline font-black">Klik untuk lihat detail ▾</span>
                            </div>
                          ) : (
                            <div className="border-t-2 border-[#D97706]/40 pt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <div className="rounded-xl border border-[#B45309]/30 bg-white/80 px-3 py-2">
                                <div className="text-xs font-black uppercase text-[#78350F]">
                                  👤 PIC Tindak Perbaikan
                                </div>
                                <div className="mt-0.5 font-black text-[#0F172A]">
                                  {parsedRtl.pic || <em className="font-semibold text-[#64748B]">Belum diisi</em>}
                                </div>
                              </div>

                              <div className="rounded-xl border border-[#B45309]/30 bg-white/80 px-3 py-2">
                                <div className="text-xs font-black uppercase text-[#78350F]">
                                  📌 Status Perbaikan (Auditee)
                                </div>
                                <div className="mt-1">
                                  <Badge
                                    tone={
                                      statusRtlCurrent === "TERVERIFIKASI" ||
                                      statusRtlCurrent === "SELESAI_AUDITEE"
                                        ? "green"
                                        : "amber"
                                    }
                                  >
                                    {RTL_LABEL[statusRtlCurrent]}
                                  </Badge>
                                </div>
                              </div>

                              <div className="rounded-xl border border-[#B45309]/30 bg-white/80 px-3 py-2 sm:col-span-2">
                                <div className="text-xs font-black uppercase text-[#78350F]">
                                  🛠️ Isi Tindakan Perbaikan
                                </div>
                                <div className="mt-0.5 font-bold text-[#0F172A]">
                                  {parsedRtl.rencana || (
                                    <em className="font-semibold text-[#64748B]">
                                      Belum diisi (Menunggu Perbaikan)
                                    </em>
                                  )}
                                </div>
                              </div>

                              <div className="rounded-xl border border-[#B45309]/30 bg-white/80 px-3 py-2 sm:col-span-2">
                                <div className="text-xs font-black uppercase text-[#78350F]">
                                  📂 Link Drive Bukti Perbaikan (RTL)
                                </div>
                                <div className="mt-0.5 truncate text-sm">
                                  {isian?.rtlLinkBukti ? (
                                    <a
                                      href={isian.rtlLinkBukti}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-mono font-bold text-[#1D4ED8] underline"
                                    >
                                      {isian.rtlLinkBukti}
                                    </a>
                                  ) : (
                                    <em className="font-semibold text-[#64748B]">
                                      Belum ada link bukti Drive
                                    </em>
                                  )}
                                </div>
                              </div>
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
                            <label>Verifikasi Status RTL ({RTL_LABEL[sav.rtlStatus]})</label>
                            <select
                              name="rtlStatus"
                              disabled={!buka}
                              value={cur.rtlStatus}
                              onChange={(e) =>
                                updateField(ind.id, "rtlStatus", e.target.value as StatusRtl)
                              }
                              className="w-full"
                            >
                              <option value="PROSES">⏳ Menunggu Perbaikan</option>
                              <option value="SELESAI_AUDITEE">✅ Selesai (Auditee)</option>
                              <option value="TERVERIFIKASI">🔒 Terverifikasi (Kunci RTL)</option>
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
                    );
                  })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {activeMode === "lapangan" && lapanganCount === 0 && (
            <Empty>
              Belum ada indikator dengan Status Dokumen &ldquo;🎯 Perlu Klarifikasi Lapangan&rdquo; yang disimpan pada tahap Audit Dokumen.
            </Empty>
          )}

          {activeMode === "rtl" && rtlCount === 0 && (
            <Empty>
              Belum ada temuan Audit Lapangan dengan Klasifikasi &ldquo;👀 Observasi (OB)&rdquo;, &ldquo;⚠️ KTS Minor&rdquo;, atau &ldquo;🚨 KTS Mayor&rdquo; yang disimpan.
            </Empty>
          )}
        </div>
      </div>
    </div>
  );
}
