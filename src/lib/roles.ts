// Dipakai juga oleh middleware (edge runtime) — jangan import @prisma/client di sini.

export const ROLES = ["SUPER_ADMIN", "LPM", "AUDITOR", "AUDITEE", "PIMPINAN"] as const;
export type RoleName = (typeof ROLES)[number];

export const ROLE_HOME: Record<RoleName, string> = {
  SUPER_ADMIN: "/admin",
  LPM: "/lpm",
  AUDITOR: "/auditor",
  AUDITEE: "/auditee",
  PIMPINAN: "/pimpinan",
};

export const ROLE_LABEL: Record<RoleName, string> = {
  SUPER_ADMIN: "Super Admin",
  LPM: "LPM",
  AUDITOR: "Auditor",
  AUDITEE: "Auditee",
  PIMPINAN: "Pimpinan",
};

export function isRole(v: unknown): v is RoleName {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}
