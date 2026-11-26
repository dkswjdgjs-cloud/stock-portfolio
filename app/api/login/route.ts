import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, authEnabled, checkPassword, createSessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!authEnabled()) return NextResponse.json({ ok: true });

  let password = "";
  try {
    const body = await request.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {}

  if (!(await checkPassword(password))) {
    // 무차별 대입을 늦추기 위한 지연
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "비밀번호가 맞지 않습니다" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
