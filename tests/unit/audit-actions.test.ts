import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addMemberAction } from '@/lib/actions/members';
import { confirmOrderAction } from '@/lib/actions/orders';
import { issueInvoiceAction } from '@/lib/actions/invoices';
import { recordPaymentAction, refundPaymentAction } from '@/lib/actions/payments';
import { createExpenseAction } from '@/lib/actions/expenses';
import { getRequiredTenantContext } from '@/lib/auth/session';
import { recordAuditLog } from '@/lib/utils/audit';
import { prisma } from '@/lib/db/prisma';
import { Role, OrderStatus, InvoiceStatus, PaymentMethod, PaymentStatus, ExpenseCategory, Prisma } from '@prisma/client';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock session and auth
vi.mock('@/lib/auth/session', () => ({
  getRequiredTenantContext: vi.fn(),
  getUserTenants: vi.fn(),
}));

// Mock recordAuditLog
vi.mock('@/lib/utils/audit', () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Mock prisma
vi.mock('@/lib/db/prisma', () => {
  const mockPrisma = {
    user: { findUnique: vi.fn(), create: vi.fn() },
    membership: { findUnique: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    product: { findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    inventory: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    inventoryMovement: { create: vi.fn() },
    customer: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    order: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    orderItem: { createMany: vi.fn(), deleteMany: vi.fn() },
    invoice: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    invoiceItem: { createMany: vi.fn(), deleteMany: vi.fn() },
    payment: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    expense: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    ledgerEntry: { create: vi.fn() },
    auditLog: { findMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(async (cb) => cb(mockPrisma)),
  };
  return { prisma: mockPrisma };
});

describe('Action-Level Audit Logging Verification', () => {
  const mockTenantContext = {
    userId: 'user_owner_1',
    tenantId: 'tenant_acme',
    tenantSlug: 'acme',
    tenantName: 'Acme Corp',
    role: Role.OWNER,
    user: { id: 'user_owner_1', name: 'Alice Owner', email: 'alice@acme.com' },
    organizationId: 'tenant_acme',
    organizationSlug: 'acme',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRequiredTenantContext).mockResolvedValue(mockTenantContext);
  });

  it('should log MEMBER_CREATED audit event on successful member addition', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'new_user_1',
      name: 'Bob Member',
      email: 'bob@acme.com',
      passwordHash: 'hash',
      emailVerified: new Date(),
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.membership.create).mockResolvedValue({
      id: 'mem_1',
      userId: 'new_user_1',
      tenantId: 'tenant_acme',
      role: Role.MEMBER,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await addMemberAction('acme', {
      name: 'Bob Member',
      email: 'bob@acme.com',
      role: Role.MEMBER,
    });

    if (!res.success) {
      console.error('addMemberAction error:', res.error);
    }
    expect(res.success).toBe(true);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant_acme',
        userId: 'user_owner_1',
        action: 'MEMBER_CREATED',
        entity: 'MEMBER',
      })
    );
  });

  it('should log ORDER_CONFIRMED audit event on successful order confirmation', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue({
      id: 'order_1',
      tenantId: 'tenant_acme',
      customerId: 'cust_1',
      status: OrderStatus.DRAFT,
      subtotal: new Prisma.Decimal('100.00'),
      discount: new Prisma.Decimal('0.00'),
      total: new Prisma.Decimal('100.00'),
      notes: null,
      createdByUserId: 'user_owner_1',
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        {
          id: 'item_1',
          orderId: 'order_1',
          productId: 'prod_1',
          quantity: 2,
          unitPrice: new Prisma.Decimal('50.00'),
          lineTotal: new Prisma.Decimal('100.00'),
          createdAt: new Date(),
          updatedAt: new Date(),
          product: { id: 'prod_1', name: 'Widget A', sku: 'WGT-A' },
        },
      ],
    } as any);

    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: 'order_1',
      status: OrderStatus.DRAFT,
    } as any);

    vi.mocked(prisma.inventory.findUnique).mockResolvedValue({
      id: 'inv_1',
      productId: 'prod_1',
      tenantId: 'tenant_acme',
      quantity: 10,
      reorderLevel: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(prisma.inventory.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.inventoryMovement.create).mockResolvedValue({} as any);
    vi.mocked(prisma.order.update).mockResolvedValue({} as any);

    const res = await confirmOrderAction('acme', { orderId: 'order_1' });
    if (!res.success) {
      console.error('confirmOrderAction error:', res.error);
    }
    expect(res.success).toBe(true);

    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant_acme',
        userId: 'user_owner_1',
        action: 'ORDER_CONFIRMED',
        entity: 'ORDER',
        entityId: 'order_1',
      })
    );
  });

  it('should log INVOICE_ISSUED audit event on successful invoice issuing', async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: 'inv_1',
      tenantId: 'tenant_acme',
      invoiceNumber: 'INV-2026-0001',
      status: InvoiceStatus.DRAFT,
      total: new Prisma.Decimal('100.00'),
    } as any);

    vi.mocked(prisma.invoice.findUnique).mockResolvedValue({
      id: 'inv_1',
      status: InvoiceStatus.DRAFT,
      total: new Prisma.Decimal('100.00'),
      customerId: 'cust_1',
    } as any);

    vi.mocked(prisma.invoice.update).mockResolvedValue({
      id: 'inv_1',
      status: InvoiceStatus.ISSUED,
      invoiceNumber: 'INV-2026-0001',
    } as any);

    const res = await issueInvoiceAction('acme', { invoiceId: 'inv_1' });
    if (!res.success) {
      console.error('issueInvoiceAction error:', res.error);
    }
    expect(res.success).toBe(true);

    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant_acme',
        userId: 'user_owner_1',
        action: 'INVOICE_ISSUED',
        entity: 'INVOICE',
        entityId: 'inv_1',
      })
    );
  });

  it('should log PAYMENT_RECORDED audit event on successful payment recording', async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: 'inv_1',
      tenantId: 'tenant_acme',
      status: InvoiceStatus.ISSUED,
      invoiceNumber: 'INV-2026-0001',
    } as any);

    vi.mocked(prisma.invoice.findUnique).mockResolvedValue({
      id: 'inv_1',
      tenantId: 'tenant_acme',
      status: InvoiceStatus.ISSUED,
      total: new Prisma.Decimal('100.00'),
      paidAmount: new Prisma.Decimal('0.00'),
      balance: new Prisma.Decimal('100.00'),
      dueDate: new Date(),
      invoiceNumber: 'INV-2026-0001',
    } as any);

    vi.mocked(prisma.payment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.payment.create).mockResolvedValue({
      id: 'pay_1',
      paymentNumber: 'PAY-2026-0001',
      amount: new Prisma.Decimal('100.00'),
      status: PaymentStatus.COMPLETED,
    } as any);

    vi.mocked(prisma.invoice.update).mockResolvedValue({} as any);
    vi.mocked(prisma.ledgerEntry.create).mockResolvedValue({} as any);

    const res = await recordPaymentAction('acme', {
      invoiceId: 'inv_1',
      amount: 100,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      paymentDate: new Date(),
    });

    if (!res.success) {
      console.error('recordPaymentAction error:', res.error);
    }
    expect(res.success).toBe(true);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant_acme',
        userId: 'user_owner_1',
        action: 'PAYMENT_RECORDED',
        entity: 'PAYMENT',
        entityId: 'pay_1',
      })
    );
  });

  it('should log PAYMENT_REFUNDED audit event on successful payment refund', async () => {
    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'pay_1',
      tenantId: 'tenant_acme',
      status: PaymentStatus.COMPLETED,
      paymentNumber: 'PAY-2026-0001',
      invoiceId: 'inv_1',
    } as any);

    vi.mocked(prisma.payment.findUnique).mockResolvedValue({
      id: 'pay_1',
      tenantId: 'tenant_acme',
      status: PaymentStatus.COMPLETED,
      amount: new Prisma.Decimal('100.00'),
      paymentNumber: 'PAY-2026-0001',
      invoiceId: 'inv_1',
    } as any);

    vi.mocked(prisma.invoice.findUnique).mockResolvedValue({
      id: 'inv_1',
      tenantId: 'tenant_acme',
      total: new Prisma.Decimal('100.00'),
      paidAmount: new Prisma.Decimal('100.00'),
      balance: new Prisma.Decimal('0.00'),
      dueDate: new Date(),
      invoiceNumber: 'INV-2026-0001',
      status: InvoiceStatus.PAID,
    } as any);

    vi.mocked(prisma.payment.update).mockResolvedValue({} as any);
    vi.mocked(prisma.invoice.update).mockResolvedValue({} as any);
    vi.mocked(prisma.ledgerEntry.create).mockResolvedValue({} as any);

    const res = await refundPaymentAction('acme', {
      paymentId: 'pay_1',
      reason: 'Customer requested refund',
    });

    if (!res.success) {
      console.error('refundPaymentAction error:', res.error);
    }
    expect(res.success).toBe(true);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant_acme',
        userId: 'user_owner_1',
        action: 'PAYMENT_REFUNDED',
        entity: 'PAYMENT',
        entityId: 'pay_1',
      })
    );
  });

  it('should log EXPENSE_CREATED audit event on successful expense creation', async () => {
    vi.mocked(prisma.expense.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.expense.create).mockResolvedValue({
      id: 'exp_1',
      expenseNumber: 'EXP-2026-0001',
      category: ExpenseCategory.OFFICE_SUPPLIES,
      payee: 'Staples',
      total: new Prisma.Decimal('75.00'),
    } as any);
    vi.mocked(prisma.ledgerEntry.create).mockResolvedValue({} as any);

    const res = await createExpenseAction('acme', {
      category: ExpenseCategory.OFFICE_SUPPLIES,
      payee: 'Staples',
      amount: 75,
      taxAmount: 0,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      expenseDate: new Date(),
    });

    if (!res.success) {
      console.error('createExpenseAction error:', res.error);
    }
    expect(res.success).toBe(true);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant_acme',
        userId: 'user_owner_1',
        action: 'EXPENSE_CREATED',
        entity: 'EXPENSE',
        entityId: 'exp_1',
      })
    );
  });
});
