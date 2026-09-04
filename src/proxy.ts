import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const token = req.cookies.get("authjs.session-token") || req.cookies.get("__Secure-authjs.session-token");
  const isLoggedIn = !!token;
  const path = req.nextUrl.pathname;

  // Always allow all dashboard pages, products, and APIs without login blocking
  if (path.startsWith("/dashboard") || path.startsWith("/api")) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
