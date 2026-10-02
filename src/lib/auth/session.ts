import { auth } from './index';
import { prisma } from '@/lib/db/prisma';
import { AppError } from '@/lib/errors/app-error';
import { Role } from '@prisma/client';

export interface TenantContext {
  userId: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: Role;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  // Backward compatibility aliases
  organizationId: string;
  organizationSlug: string;
}

/**
 * Server-side helper to resolve active session & verified tenant context.
 * Throws AppError(401) if unauthenticated.
 * Throws AppError(403) if user is not a verified active member of the requested tenant.
 *
 * @param targetSlug - Optional tenant slug from the route parameter (e.g. 'acme-corp')
 */
export async function getRequiredTenantContext(targetSlug?: string): Promise<TenantContext> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new AppError('Unauthorized: Authentication required', 401);
  }

  const userId = session.user.id;

  // Find user membership for target tenant slug or active session tenant
  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      tenant: targetSlug ? { slug: targetSlug } : undefined,
    },
    include: {
      tenant: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!membership) {
    throw new AppError('Forbidden: Access denied to requested tenant workspace', 403);
  }

  return {
    userId,
    tenantId: membership.tenantId,
    tenantSlug: membership.tenant.slug,
    tenantName: membership.tenant.name,
    role: membership.role,
    user: membership.user,
    // Aliases
    organizationId: membership.tenantId,
    organizationSlug: membership.tenant.slug,
  };
}

/**
 * Fetch all active tenants associated with a user.
 * Used for tenant switching and routing after login.
 */
export async function getUserTenants(userId: string) {
  if (!userId) return [];

  const memberships = await prisma.membership.findMany({
    where: {
      userId,
      status: 'ACTIVE',
    },
    include: {
      tenant: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  return memberships.map((m) => ({
    tenantId: m.tenantId,
    tenantSlug: m.tenant.slug,
    tenantName: m.tenant.name,
    role: m.role,
  }));
}
