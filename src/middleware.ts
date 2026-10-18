import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { ROLE_HOME } from "@/lib/roles";

// Lapisan pertama: arahkan pengguna ke area sesuai role.
// Lapisan kedua (wajib): setiap halaman & server action memanggil requireUser().
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login")) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const home = ROLE_HOME[session.role];
  const area = Object.values(ROLE_HOME).find((p) => pathname === p || pathname.startsWith(p + "/"));
  if (area && area !== home) return NextResponse.redirect(new URL(home, req.url));

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
