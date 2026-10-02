import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/lib/db/prisma';
import { verifyPassword } from './password';
import { loginSchema } from '@/lib/validations/auth';

export const authConfig: NextAuthConfig = {
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        // Fetch user from DB by normalized email
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
          include: {
            memberships: {
              where: { status: 'ACTIVE' },
              include: { tenant: true },
            },
          },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        // Verify password against secure bcrypt hash
        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        // Return user info (never expose passwordHash)
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;

        // Fetch active membership for user
        const membership = await prisma.membership.findFirst({
          where: { userId: user.id, status: 'ACTIVE' },
          include: { tenant: true },
        });

        if (membership) {
          token.tenantId = membership.tenantId;
          token.tenantSlug = membership.tenant.slug;
          token.role = membership.role;
          // Aliases for compatibility
          token.organizationId = membership.tenantId;
          token.organizationSlug = membership.tenant.slug;
        }
      }
      return token;
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
};
