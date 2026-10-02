import { Role, MembershipStatus, Prisma } from '@prisma/client';

export interface HarnessUser {
  id: string;
  name: string;
  email: string;
}

export interface HarnessTenant {
  id: string;
  name: string;
  slug: string;
}

export interface HarnessContext {
  userId: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: Role;
  user: HarnessUser;
  organizationId: string;
  organizationSlug: string;
}

// ── Standard Multi-Tenant Fixtures ──────────────────────────────────────────
export const FIXTURE_TENANT_ACME: HarnessTenant = {
  id: 'tenant_acme_101',
  name: 'Acme Corporation',
  slug: 'acme',
};

export const FIXTURE_TENANT_GLOBEX: HarnessTenant = {
  id: 'tenant_globex_202',
  name: 'Globex Corporation',
  slug: 'globex',
};

export const ACME_OWNER_CONTEXT: HarnessContext = {
  userId: 'user_acme_owner',
  tenantId: FIXTURE_TENANT_ACME.id,
  tenantSlug: FIXTURE_TENANT_ACME.slug,
  tenantName: FIXTURE_TENANT_ACME.name,
  role: Role.OWNER,
  user: {
    id: 'user_acme_owner',
    name: 'Alice Acme (Owner)',
    email: 'alice@acme.com',
  },
  organizationId: FIXTURE_TENANT_ACME.id,
  organizationSlug: FIXTURE_TENANT_ACME.slug,
};

export const ACME_ADMIN_CONTEXT: HarnessContext = {
  userId: 'user_acme_admin',
  tenantId: FIXTURE_TENANT_ACME.id,
  tenantSlug: FIXTURE_TENANT_ACME.slug,
  tenantName: FIXTURE_TENANT_ACME.name,
  role: Role.ADMIN,
  user: {
    id: 'user_acme_admin',
    name: 'Adam Acme (Admin)',
    email: 'adam@acme.com',
  },
  organizationId: FIXTURE_TENANT_ACME.id,
  organizationSlug: FIXTURE_TENANT_ACME.slug,
};

export const ACME_MEMBER_CONTEXT: HarnessContext = {
  userId: 'user_acme_member',
  tenantId: FIXTURE_TENANT_ACME.id,
  tenantSlug: FIXTURE_TENANT_ACME.slug,
  tenantName: FIXTURE_TENANT_ACME.name,
  role: Role.MEMBER,
  user: {
    id: 'user_acme_member',
    name: 'Mark Acme (Member)',
    email: 'mark@acme.com',
  },
  organizationId: FIXTURE_TENANT_ACME.id,
  organizationSlug: FIXTURE_TENANT_ACME.slug,
};

export const ACME_VIEWER_CONTEXT: HarnessContext = {
  userId: 'user_acme_viewer',
  tenantId: FIXTURE_TENANT_ACME.id,
  tenantSlug: FIXTURE_TENANT_ACME.slug,
  tenantName: FIXTURE_TENANT_ACME.name,
  role: Role.VIEWER,
  user: {
    id: 'user_acme_viewer',
    name: 'Victor Acme (Viewer)',
    email: 'victor@acme.com',
  },
  organizationId: FIXTURE_TENANT_ACME.id,
  organizationSlug: FIXTURE_TENANT_ACME.slug,
};

export const GLOBEX_OWNER_CONTEXT: HarnessContext = {
  userId: 'user_globex_owner',
  tenantId: FIXTURE_TENANT_GLOBEX.id,
  tenantSlug: FIXTURE_TENANT_GLOBEX.slug,
  tenantName: FIXTURE_TENANT_GLOBEX.name,
  role: Role.OWNER,
  user: {
    id: 'user_globex_owner',
    name: 'Greg Globex (Owner)',
    email: 'greg@globex.com',
  },
  organizationId: FIXTURE_TENANT_GLOBEX.id,
  organizationSlug: FIXTURE_TENANT_GLOBEX.slug,
};

export const GLOBEX_MEMBER_CONTEXT: HarnessContext = {
  userId: 'user_globex_member',
  tenantId: FIXTURE_TENANT_GLOBEX.id,
  tenantSlug: FIXTURE_TENANT_GLOBEX.slug,
  tenantName: FIXTURE_TENANT_GLOBEX.name,
  role: Role.MEMBER,
  user: {
    id: 'user_globex_member',
    name: 'Gary Globex (Member)',
    email: 'gary@globex.com',
  },
  organizationId: FIXTURE_TENANT_GLOBEX.id,
  organizationSlug: FIXTURE_TENANT_GLOBEX.slug,
};
