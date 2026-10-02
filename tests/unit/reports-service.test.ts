import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTenantReportsData } from '@/lib/services/reports-service';
import { prisma } from '@/lib/db/prisma';
import {
  InvoiceStatus,
  PaymentStatus,
  OrderStatus,
  ExpenseCategory,
  Prisma,
} from '@prisma/client';

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    invoice: { findMany: vi.fn() },
    payment: { findMany: vi.fn() },
    expense: { findMany: vi.fn() },
    order: { findMany: vi.fn() },
    orderItem: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
    customer: { findMany: vi.fn() },
  },
}));

describe('Reports Service — getTenantReportsData', () => {
  const asOf = new Date('2026-08-23T12:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle completely empty workspace without dividing by zero', async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([]);
    vi.mocked(prisma.order.findMany).mockResolvedValue([]);
    vi.mocked(prisma.orderItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);
    vi.mocked(prisma.customer.findMany).mockResolvedValue([]);

    const data = await getTenantReportsData('tenant_empty', 'ALL', asOf);

    expect(data.financials.collectedRevenue).toBe('0');
    expect(data.financials.totalExpenses).toBe('0');
    expect(data.financials.netProfit).toBe('0');
    expect(data.financials.accountsReceivable).toBe('0');
    expect(data.financials.averageExpense).toBe('0.00');

    expect(data.orders.totalCount).toBe(0);
    expect(data.orders.totalValue).toBe('0');
    expect(data.orders.averageOrderValue).toBe('0.00');

    expect(data.products.totalProducts).toBe(0);
    expect(data.products.totalInventoryUnits).toBe(0);
    expect(data.products.totalCostValuation).toBe('0');
    expect(data.products.totalRetailValuation).toBe('0');

    expect(data.customers.totalCount).toBe(0);
    expect(data.expenseCategories).toHaveLength(0);
    expect(data.monthlyTrends).toBeDefined();
  });

  it('should compute authoritative financial aggregates with Decimal precision', async () => {
    // 1. Invoices in range
    vi.mocked(prisma.invoice.findMany)
      .mockResolvedValueOnce([
        {
          id: 'inv_1',
          status: InvoiceStatus.PAID,
          total: new Prisma.Decimal('1200.00'),
          paidAmount: new Prisma.Decimal('1200.00'),
          balance: new Prisma.Decimal('0.00'),
          createdAt: new Date(),
        },
        {
          id: 'inv_2',
          status: InvoiceStatus.PARTIALLY_PAID,
          total: new Prisma.Decimal('800.00'),
          paidAmount: new Prisma.Decimal('300.00'),
          balance: new Prisma.Decimal('500.00'),
          createdAt: new Date(),
        },
      ] as any)
      // 2. All open invoices for AR
      .mockResolvedValueOnce([
        {
          id: 'inv_2',
          customerId: 'cust_1',
          balance: new Prisma.Decimal('500.00'),
        },
      ] as any);

    // 3. Payments
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        id: 'pay_1',
        amount: new Prisma.Decimal('1200.00'),
        status: PaymentStatus.COMPLETED,
        paymentDate: new Date(),
      },
      {
        id: 'pay_2',
        amount: new Prisma.Decimal('300.00'),
        status: PaymentStatus.COMPLETED,
        paymentDate: new Date(),
      },
      {
        id: 'pay_3',
        amount: new Prisma.Decimal('100.00'),
        status: PaymentStatus.REFUNDED,
        paymentDate: new Date(),
      },
    ] as any);

    // 4. Expenses
    vi.mocked(prisma.expense.findMany).mockResolvedValue([
      {
        id: 'exp_1',
        category: ExpenseCategory.OFFICE_SUPPLIES,
        total: new Prisma.Decimal('150.00'),
        amount: new Prisma.Decimal('150.00'),
        taxAmount: new Prisma.Decimal('0.00'),
        expenseDate: new Date(),
      },
      {
        id: 'exp_2',
        category: ExpenseCategory.SOFTWARE_SUBSCRIPTION,
        total: new Prisma.Decimal('250.00'),
        amount: new Prisma.Decimal('250.00'),
        taxAmount: new Prisma.Decimal('0.00'),
        expenseDate: new Date(),
      },
    ] as any);

    // 5. Orders
    vi.mocked(prisma.order.findMany).mockResolvedValue([
      {
        id: 'ord_1',
        customerId: 'cust_1',
        status: OrderStatus.CONFIRMED,
        total: new Prisma.Decimal('1200.00'),
        subtotal: new Prisma.Decimal('1200.00'),
        discount: new Prisma.Decimal('0.00'),
        createdAt: new Date(),
      },
    ] as any);

    // 6. Products + Inventory
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      {
        id: 'prod_1',
        name: 'Pro Laptop',
        sku: 'LAP-001',
        cost: new Prisma.Decimal('800.00'),
        price: new Prisma.Decimal('1200.00'),
        isActive: true,
        inventory: { quantity: 5, reorderLevel: 2 },
      },
      {
        id: 'prod_2',
        name: 'Mouse',
        sku: 'MOU-001',
        cost: new Prisma.Decimal('10.00'),
        price: new Prisma.Decimal('25.00'),
        isActive: true,
        inventory: { quantity: 1, reorderLevel: 2 }, // Low stock
      },
    ] as any);

    // 7. Order Items
    vi.mocked(prisma.orderItem.findMany).mockResolvedValue([
      {
        id: 'item_1',
        productId: 'prod_1',
        quantity: 1,
        lineTotal: new Prisma.Decimal('1200.00'),
        product: { id: 'prod_1', name: 'Pro Laptop', sku: 'LAP-001' },
      },
    ] as any);

    // 8. Customers
    vi.mocked(prisma.customer.findMany).mockResolvedValue([
      {
        id: 'cust_1',
        name: 'Acme Client',
        companyName: 'Acme Inc',
        email: 'client@acme.com',
        isActive: true,
        createdAt: new Date(),
      },
    ] as any);

    const data = await getTenantReportsData('tenant_1', 'ALL', asOf);

    // Collected revenue = 1200 + 300 = 1500
    expect(data.financials.collectedRevenue).toBe('1500');
    // Refunded amount = 100
    expect(data.financials.refundedAmount).toBe('100');
    expect(data.financials.refundCount).toBe(1);

    // Total expenses = 150 + 250 = 400
    expect(data.financials.totalExpenses).toBe('400');
    // Net profit = 1500 - 400 = 1100
    expect(data.financials.netProfit).toBe('1100');
    // Accounts Receivable = 500
    expect(data.financials.accountsReceivable).toBe('500');

    // Expense categories
    expect(data.expenseCategories).toHaveLength(2);
    expect(data.financials.averageExpense).toBe('200.00');

    // Products & Inventory
    expect(data.products.totalProducts).toBe(2);
    expect(data.products.totalInventoryUnits).toBe(6); // 5 + 1
    // Cost valuation = 5*800 + 1*10 = 4010
    expect(data.products.totalCostValuation).toBe('4010');
    // Retail valuation = 5*1200 + 1*25 = 6025
    expect(data.products.totalRetailValuation).toBe('6025');
    // Low stock count = 1
    expect(data.products.lowStockCount).toBe(1);

    // Customer analytics
    expect(data.customers.totalCount).toBe(1);
    expect(data.customers.topCustomers[0].totalSpend).toBe('1200');
    expect(data.customers.topCustomers[0].outstandingBalance).toBe('500');
  });

  it('should enforce tenant isolation on all queries', async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.expense.findMany).mockResolvedValue([]);
    vi.mocked(prisma.order.findMany).mockResolvedValue([]);
    vi.mocked(prisma.orderItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.product.findMany).mockResolvedValue([]);
    vi.mocked(prisma.customer.findMany).mockResolvedValue([]);

    await getTenantReportsData('tenant_xyz_isolation', 'ALL', asOf);

    // Verify tenantId was passed to all findMany calls
    expect(vi.mocked(prisma.invoice.findMany).mock.calls[0][0]?.where?.tenantId).toBe('tenant_xyz_isolation');
    expect(vi.mocked(prisma.payment.findMany).mock.calls[0][0]?.where?.tenantId).toBe('tenant_xyz_isolation');
    expect(vi.mocked(prisma.expense.findMany).mock.calls[0][0]?.where?.tenantId).toBe('tenant_xyz_isolation');
    expect(vi.mocked(prisma.order.findMany).mock.calls[0][0]?.where?.tenantId).toBe('tenant_xyz_isolation');
    expect(vi.mocked(prisma.product.findMany).mock.calls[0][0]?.where?.tenantId).toBe('tenant_xyz_isolation');
    expect(vi.mocked(prisma.customer.findMany).mock.calls[0][0]?.where?.tenantId).toBe('tenant_xyz_isolation');
  });
});
