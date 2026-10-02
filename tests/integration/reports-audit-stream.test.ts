import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ACME_OWNER_CONTEXT,
  GLOBEX_OWNER_CONTEXT,
} from './helpers/test-harness';
import { getTenantReportsData } from '@/lib/services/reports-service';
import { recordAuditLog } from '@/lib/utils/audit';
import { canViewAuditLog } from '@/lib/auth/audit-auth';
import { prisma } from '@/lib/db/prisma';
import { Role } from '@prisma/client';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    invoice: { findMany: vi.fn() },
    payment: { findMany: vi.fn() },
    expense: { findMany: vi.fn() },
    order: { findMany: vi.fn() },
    orderItem: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
    customer: { findMany: vi.fn() },
    auditLog: { create: vi.fn(), findMany: vi.fn() },
  },
}));

describe('Integration Suite 5 — Reports Aggregation & Audit Stream Verification', () => {
  const asOf = new Date('2026-08-23T12:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Reports Aggregation Multi-Tenant Isolation', () => {
    it('should aggregate only Acme data and never query or aggregate Globex records', async () => {
      vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);
      vi.mocked(prisma.payment.findMany).mockResolvedValue([]);
      vi.mocked(prisma.expense.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.orderItem.findMany).mockResolvedValue([]);
      vi.mocked(prisma.product.findMany).mockResolvedValue([]);
      vi.mocked(prisma.customer.findMany).mockResolvedValue([]);

      await getTenantReportsData(ACME_OWNER_CONTEXT.tenantId, 'ALL', asOf);

      // Verify that all prisma findMany calls used ACME tenantId
      const calls = [
        vi.mocked(prisma.invoice.findMany).mock.calls[0][0],
        vi.mocked(prisma.payment.findMany).mock.calls[0][0],
        vi.mocked(prisma.expense.findMany).mock.calls[0][0],
        vi.mocked(prisma.order.findMany).mock.calls[0][0],
        vi.mocked(prisma.product.findMany).mock.calls[0][0],
        vi.mocked(prisma.customer.findMany).mock.calls[0][0],
      ];

      for (const call of calls) {
        expect(call?.where?.tenantId).toBe(ACME_OWNER_CONTEXT.tenantId);
        expect(call?.where?.tenantId).not.toBe(GLOBEX_OWNER_CONTEXT.tenantId);
      }
    });

    it('should handle zero-records safely with Decimal-safe outputs', async () => {
      vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);
      vi.mocked(prisma.payment.findMany).mockResolvedValue([]);
      vi.mocked(prisma.expense.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.orderItem.findMany).mockResolvedValue([]);
      vi.mocked(prisma.product.findMany).mockResolvedValue([]);
      vi.mocked(prisma.customer.findMany).mockResolvedValue([]);

      const res = await getTenantReportsData(ACME_OWNER_CONTEXT.tenantId, 'ALL', asOf);

      expect(res.financials.collectedRevenue).toBe('0');
      expect(res.financials.totalExpenses).toBe('0');
      expect(res.financials.netProfit).toBe('0');
      expect(res.financials.accountsReceivable).toBe('0');
      expect(res.orders.totalCount).toBe(0);
      expect(res.orders.averageOrderValue).toBe('0.00');
    });
  });

  describe('Audit Log Stream Integrity & Access Control', () => {
    it('should record audit event with automatic metadata sanitization of sensitive fields', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      await recordAuditLog({
        tenantId: ACME_OWNER_CONTEXT.tenantId,
        userId: ACME_OWNER_CONTEXT.userId,
        action: 'MEMBER_CREATED',
        entity: 'MEMBER',
        entityId: 'mem_new_1',
        metadata: {
          email: 'newbie@acme.com',
          password: 'SuperSecretPassword123!',
          secretToken: 'secret_123',
          apiKey: 'key_123',
          safeField: 'Acme Operations',
        },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: ACME_OWNER_CONTEXT.tenantId,
            userId: ACME_OWNER_CONTEXT.userId,
            action: 'MEMBER_CREATED',
            entity: 'MEMBER',
            metadata: {
              email: 'newbie@acme.com',
              password: '[REDACTED]',
              secretToken: '[REDACTED]',
              apiKey: '[REDACTED]',
              safeField: 'Acme Operations',
            },
          }),
        })
      );
    });

    it('should strictly deny MEMBER and VIEWER from viewing audit logs', () => {
      expect(canViewAuditLog(Role.MEMBER).allowed).toBe(false);
      expect(canViewAuditLog(Role.VIEWER).allowed).toBe(false);
      expect(canViewAuditLog(Role.OWNER).allowed).toBe(true);
      expect(canViewAuditLog(Role.ADMIN).allowed).toBe(true);
    });
  });
});
