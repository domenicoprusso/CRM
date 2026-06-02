import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getAuthSecretKey, sessionCookieName } from "@/lib/session";

const publicPaths = new Set(["/login", "/register", "/api/auth/login", "/api/auth/register"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (publicPaths.has(pathname) || pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  const token = request.cookies.get(sessionCookieName)?.value;
  if (!token) return NextResponse.redirect(new URL("/login", request.url));

  try {
    await jwtVerify(token, getAuthSecretKey());
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(sessionCookieName);
    return response;
  }
}

export const config = {
  matcher: ["/((?!api/auth/logout).*)"],
};
