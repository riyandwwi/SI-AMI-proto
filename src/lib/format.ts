const TZ = "Asia/Jakarta";
const OFFSET_MS = 7 * 3600 * 1000; // WIB, tanpa DST

export function fmtTanggal(d?: Date | null) {
  return d ? d.toLocaleDateString("id-ID", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }) : "—";
}

export function fmtWaktu(d?: Date | null) {
  return d
    ? d.toLocaleString("id-ID", { timeZone: TZ, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
}

export function toInputDate(d?: Date | null) {
  return d ? new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10) : "";
}

export function toInputDateTime(d?: Date | null) {
  return d ? new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 16) : "";
}

// Input form ditafsirkan sebagai WIB, karena server Vercel berjalan dalam UTC.
function valid(d: Date) {
  return isNaN(d.getTime()) ? null : d;
}
export function parseDate(v: FormDataEntryValue | null, endOfDay = false) {
  const s = typeof v === "string" ? v.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return valid(new Date(`${s}T${endOfDay ? "23:59:59" : "00:00:00"}+07:00`));
}
export function parseDateTime(v: FormDataEntryValue | null) {
  const s = typeof v === "string" ? v.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return null;
  return valid(new Date(`${s}:00+07:00`));
}
