import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordAuditLog } from '@/lib/utils/audit';
import { prisma } from '@/lib/db/prisma';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

describe('Audit Helper — recordAuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully record an audit log with sanitized metadata', async () => {
    const createMock = vi.mocked(prisma.auditLog.create).mockResolvedValue({
      id: 'audit_123',
      tenantId: 'tenant_1',
      userId: 'user_1',
      action: 'INVOICE_ISSUED',
      entity: 'INVOICE',
      entityId: 'inv_123',
      metadata: {},
      ipAddress: null,
      userAgent: null,
      createdAt: new Date(),
    });

    await recordAuditLog({
      tenantId: 'tenant_1',
      userId: 'user_1',
      action: 'INVOICE_ISSUED',
      entity: 'INVOICE',
      entityId: 'inv_123',
      metadata: {
        invoiceNumber: 'INV-2026-0001',
        total: '1200.00',
        userPassword: 'SecretPassword123!',
        apiToken: 'tok_abc123',
      },
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    const callArgs = createMock.mock.calls[0][0];
    expect(callArgs.data.tenantId).toBe('tenant_1');
    expect(callArgs.data.userId).toBe('user_1');
    expect(callArgs.data.action).toBe('INVOICE_ISSUED');
    expect(callArgs.data.entity).toBe('INVOICE');
    expect(callArgs.data.entityId).toBe('inv_123');

    // Verify sensitive data was redacted in metadata
    const recordedMetadata = callArgs.data.metadata as Record<string, unknown>;
    expect(recordedMetadata.invoiceNumber).toBe('INV-2026-0001');
    expect(recordedMetadata.total).toBe('1200.00');
    expect(recordedMetadata.userPassword).toBe('[REDACTED]');
    expect(recordedMetadata.apiToken).toBe('[REDACTED]');
  });

  it('should write through transaction client when tx is provided', async () => {
    const txMock = {
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit_tx_1' }),
      },
    };

    await recordAuditLog({
      tenantId: 'tenant_1',
      userId: 'user_1',
      action: 'PAYMENT_RECORDED',
      entity: 'PAYMENT',
      entityId: 'pay_123',
      tx: txMock as any,
    });

    expect(txMock.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('should reject missing tenantId and throw when throwOnError is true', async () => {
    await expect(
      recordAuditLog({
        tenantId: '',
        userId: 'user_1',
        action: 'ORDER_CREATED',
        entity: 'ORDER',
        throwOnError: true,
      })
    ).rejects.toThrow('tenantId is required');
  });

  it('should gracefully suppress errors when throwOnError is false (default)', async () => {
    vi.mocked(prisma.auditLog.create).mockRejectedValue(new Error('DB connection failure'));

    // Should not throw
    await expect(
      recordAuditLog({
        tenantId: 'tenant_1',
        userId: 'user_1',
        action: 'ORDER_CREATED',
        entity: 'ORDER',
        throwOnError: false,
      })
    ).resolves.toBeUndefined();
  });
});
