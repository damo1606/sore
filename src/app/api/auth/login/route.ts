import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "sore_session";
const SESSION_TOKEN = process.env.SESSION_SECRET ?? "sore_secret_token";

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  const validUser = process.env.AUTH_USERNAME ?? "admin";
  const validPass = process.env.AUTH_PASSWORD ?? "sore2024";

  if (username !== validUser || password !== validPass) {
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, SESSION_TOKEN, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 días
  });

  return response;
}
