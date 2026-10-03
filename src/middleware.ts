import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authEdgeConfig } from '@/lib/auth/auth.config';

// Edge runtime: use the edge-safe config (JWT verification only, no Prisma).
const { auth } = NextAuth(authEdgeConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Public routes
  const isPublic =
    pathname === '/' ||
    pathname === '/login' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/health');

  // If trying to access protected route while unauthenticated
  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
