import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptPassword } from "@/lib/crypto";
import { CREATABLE_ROLES, PRODI_LIST, ROLE_LABEL, ROLES, isRole } from "@/lib/roles";
import { Badge, Flash, PageHeader, one, type SP } from "@/components/ui";
import { PasswordCell } from "./PasswordCell";
import { gantiPasswordUser, hapusUser, tambahUser } from "./actions";

export default async function AdminPage({ searchParams }: { searchParams: SP }) {
  const admin = await requireUser("SUPER_ADMIN");
  const sp = await searchParams;
  const roleFilter = one(sp.role);

  const users = await prisma.user.findMany({
    where: isRole(roleFilter) ? { role: roleFilter } : undefined,
    include: { unit: true },
    orderBy: [{ role: "asc" }, { nama: "asc" }],
  });

  return (
    <>
      <PageHeader
        title="Manajemen Akun Pengguna (Super Admin)"
        desc="Buat akun baru (otomatis password default: 123), lihat username & password, ganti password, serta hapus akun."
      />
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {/* Form Tambah Akun */}
      <form action={tambahUser} className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-3">
          <div>
            <h2 className="text-base font-black text-black">+ Buat Akun Pengguna Baru</h2>
            <p className="text-xs font-semibold text-slate-600">
              Masukkan Nama, NIDN/NUPTK, Program Studi, Role (LPM / Auditor / Auditee), dan Username.
            </p>
          </div>
          <Badge tone="amber">🔑 Password Default Otomatis: 123</Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <label>Nama Lengkap</label>
            <input name="nama" required placeholder="Dr. Hendra Wijaya, M.M" className="w-full" />
          </div>

          <div className="space-y-1">
            <label>NIDN / NUPTK</label>
            <input name="nimNuptk" required placeholder="0412058701" className="w-full font-mono" />
          </div>

          <div className="space-y-1">
            <label>Program Studi</label>
            <select name="prodiKode" required className="w-full" defaultValue="PRODI-BD">
              {PRODI_LIST.map((p) => (
                <option key={p.kode} value={p.kode}>
                  {p.nama}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label>Pilih Role Akun</label>
            <select name="role" required className="w-full font-bold" defaultValue="AUDITOR">
              {CREATABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label>Username Login</label>
            <div className="flex gap-2">
              <input name="username" required placeholder="hendra_bd" className="w-full font-mono" />
              <button className="btn shrink-0">+ Buat Akun</button>
            </div>
          </div>
        </div>
      </form>

      {/* Tabel Daftar Akun */}
      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-3">
          <div>
            <h2 className="text-base font-black text-black">Daftar Akun Terdaftar ({users.length} akun)</h2>
            <p className="text-xs font-semibold text-slate-600">
              Klik <strong>👁️ Lihat</strong> untuk melihat password saat ini, ubah password, atau klik <strong>Hapus</strong> untuk menghapus akun.
            </p>
          </div>
          <form method="GET" className="flex items-center gap-2">
            <label>Filter Role:</label>
            <select name="role" defaultValue={roleFilter ?? ""} className="text-xs">
              <option value="">Semua Role (4 Role)</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            <button className="btn-secondary text-xs">Terapkan</button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Nama Lengkap</th>
                <th>NIDN / NUPTK</th>
                <th>Program Studi</th>
                <th>Role</th>
                <th>Username</th>
                <th>Password Saat Ini</th>
                <th>Ganti Password</th>
                <th>Hapus Akun</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const plain = decryptPassword(u.passwordEnc);
                const isSuperAdmin = u.role === "SUPER_ADMIN" || u.id === admin.id;
                return (
                  <tr key={u.id} className="hover:bg-[#FAF7EE]/60 transition-colors">
                    <td className="font-bold text-black">{u.nama}</td>
                    <td className="font-mono text-xs font-semibold text-slate-800">{u.nimNuptk || "—"}</td>
                    <td className="font-semibold text-slate-800">{u.unit ? u.unit.nama : "—"}</td>
                    <td>
                      <Badge tone={u.role === "SUPER_ADMIN" ? "purple" : u.role === "LPM" ? "amber" : u.role === "AUDITOR" ? "green" : "blue"}>
                        {ROLE_LABEL[u.role]}
                      </Badge>
                    </td>
                    <td>
                      <code className="rounded-lg border border-black bg-[#FAF7EE] px-2 py-0.5 text-xs font-mono font-bold text-black shadow-[1px_1px_0px_#000]">
                        {u.username}
                      </code>
                    </td>
                    <td>
                      <PasswordCell plainPassword={plain} />
                    </td>
                    <td>
                      <form action={gantiPasswordUser} className="flex items-center gap-1.5">
                        <input type="hidden" name="userId" value={u.id} />
                        <input
                          name="passwordBaru"
                          type="text"
                          required
                          minLength={3}
                          placeholder="Password baru..."
                          className="w-32 font-mono text-xs"
                        />
                        <button className="btn-secondary text-xs">Simpan</button>
                      </form>
                    </td>
                    <td>
                      {isSuperAdmin ? (
                        <span className="rounded-full border border-black bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                          Akun Utama
                        </span>
                      ) : (
                        <form action={hapusUser}>
                          <input type="hidden" name="userId" value={u.id} />
                          <button className="btn-danger text-xs">Hapus</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
