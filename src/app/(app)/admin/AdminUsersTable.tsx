"use client";

import { useMemo, useState } from "react";
import { HOMEBASE_LIST, ROLE_LABEL, ROLES, type RoleName } from "@/lib/roles";
import { Badge } from "@/components/ui";
import { PasswordCell } from "./PasswordCell";
import { gantiPasswordUser, hapusUser, ubahHomebaseUser } from "./actions";

export interface AdminUserRow {
  id: string;
  nama: string;
  nimNuptk: string;
  username: string;
  role: RoleName;
  unitKode: string;
  unitNama: string;
  plainPassword: string;
  isSuperAdmin: boolean;
}

type SortKey = "homebase" | "role" | "nama_asc" | "nama_desc" | "username";

export function AdminUsersTable({ users }: { users: AdminUserRow[] }) {
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [unitFilter, setUnitFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortKey>("homebase");

  // Hitung jumlah per role dan per homebase
  const roleCounts = useMemo(() => {
    const map: Record<string, number> = { ALL: users.length };
    for (const r of ROLES) map[r] = 0;
    for (const u of users) map[u.role] = (map[u.role] ?? 0) + 1;
    return map;
  }, [users]);

  const unitCounts = useMemo(() => {
    const map: Record<string, number> = { ALL: users.length };
    for (const h of HOMEBASE_LIST) map[h.kode] = 0;
    for (const u of users) {
      if (u.unitKode) map[u.unitKode] = (map[u.unitKode] ?? 0) + 1;
    }
    return map;
  }, [users]);

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (unitFilter !== "ALL" && u.unitKode !== unitFilter) return false;
      if (q) {
        const match =
          u.nama.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.nimNuptk.toLowerCase().includes(q) ||
          u.unitNama.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    const roleRank: Record<RoleName, number> = {
      SUPER_ADMIN: 1,
      LPM: 2,
      AUDITOR: 3,
      AUDITEE: 4,
    };

    list.sort((a, b) => {
      if (sortBy === "homebase") {
        const cmpUnit = a.unitNama.localeCompare(b.unitNama, "id");
        if (cmpUnit !== 0) return cmpUnit;
        const cmpRole = roleRank[a.role] - roleRank[b.role];
        if (cmpRole !== 0) return cmpRole;
        return a.nama.localeCompare(b.nama, "id");
      }
      if (sortBy === "role") {
        const cmpRole = roleRank[a.role] - roleRank[b.role];
        if (cmpRole !== 0) return cmpRole;
        const cmpUnit = a.unitNama.localeCompare(b.unitNama, "id");
        if (cmpUnit !== 0) return cmpUnit;
        return a.nama.localeCompare(b.nama, "id");
      }
      if (sortBy === "nama_asc") {
        return a.nama.localeCompare(b.nama, "id");
      }
      if (sortBy === "nama_desc") {
        return b.nama.localeCompare(a.nama, "id");
      }
      if (sortBy === "username") {
        return a.username.localeCompare(b.username, "id");
      }
      return 0;
    });

    return list;
  }, [users, roleFilter, unitFilter, search, sortBy]);

  return (
    <div className="card space-y-4">
      {/* Bar Atas: Judul + Pencarian + Urutkan (Sort) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/15 pb-3">
        <h2 className="text-base font-black text-black">
          Daftar Akun ({filteredAndSorted.length} / {users.length})
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Cari nama / username / NIDN..."
            className="w-56 text-xs"
          />

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black uppercase text-slate-700">Urutkan:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="text-xs font-bold"
            >
              <option value="homebase">🏫 Homebase / Prodi</option>
              <option value="role">🛡️ Role (LPM → Auditor → Auditee)</option>
              <option value="nama_asc">🔤 Nama (A – Z)</option>
              <option value="nama_desc">🔤 Nama (Z – A)</option>
              <option value="username">👤 Username (A – Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter Cepat per Role & per Homebase */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-black/15 bg-[#FAF7EE] p-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-black uppercase text-slate-700">Role:</span>
          <button
            type="button"
            onClick={() => setRoleFilter("ALL")}
            className={
              roleFilter === "ALL"
                ? "rounded-xl border border-black bg-[#FF5C38] px-2.5 py-1 font-black text-white"
                : "rounded-xl border border-black/20 bg-white px-2.5 py-1 font-bold text-black hover:bg-[#FEF08A]"
            }
          >
            Semua ({roleCounts.ALL})
          </button>
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={
                roleFilter === r
                  ? "rounded-xl border border-black bg-[#FF5C38] px-2.5 py-1 font-black text-white"
                  : "rounded-xl border border-black/20 bg-white px-2.5 py-1 font-bold text-black hover:bg-[#FEF08A]"
              }
            >
              {ROLE_LABEL[r]} ({roleCounts[r] ?? 0})
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-black uppercase text-slate-700">Homebase:</span>
          <button
            type="button"
            onClick={() => setUnitFilter("ALL")}
            className={
              unitFilter === "ALL"
                ? "rounded-xl border border-black bg-[#FF5C38] px-2.5 py-1 font-black text-white"
                : "rounded-xl border border-black/20 bg-white px-2.5 py-1 font-bold text-black hover:bg-[#FEF08A]"
            }
          >
            Semua Homebase ({unitCounts.ALL})
          </button>
          {HOMEBASE_LIST.map((h) => (
            <button
              key={h.kode}
              type="button"
              onClick={() => setUnitFilter(h.kode)}
              className={
                unitFilter === h.kode
                  ? "rounded-xl border border-black bg-[#FF5C38] px-2.5 py-1 font-black text-white"
                  : "rounded-xl border border-black/20 bg-white px-2.5 py-1 font-bold text-black hover:bg-[#FEF08A]"
              }
            >
              {h.nama} ({unitCounts[h.kode] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {/* Tabel Akun */}
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Nama</th>
              <th>NIDN / NUPTK</th>
              <th>Homebase / Prodi</th>
              <th>Role</th>
              <th>Username</th>
              <th>Password</th>
              <th>Ganti Password</th>
              <th>Hapus</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map((u) => (
              <tr key={u.id} className="hover:bg-[#FAF7EE]/60 transition-colors">
                <td className="font-bold text-black">{u.nama}</td>
                <td className="font-mono text-xs font-semibold text-slate-800">
                  {u.nimNuptk || "—"}
                </td>
                <td>
                  <form action={ubahHomebaseUser} className="flex items-center gap-1">
                    <input type="hidden" name="userId" value={u.id} />
                    <select
                      name="prodiKode"
                      defaultValue={u.unitKode || "PRODI-BD"}
                      className="text-xs py-1 px-2"
                    >
                      {HOMEBASE_LIST.map((h) => (
                        <option key={h.kode} value={h.kode}>
                          {h.nama}
                        </option>
                      ))}
                    </select>
                    <button className="btn-secondary px-2 py-1 text-[11px]">Ubah</button>
                  </form>
                </td>
                <td>
                  <Badge
                    tone={
                      u.role === "SUPER_ADMIN"
                        ? "purple"
                        : u.role === "LPM"
                          ? "amber"
                          : u.role === "AUDITOR"
                            ? "green"
                            : "blue"
                    }
                  >
                    {ROLE_LABEL[u.role]}
                  </Badge>
                </td>
                <td>
                  <code className="rounded-lg border border-black/25 bg-[#FAF7EE] px-2 py-0.5 text-xs font-mono font-bold text-black">
                    {u.username}
                  </code>
                </td>
                <td>
                  <PasswordCell plainPassword={u.plainPassword} />
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
                      className="w-28 font-mono text-xs py-1"
                    />
                    <button className="btn-secondary px-2.5 py-1 text-xs">Simpan</button>
                  </form>
                </td>
                <td>
                  {u.isSuperAdmin ? (
                    <span className="rounded-full border border-black/25 bg-white/80 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                      Utama
                    </span>
                  ) : (
                    <form action={hapusUser}>
                      <input type="hidden" name="userId" value={u.id} />
                      <button className="btn-danger px-2.5 py-1 text-xs">Hapus</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
