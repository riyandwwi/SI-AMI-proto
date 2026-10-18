import { SignJWT, jwtVerify } from "jose";
import { isRole, type RoleName } from "./roles";

export const SESSION_COOKIE = "ami_session";
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 jam

export type SessionPayload = { uid: string; role: RoleName };

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET belum diset (min. 32 karakter)");
  return new TextEncoder().encode(s);
}

export async function signSession(p: SessionPayload) {
  return new SignJWT({ uid: p.uid, role: p.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.uid !== "string" || !isRole(payload.role)) return null;
    return { uid: payload.uid, role: payload.role };
  } catch {
    return null;
  }
}
