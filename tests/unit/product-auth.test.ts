import { describe, it, expect } from 'vitest';
import { Role, MovementType } from '@prisma/client';
import {
  canViewProducts,
  canCreateProduct,
  canEditProduct,
  canArchiveProduct,
  canManageCategories,
  canAdjustInventory,
  canViewInventoryHistory,
} from '../../src/lib/auth/product-auth';
import {
  createCategorySchema,
  updateCategorySchema,
  createProductSchema,
  updateProductSchema,
  inventoryAdjustmentSchema,
} from '../../src/lib/validations/product';

describe('Products & Inventory Authorization Matrix Tests', () => {
  it('allows all verified workspace roles to view products and inventory history', () => {
    expect(canViewProducts(Role.OWNER)).toBe(true);
    expect(canViewProducts(Role.ADMIN)).toBe(true);
    expect(canViewProducts(Role.MEMBER)).toBe(true);
    expect(canViewProducts(Role.VIEWER)).toBe(true);

    expect(canViewInventoryHistory(Role.OWNER)).toBe(true);
    expect(canViewInventoryHistory(Role.ADMIN)).toBe(true);
    expect(canViewInventoryHistory(Role.MEMBER)).toBe(true);
    expect(canViewInventoryHistory(Role.VIEWER)).toBe(true);
  });

  it('allows OWNER and ADMIN to perform all product and inventory mutations', () => {
    // OWNER
    expect(canCreateProduct(Role.OWNER).allowed).toBe(true);
    expect(canEditProduct(Role.OWNER).allowed).toBe(true);
    expect(canArchiveProduct(Role.OWNER).allowed).toBe(true);
    expect(canManageCategories(Role.OWNER).allowed).toBe(true);
    expect(canAdjustInventory(Role.OWNER).allowed).toBe(true);

    // ADMIN
    expect(canCreateProduct(Role.ADMIN).allowed).toBe(true);
    expect(canEditProduct(Role.ADMIN).allowed).toBe(true);
    expect(canArchiveProduct(Role.ADMIN).allowed).toBe(true);
    expect(canManageCategories(Role.ADMIN).allowed).toBe(true);
    expect(canAdjustInventory(Role.ADMIN).allowed).toBe(true);
  });

  it('strictly denies MEMBER and VIEWER from performing product or inventory mutations', () => {
    // MEMBER
    expect(canCreateProduct(Role.MEMBER).allowed).toBe(false);
    expect(canEditProduct(Role.MEMBER).allowed).toBe(false);
    expect(canArchiveProduct(Role.MEMBER).allowed).toBe(false);
    expect(canManageCategories(Role.MEMBER).allowed).toBe(false);
    expect(canAdjustInventory(Role.MEMBER).allowed).toBe(false);

    // VIEWER
    expect(canCreateProduct(Role.VIEWER).allowed).toBe(false);
    expect(canEditProduct(Role.VIEWER).allowed).toBe(false);
    expect(canArchiveProduct(Role.VIEWER).allowed).toBe(false);
    expect(canManageCategories(Role.VIEWER).allowed).toBe(false);
    expect(canAdjustInventory(Role.VIEWER).allowed).toBe(false);
  });
});

describe('Product & Category Validation Schemas', () => {
  it('validates a correct CreateProductInput and normalizes SKU', () => {
    const valid = createProductSchema.safeParse({
      name: 'Mechanical Keyboard Pro',
      sku: '  kb-mech-01  ',
      description: 'Tactile switches with RGB backlight',
      price: '149.99',
      cost: '75.00',
      initialStock: '10',
      reorderLevel: '3',
    });

    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.sku).toBe('KB-MECH-01');
      expect(valid.data.price).toBe(149.99);
      expect(valid.data.cost).toBe(75.0);
      expect(valid.data.initialStock).toBe(10);
      expect(valid.data.reorderLevel).toBe(3);
    }
  });

  it('rejects negative price and negative cost', () => {
    const negPrice = createProductSchema.safeParse({
      name: 'Item A',
      sku: 'SKU-A',
      price: -10,
      cost: 0,
    });
    expect(negPrice.success).toBe(false);

    const negCost = createProductSchema.safeParse({
      name: 'Item B',
      sku: 'SKU-B',
      price: 10,
      cost: -5,
    });
    expect(negCost.success).toBe(false);
  });

  it('rejects empty product name or invalid short SKU', () => {
    const emptyName = createProductSchema.safeParse({
      name: ' ',
      sku: 'SKU-VALID',
      price: 10,
    });
    expect(emptyName.success).toBe(false);

    const shortSku = createProductSchema.safeParse({
      name: 'Valid Name',
      sku: 'A',
      price: 10,
    });
    expect(shortSku.success).toBe(false);
  });

  it('validates Category schemas', () => {
    const validCat = createCategorySchema.safeParse({
      name: 'Electronics',
      description: 'Monitors, laptops, and peripherals',
    });
    expect(validCat.success).toBe(true);

    const emptyCat = createCategorySchema.safeParse({
      name: ' ',
    });
    expect(emptyCat.success).toBe(false);
  });
});

describe('Inventory Adjustment Schemas & Invariant Rules', () => {
  it('accepts positive quantity for STOCK_IN', () => {
    const res = inventoryAdjustmentSchema.safeParse({
      productId: 'prod_123',
      type: MovementType.STOCK_IN,
      quantity: 5,
      reason: 'PO Shipment arrived',
    });
    expect(res.success).toBe(true);
  });

  it('rejects 0 or negative quantity for STOCK_IN and STOCK_OUT', () => {
    const stockInZero = inventoryAdjustmentSchema.safeParse({
      productId: 'prod_123',
      type: MovementType.STOCK_IN,
      quantity: 0,
    });
    expect(stockInZero.success).toBe(false);

    const stockOutZero = inventoryAdjustmentSchema.safeParse({
      productId: 'prod_123',
      type: MovementType.STOCK_OUT,
      quantity: 0,
    });
    expect(stockOutZero.success).toBe(false);

    const stockOutNegative = inventoryAdjustmentSchema.safeParse({
      productId: 'prod_123',
      type: MovementType.STOCK_OUT,
      quantity: -5,
    });
    expect(stockOutNegative.success).toBe(false);
  });

  it('accepts quantity 0 for ADJUSTMENT (setting stock to 0 / out of stock)', () => {
    const adjustmentZero = inventoryAdjustmentSchema.safeParse({
      productId: 'prod_123',
      type: MovementType.ADJUSTMENT,
      quantity: 0,
      reason: 'Physical count verified zero units remaining',
    });
    expect(adjustmentZero.success).toBe(true);
  });

  it('rejects negative quantity for ADJUSTMENT', () => {
    const adjustmentNeg = inventoryAdjustmentSchema.safeParse({
      productId: 'prod_123',
      type: MovementType.ADJUSTMENT,
      quantity: -1,
    });
    expect(adjustmentNeg.success).toBe(false);
  });
});
