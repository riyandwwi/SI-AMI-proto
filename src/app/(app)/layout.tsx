import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getActivePeriode, TAHAP_LABEL } from "@/lib/periode";
import { ROLE_LABEL } from "@/lib/roles";
import { NavLinks } from "@/components/NavLinks";
import { Badge } from "@/components/ui";
import { logout } from "@/app/login/actions";

const NAV = {
  SUPER_ADMIN: [{ href: "/admin", label: "Akun Pengguna" }],
  LPM: [
    { href: "/lpm", label: "Sesi & Periode" },
    { href: "/lpm/unit", label: "Unit / Auditee" },
    { href: "/lpm/indikator", label: "Indikator" },
    { href: "/lpm/penugasan", label: "Tim & Jadwal" },
    { href: "/lpm/rekap", label: "Rekap" },
    { href: "/lpm/log", label: "Log" },
  ],
  AUDITOR: [{ href: "/auditor", label: "Penugasan Saya" }],
  AUDITEE: [{ href: "/auditee", label: "Evaluasi Diri & Bukti" }],
  PIMPINAN: [{ href: "/pimpinan", label: "Dashboard Mutu" }],
} as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const periode = await getActivePeriode();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">AMI</div>
            <div>
              <div className="text-sm font-bold text-slate-900">SI-AMI ITBMP</div>
              <div className="text-xs text-slate-500">
                {periode ? (
                  <>
                    {periode.nama} · <span className="font-semibold text-blue-700">{TAHAP_LABEL[periode.tahap]}</span>
                    {periode.sourceLocked && <> · 🔒 source-lock</>}
                  </>
                ) : (
                  "Belum ada periode aktif"
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right">
              <div className="font-semibold text-slate-800">{user.nama}</div>
              <div className="flex items-center justify-end gap-1 text-xs text-slate-500">
                <Badge tone="blue">{ROLE_LABEL[user.role]}</Badge>
                {user.unit && <span>{user.unit.nama}</span>}
              </div>
            </div>
            <Link href="/akun" className="btn-secondary">Ganti Password</Link>
            <form action={logout}>
              <button className="btn-secondary">Keluar</button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-2">
          <NavLinks items={[...NAV[user.role]]} />
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">{children}</main>
    </div>
  );
}
