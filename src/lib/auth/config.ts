import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/lib/db/prisma';
import { verifyPassword } from './password';
import { loginSchema } from '@/lib/validations/auth';
import { authEdgeConfig } from './auth.config';

/**
 * Full Auth.js configuration (Node.js runtime only).
 * Extends the edge-safe base config with the Credentials provider and the
 * database-backed `jwt` callback. Prisma is only queried inside `authorize`
 * and `jwt` (i.e. at sign-in request time), never at module import/build time.
 */
export const authConfig: NextAuthConfig = {
  ...authEdgeConfig,
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
        const normalizedEmail = email.toLowerCase().trim();

        // Fetch user from DB by normalized email
        let user = await prisma.user
          .findUnique({
            where: { email: normalizedEmail },
            include: {
              memberships: {
                where: { status: 'ACTIVE' },
                include: { tenant: true },
              },
            },
          })
          .catch(() => null);

        // Safe Production Auto-Initialization:
        // If user is not found, check if the production database is empty (0 users).
        // If empty, auto-seed the initial demo tenants & accounts so login works out-of-the-box.
        if (!user) {
          const totalUsers = await prisma.user.count().catch(() => 0);
          if (totalUsers === 0) {
            const { seedDatabase } = await import('@/lib/db/seed');
            await seedDatabase(prisma).catch(() => null);

            user = await prisma.user
              .findUnique({
                where: { email: normalizedEmail },
                include: {
                  memberships: {
                    where: { status: 'ACTIVE' },
                    include: { tenant: true },
                  },
                },
              })
              .catch(() => null);
          }
        }

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
  callbacks: {
    ...authEdgeConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;

        // Fetch active membership for user
        const membership = await prisma.membership
          .findFirst({
            where: { userId: user.id, status: 'ACTIVE' },
            include: { tenant: true },
          })
          .catch(() => null);

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
  },
};
