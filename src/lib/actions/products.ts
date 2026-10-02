'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { getRequiredTenantContext } from '@/lib/auth/session';
import { Prisma } from '@prisma/client';
import {
  canCreateProduct,
  canEditProduct,
  canArchiveProduct,
  canManageCategories,
  canAdjustInventory,
} from '@/lib/auth/product-auth';
import { recordAuditLog } from '@/lib/utils/audit';
import {
  createCategorySchema,
  updateCategorySchema,
  createProductSchema,
  updateProductSchema,
  archiveProductSchema,
  inventoryAdjustmentSchema,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateProductInput,
  UpdateProductInput,
  ArchiveProductInput,
  InventoryAdjustmentInput,
} from '@/lib/validations/product';

export interface ProductActionResult<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

/**
 * Create a new product category scoped to the verified tenant.
 */
export async function createCategoryAction(
  orgSlug: string,
  input: CreateCategoryInput
): Promise<ProductActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const decision = canManageCategories(tenantContext.role);
    if (!decision.allowed) {
      return {
        success: false,
        error: decision.reason || 'You are not authorized to create categories.',
      };
    }

    const parsed = createCategorySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid category input.',
      };
    }

    const { name, description } = parsed.data;

    // Check for duplicate category name within this tenant
    const existing = await prisma.category.findUnique({
      where: {
        tenantId_name: {
          tenantId: tenantContext.tenantId,
          name,
        },
      },
    });

    if (existing) {
      return {
        success: false,
        error: `A category named "${name}" already exists in this workspace.`,
      };
    }

    const category = await prisma.category.create({
      data: {
        tenantId: tenantContext.tenantId,
        name,
        description: description || null,
      },
    });

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'CATEGORY_CREATED',
      entity: 'CATEGORY',
      entityId: category.id,
      metadata: { name, description },
    });

    revalidatePath(`/${orgSlug}/products`);

    return {
      success: true,
      message: `Category "${name}" created successfully.`,
      data: category,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create category.',
    };
  }
}

/**
 * Update an existing product category.
 */
export async function updateCategoryAction(
  orgSlug: string,
  input: UpdateCategoryInput
): Promise<ProductActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const decision = canManageCategories(tenantContext.role);
    if (!decision.allowed) {
      return {
        success: false,
        error: decision.reason || 'You are not authorized to edit categories.',
      };
    }

    const parsed = updateCategorySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid category input.',
      };
    }

    const { categoryId, name, description } = parsed.data;

    // Strict tenant scoping
    const targetCategory = await prisma.category.findFirst({
      where: {
        id: categoryId,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!targetCategory) {
      return {
        success: false,
        error: 'Category not found in this workspace.',
      };
    }

    // Check duplicate if name changed
    if (name !== targetCategory.name) {
      const duplicate = await prisma.category.findUnique({
        where: {
          tenantId_name: {
            tenantId: tenantContext.tenantId,
            name,
          },
        },
      });

      if (duplicate) {
        return {
          success: false,
          error: `Another category named "${name}" already exists.`,
        };
      }
    }

    const updated = await prisma.category.update({
      where: { id: targetCategory.id },
      data: {
        name,
        description: description || null,
      },
    });

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'CATEGORY_UPDATED',
      entity: 'CATEGORY',
      entityId: targetCategory.id,
      metadata: {
        previousName: targetCategory.name,
        newName: name,
        description,
      },
    });

    revalidatePath(`/${orgSlug}/products`);

    return {
      success: true,
      message: `Category "${name}" updated successfully.`,
      data: updated,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update category.',
    };
  }
}

/**
 * Create a new product with initial inventory inside a transaction.
 */
export async function createProductAction(
  orgSlug: string,
  input: CreateProductInput
): Promise<ProductActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const decision = canCreateProduct(tenantContext.role);
    if (!decision.allowed) {
      return {
        success: false,
        error: decision.reason || 'You are not authorized to create products.',
      };
    }

    const parsed = createProductSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid product input.',
      };
    }

    const {
      name,
      sku,
      description,
      price,
      cost,
      categoryId,
      initialStock,
      reorderLevel,
    } = parsed.data;

    // Verify category belongs to the same tenant if supplied
    if (categoryId && categoryId.trim() !== '') {
      const category = await prisma.category.findFirst({
        where: {
          id: categoryId,
          tenantId: tenantContext.tenantId,
        },
      });

      if (!category) {
        return {
          success: false,
          error: 'Specified category does not exist in this workspace.',
        };
      }
    }

    // Check SKU uniqueness in tenant
    const existingSku = await prisma.product.findUnique({
      where: {
        tenantId_sku: {
          tenantId: tenantContext.tenantId,
          sku,
        },
      },
    });

    if (existingSku) {
      return {
        success: false,
        error: `A product with SKU "${sku}" already exists in this workspace.`,
      };
    }

    // Perform atomic transaction: Product + Inventory + Initial Movement
    const createdProduct = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          tenantId: tenantContext.tenantId,
          name,
          sku,
          description: description || null,
          price: new Prisma.Decimal(price),
          cost: new Prisma.Decimal(cost),
          categoryId: categoryId && categoryId.trim() !== '' ? categoryId : null,
          isActive: true,
        },
      });

      await tx.inventory.create({
        data: {
          tenantId: tenantContext.tenantId,
          productId: product.id,
          quantity: initialStock,
          reorderLevel,
        },
      });

      if (initialStock > 0) {
        await tx.inventoryMovement.create({
          data: {
            tenantId: tenantContext.tenantId,
            productId: product.id,
            type: 'STOCK_IN',
            quantity: initialStock,
            previousQuantity: 0,
            newQuantity: initialStock,
            reason: 'Initial stock on product creation',
            createdByUserId: tenantContext.userId,
          },
        });
      }

      return product;
    });

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'PRODUCT_CREATED',
      entity: 'PRODUCT',
      entityId: createdProduct.id,
      metadata: {
        name,
        sku,
        price,
        cost,
        initialStock,
        reorderLevel,
      },
    });

    revalidatePath(`/${orgSlug}/products`);
    revalidatePath(`/${orgSlug}/products/inventory`);
    revalidatePath(`/${orgSlug}`);

    return {
      success: true,
      message: `Product "${name}" (SKU: ${sku}) created successfully.`,
      data: createdProduct,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create product.',
    };
  }
}

/**
 * Update product catalog and inventory reorder level.
 */
export async function updateProductAction(
  orgSlug: string,
  input: UpdateProductInput
): Promise<ProductActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const decision = canEditProduct(tenantContext.role);
    if (!decision.allowed) {
      return {
        success: false,
        error: decision.reason || 'You are not authorized to edit products.',
      };
    }

    const parsed = updateProductSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid product input.',
      };
    }

    const {
      productId,
      name,
      sku,
      description,
      price,
      cost,
      categoryId,
      reorderLevel,
      isActive,
    } = parsed.data;

    // Strict tenant scoping
    const targetProduct = await prisma.product.findFirst({
      where: {
        id: productId,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!targetProduct) {
      return {
        success: false,
        error: 'Product not found in this workspace.',
      };
    }

    // Check SKU duplicate if changed
    if (sku !== targetProduct.sku) {
      const duplicateSku = await prisma.product.findUnique({
        where: {
          tenantId_sku: {
            tenantId: tenantContext.tenantId,
            sku,
          },
        },
      });

      if (duplicateSku) {
        return {
          success: false,
          error: `Another product with SKU "${sku}" already exists.`,
        };
      }
    }

    // Validate category belongs to same tenant
    if (categoryId && categoryId.trim() !== '') {
      const category = await prisma.category.findFirst({
        where: {
          id: categoryId,
          tenantId: tenantContext.tenantId,
        },
      });

      if (!category) {
        return {
          success: false,
          error: 'Specified category does not exist in this workspace.',
        };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: targetProduct.id },
        data: {
          name,
          sku,
          description: description || null,
          price: new Prisma.Decimal(price),
          cost: new Prisma.Decimal(cost),
          categoryId: categoryId && categoryId.trim() !== '' ? categoryId : null,
          ...(isActive !== undefined ? { isActive } : {}),
        },
      });

      if (reorderLevel !== undefined) {
        await tx.inventory.upsert({
          where: { productId: targetProduct.id },
          update: { reorderLevel },
          create: {
            productId: targetProduct.id,
            tenantId: tenantContext.tenantId,
            quantity: 0,
            reorderLevel,
          },
        });
      }
    });

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'PRODUCT_UPDATED',
      entity: 'PRODUCT',
      entityId: targetProduct.id,
      metadata: {
        name,
        sku,
        price,
        cost,
        reorderLevel,
        isActive,
      },
    });

    revalidatePath(`/${orgSlug}/products`);
    revalidatePath(`/${orgSlug}/products/inventory`);

    return {
      success: true,
      message: `Product "${name}" updated successfully.`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update product.',
    };
  }
}

/**
 * Archive / Deactivate or reactivate a product.
 */
export async function archiveProductAction(
  orgSlug: string,
  input: ArchiveProductInput
): Promise<ProductActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const decision = canArchiveProduct(tenantContext.role);
    if (!decision.allowed) {
      return {
        success: false,
        error: decision.reason || 'You are not authorized to archive products.',
      };
    }

    const parsed = archiveProductSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid input.',
      };
    }

    const { productId, isActive } = parsed.data;

    const targetProduct = await prisma.product.findFirst({
      where: {
        id: productId,
        tenantId: tenantContext.tenantId,
      },
    });

    if (!targetProduct) {
      return {
        success: false,
        error: 'Product not found in this workspace.',
      };
    }

    const newActiveState = isActive !== undefined ? isActive : !targetProduct.isActive;

    await prisma.product.update({
      where: { id: targetProduct.id },
      data: { isActive: newActiveState },
    });

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'PRODUCT_ARCHIVED',
      entity: 'PRODUCT',
      entityId: targetProduct.id,
      metadata: {
        productName: targetProduct.name,
        sku: targetProduct.sku,
        isActive: newActiveState,
      },
    });

    revalidatePath(`/${orgSlug}/products`);

    return {
      success: true,
      message: `Product "${targetProduct.name}" is now ${newActiveState ? 'active' : 'archived'}.`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to archive product.',
    };
  }
}

/**
 * Perform a stock adjustment (STOCK_IN, STOCK_OUT, ADJUSTMENT) with strict negative stock prevention
 * and atomic immutable movement ledger logging.
 */
export async function adjustInventoryAction(
  orgSlug: string,
  input: InventoryAdjustmentInput
): Promise<ProductActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const decision = canAdjustInventory(tenantContext.role);
    if (!decision.allowed) {
      return {
        success: false,
        error: decision.reason || 'You are not authorized to adjust inventory.',
      };
    }

    const parsed = inventoryAdjustmentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid inventory adjustment input.',
      };
    }

    const { productId, type, quantity, reason } = parsed.data;

    // Strict tenant scoping
    const targetProduct = await prisma.product.findFirst({
      where: {
        id: productId,
        tenantId: tenantContext.tenantId,
      },
      include: {
        inventory: true,
      },
    });

    if (!targetProduct) {
      return {
        success: false,
        error: 'Product not found in this workspace.',
      };
    }

    const currentStock = targetProduct.inventory?.quantity ?? 0;
    let newQuantity = currentStock;

    if (type === 'STOCK_IN') {
      newQuantity = currentStock + quantity;
    } else if (type === 'STOCK_OUT') {
      if (currentStock < quantity) {
        return {
          success: false,
          error: `Insufficient inventory. Current stock is ${currentStock} units, cannot remove ${quantity} units.`,
        };
      }
      newQuantity = currentStock - quantity;
    } else if (type === 'ADJUSTMENT') {
      if (quantity < 0) {
        return {
          success: false,
          error: 'Adjustment stock quantity cannot be negative.',
        };
      }
      newQuantity = quantity;
    }

    // Atomic transaction for Inventory Update + Immutable Movement Record
    await prisma.$transaction(async (tx) => {
      await tx.inventory.upsert({
        where: { productId: targetProduct.id },
        update: { quantity: newQuantity },
        create: {
          productId: targetProduct.id,
          tenantId: tenantContext.tenantId,
          quantity: newQuantity,
          reorderLevel: 0,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          tenantId: tenantContext.tenantId,
          productId: targetProduct.id,
          type,
          quantity,
          previousQuantity: currentStock,
          newQuantity,
          reason: reason || null,
          createdByUserId: tenantContext.userId,
        },
      });
    });

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'INVENTORY_ADJUSTED',
      entity: 'INVENTORY',
      entityId: targetProduct.id,
      metadata: {
        productName: targetProduct.name,
        sku: targetProduct.sku,
        type,
        quantity,
        previousQuantity: currentStock,
        newQuantity,
        reason,
      },
    });

    revalidatePath(`/${orgSlug}/products`);
    revalidatePath(`/${orgSlug}/products/inventory`);
    revalidatePath(`/${orgSlug}`);

    return {
      success: true,
      message: `Inventory for "${targetProduct.name}" updated: ${currentStock} → ${newQuantity} units.`,
      data: { previousQuantity: currentStock, newQuantity },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to adjust inventory.',
    };
  }
}
