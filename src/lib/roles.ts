// Dipakai juga oleh middleware (edge runtime) — jangan import @prisma/client di sini.

export const ROLES = ["SUPER_ADMIN", "LPM", "AUDITOR", "AUDITEE"] as const;
export type RoleName = (typeof ROLES)[number];

/** Role yang boleh dibuat oleh Super Admin (Super Admin tidak boleh membuat Super Admin baru). */
export const CREATABLE_ROLES = ["LPM", "AUDITOR", "AUDITEE"] as const;
export type CreatableRoleName = (typeof CREATABLE_ROLES)[number];

export const ROLE_HOME: Record<RoleName, string> = {
  SUPER_ADMIN: "/admin",
  LPM: "/lpm",
  AUDITOR: "/auditor",
  AUDITEE: "/auditee",
};

export const ROLE_LABEL: Record<RoleName, string> = {
  SUPER_ADMIN: "Super Admin",
  LPM: "LPM",
  AUDITOR: "Auditor",
  AUDITEE: "Auditee",
};

export const PRODI_LIST = [
  { kode: "PRODI-BD", nama: "Bisnis Digital" },
  { kode: "PRODI-AKT", nama: "Aktuaria" },
  { kode: "PRODI-PWK", nama: "Perancangan Wilayah dan Kota" },
] as const;

export function isRole(v: unknown): v is RoleName {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

export function isCreatableRole(v: unknown): v is CreatableRoleName {
  return typeof v === "string" && (CREATABLE_ROLES as readonly string[]).includes(v);
}
