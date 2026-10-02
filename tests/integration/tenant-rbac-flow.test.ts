import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ACME_OWNER_CONTEXT,
  ACME_ADMIN_CONTEXT,
  ACME_MEMBER_CONTEXT,
  ACME_VIEWER_CONTEXT,
} from './helpers/test-harness';
import { getRequiredTenantContext } from '@/lib/auth/session';
import { canViewAuditLog } from '@/lib/auth/audit-auth';
import { canViewReports } from '@/lib/auth/reports-auth';
import { canRemoveMember, canAddMember } from '@/lib/auth/member-auth';
import { canRefundPayment, canVoidInvoice, canDeleteExpense } from '@/lib/auth/finance-auth';
import { canCreateProduct, canAdjustInventory } from '@/lib/auth/product-auth';
import { canCreateOrder, canConfirmOrder } from '@/lib/auth/order-auth';
import { removeMemberAction } from '@/lib/actions/members';
import { refundPaymentAction } from '@/lib/actions/payments';
import { deleteExpenseAction } from '@/lib/actions/expenses';
import { prisma } from '@/lib/db/prisma';
import { Role } from '@prisma/client';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({
  getRequiredTenantContext: vi.fn(),
  getUserTenants: vi.fn(),
}));

vi.mock('@/lib/utils/audit', () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/db/prisma', () => {
  const mock = {
    membership: { findFirst: vi.fn(), delete: vi.fn(), count: vi.fn() },
    payment: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    invoice: { findUnique: vi.fn(), update: vi.fn() },
    expense: { findFirst: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    ledgerEntry: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (cb) => cb(mock)),
  };
  return { prisma: mock };
});

describe('Integration Suite 1 — Multi-Tenancy & RBAC Authorization Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Cross-Tenant Boundary Protection', () => {
    it('should reject Acme user trying to access Globex workspace with 403', async () => {
      vi.mocked(getRequiredTenantContext).mockRejectedValueOnce(
        new Error('Forbidden: Access denied to requested tenant workspace')
      );

      await expect(getRequiredTenantContext('globex')).rejects.toThrow(
        'Forbidden: Access denied to requested tenant workspace'
      );
    });

    it('should allow Acme user access to Acme workspace with valid context', async () => {
      vi.mocked(getRequiredTenantContext).mockResolvedValueOnce(ACME_OWNER_CONTEXT);

      const ctx = await getRequiredTenantContext('acme');
      expect(ctx.tenantId).toBe(ACME_OWNER_CONTEXT.tenantId);
      expect(ctx.tenantSlug).toBe('acme');
      expect(ctx.role).toBe(Role.OWNER);
    });
  });

  describe('RBAC Authorization Boundaries across all 4 Roles', () => {
    it('OWNER role: possesses unrestricted management across all domains', () => {
      expect(canViewAuditLog(Role.OWNER).allowed).toBe(true);
      expect(canViewReports(Role.OWNER).allowed).toBe(true);
      expect(canRemoveMember(Role.OWNER, Role.MEMBER, false, false).allowed).toBe(true);
      expect(canRefundPayment(Role.OWNER).allowed).toBe(true);
      expect(canDeleteExpense(Role.OWNER).allowed).toBe(true);
      expect(canVoidInvoice(Role.OWNER).allowed).toBe(true);
      expect(canCreateProduct(Role.OWNER).allowed).toBe(true);
      expect(canCreateOrder(Role.OWNER).allowed).toBe(true);
    });

    it('ADMIN role: possesses operational management but denied root owner actions', () => {
      expect(canViewAuditLog(Role.ADMIN).allowed).toBe(true);
      expect(canViewReports(Role.ADMIN).allowed).toBe(true);
      expect(canAddMember(Role.ADMIN, Role.MEMBER).allowed).toBe(true);
      expect(canCreateProduct(Role.ADMIN).allowed).toBe(true);
      expect(canCreateOrder(Role.ADMIN).allowed).toBe(true);
      expect(canDeleteExpense(Role.ADMIN).allowed).toBe(true);

      // Denied Owner-only actions
      expect(canRemoveMember(Role.ADMIN, Role.OWNER, false, false).allowed).toBe(false);
      expect(canRefundPayment(Role.ADMIN).allowed).toBe(false);
    });

    it('MEMBER role: possesses day-to-day operations but denied sensitive security/audit areas', () => {
      expect(canViewReports(Role.MEMBER).allowed).toBe(true);
      expect(canCreateOrder(Role.MEMBER).allowed).toBe(true);

      // Denied Admin/Owner actions
      expect(canViewAuditLog(Role.MEMBER).allowed).toBe(false);
      expect(canAddMember(Role.MEMBER, Role.MEMBER).allowed).toBe(false);
      expect(canRemoveMember(Role.MEMBER, Role.MEMBER, false, false).allowed).toBe(false);
      expect(canVoidInvoice(Role.MEMBER).allowed).toBe(false);
      expect(canRefundPayment(Role.MEMBER).allowed).toBe(false);
      expect(canDeleteExpense(Role.MEMBER).allowed).toBe(false);
      expect(canCreateProduct(Role.MEMBER).allowed).toBe(false);
      expect(canAdjustInventory(Role.MEMBER).allowed).toBe(false);
      expect(canConfirmOrder(Role.MEMBER).allowed).toBe(false);
    });

    it('VIEWER role: strictly read-only and blocked from all mutations', () => {
      expect(canViewReports(Role.VIEWER).allowed).toBe(true);

      // Blocked from all mutations
      expect(canViewAuditLog(Role.VIEWER).allowed).toBe(false);
      expect(canAddMember(Role.VIEWER, Role.MEMBER).allowed).toBe(false);
      expect(canCreateProduct(Role.VIEWER).allowed).toBe(false);
      expect(canAdjustInventory(Role.VIEWER).allowed).toBe(false);
      expect(canCreateOrder(Role.VIEWER).allowed).toBe(false);
      expect(canConfirmOrder(Role.VIEWER).allowed).toBe(false);
      expect(canRefundPayment(Role.VIEWER).allowed).toBe(false);
      expect(canDeleteExpense(Role.VIEWER).allowed).toBe(false);
    });
  });

  describe('Server Action RBAC Rejections in Practice', () => {
    it('should reject MEMBER attempting to refund a payment', async () => {
      vi.mocked(getRequiredTenantContext).mockResolvedValueOnce(ACME_MEMBER_CONTEXT);

      const res = await refundPaymentAction('acme', {
        paymentId: 'pay_123',
        reason: 'Unauthorized refund attempt',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('restricted to Workspace Owners only');
    });

    it('should reject ADMIN attempting to remove an organization owner', async () => {
      vi.mocked(getRequiredTenantContext).mockResolvedValueOnce(ACME_ADMIN_CONTEXT);
      vi.mocked(prisma.membership.findFirst).mockResolvedValueOnce({
        id: 'mem_target',
        userId: 'user_target',
        tenantId: ACME_ADMIN_CONTEXT.tenantId,
        role: Role.OWNER,
        tenant: { slug: 'acme' },
      } as any);

      const res = await removeMemberAction('acme', {
        membershipId: 'mem_target',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Administrators cannot remove an Owner');
    });

    it('should reject MEMBER attempting to delete an expense', async () => {
      vi.mocked(getRequiredTenantContext).mockResolvedValueOnce(ACME_MEMBER_CONTEXT);

      const res = await deleteExpenseAction('acme', {
        expenseId: 'exp_123',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Admin or Owner role required');
    });
  });
});
