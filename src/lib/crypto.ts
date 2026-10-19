import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// Salinan password disimpan terenkripsi (bukan teks polos) supaya bocornya database
// saja tidak langsung membocorkan password. Login tetap memakai hash bcrypt.

function key() {
  const s = process.env.PASSWORD_ENC_KEY;
  if (!s || s.length < 32) throw new Error("PASSWORD_ENC_KEY belum diset (min. 32 karakter)");
  return createHash("sha256").update(s).digest();
}

export function encryptPassword(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64")).join(".");
}

export function decryptPassword(payload: string): string {
  try {
    const [iv, tag, enc] = payload.split(".").map((s) => Buffer.from(s, "base64"));
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return "(tidak dapat dibaca — PASSWORD_ENC_KEY berubah?)";
  }
}
