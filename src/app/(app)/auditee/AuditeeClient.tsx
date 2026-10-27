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
  parseRtlData,
} from "@/lib/periode";
import { Badge } from "@/components/ui";
import { simpanBatchIsianAuditee, simpanRtlAuditeeClient } from "./actions";

export interface AuditeeIndikatorItem {
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

interface DraftEntry {
  klaim: string;
  linkDrive: string;
  rtlPic: string;
  rtlRencana: string;
  rtlLinkBukti: string;
  rtlStatus: "PROSES" | "SELESAI_AUDITEE";
}

export default function AuditeeClient({
  periodeId,
  unitId,
  buka,
  arsipId,
  indikator,
}: {
  periodeId: string;
  unitId: string;
  buka: boolean;
  arsipId?: string;
  indikator: AuditeeIndikatorItem[];
}) {
  const router = useRouter();
  const storageKey = `ami_auditee_draft_${periodeId}_${unitId}`;

  const [values, setValues] = useState<Record<string, DraftEntry>>(() => {
    const init: Record<string, DraftEntry> = {};
    for (const ind of indikator) {
      const parsedRtl = parseRtlData(ind.isian?.rtlRencana);
      init[ind.id] = {
        klaim: ind.isian?.klaim ?? "",
        linkDrive: ind.isian?.linkDrive ?? "",
        rtlPic: parsedRtl.pic,
        rtlRencana: parsedRtl.rencana,
        rtlLinkBukti: ind.isian?.rtlLinkBukti ?? "",
        rtlStatus:
          ind.isian?.rtlStatus === "SELESAI_AUDITEE" ? "SELESAI_AUDITEE" : "PROSES",
      };
    }
    return init;
  });

  const [savedValues, setSavedValues] = useState<
    Record<string, { klaim: string; linkDrive: string; diisiOleh: string | null }>
  >(() => {
    const init: Record<string, { klaim: string; linkDrive: string; diisiOleh: string | null }> = {};
    for (const ind of indikator) {
      init[ind.id] = {
        klaim: ind.isian?.klaim ?? "",
        linkDrive: ind.isian?.linkDrive ?? "",
        diisiOleh: ind.isian?.diisiOleh ?? null,
      };
    }
    return init;
  });
  const savedValuesRef = useRef(savedValues);
  useEffect(() => {
    savedValuesRef.current = savedValues;
  }, [savedValues]);

  // State buka/minimize per indikator (default semua ter-minimize agar ringkas)
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<{ ok?: string; err?: string } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [standarFilter, setStandarFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "BELUM" | "SUDAH" | "RTL">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [lastSavedManual, setLastSavedManual] = useState<{ nama: string; kode: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Muat draft localStorage HANYA sekali saat komponen pertama kali dibuka
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, Partial<DraftEntry>>;
      setValues((prev) => {
        const next = { ...prev };
        for (const ind of indikator) {
          if (ind.isian?.terverifikasiAuditor) continue;
          const d = parsed[ind.id];
          if (!d) continue;
          const dbKlaim = ind.isian?.klaim ?? "";
          const dbLink = ind.isian?.linkDrive ?? "";
          const parsedRtl = parseRtlData(ind.isian?.rtlRencana);
          const dbRtlPic = parsedRtl.pic;
          const dbRtlRencana = parsedRtl.rencana;
          const dbRtlLink = ind.isian?.rtlLinkBukti ?? "";
          const dbRtlStatus =
            ind.isian?.rtlStatus === "SELESAI_AUDITEE" ? "SELESAI_AUDITEE" : "PROSES";
          next[ind.id] = {
            klaim: d.klaim !== undefined && d.klaim !== "" ? d.klaim : dbKlaim,
            linkDrive: d.linkDrive !== undefined && d.linkDrive !== "" ? d.linkDrive : dbLink,
            rtlPic: d.rtlPic !== undefined && d.rtlPic !== "" ? d.rtlPic : dbRtlPic,
            rtlRencana: d.rtlRencana !== undefined && d.rtlRencana !== "" ? d.rtlRencana : dbRtlRencana,
            rtlLinkBukti: d.rtlLinkBukti !== undefined && d.rtlLinkBukti !== "" ? d.rtlLinkBukti : dbRtlLink,
            rtlStatus: d.rtlStatus ?? dbRtlStatus,
          };
        }
        return next;
      });
    } catch {
      // Abaikan
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Sinkronisasi Aman: Saat prop `indikator` berubah dari server, jangan pernah menimpa indikator yang sedang diketik oleh user ini.
  useEffect(() => {
    const currentSavMap = savedValuesRef.current;

    setValues((prevValues) => {
      const nextValues = { ...prevValues };
      for (const ind of indikator) {
        const cur = prevValues[ind.id];
        const prevSav = currentSavMap[ind.id];
        const isCurrentlyDirty =
          cur &&
          prevSav &&
          !ind.isian?.terverifikasiAuditor &&
          !ind.isian?.terverifikasiLapangan &&
          (cur.klaim.trim() !== prevSav.klaim.trim() ||
            cur.linkDrive.trim() !== prevSav.linkDrive.trim());

        if (!cur || !isCurrentlyDirty) {
          const parsedRtl = parseRtlData(ind.isian?.rtlRencana);
          nextValues[ind.id] = {
            klaim: ind.isian?.klaim ?? "",
            linkDrive: ind.isian?.linkDrive ?? "",
            rtlPic: cur?.rtlPic || parsedRtl.pic || "",
            rtlRencana: cur?.rtlRencana || parsedRtl.rencana || "",
            rtlLinkBukti: cur?.rtlLinkBukti || ind.isian?.rtlLinkBukti || "",
            rtlStatus:
              cur?.rtlStatus ||
              (ind.isian?.rtlStatus === "SELESAI_AUDITEE" ? "SELESAI_AUDITEE" : "PROSES"),
          };
        }
      }
      return nextValues;
    });

    setSavedValues((prevSaved) => {
      const nextSaved = { ...prevSaved };
      for (const ind of indikator) {
        nextSaved[ind.id] = {
          klaim: ind.isian?.klaim ?? "",
          linkDrive: ind.isian?.linkDrive ?? "",
          diisiOleh: ind.isian?.diisiOleh ?? null,
        };
      }
      savedValuesRef.current = nextSaved;
      return nextSaved;
    });
  }, [indikator]);

  const updateField = (indId: string, field: keyof DraftEntry, val: string) => {
    setValues((prev) => {
      const current = prev[indId] ?? {
        klaim: "",
        linkDrive: "",
        rtlPic: "",
        rtlRencana: "",
        rtlLinkBukti: "",
        rtlStatus: "PROSES",
      };
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

  const isDirty = (indId: string) => {
    const ind = indikator.find((i) => i.id === indId);
    if (ind?.isian?.terverifikasiAuditor) return false;
    const cur = values[indId];
    const sav = savedValues[indId];
    if (!cur || !sav) return false;
    return cur.klaim.trim() !== sav.klaim.trim() || cur.linkDrive.trim() !== sav.linkDrive.trim();
  };

  const dirtyIds = indikator.map((i) => i.id).filter(isDirty);

  // Toggle buka/tutup mandiri per kartu: TIDAK menutup kartu lain di atasnya agar layar tidak pernah loncat ke atas
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

  const expandAllVisible = (visibleItems: AuditeeIndikatorItem[]) => {
    setExpandedIds((prev) => {
      const next = { ...prev };
      for (const item of visibleItems) {
        next[item.id] = true;
      }
      return next;
    });
  };

  const minimizeAll = () => {
    setExpandedIds({});
  };

  // Cari indikator berikutnya yang belum diisi link Drive-nya (hanya untuk tombol manual "Lompat ke Belum Diisi")
  const findNextUnfinishedId = (
    afterId?: string,
    justSavedSet?: Set<string>
  ): string | null => {
    const isUnfinished = (ind: AuditeeIndikatorItem) => {
      if (justSavedSet?.has(ind.id)) return false;
      if (ind.isian?.terverifikasiAuditor || ind.isian?.terverifikasiLapangan) return false;
      const savDrive = (savedValues[ind.id]?.linkDrive ?? ind.isian?.linkDrive ?? "").trim();
      return !savDrive;
    };

    if (afterId) {
      const idx = indikator.findIndex((i) => i.id === afterId);
      if (idx >= 0) {
        for (let i = idx + 1; i < indikator.length; i++) {
          if (isUnfinished(indikator[i])) return indikator[i].id;
        }
      }
    }
    const first = indikator.find(isUnfinished);
    return first ? first.id : null;
  };

  const scrollToAndExpandIndikator = (indId: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [indId]: true,
    }));
    setTimeout(() => {
      const el = document.getElementById(`auditee-ind-${indId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);
  };

  const handleSaveIndikator = (targetIndikatorId?: string) => {
    setNotice(null);
    setSavingId(targetIndikatorId ?? "ALL");

    startTransition(async () => {
      // Jika klik Simpan di 1 kartu indikator, HANYA simpan 1 indikator itu saja.
      // Jika klik Simpan Semua (targetIndikatorId === undefined), baru simpan semua indikator yang dirty.
      const payloadItems = indikator
        .filter(
          (ind) =>
            !ind.isian?.terverifikasiAuditor &&
            (targetIndikatorId ? ind.id === targetIndikatorId : isDirty(ind.id))
        )
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

      if (res.savedIds && res.savedIds.length > 0) {
        const lastSavedId = res.savedIds[res.savedIds.length - 1];
        const lastSavedInd = indikator.find((i) => i.id === lastSavedId);
        if (lastSavedInd && res.diisiOleh) {
          setLastSavedManual({ nama: res.diisiOleh, kode: lastSavedInd.kode });
        }
        setSavedValues((prev) => {
          const next = { ...prev };
          for (const id of res.savedIds!) {
            next[id] = {
              klaim: values[id]?.klaim ?? "",
              linkDrive: values[id]?.linkDrive ?? "",
              diisiOleh: res.diisiOleh ?? prev[id]?.diisiOleh ?? null,
            };
          }
          savedValuesRef.current = next;
          return next;
        });

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

      setNotice({ ok: res.message ?? "Tersimpan." });
    });
  };

  const handleSaveRtl = (indId: string, isianId: string) => {
    setNotice(null);
    setSavingId(`RTL_${indId}`);

    startTransition(async () => {
      const cur = values[indId];
      const res = await simpanRtlAuditeeClient({
        isianId,
        rtlPic: cur?.rtlPic ?? "",
        rtlRencana: cur?.rtlRencana ?? "",
        rtlLinkBukti: cur?.rtlLinkBukti ?? "",
        rtlStatus: cur?.rtlStatus === "SELESAI_AUDITEE" ? "SELESAI_AUDITEE" : "PROSES",
      });
      setSavingId(null);

      if (!res.ok) {
        setNotice({ err: res.error ?? "Gagal menyimpan RTL." });
        return;
      }

      setNotice({ ok: res.message ?? "RTL disimpan." });
      router.refresh();
    });
  };

  // Cari hanya 1 Save Terakhir (bukan daftar panjang semua indikator per orang)
  let totalTersimpan = 0;
  let totalWajibRtl = 0;
  let totalLockedAuditor = 0;
  let latestDbEntry: { nama: string; kode: string; ts: number } | null = null;

  for (const ind of indikator) {
    const savDrive = (savedValues[ind.id]?.linkDrive ?? ind.isian?.linkDrive ?? "").trim();
    if (savDrive) totalTersimpan++;
    if (ind.isian?.klasifikasi && BUTUH_RTL.includes(ind.isian.klasifikasi)) totalWajibRtl++;
    if (ind.isian?.terverifikasiAuditor || ind.isian?.terverifikasiLapangan) totalLockedAuditor++;
    const namaPengisi = savedValues[ind.id]?.diisiOleh ?? ind.isian?.diisiOleh;
    if (namaPengisi) {
      const ts = ind.isian?.updatedAt ? new Date(ind.isian.updatedAt).getTime() : 1;
      if (!latestDbEntry || ts >= latestDbEntry.ts) {
        latestDbEntry = { nama: namaPengisi, kode: ind.kode, ts };
      }
    }
  }
  const latestSavedDisplay = lastSavedManual ?? (latestDbEntry ? { nama: latestDbEntry.nama, kode: latestDbEntry.kode } : null);
  const totalBelumDiisi = Math.max(0, indikator.length - totalTersimpan);
  const persenTerisi = indikator.length > 0 ? Math.round((totalTersimpan / indikator.length) * 100) : 0;
  const persenAuditor = indikator.length > 0 ? Math.round((totalLockedAuditor / indikator.length) * 100) : 0;

  const qNorm = searchQuery.trim().toLowerCase();
  const matchesFilterAndSearch = (ind: AuditeeIndikatorItem, noUrut: number) => {
    const savDrive = Boolean((savedValues[ind.id]?.linkDrive ?? ind.isian?.linkDrive ?? "").trim());
    const perluRtl = Boolean(ind.isian?.klasifikasi && BUTUH_RTL.includes(ind.isian.klasifikasi));

    if (statusFilter === "BELUM" && savDrive) return false;
    if (statusFilter === "SUDAH" && !savDrive) return false;
    if (statusFilter === "RTL" && !perluRtl) return false;

    if (qNorm) {
      const hay = `#${noUrut} ${ind.kode} ${ind.standar} ${ind.pernyataanStandar ?? ""} ${ind.pernyataan} ${ind.buktiDiminta ?? ""}`.toLowerCase();
      if (!hay.includes(qNorm)) return false;
    }
    return true;
  };

  const allGroups = groupIndikatorByStandar(indikator);
  const visibleGroups = (
    standarFilter === "ALL"
      ? allGroups
      : allGroups.filter((g) => g.standar === standarFilter)
  )
    .map((g) => ({
      ...g,
      filteredItems: g.items.filter(({ item, noUrut }) => matchesFilterAndSearch(item, noUrut)),
    }))
    .filter((g) => g.filteredItems.length > 0);

  const visibleFlatItems = visibleGroups.flatMap((g) => g.filteredItems.map((x) => x.item));
  const allVisibleExpanded =
    visibleFlatItems.length > 0 && visibleFlatItems.every((item) => Boolean(expandedIds[item.id]));
  const nextUnfinishedCandidateId = findNextUnfinishedId();

  return (
    <div className="space-y-4">
      {/* Notifikasi Melayang (Floating Bottom-Right) agar munculnya notifikasi TIDAK menggeser posisi layar */}
      {(notice?.ok || notice?.err) && (
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
        </div>
      )}

      {/* Bar Progres Visual + Filter Standar SPMI + Filter Status + Search Cepat */}
      <div className="card space-y-3 py-3.5 text-xs">
        {/* 1. Progress Bar Visual Kesiapan Auditee & Verifikasi Auditor */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="rounded-xl border-2 border-black bg-[#EDF2F7] p-2.5 space-y-1.5">
            <div className="flex items-center justify-between font-black text-[#0F172A]">
              <span>📊 Progres Bukti Auditee</span>
              <span>
                {totalTersimpan} / {indikator.length} Indikator ({persenTerisi}%)
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full border border-black bg-[#CBD5E1]">
              <div
                className="h-full bg-[#22C55E] transition-all duration-300"
                style={{ width: `${persenTerisi}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border-2 border-black bg-[#EDF2F7] p-2.5 space-y-1.5">
            <div className="flex items-center justify-between font-black text-[#0F172A]">
              <span>🕵️ Diverifikasi Auditor</span>
              <span>
                {totalLockedAuditor} / {indikator.length} Indikator ({persenAuditor}%)
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full border border-black bg-[#CBD5E1]">
              <div
                className="h-full bg-[#38BDF8] transition-all duration-300"
                style={{ width: `${persenAuditor}%` }}
              />
            </div>
          </div>
        </div>

        {/* 2. Dropdown Standar SPMI + Tombol Lompat ke Belum Diisi + Toggle Buka/Minimize */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <label htmlFor="select-standar-spmi" className="shrink-0 font-black uppercase text-black">
              📂 Standar SPMI:
            </label>
            <select
              id="select-standar-spmi"
              value={standarFilter}
              onChange={(e) => setStandarFilter(e.target.value)}
              className="min-w-[240px] max-w-full flex-1 rounded-xl border-2 border-black bg-white px-3 py-1.5 text-xs font-black text-black sm:max-w-md"
            >
              <option value="ALL">
                Semua Standar ({allGroups.length} Standar — {indikator.length} Indikator)
              </option>
              {allGroups.map((g, idx) => {
                const savedInGroup = g.items.filter(({ item }) =>
                  Boolean((savedValues[item.id]?.linkDrive ?? item.isian?.linkDrive ?? "").trim()),
                ).length;
                return (
                  <option key={g.standar} value={g.standar}>
                    {idx + 1}. {g.standar} (#{g.startIndex}–#{g.endIndex}) — {savedInGroup}/{g.items.length} Terisi
                  </option>
                );
              })}
            </select>
            {standarFilter !== "ALL" && (
              <button
                type="button"
                onClick={() => setStandarFilter("ALL")}
                className="btn-secondary px-2.5 py-1 text-xs"
                title="Tampilkan kembali semua standar"
              >
                ✕ Semua
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {nextUnfinishedCandidateId && (
              <button
                type="button"
                onClick={() => {
                  if (standarFilter !== "ALL" || statusFilter === "SUDAH") {
                    setStandarFilter("ALL");
                    setStatusFilter("ALL");
                  }
                  scrollToAndExpandIndikator(nextUnfinishedCandidateId);
                }}
                className="btn px-3 py-1 text-xs"
              >
                ⏭️ Buka Belum Diisi Berikutnya
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
              className="btn-secondary px-3 py-1 text-xs"
            >
              {allVisibleExpanded ? "🔼 Minimize Semua" : "🔽 Buka Semua"}
            </button>
            {buka && (
              <button
                type="button"
                disabled={isPending || dirtyIds.length === 0}
                onClick={() => handleSaveIndikator(undefined)}
                className="btn-success px-3 py-1 text-xs disabled:opacity-50"
              >
                {isPending && savingId === "ALL"
                  ? "Menyimpan..."
                  : dirtyIds.length > 0
                    ? `💾 Simpan Semua (${dirtyIds.length})`
                    : "💾 Simpan Semua"}
              </button>
            )}
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
              Semua ({indikator.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("BELUM")}
              className={statusFilter === "BELUM" ? "btn px-2.5 py-1 text-xs" : "btn-secondary px-2.5 py-1 text-xs"}
            >
              ⏳ Belum Diisi ({totalBelumDiisi})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("SUDAH")}
              className={statusFilter === "SUDAH" ? "btn px-2.5 py-1 text-xs" : "btn-secondary px-2.5 py-1 text-xs"}
            >
              ✅ Sudah Diisi ({totalTersimpan})
            </button>
            {totalWajibRtl > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter("RTL")}
                className={statusFilter === "RTL" ? "btn px-2.5 py-1 text-xs" : "btn-secondary px-2.5 py-1 text-xs"}
              >
                🛠️ Wajib RTL ({totalWajibRtl})
              </button>
            )}
          </div>

          <div className="flex min-w-[220px] flex-1 items-center gap-1.5 sm:max-w-xs">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Cari kode / indikator / bukti..."
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

        {/* Tampilkan Hanya 1 Save Terakhir agar Ringkas & Tidak Merusak Tampilan */}
        {latestSavedDisplay && (
          <div className="flex flex-wrap items-center gap-2 border-t border-black/15 pt-2">
            <span className="text-xs font-black uppercase text-[#0F172A]">🕒 Save Terakhir:</span>
            <Badge tone="blue">
              👤 {latestSavedDisplay.nama} — Indikator {latestSavedDisplay.kode}
            </Badge>
          </div>
        )}
      </div>

      {visibleGroups.map((group) => {
        const groupSavedCount = group.items.filter(({ item }) =>
          Boolean((savedValues[item.id]?.linkDrive ?? item.isian?.linkDrive ?? "").trim()),
        ).length;

        return (
          <div key={group.standar} className="space-y-2.5 pt-1">
            {/* Kepala Kelompok Standar (Opsi 1: Soft Cool Slate) */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-black bg-[#CBD5E1] px-4 py-2.5 shadow-[3px_3px_0px_#000]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-black text-[#0F172A]">📂 {group.standar}</span>
                <Badge tone="slate">
                  Indikator #{group.startIndex} – #{group.endIndex}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={groupSavedCount === group.items.length ? "green" : "blue"}>
                  ✓ {groupSavedCount}/{group.items.length} Terisi
                </Badge>
              </div>
            </div>

            {group.filteredItems.map(({ item: ind, noUrut }) => {
              const isian = ind.isian;
              const cur = values[ind.id] ?? { klaim: "", linkDrive: "", rtlRencana: "", rtlLinkBukti: "" };
              const sav = savedValues[ind.id] ?? { klaim: "", linkDrive: "", diisiOleh: null };
              const dirty = isDirty(ind.id);
              const hasSavedDrive = Boolean(sav.linkDrive.trim());
              const lockedByAuditor = Boolean(isian?.terverifikasiAuditor || isian?.terverifikasiLapangan);
              const lockedLapangan = Boolean(isian?.terverifikasiLapangan);
              const canEdit = buka && !lockedByAuditor;
              const perluRtl = isian?.klasifikasi && BUTUH_RTL.includes(isian.klasifikasi);
              const namaPengisi = sav.diisiOleh ?? isian?.diisiOleh;
              const isExpanded = Boolean(expandedIds[ind.id]);

              // Opsi 1: Soft Cool Slate (#EDF2F7 / #E2E8F0) — Sejuk di mata, 0% silau putih/kuning, tulisan hitam arang 16px tajam
              const cardStyle = dirty
                ? "border-l-8 border-l-[#0F172A] bg-[#E2E8F0] text-[#0F172A] ring-2 ring-[#0F172A]"
                : hasSavedDrive
                  ? "border-l-8 border-l-[#0F172A] bg-[#EDF2F7] text-[#0F172A]"
                  : "border-l-8 border-l-slate-500 bg-[#E6ECF2] text-[#0F172A]";

              return (
                <div
                  key={ind.id}
                  id={`auditee-ind-${ind.id}`}
                  className={`rounded-2xl border-2 border-black px-5 shadow-[4px_4px_0px_#000000] transition ${cardStyle} ${
                    isExpanded ? "space-y-3.5 py-4" : "py-3"
                  }`}
                >
                  {/* Baris Header Indikator (Klik untuk Buka / Minimize) */}
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
                        <span className="line-clamp-1 max-w-2xl text-base font-bold text-[#0F172A]">
                          {ind.pernyataan}
                        </span>
                      ) : (
                        <span className="text-base font-black text-[#0F172A]">{ind.standar}</span>
                      )}
                    </div>

                    {/* Tanda Status Visual (Sangat Jelas Saat Minimize Maupun Expand) */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {dirty && <Badge tone="amber">📝 Belum Disimpan</Badge>}

                      {hasSavedDrive ? (
                        <Badge tone="green">
                          ✅ SUDAH DIISI{namaPengisi ? ` (${namaPengisi})` : ""}
                        </Badge>
                      ) : (
                        <Badge tone="amber">⏳ BELUM DIISI</Badge>
                      )}

                      {lockedByAuditor && (
                        <Badge tone="purple">
                          🔒 Dikunci Auditor{isian?.diperiksaOleh ? ` (${isian.diperiksaOleh})` : ""}
                        </Badge>
                      )}

                      {lockedLapangan && (
                        <Badge tone="purple">🔒 Lapangan Terverifikasi</Badge>
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
                          {KLASIFIKASI_LABEL[isian.klasifikasi]}
                        </Badge>
                      )}

                      {perluRtl && (
                        <Badge tone={isian?.rtlStatus === "TERVERIFIKASI" ? "green" : "red"}>
                          🛠️ RTL: {RTL_LABEL[isian!.rtlStatus]}
                        </Badge>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(ind.id);
                        }}
                        className="rounded-xl border-2 border-black bg-white px-3 py-1 text-xs font-black text-black hover:bg-[#FEF08A]"
                      >
                        {isExpanded ? "▲ Minimize" : canEdit ? "▼ Buka & Isi" : "▼ Lihat"}
                      </button>
                    </div>
                  </div>

                  {/* Isi Lengkap Indikator & Form Pengisian (Hanya tampil saat Expanded) */}
                  {isExpanded && (
                    <div className="space-y-3.5 pt-1">
                      {ind.pernyataanStandar && (
                        <div className="rounded-xl border border-black/25 bg-[#E2E8F0] px-4 py-3 text-base font-semibold leading-relaxed text-[#0F172A]">
                          <strong className="font-black text-[#0F172A]">📜 Isi Pernyataan Standar:</strong>{" "}
                          {ind.pernyataanStandar}
                        </div>
                      )}

                      {/* Kotak Gabungan Ter-Highlight: Indikator Kinerja + Dokumen Bukti + Form Evaluasi Diri & Link Drive */}
                      <div className="rounded-2xl border-2 border-[#1E3A8A] border-l-8 border-l-[#1D4ED8] bg-[#DCE5EF] p-4 space-y-3 text-[#0F172A] shadow-sm">
                        <div className="text-base font-bold leading-relaxed">
                          <strong className="font-black text-[#0F172A]">🎯 Indikator Kinerja ({ind.kode}):</strong>{" "}
                          {ind.pernyataan}
                        </div>

                        {ind.buktiDiminta && (
                          <div className="text-[15px] font-semibold leading-relaxed text-[#1E293B]">
                            <strong className="font-black text-[#0F172A]">📋 Dokumen Bukti yang Diminta:</strong>{" "}
                            {ind.buktiDiminta}
                          </div>
                        )}

                        {/* Form Evaluasi Diri & Link Google Drive */}
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleSaveIndikator(ind.id);
                          }}
                          className="grid grid-cols-1 gap-3.5 border-t-2 border-[#94A3B8] pt-3 md:grid-cols-2"
                        >
                          <div className="space-y-1.5">
                            <label className="!text-sm !font-black !text-[#1E3A8A]">✍️ Evaluasi Diri Auditee</label>
                            <textarea
                              name="klaim"
                              rows={3}
                              required
                              disabled={!canEdit}
                              value={cur.klaim}
                              onChange={(e) => updateField(ind.id, "klaim", e.target.value)}
                              placeholder="Ketik evaluasi diri di sini..."
                              className="w-full text-base font-semibold !border-2 !border-black !bg-[#F8FAFC] !text-[#0F172A] focus:!bg-white disabled:!bg-slate-200"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="!text-sm !font-black !text-[#1E3A8A]">📂 Link Google Drive Bukti</label>
                            <div className="flex gap-2">
                              <input
                                name="linkDrive"
                                type="url"
                                required
                                disabled={!canEdit}
                                value={cur.linkDrive}
                                onChange={(e) => updateField(ind.id, "linkDrive", e.target.value)}
                                placeholder="https://drive.google.com/..."
                                className="w-full font-mono text-sm font-bold !border-2 !border-black !bg-[#F8FAFC] !text-[#0F172A] focus:!bg-white disabled:!bg-slate-200"
                              />
                              {canEdit && (
                                <button
                                  type="submit"
                                  disabled={isPending}
                                  className="btn shrink-0 text-sm"
                                >
                                  {isPending && (savingId === ind.id || savingId === "ALL")
                                    ? "..."
                                    : "💾 Simpan"}
                                </button>
                              )}
                            </div>
                            {(sav.linkDrive || cur.linkDrive) && (
                              <div className="pt-1 text-right text-sm">
                                <a
                                  href={cur.linkDrive || sav.linkDrive}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-black text-blue-700 underline hover:text-black"
                                >
                                  ↗ Buka Dokumen di Google Drive
                                </a>
                              </div>
                            )}
                          </div>
                        </form>
                      </div>

                      {/* Catatan Auditor (Jika sudah diperiksa) */}
                      {(isian?.catatanDokumen || isian?.catatanLapangan || isian?.rekomendasi) && (
                        <div className="space-y-1.5 rounded-2xl border-2 border-black bg-[#FAF7EE] p-4 text-sm font-semibold text-black">
                          {isian.diperiksaOleh && (
                            <div className="font-black text-black">🕵️ Diperiksa Auditor: {isian.diperiksaOleh}</div>
                          )}
                          {isian.catatanDokumen && (
                            <div>
                              <strong className="font-black text-black">
                                Catatan Dokumen ({STATUS_DOK_LABEL[isian.statusDokumen]}):
                              </strong>{" "}
                              {isian.catatanDokumen}
                            </div>
                          )}
                          {isian.catatanLapangan && (
                            <div>
                              <strong className="font-black text-black">Temuan Lapangan:</strong>{" "}
                              {isian.catatanLapangan}
                            </div>
                          )}
                          {isian.rekomendasi && (
                            <div>
                              <strong className="font-black text-black">Rekomendasi:</strong>{" "}
                              {isian.rekomendasi}
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
                          className="space-y-3 rounded-2xl border-2 border-black bg-[#FEF9C3] p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-black text-black">
                              🛠️ Tindak Lanjut Perbaikan (RTL) — {KLASIFIKASI_LABEL[isian.klasifikasi!]}
                            </span>
                            <Badge tone={isian.rtlStatus === "TERVERIFIKASI" ? "green" : isian.rtlStatus === "SELESAI_AUDITEE" ? "blue" : "amber"}>
                              {RTL_LABEL[isian.rtlStatus]}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                            <div className="space-y-1">
                              <label className="!text-sm !font-black !text-black">
                                👤 PIC Tindak Perbaikan
                              </label>
                              <input
                                name="rtlPic"
                                required
                                disabled={!buka || isian.rtlStatus === "TERVERIFIKASI"}
                                value={cur.rtlPic}
                                onChange={(e) => updateField(ind.id, "rtlPic", e.target.value)}
                                placeholder="Misal: Rektor / Dekan / Kaprodi..."
                                className="w-full text-sm font-bold !border-2 !border-black !bg-white !text-black"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="!text-sm !font-black !text-black">
                                🛠️ Tindakan Perbaikan
                              </label>
                              <input
                                name="rtlRencana"
                                disabled={!buka || isian.rtlStatus === "TERVERIFIKASI"}
                                value={cur.rtlRencana}
                                onChange={(e) => updateField(ind.id, "rtlRencana", e.target.value)}
                                placeholder="Isi tindakan (boleh kosong jika menunggu)..."
                                className="w-full text-sm !border-2 !border-black !bg-white !text-black"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="!text-sm !font-black !text-black">
                                📂 Link Drive Bukti RTL
                              </label>
                              <input
                                name="rtlLinkBukti"
                                type="url"
                                disabled={!buka || isian.rtlStatus === "TERVERIFIKASI"}
                                value={cur.rtlLinkBukti}
                                onChange={(e) => updateField(ind.id, "rtlLinkBukti", e.target.value)}
                                placeholder="https://drive.google.com/... (opsional)"
                                className="w-full font-mono text-sm !border-2 !border-black !bg-white !text-black"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="!text-sm !font-black !text-black">
                                📌 Status Perbaikan
                              </label>
                              <div className="flex gap-2">
                                <select
                                  name="rtlStatus"
                                  disabled={!buka || isian.rtlStatus === "TERVERIFIKASI"}
                                  value={cur.rtlStatus}
                                  onChange={(e) =>
                                    updateField(
                                      ind.id,
                                      "rtlStatus",
                                      e.target.value === "SELESAI_AUDITEE"
                                        ? "SELESAI_AUDITEE"
                                        : "PROSES"
                                    )
                                  }
                                  className="w-full text-sm font-bold !border-2 !border-black !bg-white !text-black"
                                >
                                  <option value="PROSES">⏳ Menunggu Perbaikan</option>
                                  <option value="SELESAI_AUDITEE">✅ Selesai</option>
                                </select>

                                {buka && isian.rtlStatus !== "TERVERIFIKASI" && (
                                  <button
                                    type="submit"
                                    disabled={isPending}
                                    className="btn shrink-0 text-xs"
                                  >
                                    {isPending && savingId === `RTL_${ind.id}` ? "..." : "💾 Simpan"}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {isian.rtlCatatanAuditor && (
                            <div className="text-sm font-semibold text-black">
                              <strong className="font-black text-black">Catatan RTL Auditor:</strong>{" "}
                              {isian.rtlCatatanAuditor}
                            </div>
                          )}
                        </form>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
