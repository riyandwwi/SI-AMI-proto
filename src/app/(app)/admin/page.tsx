import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptPassword } from "@/lib/crypto";
import { CREATABLE_ROLES, HOMEBASE_LIST, ROLE_LABEL } from "@/lib/roles";
import { Badge, Flash, PageHeader, one, type SP } from "@/components/ui";
import { AdminUsersTable, type AdminUserRow } from "./AdminUsersTable";
import { tambahUser } from "./actions";

export default async function AdminPage({ searchParams }: { searchParams: SP }) {
  const admin = await requireUser("SUPER_ADMIN");
  const sp = await searchParams;

  const users = await prisma.user.findMany({
    where: { isTraining: false },
    include: { unit: true },
    orderBy: [{ role: "asc" }, { nama: "asc" }],
  });

  const userRows: AdminUserRow[] = users.map((u) => ({
    id: u.id,
    nama: u.nama,
    nimNuptk: u.nimNuptk || "",
    username: u.username,
    role: u.role,
    unitKode: u.unit?.kode ?? "PRODI-BD",
    unitNama: u.unit?.nama ?? "—",
    plainPassword: decryptPassword(u.passwordEnc),
    isSuperAdmin: u.role === "SUPER_ADMIN" || u.id === admin.id,
  }));

  return (
    <>
      <PageHeader title="Kelola Akun Pengguna" />
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {/* Form Tambah Akun (Collapsible agar halaman bersih) */}
      <details open={userRows.length === 0} className="card group p-4">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 text-sm font-bold text-slate-900">
          <div className="flex flex-wrap items-center gap-2">
            <span>➕ Buat Akun Pengguna Baru</span>
            <Badge tone="amber">🔑 Password Default: 123</Badge>
          </div>
          <span className="btn-secondary px-2.5 py-1 text-xs group-open:bg-slate-100">
            Buka / Tutup Form
          </span>
        </summary>

        <form action={tambahUser} className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <label>Nama Lengkap</label>
            <input name="nama" required placeholder="Nama..." className="w-full" />
          </div>

          <div className="space-y-1">
            <label>NIDN / NUPTK</label>
            <input name="nimNuptk" required placeholder="NIDN / NUPTK..." className="w-full font-mono" />
          </div>

          <div className="space-y-1">
            <label>Homebase / Prodi</label>
            <select name="prodiKode" required className="w-full" defaultValue="PRODI-BD">
              {HOMEBASE_LIST.map((p) => (
                <option key={p.kode} value={p.kode}>
                  {p.nama}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label>Role</label>
            <select name="role" required className="w-full font-bold" defaultValue="AUDITOR">
              {CREATABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label>Username</label>
            <div className="flex gap-2">
              <input name="username" required placeholder="Username..." className="w-full font-mono" />
              <button className="btn shrink-0">+ Buat</button>
            </div>
          </div>
        </form>
      </details>

      {/* Tabel Daftar Akun dengan Sort, Filter Role/Homebase, Search & Ubah Homebase */}
      <AdminUsersTable users={userRows} />
    </>
  );
}
