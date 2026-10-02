import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ACME_OWNER_CONTEXT } from './helpers/test-harness';
import { getRequiredTenantContext } from '@/lib/auth/session';
import {
  createOrderAction,
  confirmOrderAction,
  cancelOrderAction,
} from '@/lib/actions/orders';
import { recordAuditLog } from '@/lib/utils/audit';
import { prisma } from '@/lib/db/prisma';
import { OrderStatus, Prisma } from '@prisma/client';

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
    customer: { findFirst: vi.fn() },
    product: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    inventory: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    inventoryMovement: { create: vi.fn() },
    order: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    orderItem: { createMany: vi.fn() },
    $transaction: vi.fn(async (cb) => cb(mock)),
  };
  return { prisma: mock };
});

describe('Integration Suite 3 — Sales Order Lifecycle & Inventory Fulfillment Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRequiredTenantContext).mockResolvedValue(ACME_OWNER_CONTEXT);
  });

  it('should draft an order and prevent confirmation when inventory is insufficient', async () => {
    // 1. Create Draft Order
    vi.mocked(prisma.customer.findFirst).mockResolvedValueOnce({
      id: 'cust_1',
      tenantId: ACME_OWNER_CONTEXT.tenantId,
      isActive: true,
    } as any);

    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([
      {
        id: 'prod_1',
        tenantId: ACME_OWNER_CONTEXT.tenantId,
        name: 'Quantum Widget',
        price: new Prisma.Decimal('100.00'),
        isActive: true,
      },
    ] as any);

    vi.mocked(prisma.order.create).mockResolvedValueOnce({
      id: 'ord_101',
      tenantId: ACME_OWNER_CONTEXT.tenantId,
      customerId: 'cust_1',
      status: OrderStatus.DRAFT,
      subtotal: new Prisma.Decimal('500.00'),
      discount: new Prisma.Decimal('0.00'),
      total: new Prisma.Decimal('500.00'),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const draftRes = await createOrderAction('acme', {
      customerId: 'cust_1',
      discount: 0,
      items: [{ productId: 'prod_1', quantity: 5 }],
    });

    expect(draftRes.success).toBe(true);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: ACME_OWNER_CONTEXT.tenantId,
        action: 'ORDER_CREATED',
        entity: 'ORDER',
      })
    );

    // 2. Attempt confirmation when available stock = 2 (less than ordered 5)
    vi.mocked(prisma.order.findFirst).mockResolvedValueOnce({
      id: 'ord_101',
      tenantId: ACME_OWNER_CONTEXT.tenantId,
      status: OrderStatus.DRAFT,
      items: [
        {
          productId: 'prod_1',
          quantity: 5,
          product: { name: 'Quantum Widget', sku: 'QNT-01' },
        },
      ],
    } as any);

    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
      id: 'ord_101',
      status: OrderStatus.DRAFT,
    } as any);

    vi.mocked(prisma.inventory.findUnique).mockResolvedValueOnce({
      id: 'inv_1',
      productId: 'prod_1',
      quantity: 2,
    } as any);

    // updateMany returns count: 0 because stock was insufficient
    vi.mocked(prisma.inventory.updateMany).mockResolvedValueOnce({ count: 0 });

    const failConfirmRes = await confirmOrderAction('acme', {
      orderId: 'ord_101',
    });

    expect(failConfirmRes.success).toBe(false);
    expect(failConfirmRes.error).toContain('Insufficient inventory');
  });

  it('should confirm order with atomic stock deduction, and restore stock on cancellation', async () => {
    // 1. Confirm Order with sufficient stock = 10
    vi.mocked(prisma.order.findFirst).mockResolvedValueOnce({
      id: 'ord_101',
      tenantId: ACME_OWNER_CONTEXT.tenantId,
      status: OrderStatus.DRAFT,
      items: [
        {
          productId: 'prod_1',
          quantity: 4,
          product: { name: 'Quantum Widget', sku: 'QNT-01' },
        },
      ],
    } as any);

    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
      id: 'ord_101',
      status: OrderStatus.DRAFT,
    } as any);

    vi.mocked(prisma.inventory.findUnique).mockResolvedValueOnce({
      id: 'inv_1',
      productId: 'prod_1',
      tenantId: ACME_OWNER_CONTEXT.tenantId,
      quantity: 10,
    } as any);

    vi.mocked(prisma.inventory.updateMany).mockResolvedValueOnce({ count: 1 });
    vi.mocked(prisma.inventoryMovement.create).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.order.update).mockResolvedValueOnce({
      id: 'ord_101',
      status: OrderStatus.CONFIRMED,
    } as any);

    const confirmRes = await confirmOrderAction('acme', {
      orderId: 'ord_101',
    });

    expect(confirmRes.success).toBe(true);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: ACME_OWNER_CONTEXT.tenantId,
        action: 'ORDER_CONFIRMED',
        entity: 'ORDER',
        entityId: 'ord_101',
      })
    );

    // 2. Cancel Order -> restores 4 items to inventory
    vi.mocked(prisma.order.findFirst).mockResolvedValueOnce({
      id: 'ord_101',
      tenantId: ACME_OWNER_CONTEXT.tenantId,
      status: OrderStatus.CONFIRMED,
      items: [
        {
          productId: 'prod_1',
          quantity: 4,
          product: { name: 'Quantum Widget' },
        },
      ],
    } as any);

    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
      id: 'ord_101',
      status: OrderStatus.CONFIRMED,
    } as any);

    vi.mocked(prisma.inventory.update).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.inventoryMovement.create).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.order.update).mockResolvedValueOnce({
      id: 'ord_101',
      status: OrderStatus.CANCELLED,
    } as any);

    const cancelRes = await cancelOrderAction('acme', {
      orderId: 'ord_101',
    });

    expect(cancelRes.success).toBe(true);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: ACME_OWNER_CONTEXT.tenantId,
        action: 'ORDER_CANCELLED',
        entity: 'ORDER',
        entityId: 'ord_101',
      })
    );
  });
});
