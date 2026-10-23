import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { NavLinks } from "@/components/NavLinks";
import { Badge } from "@/components/ui";
import { logout } from "@/app/login/actions";

const NAV = {
  SUPER_ADMIN: [{ href: "/admin", label: "Kelola Akun" }],
  LPM: [
    { href: "/lpm", label: "Sesi AMI" },
    { href: "/lpm/indikator", label: "Indikator" },
    { href: "/lpm/rekap", label: "Rekap & Excel" },
    { href: "/lpm/log", label: "Log" },
  ],
  AUDITOR: [{ href: "/auditor", label: "Sesi Audit" }],
  AUDITEE: [{ href: "/auditee", label: "Evaluasi Diri" }],
} as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const firstName = user.nama.split(" ")[0] || user.nama;

  const shortcuts =
    user.role === "LPM"
      ? [
          { href: "/lpm", label: "Sesi AMI", icon: "📋", bg: "bg-[#E9D5FF]" },
          { href: "/lpm/indikator", label: "Indikator", icon: "📑", bg: "bg-[#FEF08A]" },
          { href: "/lpm/rekap", label: "Rekap", icon: "📊", bg: "bg-[#D9F99D]" },
          { href: "/lpm/log", label: "Log", icon: "📜", bg: "bg-[#BAE6FD]" },
        ]
      : user.role === "AUDITOR"
        ? [
            { href: "/auditor", label: "Sesi Audit", icon: "🏛️", bg: "bg-[#E9D5FF]" },
            { href: "/auditor", label: "Dokumen", icon: "📂", bg: "bg-[#FEF08A]" },
            { href: "/auditor", label: "Lapangan", icon: "🔍", bg: "bg-[#D9F99D]" },
            { href: "/auditor", label: "Verifikasi", icon: "🔒", bg: "bg-[#BAE6FD]" },
          ]
        : user.role === "AUDITEE"
          ? [
              { href: "/auditee", label: "Evaluasi", icon: "📝", bg: "bg-[#E9D5FF]" },
              { href: "/auditee", label: "Drive", icon: "🔗", bg: "bg-[#FEF08A]" },
              { href: "/auditee", label: "Status", icon: "✅", bg: "bg-[#D9F99D]" },
              { href: "/auditee", label: "RTL", icon: "🛠️", bg: "bg-[#BAE6FD]" },
            ]
          : [
              { href: "/admin", label: "Akun", icon: "👥", bg: "bg-[#E9D5FF]" },
              { href: "/admin", label: "Password", icon: "🔑", bg: "bg-[#FEF08A]" },
              { href: "/admin", label: "Prodi", icon: "🎓", bg: "bg-[#D9F99D]" },
              { href: "/admin", label: "Role", icon: "🛡️", bg: "bg-[#BAE6FD]" },
            ];

  return (
    <div className="min-h-screen bg-[#FAF7EE] text-[#121212]">
      <header className="sticky top-0 z-30 border-b-2 border-black bg-[#FAF7EE]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-black bg-[#FF5C38] text-sm font-black text-white shadow-[2.5px_2.5px_0px_#000000]">
              AMI
            </div>
            <div className="text-lg font-black tracking-tight text-black">SI-AMI ITBMP</div>
          </div>

          <div className="flex items-center gap-2.5 text-sm">
            <div className="text-right">
              <div className="font-extrabold text-black">
                {user.nama}
              </div>
              <div className="flex items-center justify-end gap-1.5 pt-0.5 text-xs">
                <Badge tone="purple">{ROLE_LABEL[user.role]}</Badge>
                {user.unit && (
                  <span className="rounded-full border border-black bg-white px-2 py-0.2 font-bold text-[11px]">
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

        <div className="mx-auto max-w-7xl px-4 pb-2.5">
          <NavLinks items={[...NAV[user.role]]} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <section className="space-y-3">
          <h2 className="text-2xl font-black tracking-tight text-black sm:text-3xl">
            Welcome Back, {firstName}!
          </h2>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            {shortcuts.map((sc, idx) => (
              <Link
                key={idx}
                href={sc.href}
                className="group flex flex-col items-center gap-1.5"
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full border-2 border-black text-xl shadow-[3px_3px_0px_#000000] transition-all group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:shadow-[5px_5px_0px_#000000] group-active:translate-x-0.5 group-active:translate-y-0.5 group-active:shadow-[1px_1px_0px_#000000] ${sc.bg}`}
                >
                  {sc.icon}
                </div>
                <span className="text-xs font-black text-black group-hover:underline">
                  {sc.label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {children}
      </main>
    </div>
  );
}
