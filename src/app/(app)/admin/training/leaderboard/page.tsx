import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { one, type SP } from "@/components/ui";
import LeaderboardClient, {
  type IndividualRankItem,
  type TeamRaceItem,
} from "./LeaderboardClient";

export const dynamic = "force-dynamic";

export default async function TrainingLeaderboardPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  await requireUser("SUPER_ADMIN", "LPM");
  const sp = await searchParams;
  const rawMode = one(sp.mode);
  const initialMode: "auditee" | "auditor" =
    rawMode === "auditor" ? "auditor" : "auditee";

  const trainingPeriodes = await prisma.periode.findMany({
    where: { isTraining: true },
    include: {
      indikator: {
        select: {
          id: true,
          kode: true,
          isian: {
            select: {
              id: true,
              unitId: true,
              klaim: true,
              linkDrive: true,
              diisiOleh: true,
              statusDokumen: true,
              catatanDokumen: true,
              klasifikasi: true,
              rekomendasi: true,
              diperiksaOleh: true,
              terverifikasiAuditor: true,
              updatedAt: true,
            },
          },
        },
      },
      trainingUsers: {
        select: {
          id: true,
          nama: true,
          username: true,
          role: true,
        },
        orderBy: { nama: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const teams: TeamRaceItem[] = [];
  const auditeeMap = new Map<string, IndividualRankItem>();
  const auditorMap = new Map<string, IndividualRankItem>();

  for (const tp of trainingPeriodes) {
    const totalIndikator = tp.indikator.length;
    const auditeeUsers = tp.trainingUsers.filter((u) => u.role === "AUDITEE");
    const auditorUsers = tp.trainingUsers.filter((u) => u.role === "AUDITOR");

    // Pre-seed assigned Auditee & Auditor members so everyone appears in the standings even at 0
    for (const u of auditeeUsers) {
      const key = `${tp.id}|||${u.nama.trim().toLowerCase()}`;
      auditeeMap.set(key, {
        key,
        nama: u.nama,
        username: u.username,
        namaKelompok: tp.nama,
        count: 0,
        totalGroupIndikator: totalIndikator,
        pctOfGroup: 0,
        latestKode: null,
        latestAt: null,
      });
    }

    for (const u of auditorUsers) {
      const key = `${tp.id}|||${u.nama.trim().toLowerCase()}`;
      auditorMap.set(key, {
        key,
        nama: u.nama,
        username: u.username,
        namaKelompok: tp.nama,
        count: 0,
        verifiedCount: 0,
        totalGroupIndikator: totalIndikator,
        pctOfGroup: 0,
        latestKode: null,
        latestAt: null,
      });
    }

    let auditeeFilledCount = 0;
    let auditeeLatestBy: string | null = null;
    let auditeeLatestKode: string | null = null;
    let auditeeLatestTime = 0;

    let auditorCheckedCount = 0;
    let auditorVerifiedCount = 0;
    let auditorLatestBy: string | null = null;
    let auditorLatestKode: string | null = null;
    let auditorLatestTime = 0;

    for (const ind of tp.indikator) {
      // Pick the isian matching tp.unitId (or the first available isian for this training indicator)
      const isian =
        (tp.unitId
          ? ind.isian.find((is) => is.unitId === tp.unitId)
          : ind.isian[0]) ?? ind.isian[0];

      if (!isian) continue;

      const updatedMs = isian.updatedAt ? new Date(isian.updatedAt).getTime() : 0;
      const updatedIso = isian.updatedAt ? isian.updatedAt.toISOString() : null;

      // 1. Check Auditee Fill
      const isAuditeeFilled = Boolean(
        (isian.klaim && isian.klaim.trim().length > 0) ||
          (isian.linkDrive && isian.linkDrive.trim().length > 0),
      );
      if (isAuditeeFilled) {
        auditeeFilledCount++;
        const fillerName = isian.diisiOleh?.trim() || null;
        if (fillerName) {
          if (updatedMs >= auditeeLatestTime) {
            auditeeLatestTime = updatedMs;
            auditeeLatestBy = fillerName;
            auditeeLatestKode = ind.kode;
          }

          const key = `${tp.id}|||${fillerName.toLowerCase()}`;
          const existing = auditeeMap.get(key);
          if (existing) {
            existing.count += 1;
            const prevMs = existing.latestAt
              ? new Date(existing.latestAt).getTime()
              : 0;
            if (updatedMs >= prevMs) {
              existing.latestAt = updatedIso;
              existing.latestKode = ind.kode;
            }
          } else {
            auditeeMap.set(key, {
              key,
              nama: fillerName,
              username: null,
              namaKelompok: tp.nama,
              count: 1,
              totalGroupIndikator: totalIndikator,
              pctOfGroup: 0,
              latestKode: ind.kode,
              latestAt: updatedIso,
            });
          }
        }
      }

      // 2. Check Auditor Evaluation
      const isAuditorChecked = Boolean(
        (isian.diperiksaOleh && isian.diperiksaOleh.trim().length > 0) ||
          isian.statusDokumen !== "BELUM_DICEK" ||
          isian.klasifikasi !== null ||
          isian.terverifikasiAuditor ||
          (isian.catatanDokumen && isian.catatanDokumen.trim().length > 0),
      );
      if (isAuditorChecked) {
        auditorCheckedCount++;
        if (isian.terverifikasiAuditor) {
          auditorVerifiedCount++;
        }
        const checkerName = isian.diperiksaOleh?.trim() || null;
        if (checkerName) {
          if (updatedMs >= auditorLatestTime) {
            auditorLatestTime = updatedMs;
            auditorLatestBy = checkerName;
            auditorLatestKode = ind.kode;
          }

          const key = `${tp.id}|||${checkerName.toLowerCase()}`;
          const existing = auditorMap.get(key);
          if (existing) {
            existing.count += 1;
            if (isian.terverifikasiAuditor) {
              existing.verifiedCount = (existing.verifiedCount ?? 0) + 1;
            }
            const prevMs = existing.latestAt
              ? new Date(existing.latestAt).getTime()
              : 0;
            if (updatedMs >= prevMs) {
              existing.latestAt = updatedIso;
              existing.latestKode = ind.kode;
            }
          } else {
            auditorMap.set(key, {
              key,
              nama: checkerName,
              username: null,
              namaKelompok: tp.nama,
              count: 1,
              verifiedCount: isian.terverifikasiAuditor ? 1 : 0,
              totalGroupIndikator: totalIndikator,
              pctOfGroup: 0,
              latestKode: ind.kode,
              latestAt: updatedIso,
            });
          }
        }
      }
    }

    const auditeePct =
      totalIndikator > 0
        ? Math.round((auditeeFilledCount / totalIndikator) * 1000) / 10
        : 0;
    const auditorPct =
      totalIndikator > 0
        ? Math.round((auditorCheckedCount / totalIndikator) * 1000) / 10
        : 0;

    teams.push({
      periodeId: tp.id,
      namaKelompok: tp.nama,
      totalIndikator,
      auditeeFilledCount,
      auditeePct,
      auditeeLatestBy,
      auditeeLatestKode,
      auditeeLatestAt:
        auditeeLatestTime > 0 ? new Date(auditeeLatestTime).toISOString() : null,
      auditeeMembers: auditeeUsers.map((u) => u.nama),
      auditorCheckedCount,
      auditorVerifiedCount,
      auditorPct,
      auditorLatestBy,
      auditorLatestKode,
      auditorLatestAt:
        auditorLatestTime > 0 ? new Date(auditorLatestTime).toISOString() : null,
      auditorMembers: auditorUsers.map((u) => u.nama),
    });
  }

  // Finalize percentage and sort individuals descending by count
  const auditeeIndividuals = Array.from(auditeeMap.values())
    .map((item) => ({
      ...item,
      pctOfGroup:
        item.totalGroupIndikator > 0
          ? Math.round((item.count / item.totalGroupIndikator) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.nama.localeCompare(b.nama, "id");
    });

  const auditorIndividuals = Array.from(auditorMap.values())
    .map((item) => ({
      ...item,
      pctOfGroup:
        item.totalGroupIndikator > 0
          ? Math.round((item.count / item.totalGroupIndikator) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.nama.localeCompare(b.nama, "id");
    });

  const lastServerTime = new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <LeaderboardClient
      initialMode={initialMode}
      teams={teams}
      auditeeIndividuals={auditeeIndividuals}
      auditorIndividuals={auditorIndividuals}
      lastServerTime={lastServerTime}
    />
  );
}
