import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ACME_OWNER_CONTEXT, ACME_ADMIN_CONTEXT } from './helpers/test-harness';
import { getRequiredTenantContext } from '@/lib/auth/session';
import { createCustomerAction, updateCustomerAction, archiveCustomerAction } from '@/lib/actions/customers';
import { createProductAction, adjustInventoryAction } from '@/lib/actions/products';
import { recordAuditLog } from '@/lib/utils/audit';
import { prisma } from '@/lib/db/prisma';
import { MovementType, Prisma } from '@prisma/client';

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
    customer: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    category: { findFirst: vi.fn(), create: vi.fn() },
    product: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    inventory: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    inventoryMovement: { create: vi.fn() },
    $transaction: vi.fn(async (cb) => cb(mock)),
  };
  return { prisma: mock };
});

describe('Integration Suite 2 — Customer & Product Inventory Lifecycle Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Customer Lifecycle Flow', () => {
    it('should complete full customer lifecycle: create, update, and archive status with audit logging', async () => {
      vi.mocked(getRequiredTenantContext).mockResolvedValue(ACME_OWNER_CONTEXT);

      // 1. Create Customer (calls customer.create)
      vi.mocked(prisma.customer.create).mockResolvedValueOnce({
        id: 'cust_acme_1',
        tenantId: ACME_OWNER_CONTEXT.tenantId,
        name: 'Stark Industries',
        email: 'tony@stark.com',
        phone: '+1-555-1234',
        companyName: 'Stark Ind',
        address: '10880 Malibu Point',
        city: 'Malibu',
        notes: 'VIP Client',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const createRes = await createCustomerAction('acme', {
        name: 'Stark Industries',
        email: 'tony@stark.com',
        phone: '+1-555-1234',
        companyName: 'Stark Ind',
        address: '10880 Malibu Point',
        notes: 'VIP Client',
      });

      expect(createRes.success).toBe(true);
      expect(recordAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: ACME_OWNER_CONTEXT.tenantId,
          action: 'CUSTOMER_CREATED',
          entity: 'CUSTOMER',
        })
      );

      // 2. Update Customer (calls customer.findFirst for targetCustomer, then customer.update)
      vi.mocked(prisma.customer.findFirst).mockResolvedValueOnce({
        id: 'cust_acme_1',
        tenantId: ACME_OWNER_CONTEXT.tenantId,
        name: 'Stark Industries',
      } as any);

      vi.mocked(prisma.customer.update).mockResolvedValueOnce({
        id: 'cust_acme_1',
        tenantId: ACME_OWNER_CONTEXT.tenantId,
        name: 'Stark Industries Global',
        email: 'tony@stark.com',
        phone: '+1-555-9999',
        companyName: 'Stark Global',
        address: 'Avengers Tower',
        city: 'New York',
        notes: 'Updated VIP Client',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updateRes = await updateCustomerAction('acme', {
        customerId: 'cust_acme_1',
        name: 'Stark Industries Global',
        email: 'tony@stark.com',
        phone: '+1-555-9999',
        companyName: 'Stark Global',
        address: 'Avengers Tower',
      });

      expect(updateRes.success).toBe(true);
      expect(recordAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: ACME_OWNER_CONTEXT.tenantId,
          action: 'CUSTOMER_UPDATED',
          entity: 'CUSTOMER',
          entityId: 'cust_acme_1',
        })
      );

      // 3. Archive Customer (calls customer.findFirst, then customer.update)
      vi.mocked(prisma.customer.findFirst).mockResolvedValueOnce({
        id: 'cust_acme_1',
        tenantId: ACME_OWNER_CONTEXT.tenantId,
        name: 'Stark Industries Global',
        isActive: true,
      } as any);
      vi.mocked(prisma.customer.update).mockResolvedValueOnce({
        id: 'cust_acme_1',
        tenantId: ACME_OWNER_CONTEXT.tenantId,
        name: 'Stark Industries Global',
        isActive: false,
      } as any);

      const archiveRes = await archiveCustomerAction('acme', {
        customerId: 'cust_acme_1',
        isActive: false,
      });

      expect(archiveRes.success).toBe(true);
      expect(recordAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: ACME_OWNER_CONTEXT.tenantId,
          action: 'CUSTOMER_ARCHIVED',
          entity: 'CUSTOMER',
          entityId: 'cust_acme_1',
        })
      );
    });
  });

  describe('Product & Inventory Flow', () => {
    it('should create product with initial stock and perform inventory adjustments', async () => {
      vi.mocked(getRequiredTenantContext).mockResolvedValue(ACME_ADMIN_CONTEXT);

      // 1. Create Product with initial stock
      vi.mocked(prisma.product.findUnique).mockResolvedValueOnce(null); // SKU unique check
      vi.mocked(prisma.product.create).mockResolvedValueOnce({
        id: 'prod_widget_1',
        tenantId: ACME_ADMIN_CONTEXT.tenantId,
        name: 'Quantum Core',
        sku: 'QNT-001',
        price: new Prisma.Decimal('500.00'),
        cost: new Prisma.Decimal('300.00'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      vi.mocked(prisma.inventory.create).mockResolvedValueOnce({
        id: 'inv_widget_1',
        productId: 'prod_widget_1',
        tenantId: ACME_ADMIN_CONTEXT.tenantId,
        quantity: 10,
        reorderLevel: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(prisma.inventoryMovement.create).mockResolvedValueOnce({} as any);

      const prodRes = await createProductAction('acme', {
        name: 'Quantum Core',
        sku: 'QNT-001',
        price: 500,
        cost: 300,
        initialStock: 10,
        reorderLevel: 2,
      });

      expect(prodRes.success).toBe(true);
      expect(recordAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: ACME_ADMIN_CONTEXT.tenantId,
          action: 'PRODUCT_CREATED',
          entity: 'PRODUCT',
        })
      );

      // 2. Perform Stock In adjustment (+5)
      vi.mocked(prisma.product.findFirst).mockResolvedValueOnce({
        id: 'prod_widget_1',
        tenantId: ACME_ADMIN_CONTEXT.tenantId,
        inventory: { quantity: 10 },
      } as any);
      vi.mocked(prisma.inventory.upsert).mockResolvedValueOnce({
        id: 'inv_widget_1',
        productId: 'prod_widget_1',
        tenantId: ACME_ADMIN_CONTEXT.tenantId,
        quantity: 15,
      } as any);

      const stockInRes = await adjustInventoryAction('acme', {
        productId: 'prod_widget_1',
        quantity: 5,
        type: MovementType.STOCK_IN,
        reason: 'Shipment received from factory',
      });

      expect(stockInRes.success).toBe(true);
      expect(recordAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'INVENTORY_ADJUSTED',
          entity: 'INVENTORY',
        })
      );

      // 3. Reject negative stock adjustment (attempting deduction of 20 when current is 15)
      vi.mocked(prisma.product.findFirst).mockResolvedValueOnce({
        id: 'prod_widget_1',
        tenantId: ACME_ADMIN_CONTEXT.tenantId,
        inventory: { quantity: 15 },
      } as any);

      const excessiveStockOutRes = await adjustInventoryAction('acme', {
        productId: 'prod_widget_1',
        quantity: 20,
        type: MovementType.STOCK_OUT,
        reason: 'Excess deduction',
      });

      expect(excessiveStockOutRes.success).toBe(false);
      expect(excessiveStockOutRes.error).toContain('Insufficient inventory');
    });
  });
});
