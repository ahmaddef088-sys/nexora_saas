import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe Auth.js configuration.
 *
 * This file must NOT import Prisma, bcrypt or any other Node-only module,
 * because it is consumed by `src/middleware.ts`, which runs on the Edge
 * runtime. It contains only what is needed to decode/verify the JWT session
 * cookie. The full configuration (Credentials provider + database lookups)
 * lives in `./config.ts` and extends this object.
 *
 * Secrets are read from the environment only: `AUTH_SECRET` (Auth.js v5
 * default) with `NEXTAUTH_SECRET` kept as a backward-compatible fallback.
 */
export const authEdgeConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  providers: [],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async redirect({ url }) {
      if (url.startsWith('/')) {
        return url;
      }
      return url;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = (token.id as string) || (token.sub as string);
        session.user.tenantId = token.tenantId as string | undefined;
        session.user.tenantSlug = token.tenantSlug as string | undefined;
        session.user.role = token.role as any;
        session.user.organizationId = token.tenantId as string | undefined;
        session.user.organizationSlug = token.tenantSlug as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
} satisfies NextAuthConfig;
