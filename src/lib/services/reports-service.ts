import { prisma } from '@/lib/db/prisma';
import {
  Prisma,
  OrderStatus,
  InvoiceStatus,
  PaymentStatus,
  ExpenseCategory,
} from '@prisma/client';
import {
  DateRangePreset,
  getDateRangeBounds,
} from '@/lib/utils/reports-constants';
import { expenseCategoryLabels } from '@/lib/utils/expense-constants';

export interface ReportsData {
  preset: DateRangePreset;
  asOfDate: string;
  startDate?: string;
  endDate?: string;

  // 1. Executive Financial Summary
  financials: {
    collectedRevenue: string;
    invoicedRevenue: string;
    totalExpenses: string;
    netProfit: string;
    accountsReceivable: string;
    paidInvoicesAmount: string;
    outstandingInvoicesAmount: string;
    refundedAmount: string;
    refundCount: number;
    expenseCount: number;
    averageExpense: string;
  };

  // 2. Expense Category Breakdown
  expenseCategories: Array<{
    category: ExpenseCategory;
    label: string;
    amount: string;
    count: number;
    percentage: number;
  }>;

  // 3. Sales & Orders
  orders: {
    totalCount: number;
    confirmedCount: number;
    completedCount: number;
    draftCount: number;
    cancelledCount: number;
    totalValue: string;
    averageOrderValue: string;
    statusDistribution: Array<{
      status: OrderStatus;
      label: string;
      count: number;
      value: string;
      percentage: number;
    }>;
  };

  // 4. Products & Inventory Valuation
  products: {
    totalProducts: number;
    activeProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalInventoryUnits: number;
    totalCostValuation: string;
    totalRetailValuation: string;
    topProductsByRevenue: Array<{
      id: string;
      name: string;
      sku: string;
      quantitySold: number;
      revenue: string;
    }>;
    topProductsByVolume: Array<{
      id: string;
      name: string;
      sku: string;
      quantitySold: number;
      revenue: string;
    }>;
    lowStockItems: Array<{
      id: string;
      name: string;
      sku: string;
      quantity: number;
      reorderLevel: number;
    }>;
  };

  // 5. Customers
  customers: {
    totalCount: number;
    activeCount: number;
    newInPeriodCount: number;
    topCustomers: Array<{
      id: string;
      name: string;
      companyName: string | null;
      email: string | null;
      orderCount: number;
      totalSpend: string;
      outstandingBalance: string;
    }>;
  };

  // 6. Invoices Summary
  invoices: {
    totalCount: number;
    draftCount: number;
    issuedCount: number;
    partiallyPaidCount: number;
    paidCount: number;
    overdueCount: number;
    voidedCount: number;
  };

  // 7. Time-series Trends (for charts)
  monthlyTrends: Array<{
    period: string;
    revenue: number;
    expenses: number;
    net: number;
    orders: number;
  }>;
}

export async function getTenantReportsData(
  tenantId: string,
  preset: DateRangePreset = 'ALL',
  asOfDate: Date = new Date()
): Promise<ReportsData> {
  const bounds = getDateRangeBounds(preset, asOfDate);
  const dateFilter = bounds.startDate && bounds.endDate
    ? { gte: bounds.startDate, lte: bounds.endDate }
    : undefined;

  // ── Parallel Tenant-Scoped Database Queries ─────────────────────────────────
  const [
    // Invoices in date range
    invoicesInRange,
    // All unpaid invoices (for current AR)
    allUnpaidInvoices,
    // Payments in date range
    paymentsInRange,
    // Expenses in date range
    expensesInRange,
    // Orders in date range
    ordersInRange,
    // All Products with Inventory
    allProductsWithInventory,
    // Order items for product analytics (from confirmed/completed orders in range)
    orderItemsInRange,
    // Customers
    allCustomers,
  ] = await Promise.all([
    // 1. Invoices
    prisma.invoice.findMany({
      where: {
        tenantId,
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      select: {
        id: true,
        status: true,
        total: true,
        paidAmount: true,
        balance: true,
        createdAt: true,
      },
    }),

    // 2. All Outstanding Invoices for AR
    prisma.invoice.findMany({
      where: {
        tenantId,
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
        balance: { gt: 0 },
      },
      select: {
        id: true,
        customerId: true,
        balance: true,
      },
    }),

    // 3. Payments
    prisma.payment.findMany({
      where: {
        tenantId,
        ...(dateFilter ? { paymentDate: dateFilter } : {}),
      },
      select: {
        id: true,
        amount: true,
        status: true,
        paymentDate: true,
      },
    }),

    // 4. Expenses
    prisma.expense.findMany({
      where: {
        tenantId,
        ...(dateFilter ? { expenseDate: dateFilter } : {}),
      },
      select: {
        id: true,
        category: true,
        total: true,
        amount: true,
        taxAmount: true,
        expenseDate: true,
      },
    }),

    // 5. Orders
    prisma.order.findMany({
      where: {
        tenantId,
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      select: {
        id: true,
        customerId: true,
        status: true,
        total: true,
        subtotal: true,
        discount: true,
        createdAt: true,
      },
    }),

    // 6. Products + Inventory
    prisma.product.findMany({
      where: { tenantId },
      include: {
        inventory: true,
      },
    }),

    // 7. Order Items
    prisma.orderItem.findMany({
      where: {
        order: {
          tenantId,
          status: { in: [OrderStatus.CONFIRMED, OrderStatus.COMPLETED] },
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
      },
    }),

    // 8. Customers
    prisma.customer.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        companyName: true,
        email: true,
        isActive: true,
        createdAt: true,
      },
    }),
  ]);

  // ── Financial Calculations (Decimal-Safe) ──────────────────────────────────
  let decCollectedRevenue = new Prisma.Decimal('0.00');
  let decRefundedAmount = new Prisma.Decimal('0.00');
  let refundCount = 0;

  for (const payment of paymentsInRange) {
    const pAmt = new Prisma.Decimal(payment.amount.toString());
    if (payment.status === PaymentStatus.COMPLETED) {
      decCollectedRevenue = decCollectedRevenue.add(pAmt);
    } else if (payment.status === PaymentStatus.REFUNDED) {
      decRefundedAmount = decRefundedAmount.add(pAmt);
      refundCount++;
    }
  }

  let decInvoicedRevenue = new Prisma.Decimal('0.00');
  let decPaidInvoicesAmount = new Prisma.Decimal('0.00');
  let decOutstandingInvoicesAmount = new Prisma.Decimal('0.00');

  let invoiceStatusCounts = {
    total: invoicesInRange.length,
    draft: 0,
    issued: 0,
    partiallyPaid: 0,
    paid: 0,
    overdue: 0,
    voided: 0,
  };

  for (const inv of invoicesInRange) {
    const invTotal = new Prisma.Decimal(inv.total.toString());
    const invPaid = new Prisma.Decimal(inv.paidAmount.toString());
    const invBalance = new Prisma.Decimal(inv.balance.toString());

    if (inv.status !== InvoiceStatus.DRAFT && inv.status !== InvoiceStatus.VOIDED) {
      decInvoicedRevenue = decInvoicedRevenue.add(invTotal);
      decPaidInvoicesAmount = decPaidInvoicesAmount.add(invPaid);
      decOutstandingInvoicesAmount = decOutstandingInvoicesAmount.add(invBalance);
    }

    if (inv.status === InvoiceStatus.DRAFT) invoiceStatusCounts.draft++;
    else if (inv.status === InvoiceStatus.ISSUED) invoiceStatusCounts.issued++;
    else if (inv.status === InvoiceStatus.PARTIALLY_PAID) invoiceStatusCounts.partiallyPaid++;
    else if (inv.status === InvoiceStatus.PAID) invoiceStatusCounts.paid++;
    else if (inv.status === InvoiceStatus.OVERDUE) invoiceStatusCounts.overdue++;
    else if (inv.status === InvoiceStatus.VOIDED) invoiceStatusCounts.voided++;
  }

  // Authoritative Total AR (All open unpaid invoices)
  let decTotalAR = new Prisma.Decimal('0.00');
  const customerDebtMap = new Map<string, Prisma.Decimal>();

  for (const inv of allUnpaidInvoices) {
    const bal = new Prisma.Decimal(inv.balance.toString());
    decTotalAR = decTotalAR.add(bal);

    const prevDebt = customerDebtMap.get(inv.customerId) || new Prisma.Decimal('0.00');
    customerDebtMap.set(inv.customerId, prevDebt.add(bal));
  }

  // Expenses Calculations
  let decTotalExpenses = new Prisma.Decimal('0.00');
  const expenseCatMap = new Map<ExpenseCategory, { count: number; total: Prisma.Decimal }>();

  for (const exp of expensesInRange) {
    const expTotal = new Prisma.Decimal(exp.total.toString());
    decTotalExpenses = decTotalExpenses.add(expTotal);

    const existing = expenseCatMap.get(exp.category) || { count: 0, total: new Prisma.Decimal('0.00') };
    existing.count++;
    existing.total = existing.total.add(expTotal);
    expenseCatMap.set(exp.category, existing);
  }

  const numTotalExpenses = parseFloat(decTotalExpenses.toString());
  const expenseCategories = Array.from(expenseCatMap.entries())
    .map(([cat, data]) => {
      const catAmountNum = parseFloat(data.total.toString());
      const percentage = numTotalExpenses > 0 ? (catAmountNum / numTotalExpenses) * 100 : 0;
      return {
        category: cat,
        label: expenseCategoryLabels[cat] || cat,
        amount: data.total.toString(),
        count: data.count,
        percentage: parseFloat(percentage.toFixed(1)),
      };
    })
    .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));

  const averageExpense = expensesInRange.length > 0
    ? decTotalExpenses.div(expensesInRange.length).toFixed(2)
    : '0.00';

  const decNetProfit = decCollectedRevenue.sub(decTotalExpenses);

  // ── Sales & Orders Analytics ───────────────────────────────────────────────
  let decTotalOrderValue = new Prisma.Decimal('0.00');
  let orderStatusCounts: Record<OrderStatus, { count: number; value: Prisma.Decimal }> = {
    DRAFT: { count: 0, value: new Prisma.Decimal('0.00') },
    CONFIRMED: { count: 0, value: new Prisma.Decimal('0.00') },
    COMPLETED: { count: 0, value: new Prisma.Decimal('0.00') },
    CANCELLED: { count: 0, value: new Prisma.Decimal('0.00') },
  };

  const customerSpendMap = new Map<string, { orderCount: number; spend: Prisma.Decimal }>();

  for (const ord of ordersInRange) {
    const ordTotal = new Prisma.Decimal(ord.total.toString());
    orderStatusCounts[ord.status].count++;
    orderStatusCounts[ord.status].value = orderStatusCounts[ord.status].value.add(ordTotal);

    if (ord.status === OrderStatus.CONFIRMED || ord.status === OrderStatus.COMPLETED) {
      decTotalOrderValue = decTotalOrderValue.add(ordTotal);

      const custData = customerSpendMap.get(ord.customerId) || {
        orderCount: 0,
        spend: new Prisma.Decimal('0.00'),
      };
      custData.orderCount++;
      custData.spend = custData.spend.add(ordTotal);
      customerSpendMap.set(ord.customerId, custData);
    }
  }

  const validOrdersCount =
    orderStatusCounts.CONFIRMED.count + orderStatusCounts.COMPLETED.count;
  const averageOrderValue = validOrdersCount > 0
    ? decTotalOrderValue.div(validOrdersCount).toFixed(2)
    : '0.00';

  const totalOrdersCount = ordersInRange.length;
  const orderStatusDistribution = (Object.keys(orderStatusCounts) as OrderStatus[]).map((st) => {
    const item = orderStatusCounts[st];
    const percentage = totalOrdersCount > 0 ? (item.count / totalOrdersCount) * 100 : 0;
    return {
      status: st,
      label: st,
      count: item.count,
      value: item.value.toString(),
      percentage: parseFloat(percentage.toFixed(1)),
    };
  });

  // ── Product Analytics & Inventory Valuation ────────────────────────────────
  let totalInventoryUnits = 0;
  let decTotalCostValuation = new Prisma.Decimal('0.00');
  let decTotalRetailValuation = new Prisma.Decimal('0.00');
  let lowStockCount = 0;
  let outOfStockCount = 0;
  const lowStockItems: Array<{
    id: string;
    name: string;
    sku: string;
    quantity: number;
    reorderLevel: number;
  }> = [];

  let activeProductsCount = 0;

  for (const prod of allProductsWithInventory) {
    if (prod.isActive) activeProductsCount++;

    const qty = prod.inventory?.quantity ?? 0;
    const reorder = prod.inventory?.reorderLevel ?? 0;
    totalInventoryUnits += qty;

    const cost = new Prisma.Decimal(prod.cost.toString());
    const price = new Prisma.Decimal(prod.price.toString());

    decTotalCostValuation = decTotalCostValuation.add(cost.mul(qty));
    decTotalRetailValuation = decTotalRetailValuation.add(price.mul(qty));

    if (qty === 0) {
      outOfStockCount++;
      lowStockItems.push({
        id: prod.id,
        name: prod.name,
        sku: prod.sku,
        quantity: qty,
        reorderLevel: reorder,
      });
    } else if (qty <= reorder) {
      lowStockCount++;
      lowStockItems.push({
        id: prod.id,
        name: prod.name,
        sku: prod.sku,
        quantity: qty,
        reorderLevel: reorder,
      });
    }
  }

  // Top products from OrderItems in range
  const productPerformanceMap = new Map<
    string,
    { name: string; sku: string; quantity: number; revenue: Prisma.Decimal }
  >();

  for (const item of orderItemsInRange) {
    const prodId = item.productId;
    const lineTotal = new Prisma.Decimal(item.lineTotal.toString());
    const prodName = item.product?.name || 'Unknown Product';
    const prodSku = item.product?.sku || 'N/A';

    const existing = productPerformanceMap.get(prodId) || {
      name: prodName,
      sku: prodSku,
      quantity: 0,
      revenue: new Prisma.Decimal('0.00'),
    };
    existing.quantity += item.quantity;
    existing.revenue = existing.revenue.add(lineTotal);
    productPerformanceMap.set(prodId, existing);
  }

  const productPerfArray = Array.from(productPerformanceMap.entries()).map(
    ([id, data]) => ({
      id,
      name: data.name,
      sku: data.sku,
      quantitySold: data.quantity,
      revenue: data.revenue.toString(),
    })
  );

  const topProductsByRevenue = [...productPerfArray]
    .sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue))
    .slice(0, 10);

  const topProductsByVolume = [...productPerfArray]
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, 10);

  // ── Customer Analytics ─────────────────────────────────────────────────────
  let activeCustomersCount = 0;
  let newCustomersInPeriod = 0;

  for (const cust of allCustomers) {
    if (cust.isActive) activeCustomersCount++;
    if (bounds.startDate && bounds.endDate) {
      if (cust.createdAt >= bounds.startDate && cust.createdAt <= bounds.endDate) {
        newCustomersInPeriod++;
      }
    } else {
      newCustomersInPeriod = allCustomers.length;
    }
  }

  const topCustomers = allCustomers
    .map((cust) => {
      const spendData = customerSpendMap.get(cust.id) || {
        orderCount: 0,
        spend: new Prisma.Decimal('0.00'),
      };
      const debt = customerDebtMap.get(cust.id) || new Prisma.Decimal('0.00');

      return {
        id: cust.id,
        name: cust.name,
        companyName: cust.companyName,
        email: cust.email,
        orderCount: spendData.orderCount,
        totalSpend: spendData.spend.toString(),
        outstandingBalance: debt.toString(),
      };
    })
    .sort((a, b) => parseFloat(b.totalSpend) - parseFloat(a.totalSpend))
    .slice(0, 10);

  // ── Monthly Trends Aggregation (Last 6-12 Months) ───────────────────────────
  const trendMap = new Map<string, { revenue: number; expenses: number; orders: number }>();

  // Helper to get formatted month key: "YYYY-MM"
  const getMonthKey = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  // Populate last 6 months minimum
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth() - i, 1));
    const k = getMonthKey(d);
    trendMap.set(k, { revenue: 0, expenses: 0, orders: 0 });
  }

  for (const p of paymentsInRange) {
    if (p.status === PaymentStatus.COMPLETED) {
      const k = getMonthKey(new Date(p.paymentDate));
      const curr = trendMap.get(k) || { revenue: 0, expenses: 0, orders: 0 };
      curr.revenue += parseFloat(p.amount.toString());
      trendMap.set(k, curr);
    }
  }

  for (const exp of expensesInRange) {
    const k = getMonthKey(new Date(exp.expenseDate));
    const curr = trendMap.get(k) || { revenue: 0, expenses: 0, orders: 0 };
    curr.expenses += parseFloat(exp.total.toString());
    trendMap.set(k, curr);
  }

  for (const ord of ordersInRange) {
    if (ord.status === OrderStatus.CONFIRMED || ord.status === OrderStatus.COMPLETED) {
      const k = getMonthKey(new Date(ord.createdAt));
      const curr = trendMap.get(k) || { revenue: 0, expenses: 0, orders: 0 };
      curr.orders++;
      trendMap.set(k, curr);
    }
  }

  const monthlyTrends = Array.from(trendMap.entries())
    .map(([period, data]) => ({
      period,
      revenue: parseFloat(data.revenue.toFixed(2)),
      expenses: parseFloat(data.expenses.toFixed(2)),
      net: parseFloat((data.revenue - data.expenses).toFixed(2)),
      orders: data.orders,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return {
    preset,
    asOfDate: asOfDate.toISOString(),
    startDate: bounds.startDate?.toISOString(),
    endDate: bounds.endDate?.toISOString(),

    financials: {
      collectedRevenue: decCollectedRevenue.toString(),
      invoicedRevenue: decInvoicedRevenue.toString(),
      totalExpenses: decTotalExpenses.toString(),
      netProfit: decNetProfit.toString(),
      accountsReceivable: decTotalAR.toString(),
      paidInvoicesAmount: decPaidInvoicesAmount.toString(),
      outstandingInvoicesAmount: decOutstandingInvoicesAmount.toString(),
      refundedAmount: decRefundedAmount.toString(),
      refundCount,
      expenseCount: expensesInRange.length,
      averageExpense,
    },

    expenseCategories,

    orders: {
      totalCount: totalOrdersCount,
      confirmedCount: orderStatusCounts.CONFIRMED.count,
      completedCount: orderStatusCounts.COMPLETED.count,
      draftCount: orderStatusCounts.DRAFT.count,
      cancelledCount: orderStatusCounts.CANCELLED.count,
      totalValue: decTotalOrderValue.toString(),
      averageOrderValue,
      statusDistribution: orderStatusDistribution,
    },

    products: {
      totalProducts: allProductsWithInventory.length,
      activeProducts: activeProductsCount,
      lowStockCount,
      outOfStockCount,
      totalInventoryUnits,
      totalCostValuation: decTotalCostValuation.toString(),
      totalRetailValuation: decTotalRetailValuation.toString(),
      topProductsByRevenue,
      topProductsByVolume,
      lowStockItems: lowStockItems.slice(0, 10),
    },

    customers: {
      totalCount: allCustomers.length,
      activeCount: activeCustomersCount,
      newInPeriodCount: newCustomersInPeriod,
      topCustomers,
    },

    invoices: {
      totalCount: invoiceStatusCounts.total,
      draftCount: invoiceStatusCounts.draft,
      issuedCount: invoiceStatusCounts.issued,
      partiallyPaidCount: invoiceStatusCounts.partiallyPaid,
      paidCount: invoiceStatusCounts.paid,
      overdueCount: invoiceStatusCounts.overdue,
      voidedCount: invoiceStatusCounts.voided,
    },

    monthlyTrends,
  };
}
