'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { getRequiredTenantContext } from '@/lib/auth/session';
import { Prisma, InvoiceStatus, OrderStatus } from '@prisma/client';
import {
  canCreateInvoice,
  canEditInvoice,
  canIssueInvoice,
  canVoidInvoice,
  canGenerateInvoiceFromOrder,
  isValidInvoiceStatusTransition,
} from '@/lib/auth/finance-auth';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  issueInvoiceSchema,
  voidInvoiceSchema,
  generateInvoiceFromOrderSchema,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  IssueInvoiceInput,
  VoidInvoiceInput,
  GenerateInvoiceFromOrderInput,
} from '@/lib/validations/finance';
import { calculateLineTotal, calculateInvoiceSummary } from '@/lib/utils/finance-calculations';
import { recordAuditLog } from '@/lib/utils/audit';

export interface FinanceActionResult<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Invoice Number Generation
// Generates unique tenant-scoped numbers: INV-2026-0001
// Uses MAX(invoiceNumber) per tenant to find the next sequence.
// The @@unique([tenantId, invoiceNumber]) DB constraint prevents duplicates
// under concurrent requests (one will get a unique constraint violation).
// ─────────────────────────────────────────────────────────────────────────────
async function generateInvoiceNumber(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  const lastInvoice = await tx.invoice.findFirst({
    where: {
      tenantId,
      invoiceNumber: { startsWith: prefix },
    },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  });

  let nextSeq = 1;
  if (lastInvoice) {
    const lastSeq = parseInt(lastInvoice.invoiceNumber.replace(prefix, ''), 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. createInvoiceAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new invoice in DRAFT status.
 * All financial totals are calculated server-side — client-provided totals are ignored.
 * Invoice + InvoiceItems are created atomically in one transaction.
 */
export async function createInvoiceAction(
  orgSlug: string,
  input: CreateInvoiceInput
): Promise<FinanceActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const decision = canCreateInvoice(tenantContext.role);
    if (!decision.allowed) {
      return { success: false, error: decision.reason || 'You are not authorized to create invoices.' };
    }

    const parsed = createInvoiceSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || 'Invalid invoice input data.' };
    }

    const { customerId, dueDate, taxRate, discount, notes, terms, items } = parsed.data;

    // Verify customer belongs to this tenant
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: tenantContext.tenantId, isActive: true },
    });
    if (!customer) {
      return { success: false, error: 'Customer does not exist or is inactive in this workspace.' };
    }

    // Server-side calculation — ignoring any client-supplied totals
    const summary = calculateInvoiceSummary(items, taxRate, discount);

    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await generateInvoiceNumber(tx, tenantContext.tenantId);

      return tx.invoice.create({
        data: {
          tenantId: tenantContext.tenantId,
          invoiceNumber,
          customerId: customer.id,
          status: InvoiceStatus.DRAFT,
          dueDate,
          subtotal: summary.subtotal,
          taxRate: summary.taxRate,
          taxAmount: summary.taxAmount,
          discount: summary.discount,
          total: summary.total,
          paidAmount: new Prisma.Decimal('0.00'),
          balance: summary.total,
          notes: notes && notes.trim() !== '' ? notes.trim() : null,
          terms: terms && terms.trim() !== '' ? terms.trim() : null,
          createdByUserId: tenantContext.userId,
          items: {
            create: items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
              lineTotal: calculateLineTotal(item.quantity, item.unitPrice),
              productId: item.productId && item.productId.trim() !== '' ? item.productId : null,
            })),
          },
        },
        include: { items: true, customer: true },
      });
    });

    revalidatePath(`/${orgSlug}/finance`);
    revalidatePath(`/${orgSlug}/finance/invoices`);
    revalidatePath(`/${orgSlug}`);

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'INVOICE_CREATED',
      entity: 'INVOICE',
      entityId: invoice.id,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        customerId: customer.id,
        customerName: customer.name,
        total: invoice.total.toString(),
      },
    });

    return {
      success: true,
      message: `Invoice ${invoice.invoiceNumber} created as a draft.`,
      data: invoice,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return { success: false, error: 'Invoice number conflict. Please try again.' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create invoice.',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. updateInvoiceAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update a DRAFT invoice. Only DRAFT status is editable.
 * Status is re-verified INSIDE the transaction (TOCTOU protection).
 * All totals recalculated server-side — client totals ignored.
 * paidAmount is never touched during an update.
 */
export async function updateInvoiceAction(
  orgSlug: string,
  input: UpdateInvoiceInput
): Promise<FinanceActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const parsed = updateInvoiceSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || 'Invalid invoice data.' };
    }

    const { invoiceId, customerId, dueDate, taxRate, discount, notes, terms, items } = parsed.data;

    // Optimistic pre-check (status re-verified inside tx)
    const preCheck = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: tenantContext.tenantId },
      select: { id: true, status: true, invoiceNumber: true },
    });

    if (!preCheck) {
      return { success: false, error: 'Invoice not found in this workspace.' };
    }

    const rbacDecision = canEditInvoice(tenantContext.role, preCheck.status);
    if (!rbacDecision.allowed) {
      return { success: false, error: rbacDecision.reason || 'You are not authorized to edit this invoice.' };
    }

    // Verify customer belongs to this tenant
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: tenantContext.tenantId, isActive: true },
    });
    if (!customer) {
      return { success: false, error: 'Customer does not exist or is inactive in this workspace.' };
    }

    const summary = calculateInvoiceSummary(items, taxRate, discount);

    const updated = await prisma.$transaction(async (tx) => {
      // ── SAFETY: Re-read status inside transaction (TOCTOU protection) ───────
      const liveInvoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: { status: true },
      });

      if (!liveInvoice || liveInvoice.status !== InvoiceStatus.DRAFT) {
        throw new Error(
          `Cannot edit invoice: it is no longer in DRAFT status ` +
          `(current: ${liveInvoice?.status ?? 'unknown'}). Only DRAFT invoices may be modified.`
        );
      }
      // ─────────────────────────────────────────────────────────────────────

      // Atomically replace invoice items
      await tx.invoiceItem.deleteMany({ where: { invoiceId } });

      return tx.invoice.update({
        where: { id: invoiceId },
        data: {
          customerId: customer.id,
          dueDate,
          subtotal: summary.subtotal,
          taxRate: summary.taxRate,
          taxAmount: summary.taxAmount,
          discount: summary.discount,
          total: summary.total,
          balance: summary.total, // DRAFT always has paidAmount = 0
          notes: notes && notes.trim() !== '' ? notes.trim() : null,
          terms: terms && terms.trim() !== '' ? terms.trim() : null,
          items: {
            create: items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
              lineTotal: calculateLineTotal(item.quantity, item.unitPrice),
              productId: item.productId && item.productId.trim() !== '' ? item.productId : null,
            })),
          },
        },
        include: { items: true, customer: true },
      });
    });

    revalidatePath(`/${orgSlug}/finance`);
    revalidatePath(`/${orgSlug}/finance/invoices`);
    revalidatePath(`/${orgSlug}/finance/invoices/${invoiceId}`);

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'INVOICE_UPDATED',
      entity: 'INVOICE',
      entityId: preCheck.id,
      metadata: {
        invoiceNumber: preCheck.invoiceNumber,
        customerId: customer.id,
        customerName: customer.name,
        total: updated.total.toString(),
      },
    });

    return {
      success: true,
      message: `Invoice ${preCheck.invoiceNumber} updated successfully.`,
      data: updated,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update invoice.',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. issueInvoiceAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Issue (finalize) a DRAFT invoice, locking the historical snapshot.
 * Transitions: DRAFT -> ISSUED.
 * Revenue is NOT recognized at issuance — only upon payment receipt.
 * Re-reads invoice status inside transaction (TOCTOU protection).
 */
export async function issueInvoiceAction(
  orgSlug: string,
  input: IssueInvoiceInput
): Promise<FinanceActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const decision = canIssueInvoice(tenantContext.role);
    if (!decision.allowed) {
      return { success: false, error: decision.reason || 'You are not authorized to issue invoices.' };
    }

    const parsed = issueInvoiceSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || 'Invalid request.' };
    }

    const { invoiceId } = parsed.data;

    const preCheck = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: tenantContext.tenantId },
      select: { id: true, status: true, invoiceNumber: true, total: true },
    });

    if (!preCheck) {
      return { success: false, error: 'Invoice not found in this workspace.' };
    }

    if (!isValidInvoiceStatusTransition(preCheck.status, InvoiceStatus.ISSUED)) {
      return {
        success: false,
        error: `Cannot issue invoice in "${preCheck.status}" status. Only DRAFT invoices can be issued.`,
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      // ── SAFETY: Re-read inside transaction ──────────────────────────────────
      const liveInvoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: { status: true, total: true, customerId: true },
      });

      if (!liveInvoice || liveInvoice.status !== InvoiceStatus.DRAFT) {
        throw new Error(
          `Cannot issue invoice: current status is "${liveInvoice?.status ?? 'unknown'}". Only DRAFT invoices can be issued.`
        );
      }

      // Validate total > 0 before issuing
      if (new Prisma.Decimal(liveInvoice.total.toString()).lessThanOrEqualTo(0)) {
        throw new Error('Cannot issue an invoice with zero or negative total. Please add valid line items.');
      }
      // ─────────────────────────────────────────────────────────────────────

      return tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.ISSUED,
          issueDate: new Date(),
        },
      });
    });

    revalidatePath(`/${orgSlug}/finance`);
    revalidatePath(`/${orgSlug}/finance/invoices`);
    revalidatePath(`/${orgSlug}/finance/invoices/${invoiceId}`);

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'INVOICE_ISSUED',
      entity: 'INVOICE',
      entityId: invoiceId,
      metadata: {
        invoiceNumber: preCheck.invoiceNumber,
        total: preCheck.total.toString(),
      },
    });

    return {
      success: true,
      message: `Invoice ${preCheck.invoiceNumber} has been issued and is now awaiting payment.`,
      data: updated,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to issue invoice.',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. voidInvoiceAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Void an invoice. Preserves financial history — the invoice record is never deleted.
 * Invoices with paidAmount > 0 CANNOT be voided.
 * No ledger entry is created for voiding an unpaid invoice (no cash was received).
 * Re-reads invoice inside transaction (TOCTOU protection).
 */
export async function voidInvoiceAction(
  orgSlug: string,
  input: VoidInvoiceInput
): Promise<FinanceActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const decision = canVoidInvoice(tenantContext.role);
    if (!decision.allowed) {
      return { success: false, error: decision.reason || 'You are not authorized to void invoices.' };
    }

    const parsed = voidInvoiceSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || 'Invalid request.' };
    }

    const { invoiceId, reason } = parsed.data;

    const preCheck = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: tenantContext.tenantId },
      select: { id: true, status: true, invoiceNumber: true, paidAmount: true },
    });

    if (!preCheck) {
      return { success: false, error: 'Invoice not found in this workspace.' };
    }

    if (!isValidInvoiceStatusTransition(preCheck.status, InvoiceStatus.VOIDED)) {
      return {
        success: false,
        error: `Cannot void invoice in "${preCheck.status}" status.`,
      };
    }

    // Guard: invoices with payments cannot be voided — must refund first
    if (new Prisma.Decimal(preCheck.paidAmount.toString()).greaterThan(0)) {
      return {
        success: false,
        error: 'Cannot void an invoice with recorded payments. Please refund all payments before voiding.',
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      // ── SAFETY: Re-read inside transaction ──────────────────────────────────
      const liveInvoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: { status: true, paidAmount: true },
      });

      if (!liveInvoice || !isValidInvoiceStatusTransition(liveInvoice.status, InvoiceStatus.VOIDED)) {
        throw new Error(
          `Cannot void invoice: current status is "${liveInvoice?.status ?? 'unknown'}".`
        );
      }

      if (new Prisma.Decimal(liveInvoice.paidAmount.toString()).greaterThan(0)) {
        throw new Error('Cannot void an invoice with recorded payments.');
      }
      // ─────────────────────────────────────────────────────────────────────

      return tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.VOIDED,
          notes: reason
            ? `[Voided: ${reason}]`
            : '[Voided]',
        },
      });
    });

    revalidatePath(`/${orgSlug}/finance`);
    revalidatePath(`/${orgSlug}/finance/invoices`);
    revalidatePath(`/${orgSlug}/finance/invoices/${invoiceId}`);

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'INVOICE_VOIDED',
      entity: 'INVOICE',
      entityId: invoiceId,
      metadata: {
        invoiceNumber: preCheck.invoiceNumber,
        reason,
      },
    });

    return {
      success: true,
      message: `Invoice ${preCheck.invoiceNumber} has been voided.`,
      data: updated,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to void invoice.',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. generateInvoiceFromOrderAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a DRAFT invoice from a CONFIRMED or COMPLETED order.
 * Snapshots order line items (quantity, unitPrice, description, productId) at this moment —
 * future product price changes will NOT alter the invoice.
 * The orderId unique constraint in the Invoice model prevents duplicate invoice generation.
 * Does NOT mutate the original order, inventory, or create any ledger entries.
 * Re-reads the order inside transaction (TOCTOU + tenant verification).
 */
export async function generateInvoiceFromOrderAction(
  orgSlug: string,
  input: GenerateInvoiceFromOrderInput
): Promise<FinanceActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    // Pre-check: read order status before RBAC (status check needed for RBAC)
    const preOrder = await prisma.order.findFirst({
      where: { id: input.orderId, tenantId: tenantContext.tenantId },
      include: {
        customer: true,
        items: {
          include: { product: true },
        },
      },
    });

    if (!preOrder) {
      return { success: false, error: 'Order not found in this workspace.' };
    }

    const rbacDecision = canGenerateInvoiceFromOrder(tenantContext.role, preOrder.status);
    if (!rbacDecision.allowed) {
      return { success: false, error: rbacDecision.reason || 'You are not authorized to generate invoices from this order.' };
    }

    const parsed = generateInvoiceFromOrderSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || 'Invalid request.' };
    }

    const { orderId, dueDate, taxRate, notes, terms } = parsed.data;

    // Calculate a default due date (30 days from now) if not supplied
    const resolvedDueDate = dueDate ?? (() => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d;
    })();

    // Snapshot order items into invoice item format
    const itemSnapshots = preOrder.items.map((item) => ({
      productId: item.productId,
      description: item.product
        ? `${item.product.name}${item.product.sku ? ` (SKU: ${item.product.sku})` : ''}`
        : `Product (deleted)`,
      quantity: item.quantity,
      unitPrice: item.unitPrice, // historical snapshot — fixed at order time
    }));

    // Use order discount; apply additional taxRate if provided
    const orderDiscountAmount = preOrder.discount;
    const summary = calculateInvoiceSummary(
      itemSnapshots.map((i) => ({
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      taxRate ?? 0,
      orderDiscountAmount
    );

    const invoice = await prisma.$transaction(async (tx) => {
      // ── SAFETY: Re-read order inside transaction (tenant + status + duplicate guard) ─
      const liveOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true, tenantId: true },
      });

      if (!liveOrder) {
        throw new Error('Order not found.');
      }
      if (liveOrder.tenantId !== tenantContext.tenantId) {
        throw new Error('Cross-tenant order access rejected.');
      }
      if (
        liveOrder.status !== OrderStatus.CONFIRMED &&
        liveOrder.status !== OrderStatus.COMPLETED
      ) {
        throw new Error(
          `Cannot generate invoice: order is in "${liveOrder.status}" status. ` +
          'Only CONFIRMED or COMPLETED orders can be invoiced.'
        );
      }
      // ─────────────────────────────────────────────────────────────────────

      const invoiceNumber = await generateInvoiceNumber(tx, tenantContext.tenantId);

      return tx.invoice.create({
        data: {
          tenantId: tenantContext.tenantId,
          invoiceNumber,
          orderId, // unique constraint prevents re-generation
          customerId: preOrder.customerId,
          status: InvoiceStatus.DRAFT,
          dueDate: resolvedDueDate,
          subtotal: summary.subtotal,
          taxRate: summary.taxRate,
          taxAmount: summary.taxAmount,
          discount: summary.discount,
          total: summary.total,
          paidAmount: new Prisma.Decimal('0.00'),
          balance: summary.total,
          notes: notes && notes.trim() !== '' ? notes.trim() : null,
          terms: terms && terms.trim() !== '' ? terms.trim() : null,
          createdByUserId: tenantContext.userId,
          items: {
            create: itemSnapshots.map((item) => ({
              productId: item.productId ?? null,
              description: item.description,
              quantity: item.quantity,
              unitPrice: new Prisma.Decimal(item.unitPrice.toString()),
              lineTotal: calculateLineTotal(item.quantity, item.unitPrice),
            })),
          },
        },
        include: { items: true, customer: true },
      });
    });

    revalidatePath(`/${orgSlug}/finance`);
    revalidatePath(`/${orgSlug}/finance/invoices`);
    revalidatePath(`/${orgSlug}/orders`);
    revalidatePath(`/${orgSlug}/orders/${orderId}`);

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'INVOICE_GENERATED_FROM_ORDER',
      entity: 'INVOICE',
      entityId: invoice.id,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        orderId,
        total: invoice.total.toString(),
      },
    });

    return {
      success: true,
      message: `Invoice ${invoice.invoiceNumber} generated from Order #${orderId.slice(-6).toUpperCase()}.`,
      data: invoice,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return {
        success: false,
        error: 'An invoice has already been generated for this order. Duplicate generation is not allowed.',
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate invoice from order.',
    };
  }
}
