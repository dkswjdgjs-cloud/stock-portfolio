import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, authEnabled, isCronRequest, isValidSession } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  // APP_PASSWORD 미설정이면 기존처럼 통과
  if (!authEnabled()) return NextResponse.next();

  if (isCronRequest(request.headers.get("authorization"))) return NextResponse.next();

  if (await isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // 로그인 화면/API, Next 정적 파일, 아이콘·manifest 는 제외
    "/((?!login|api/login|_next/static|_next/image|favicon\\.ico|manifest\\.json|.*\\.svg$).*)",
  ],
};
