'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { getRequiredTenantContext } from '@/lib/auth/session';
import { Prisma, OrderStatus } from '@prisma/client';
import {
  canCreateOrder,
  canEditOrder,
  canConfirmOrder,
  canCancelOrder,
  canCompleteOrder,
  isValidStatusTransition,
} from '@/lib/auth/order-auth';
import { recordAuditLog } from '@/lib/utils/audit';
import {
  createOrderSchema,
  updateOrderSchema,
  confirmOrderSchema,
  cancelOrderSchema,
  completeOrderSchema,
  CreateOrderInput,
  UpdateOrderInput,
  ConfirmOrderInput,
  CancelOrderInput,
  CompleteOrderInput,
} from '@/lib/validations/order';

export interface OrderActionResult<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

/**
 * Create a new order in DRAFT status with server-calculated line item totals.
 * Pricing is always sourced from the database — client-supplied prices are ignored.
 */
export async function createOrderAction(
  orgSlug: string,
  input: CreateOrderInput
): Promise<OrderActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const decision = canCreateOrder(tenantContext.role);
    if (!decision.allowed) {
      return {
        success: false,
        error: decision.reason || 'You are not authorized to create orders.',
      };
    }

    const parsed = createOrderSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid order input data.',
      };
    }

    const { customerId, discount, notes, items } = parsed.data;

    // Verify Customer belongs to verified tenant
    const targetCustomer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        tenantId: tenantContext.tenantId,
        isActive: true,
      },
    });

    if (!targetCustomer) {
      return {
        success: false,
        error: 'Specified customer does not exist or is archived in this workspace.',
      };
    }

    // Verify and query all products strictly belonging to this tenant
    const productIds = items.map((i) => i.productId);
    const dbProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        tenantId: tenantContext.tenantId,
        isActive: true,
      },
    });

    if (dbProducts.length !== new Set(productIds).size) {
      return {
        success: false,
        error: 'One or more selected products do not belong to this workspace or are inactive.',
      };
    }

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    // Recalculate pricing strictly server-side — never trust client-supplied values
    let subtotalNum = 0;
    const preparedItems = items.map((item) => {
      const product = productMap.get(item.productId)!;
      const unitPriceNum = parseFloat(product.price.toString());
      const lineTotalNum = unitPriceNum * item.quantity;
      subtotalNum += lineTotalNum;

      return {
        productId: product.id,
        quantity: item.quantity,
        unitPrice: product.price,
        lineTotal: new Prisma.Decimal(lineTotalNum.toFixed(2)),
      };
    });

    const discountNum = discount;
    const totalNum = Math.max(0, subtotalNum - discountNum);

    const createdOrder = await prisma.$transaction(async (tx) => {
      return await tx.order.create({
        data: {
          tenantId: tenantContext.tenantId,
          customerId: targetCustomer.id,
          status: OrderStatus.DRAFT,
          subtotal: new Prisma.Decimal(subtotalNum.toFixed(2)),
          discount: new Prisma.Decimal(discountNum.toFixed(2)),
          total: new Prisma.Decimal(totalNum.toFixed(2)),
          notes: notes && notes.trim() !== '' ? notes.trim() : null,
          createdByUserId: tenantContext.userId,
          items: {
            create: preparedItems,
          },
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });
    });

    revalidatePath(`/${orgSlug}/orders`);
    revalidatePath(`/${orgSlug}/customers`);
    revalidatePath(`/${orgSlug}`);

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'ORDER_CREATED',
      entity: 'ORDER',
      entityId: createdOrder.id,
      metadata: {
        customerId: targetCustomer.id,
        customerName: targetCustomer.name,
        total: createdOrder.total.toString(),
        itemsCount: items.length,
      },
    });

    return {
      success: true,
      message: `Order #${createdOrder.id.slice(-6).toUpperCase()} drafted successfully.`,
      data: createdOrder,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create order.',
    };
  }
}

/**
 * Update an existing order. Only DRAFT orders may be edited.
 *
 * Safety: The DRAFT status check is re-verified INSIDE the $transaction after acquiring
 * a write lock on the order row. This closes the TOCTOU window where a concurrent
 * confirmOrderAction could win the race and leave an edit applied to a CONFIRMED order.
 */
export async function updateOrderAction(
  orgSlug: string,
  input: UpdateOrderInput
): Promise<OrderActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const parsed = updateOrderSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid order data.',
      };
    }

    const { orderId, customerId, discount, notes, items } = parsed.data;

    // RBAC pre-check: optimistic check before the expensive product lookup
    const preCheck = await prisma.order.findFirst({
      where: { id: orderId, tenantId: tenantContext.tenantId },
      select: { id: true, status: true },
    });

    if (!preCheck) {
      return { success: false, error: 'Order not found in this workspace.' };
    }

    const rbacDecision = canEditOrder(tenantContext.role, preCheck.status);
    if (!rbacDecision.allowed) {
      return { success: false, error: rbacDecision.reason || 'You are not authorized to edit this order.' };
    }

    // Verify Customer belongs to this tenant and is active
    const targetCustomer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: tenantContext.tenantId, isActive: true },
    });

    if (!targetCustomer) {
      return { success: false, error: 'Selected customer does not exist or is archived in this workspace.' };
    }

    // Verify products belong to this tenant
    const productIds = items.map((i) => i.productId);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId: tenantContext.tenantId, isActive: true },
    });

    if (dbProducts.length !== new Set(productIds).size) {
      return { success: false, error: 'One or more selected products do not belong to this workspace or are inactive.' };
    }

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    let subtotalNum = 0;
    const preparedItems = items.map((item) => {
      const product = productMap.get(item.productId)!;
      const unitPriceNum = parseFloat(product.price.toString());
      const lineTotalNum = unitPriceNum * item.quantity;
      subtotalNum += lineTotalNum;
      return {
        orderId: preCheck.id,
        productId: product.id,
        quantity: item.quantity,
        unitPrice: product.price,
        lineTotal: new Prisma.Decimal(lineTotalNum.toFixed(2)),
      };
    });

    const discountNum = discount;
    const totalNum = Math.max(0, subtotalNum - discountNum);

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // ── SAFETY: Re-read current status inside the transaction ──────────────
      // This closes the TOCTOU race: if a concurrent confirmOrderAction already
      // set this order to CONFIRMED, we abort here before any write.
      const liveOrder = await tx.order.findUnique({
        where: { id: preCheck.id },
        select: { status: true },
      });

      if (!liveOrder || liveOrder.status !== OrderStatus.DRAFT) {
        throw new Error(
          `Cannot edit order: it is no longer in DRAFT status ` +
          `(current: ${liveOrder?.status ?? 'unknown'}). Only DRAFT orders may be modified.`
        );
      }
      // ───────────────────────────────────────────────────────────────────────

      // Remove old items and insert new ones atomically
      await tx.orderItem.deleteMany({ where: { orderId: preCheck.id } });
      await tx.orderItem.createMany({ data: preparedItems });

      return await tx.order.update({
        where: { id: preCheck.id },
        data: {
          customerId: targetCustomer.id,
          subtotal: new Prisma.Decimal(subtotalNum.toFixed(2)),
          discount: new Prisma.Decimal(discountNum.toFixed(2)),
          total: new Prisma.Decimal(totalNum.toFixed(2)),
          notes: notes && notes.trim() !== '' ? notes.trim() : null,
        },
      });
    });

    revalidatePath(`/${orgSlug}/orders`);
    revalidatePath(`/${orgSlug}/orders/${orderId}`);
    revalidatePath(`/${orgSlug}/customers`);

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'ORDER_UPDATED',
      entity: 'ORDER',
      entityId: preCheck.id,
      metadata: {
        customerId: targetCustomer.id,
        customerName: targetCustomer.name,
        total: updatedOrder.total.toString(),
        itemsCount: items.length,
      },
    });

    return {
      success: true,
      message: `Order #${preCheck.id.slice(-6).toUpperCase()} updated successfully.`,
      data: updatedOrder,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update order.',
    };
  }
}

/**
 * Confirm an order: atomically checks stock and decrements inventory in a single
 * conditional database write — preventing oversell under concurrent requests.
 *
 * Safety invariants enforced INSIDE the $transaction:
 *  1. Re-reads current order status from DB — rejects if not DRAFT (double-confirm guard).
 *  2. Uses atomic `updateMany WHERE quantity >= required` for each inventory row.
 *     The WHERE predicate is evaluated under a row-level write lock by the database engine,
 *     eliminating the read-check-write race condition of a plain findUnique + update pattern.
 *  3. Only after all inventory updates succeed does the order status transition to CONFIRMED.
 */
export async function confirmOrderAction(
  orgSlug: string,
  input: ConfirmOrderInput
): Promise<OrderActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const decision = canConfirmOrder(tenantContext.role);
    if (!decision.allowed) {
      return {
        success: false,
        error: decision.reason || 'You are not authorized to confirm orders.',
      };
    }

    const parsed = confirmOrderSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid order confirmation input.',
      };
    }

    const { orderId } = parsed.data;

    // Pre-fetch order items for product/inventory resolution (outside tx for efficiency)
    const preOrder = await prisma.order.findFirst({
      where: { id: orderId, tenantId: tenantContext.tenantId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });

    if (!preOrder) {
      return { success: false, error: 'Order not found in this workspace.' };
    }

    // Optimistic transition check (definitive check re-done inside transaction)
    if (!isValidStatusTransition(preOrder.status, OrderStatus.CONFIRMED)) {
      return {
        success: false,
        error: `Cannot confirm order in "${preOrder.status}" status. Only DRAFT orders can be confirmed.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      // ── SAFETY: Re-read status inside transaction ──────────────────────────
      // Serialises concurrent confirm requests — the second one will find status
      // already CONFIRMED and throw before touching inventory.
      const liveOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      });

      if (!liveOrder || liveOrder.status !== OrderStatus.DRAFT) {
        throw new Error(
          `Cannot confirm order: current status is "${liveOrder?.status ?? 'unknown'}". ` +
          'Only DRAFT orders can be confirmed. This order may have already been confirmed or cancelled.'
        );
      }
      // ───────────────────────────────────────────────────────────────────────

      for (const item of preOrder.items) {
        // Read current quantity for the audit log record (consistent read within tx)
        const inventory = await tx.inventory.findUnique({
          where: { productId: item.productId },
          select: { quantity: true },
        });

        const currentStock = inventory?.quantity ?? 0;

        // ── SAFETY: Atomic conditional decrement ─────────────────────────────
        // updateMany with WHERE quantity >= required is a single conditional UPDATE
        // evaluated under a row-level write lock. Two concurrent requests cannot
        // both see sufficient stock and both deduct — one will get count === 0.
        const result = await tx.inventory.updateMany({
          where: {
            productId: item.productId,
            quantity: { gte: item.quantity },
          },
          data: {
            quantity: { decrement: item.quantity },
          },
        });

        if (result.count === 0) {
          throw new Error(
            `Insufficient inventory for product "${item.product.name}" (SKU: ${item.product.sku}). ` +
            `Available stock: ${currentStock} unit${currentStock === 1 ? '' : 's'}, ` +
            `required: ${item.quantity}.`
          );
        }
        // ───────────────────────────────────────────────────────────────────────

        const newStock = currentStock - item.quantity;

        await tx.inventoryMovement.create({
          data: {
            tenantId: tenantContext.tenantId,
            productId: item.productId,
            type: 'STOCK_OUT',
            quantity: item.quantity,
            previousQuantity: currentStock,
            newQuantity: newStock,
            reason: `Order #${orderId.slice(-6).toUpperCase()} confirmed`,
            createdByUserId: tenantContext.userId,
          },
        });
      }

      // Only reached if every inventory decrement succeeded
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CONFIRMED },
      });
    });

    revalidatePath(`/${orgSlug}/orders`);
    revalidatePath(`/${orgSlug}/orders/${orderId}`);
    revalidatePath(`/${orgSlug}/products`);
    revalidatePath(`/${orgSlug}/products/inventory`);
    revalidatePath(`/${orgSlug}`);

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'ORDER_CONFIRMED',
      entity: 'ORDER',
      entityId: orderId,
      metadata: {
        orderId,
        itemsCount: preOrder.items.length,
      },
    });

    return {
      success: true,
      message: `Order #${orderId.slice(-6).toUpperCase()} confirmed and inventory deducted.`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to confirm order.',
    };
  }
}

/**
 * Cancel an order. If previously CONFIRMED, atomically restores inventory and logs STOCK_IN movements.
 *
 * Safety: Re-reads current order status inside the $transaction before any write
 * to prevent duplicate cancellation races.
 */
export async function cancelOrderAction(
  orgSlug: string,
  input: CancelOrderInput
): Promise<OrderActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const decision = canCancelOrder(tenantContext.role);
    if (!decision.allowed) {
      return {
        success: false,
        error: decision.reason || 'You are not authorized to cancel orders.',
      };
    }

    const parsed = cancelOrderSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid cancel request.',
      };
    }

    const { orderId, reason } = parsed.data;

    const preOrder = await prisma.order.findFirst({
      where: { id: orderId, tenantId: tenantContext.tenantId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });

    if (!preOrder) {
      return { success: false, error: 'Order not found in this workspace.' };
    }

    // Optimistic check
    if (!isValidStatusTransition(preOrder.status, OrderStatus.CANCELLED)) {
      return {
        success: false,
        error: `Cannot cancel order in "${preOrder.status}" status. Only DRAFT or CONFIRMED orders can be cancelled.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      // ── SAFETY: Re-read status inside transaction ──────────────────────────
      const liveOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true, notes: true },
      });

      if (!liveOrder || !isValidStatusTransition(liveOrder.status, OrderStatus.CANCELLED)) {
        throw new Error(
          `Cannot cancel order: current status is "${liveOrder?.status ?? 'unknown'}". ` +
          'Only DRAFT or CONFIRMED orders can be cancelled.'
        );
      }
      // ───────────────────────────────────────────────────────────────────────

      const wasConfirmed = liveOrder.status === OrderStatus.CONFIRMED;

      if (wasConfirmed) {
        for (const item of preOrder.items) {
          const inventory = await tx.inventory.findUnique({
            where: { productId: item.productId },
            select: { quantity: true },
          });

          const currentStock = inventory?.quantity ?? 0;
          const restoredStock = currentStock + item.quantity;

          await tx.inventory.update({
            where: { productId: item.productId },
            data: { quantity: restoredStock },
          });

          await tx.inventoryMovement.create({
            data: {
              tenantId: tenantContext.tenantId,
              productId: item.productId,
              type: 'STOCK_IN',
              quantity: item.quantity,
              previousQuantity: currentStock,
              newQuantity: restoredStock,
              reason: `Order #${orderId.slice(-6).toUpperCase()} cancelled${
                reason ? ` - ${reason}` : ' (stock restored)'
              }`,
              createdByUserId: tenantContext.userId,
            },
          });
        }
      }

      const existingNotes = liveOrder.notes ?? '';
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CANCELLED,
          notes: existingNotes
            ? `${existingNotes} [Cancelled: ${reason || 'No reason provided'}]`
            : `[Cancelled: ${reason || 'No reason provided'}]`,
        },
      });
    });

    revalidatePath(`/${orgSlug}/orders`);
    revalidatePath(`/${orgSlug}/orders/${orderId}`);
    revalidatePath(`/${orgSlug}/products`);
    revalidatePath(`/${orgSlug}/products/inventory`);
    revalidatePath(`/${orgSlug}`);

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'ORDER_CANCELLED',
      entity: 'ORDER',
      entityId: orderId,
      metadata: {
        orderId,
        reason,
        inventoryRestored: preOrder.status === OrderStatus.CONFIRMED,
      },
    });

    return {
      success: true,
      message: `Order #${orderId.slice(-6).toUpperCase()} cancelled${
        preOrder.status === OrderStatus.CONFIRMED ? ' and inventory restored' : ''
      }.`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel order.',
    };
  }
}

/**
 * Mark a confirmed order as COMPLETED.
 *
 * Safety: Re-reads current order status inside the $transaction before writing
 * to prevent duplicate completion races.
 */
export async function completeOrderAction(
  orgSlug: string,
  input: CompleteOrderInput
): Promise<OrderActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const decision = canCompleteOrder(tenantContext.role);
    if (!decision.allowed) {
      return {
        success: false,
        error: decision.reason || 'You are not authorized to complete orders.',
      };
    }

    const parsed = completeOrderSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid request.',
      };
    }

    const { orderId } = parsed.data;

    const preOrder = await prisma.order.findFirst({
      where: { id: orderId, tenantId: tenantContext.tenantId },
      select: { id: true, status: true },
    });

    if (!preOrder) {
      return { success: false, error: 'Order not found in this workspace.' };
    }

    // Optimistic check
    if (!isValidStatusTransition(preOrder.status, OrderStatus.COMPLETED)) {
      return {
        success: false,
        error: `Cannot complete order in "${preOrder.status}" status. Only CONFIRMED orders can be completed.`,
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      // ── SAFETY: Re-read status inside transaction ──────────────────────────
      const liveOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      });

      if (!liveOrder || liveOrder.status !== OrderStatus.CONFIRMED) {
        throw new Error(
          `Cannot complete order: current status is "${liveOrder?.status ?? 'unknown'}". ` +
          'Only CONFIRMED orders can be completed.'
        );
      }
      // ───────────────────────────────────────────────────────────────────────

      return await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.COMPLETED },
      });
    });

    revalidatePath(`/${orgSlug}/orders`);
    revalidatePath(`/${orgSlug}/orders/${orderId}`);
    revalidatePath(`/${orgSlug}/customers`);

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'ORDER_COMPLETED',
      entity: 'ORDER',
      entityId: orderId,
      metadata: { orderId },
    });

    return {
      success: true,
      message: `Order #${orderId.slice(-6).toUpperCase()} marked as completed.`,
      data: updated,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete order.',
    };
  }
}
