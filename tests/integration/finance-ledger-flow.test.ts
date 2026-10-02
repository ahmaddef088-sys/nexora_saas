import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ACME_OWNER_CONTEXT } from './helpers/test-harness';
import { getRequiredTenantContext } from '@/lib/auth/session';
import {
  generateInvoiceFromOrderAction,
  issueInvoiceAction,
} from '@/lib/actions/invoices';
import {
  recordPaymentAction,
  refundPaymentAction,
} from '@/lib/actions/payments';
import {
  createExpenseAction,
  deleteExpenseAction,
} from '@/lib/actions/expenses';
import { recordAuditLog } from '@/lib/utils/audit';
import { prisma } from '@/lib/db/prisma';
import {
  OrderStatus,
  InvoiceStatus,
  PaymentStatus,
  PaymentMethod,
  ExpenseCategory,
  Prisma,
} from '@prisma/client';

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
    order: { findFirst: vi.fn(), findUnique: vi.fn() },
    invoice: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    invoiceItem: { createMany: vi.fn() },
    payment: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    expense: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    ledgerEntry: { create: vi.fn() },
    $transaction: vi.fn(async (cb) => cb(mock)),
  };
  return { prisma: mock };
});

describe('Integration Suite 4 — Finance, Invoices, Payments, Refunds & Ledger Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRequiredTenantContext).mockResolvedValue(ACME_OWNER_CONTEXT);
  });

  describe('Invoice & Payment Settlement with General Ledger Immutability', () => {
    it('should generate invoice from confirmed order, issue it, record payment, and post to ledger', async () => {
      // 1. Generate Invoice from Confirmed Order
      vi.mocked(prisma.order.findFirst).mockResolvedValueOnce({
        id: 'ord_101',
        tenantId: ACME_OWNER_CONTEXT.tenantId,
        customerId: 'cust_1',
        status: OrderStatus.CONFIRMED,
        discount: new Prisma.Decimal('0.00'),
        items: [
          {
            productId: 'prod_1',
            quantity: 2,
            unitPrice: new Prisma.Decimal('500.00'),
            lineTotal: new Prisma.Decimal('1000.00'),
            product: { name: 'Quantum Core', description: 'Engine', sku: 'QNT-01' },
          },
        ],
      } as any);

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: 'ord_101',
        status: OrderStatus.CONFIRMED,
        tenantId: ACME_OWNER_CONTEXT.tenantId,
      } as any);

      vi.mocked(prisma.invoice.findFirst).mockResolvedValueOnce(null); // Sequence generation
      vi.mocked(prisma.invoice.create).mockResolvedValueOnce({
        id: 'inv_101',
        tenantId: ACME_OWNER_CONTEXT.tenantId,
        invoiceNumber: 'INV-2026-0001',
        status: InvoiceStatus.DRAFT,
        total: new Prisma.Decimal('1000.00'),
      } as any);

      const genRes = await generateInvoiceFromOrderAction('acme', {
        orderId: 'ord_101',
        taxRate: 0,
      });

      expect(genRes.success).toBe(true);
      expect(recordAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'INVOICE_GENERATED_FROM_ORDER',
          entity: 'INVOICE',
        })
      );

      // 2. Issue Invoice
      vi.mocked(prisma.invoice.findFirst).mockResolvedValueOnce({
        id: 'inv_101',
        tenantId: ACME_OWNER_CONTEXT.tenantId,
        status: InvoiceStatus.DRAFT,
        invoiceNumber: 'INV-2026-0001',
        total: new Prisma.Decimal('1000.00'),
      } as any);
      vi.mocked(prisma.invoice.findUnique).mockResolvedValueOnce({
        id: 'inv_101',
        status: InvoiceStatus.DRAFT,
        total: new Prisma.Decimal('1000.00'),
        customerId: 'cust_1',
      } as any);
      vi.mocked(prisma.invoice.update).mockResolvedValueOnce({
        id: 'inv_101',
        status: InvoiceStatus.ISSUED,
        invoiceNumber: 'INV-2026-0001',
      } as any);

      const issueRes = await issueInvoiceAction('acme', {
        invoiceId: 'inv_101',
      });

      expect(issueRes.success).toBe(true);
      expect(recordAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'INVOICE_ISSUED',
          entityId: 'inv_101',
        })
      );

      // 3. Record Full Payment ($1000)
      vi.mocked(prisma.invoice.findFirst).mockResolvedValueOnce({
        id: 'inv_101',
        tenantId: ACME_OWNER_CONTEXT.tenantId,
        status: InvoiceStatus.ISSUED,
        invoiceNumber: 'INV-2026-0001',
      } as any);
      vi.mocked(prisma.invoice.findUnique).mockResolvedValueOnce({
        id: 'inv_101',
        tenantId: ACME_OWNER_CONTEXT.tenantId,
        status: InvoiceStatus.ISSUED,
        total: new Prisma.Decimal('1000.00'),
        paidAmount: new Prisma.Decimal('0.00'),
        balance: new Prisma.Decimal('1000.00'),
        dueDate: new Date(),
        invoiceNumber: 'INV-2026-0001',
      } as any);
      vi.mocked(prisma.payment.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.payment.create).mockResolvedValueOnce({
        id: 'pay_101',
        paymentNumber: 'PAY-2026-0001',
        amount: new Prisma.Decimal('1000.00'),
        status: PaymentStatus.COMPLETED,
      } as any);
      vi.mocked(prisma.invoice.update).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.ledgerEntry.create).mockResolvedValueOnce({} as any);

      const payRes = await recordPaymentAction('acme', {
        invoiceId: 'inv_101',
        amount: 1000,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        paymentDate: new Date(),
      });

      expect(payRes.success).toBe(true);
      expect(prisma.ledgerEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: ACME_OWNER_CONTEXT.tenantId,
            type: 'REVENUE',
            amount: expect.any(Object),
          }),
        })
      );
    });

    it('should refund a payment and append an offsetting ledger reversal entry', async () => {
      vi.mocked(prisma.payment.findFirst).mockResolvedValueOnce({
        id: 'pay_101',
        tenantId: ACME_OWNER_CONTEXT.tenantId,
        status: PaymentStatus.COMPLETED,
        paymentNumber: 'PAY-2026-0001',
        invoiceId: 'inv_101',
      } as any);
      vi.mocked(prisma.payment.findUnique).mockResolvedValueOnce({
        id: 'pay_101',
        tenantId: ACME_OWNER_CONTEXT.tenantId,
        status: PaymentStatus.COMPLETED,
        amount: new Prisma.Decimal('1000.00'),
        paymentNumber: 'PAY-2026-0001',
        invoiceId: 'inv_101',
      } as any);
      vi.mocked(prisma.invoice.findUnique).mockResolvedValueOnce({
        id: 'inv_101',
        tenantId: ACME_OWNER_CONTEXT.tenantId,
        total: new Prisma.Decimal('1000.00'),
        paidAmount: new Prisma.Decimal('1000.00'),
        balance: new Prisma.Decimal('0.00'),
        dueDate: new Date(),
        invoiceNumber: 'INV-2026-0001',
        status: InvoiceStatus.PAID,
      } as any);

      vi.mocked(prisma.payment.update).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.invoice.update).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.ledgerEntry.create).mockResolvedValueOnce({} as any);

      const refundRes = await refundPaymentAction('acme', {
        paymentId: 'pay_101',
        reason: 'Customer returned unit under 30-day warranty',
      });

      expect(refundRes.success).toBe(true);
      // Verify offsetting ledger entry creation
      expect(prisma.ledgerEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: ACME_OWNER_CONTEXT.tenantId,
            type: 'REVENUE',
            description: expect.stringContaining('PAY-2026-0001'),
          }),
        })
      );
    });
  });

  describe('Expense Lifecycle with Ledger Entries', () => {
    it('should create an expense and append an EXPENSE ledger entry, and reverse it on delete', async () => {
      // 1. Create Expense
      vi.mocked(prisma.expense.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.expense.create).mockResolvedValueOnce({
        id: 'exp_1',
        expenseNumber: 'EXP-2026-0001',
        category: ExpenseCategory.OFFICE_SUPPLIES,
        payee: 'OfficeDepot',
        amount: new Prisma.Decimal('120.00'),
        taxAmount: new Prisma.Decimal('10.00'),
        total: new Prisma.Decimal('130.00'),
      } as any);
      vi.mocked(prisma.ledgerEntry.create).mockResolvedValueOnce({} as any);

      const expRes = await createExpenseAction('acme', {
        category: ExpenseCategory.OFFICE_SUPPLIES,
        payee: 'OfficeDepot',
        amount: 120,
        taxAmount: 10,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        expenseDate: new Date(),
      });

      expect(expRes.success).toBe(true);
      expect(prisma.ledgerEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'EXPENSE',
            amount: expect.any(Object),
          }),
        })
      );

      // 2. Delete Expense
      vi.mocked(prisma.expense.findFirst).mockResolvedValueOnce({
        id: 'exp_1',
        tenantId: ACME_OWNER_CONTEXT.tenantId,
        expenseNumber: 'EXP-2026-0001',
        total: new Prisma.Decimal('130.00'),
        category: ExpenseCategory.OFFICE_SUPPLIES,
        payee: 'OfficeDepot',
      } as any);
      vi.mocked(prisma.expense.findUnique).mockResolvedValueOnce({
        id: 'exp_1',
        tenantId: ACME_OWNER_CONTEXT.tenantId,
        expenseNumber: 'EXP-2026-0001',
        total: new Prisma.Decimal('130.00'),
      } as any);
      vi.mocked(prisma.ledgerEntry.create).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.expense.delete).mockResolvedValueOnce({} as any);

      const delExpRes = await deleteExpenseAction('acme', {
        expenseId: 'exp_1',
      });

      expect(delExpRes.success).toBe(true);
      expect(prisma.ledgerEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'EXPENSE',
            description: expect.stringContaining('EXP-2026-0001'),
          }),
        })
      );
    });
  });
});
