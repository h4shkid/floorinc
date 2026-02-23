import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Get JWT token directly (no Prisma/bcryptjs needed)
  // NextAuth v5 uses "authjs.session-token" cookie name (not "next-auth.session-token")
  const isSecure = req.nextUrl.protocol === "https:";
  const cookieName = isSecure
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName,
  });
  const isLoggedIn = !!token;
  const role = token?.role as string | undefined;

  // Public routes
  if (pathname === "/login" || pathname.startsWith("/api/auth")) {
    if (isLoggedIn && pathname === "/login") {
      if (role === "MANUFACTURER") {
        return NextResponse.redirect(new URL("/portal", req.url));
      }
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    return NextResponse.next();
  }

  // API routes for demo - allow without auth
  if (pathname.startsWith("/api/demo")) {
    return NextResponse.next();
  }

  // Require auth for everything else
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Admin routes - block manufacturers
  if (pathname.startsWith("/admin")) {
    if (role === "MANUFACTURER") {
      return NextResponse.redirect(new URL("/portal", req.url));
    }
  }

  // Portal routes - only for manufacturers
  if (pathname.startsWith("/portal")) {
    if (role !== "MANUFACTURER") {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
  }

  // Root redirect
  if (pathname === "/") {
    if (role === "MANUFACTURER") {
      return NextResponse.redirect(new URL("/portal", req.url));
    }
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
