import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "sore_session";
const SESSION_TOKEN = process.env.SESSION_SECRET ?? "sore_secret_token";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permitir rutas de auth sin protección
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const session = request.cookies.get(SESSION_COOKIE)?.value;

  if (session !== SESSION_TOKEN) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
