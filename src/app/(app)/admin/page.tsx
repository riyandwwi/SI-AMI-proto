import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptPassword } from "@/lib/crypto";
import { ROLE_LABEL, ROLES, isRole } from "@/lib/roles";
import { Badge, Flash, PageHeader, one, type SP } from "@/components/ui";
import { PasswordCell } from "./PasswordCell";
import { gantiPasswordUser, tambahUser, toggleAktifUser } from "./actions";

export default async function AdminPage({ searchParams }: { searchParams: SP }) {
  const admin = await requireUser("SUPER_ADMIN");
  const sp = await searchParams;
  const roleFilter = one(sp.role);

  const [users, units] = await Promise.all([
    prisma.user.findMany({
      where: isRole(roleFilter) ? { role: roleFilter } : undefined,
      include: { unit: true },
      orderBy: [{ role: "asc" }, { nama: "asc" }],
    }),
    prisma.unit.findMany({ orderBy: { kode: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Manajemen Akun Pengguna (Super Admin)"
        desc="Tambah akun baru, lihat username & password jika pengguna lupa, serta ganti password langsung tanpa OTP."
      />
      <Flash ok={one(sp.ok)} err={one(sp.err)} />

      {/* Form Tambah Akun */}
      <form action={tambahUser} className="card space-y-4">
        <div className="border-b border-slate-100 pb-2">
          <h2 className="text-base font-bold text-slate-900">+ Tambah Akun Pengguna Baru</h2>
          <p className="text-xs text-slate-500">
            Akun langsung aktif tanpa verifikasi OTP. Untuk Auditor &amp; Auditee, wajib memilih Unit / Homebase ITBMP.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <label>Nama Lengkap &amp; Gelar</label>
            <input name="nama" required placeholder="Dr. Hendra Wijaya, M.M" className="w-full" />
          </div>
          <div className="space-y-1">
            <label>Role</label>
            <select name="role" required className="w-full" defaultValue="AUDITOR">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label>Unit / Homebase ITBMP</label>
            <select name="unitId" className="w-full" defaultValue="">
              <option value="">— Pilih Unit (Wajib utk Auditor/Auditee) —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  [{u.kode}] {u.nama}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label>Username Login</label>
            <input name="username" required placeholder="auditor_baru" className="w-full font-mono" />
          </div>
          <div className="space-y-1">
            <label>Password Awal (min. 6 karakter)</label>
            <div className="flex gap-2">
              <input name="password" type="text" required minLength={6} placeholder="itbmp2026" className="w-full font-mono" />
              <button className="btn shrink-0">Simpan</button>
            </div>
          </div>
        </div>
      </form>

      {/* Tabel Daftar Akun */}
      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Daftar Akun Terdaftar ({users.length} akun)</h2>
            <p className="text-xs text-slate-500">
              Klik <strong>👁️ Lihat</strong> untuk melihat password saat ini, atau ketik password baru lalu klik <strong>Ubah Password</strong>.
            </p>
          </div>
          <form method="GET" className="flex items-center gap-2">
            <label>Filter Role:</label>
            <select name="role" defaultValue={roleFilter ?? ""} className="text-xs">
              <option value="">Semua Role</option>
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
                <th>Role</th>
                <th>Unit / Homebase</th>
                <th>Username</th>
                <th>Password Saat Ini</th>
                <th>Ganti Password Langsung</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const plain = decryptPassword(u.passwordEnc);
                return (
                  <tr key={u.id}>
                    <td className="font-semibold text-slate-900">{u.nama}</td>
                    <td>
                      <Badge tone="blue">{ROLE_LABEL[u.role]}</Badge>
                    </td>
                    <td className="text-slate-600">{u.unit ? `${u.unit.nama} (${u.unit.kode})` : "—"}</td>
                    <td>
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-800">{u.username}</code>
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
                          minLength={6}
                          placeholder="Password baru..."
                          className="w-36 font-mono text-xs"
                        />
                        <button className="btn-secondary text-xs">Ubah Password</button>
                      </form>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Badge tone={u.aktif ? "green" : "red"}>{u.aktif ? "Aktif" : "Nonaktif"}</Badge>
                        {u.id !== admin.id && (
                          <form action={toggleAktifUser}>
                            <input type="hidden" name="userId" value={u.id} />
                            <button className="text-xs text-slate-500 underline hover:text-slate-800">
                              {u.aktif ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                          </form>
                        )}
                      </div>
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
