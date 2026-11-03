import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { NavLinks } from "@/components/NavLinks";
import { LiveSync } from "@/components/LiveSync";
import { Badge } from "@/components/ui";
import { logout } from "@/app/login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const auditorBaseHref = user.trainingPeriodeId
    ? `/auditor/${user.trainingPeriodeId}`
    : "/auditor";

  const navItems =
    user.role === "SUPER_ADMIN"
      ? [
          { href: "/admin", label: "👥 Kelola Akun" },
          { href: "/admin/training", label: "🎓 Sesi Training" },
          { href: "/admin/training/leaderboard?mode=auditee", label: "🏆 Leaderboard" },
        ]
      : user.role === "LPM"
        ? [
            { href: "/lpm", label: "📅 Sesi AMI" },
            { href: "/lpm?tab=archive", label: "📦 Archive" },
            { href: "/lpm/indikator", label: "📑 Indikator" },
            { href: "/lpm/rekap", label: "📊 Rekap & Pengesahan" },
            { href: "/lpm/log", label: "📜 Log" },
          ]
        : user.role === "AUDITOR"
          ? user.isTraining && user.trainingPeriodeId
            ? [
                { href: auditorBaseHref, label: "🔍 Pemeriksaan Audit" },
                { href: `${auditorBaseHref}/ttd`, label: "✍️ Tanda Tangan" },
              ]
            : [
                { href: "/auditor", label: "🏛️ Sesi Audit" },
                { href: "/auditor?view=archive", label: "📦 Archive" },
              ]
          : [
              { href: "/auditee", label: "📝 Evaluasi Diri & RTL" },
              { href: "/auditee/ttd", label: "✍️ Tanda Tangan" },
            ];

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-xs font-extrabold text-white shadow-2xs">
              AMI
            </div>
            <div className="text-sm font-bold tracking-tight text-slate-900 sm:text-base">
              SI-AMI ITBMP
            </div>
            <LiveSync />
            <div className="hidden md:block pl-2">
              <Suspense fallback={null}>
                <NavLinks items={navItems} />
              </Suspense>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-sm">
            <div className="text-right">
              <div className="text-xs font-bold text-slate-900 sm:text-sm">
                {user.nama}
              </div>
              <div className="flex items-center justify-end gap-1.5 pt-0.5 text-xs">
                {user.isTraining ? (
                  <Badge tone="amber">🎓 {ROLE_LABEL[user.role]} (Training)</Badge>
                ) : (
                  <Badge tone="purple">{ROLE_LABEL[user.role]}</Badge>
                )}
                {user.unit && (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-[11px] text-slate-700">
                    {user.unit.nama}
                  </span>
                )}
              </div>
            </div>

            <Link href="/akun" className="btn-secondary text-xs">
              Password
            </Link>
            <form action={logout}>
              <button className="btn-danger text-xs">Keluar</button>
            </form>
          </div>
        </div>

        <div className="mx-auto max-w-[1440px] border-t border-slate-100 px-4 py-1.5 md:hidden">
          <Suspense fallback={null}>
            <NavLinks items={navItems} />
          </Suspense>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] space-y-4 px-4 py-5">
        {children}
      </main>
    </div>
  );
}
