'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { getRequiredTenantContext } from '@/lib/auth/session';
import { Prisma, PaymentStatus, InvoiceStatus, LedgerEntryType } from '@prisma/client';
import { canRecordPayment, canRefundPayment } from '@/lib/auth/finance-auth';
import {
  recordPaymentSchema,
  refundPaymentSchema,
  RecordPaymentInput,
  RefundPaymentInput,
} from '@/lib/validations/finance';
import { calculatePaymentBalance, determineInvoicePaymentStatus } from '@/lib/utils/finance-calculations';
import { recordAuditLog } from '@/lib/utils/audit';
import { FinanceActionResult } from './invoices';

// ─────────────────────────────────────────────────────────────────────────────
// Payment Number Generation
// Generates unique tenant-scoped numbers: PAY-2026-0001
// @@unique([tenantId, paymentNumber]) constraint prevents collision under concurrency.
// ─────────────────────────────────────────────────────────────────────────────
async function generatePaymentNumber(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PAY-${year}-`;

  const lastPayment = await tx.payment.findFirst({
    where: {
      tenantId,
      paymentNumber: { startsWith: prefix },
    },
    orderBy: { paymentNumber: 'desc' },
    select: { paymentNumber: true },
  });

  let nextSeq = 1;
  if (lastPayment) {
    const lastSeq = parseInt(lastPayment.paymentNumber.replace(prefix, ''), 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. recordPaymentAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Record a payment against an invoice. This is a critical financial transaction.
 *
 * All of the following happen atomically inside ONE $transaction:
 * 1. Re-read invoice from DB (fresh balance, status)
 * 2. Verify tenant ownership inside tx
 * 3. Verify current invoice status allows payments
 * 4. Validate payment amount <= current real balance (overpayment protection)
 * 5. Create Payment record
 * 6. Update Invoice.paidAmount
 * 7. Update Invoice.balance
 * 8. Update Invoice.status
 * 9. Create REVENUE LedgerEntry
 *
 * Uses Prisma.Decimal throughout — no JS floating-point arithmetic.
 */
export async function recordPaymentAction(
  orgSlug: string,
  input: RecordPaymentInput
): Promise<FinanceActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const decision = canRecordPayment(tenantContext.role);
    if (!decision.allowed) {
      return { success: false, error: decision.reason || 'You are not authorized to record payments.' };
    }

    const parsed = recordPaymentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || 'Invalid payment data.' };
    }

    const { invoiceId, amount, paymentMethod, paymentDate, reference, notes } = parsed.data;

    // Optimistic check (re-verified inside tx)
    const preInvoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: tenantContext.tenantId },
      select: { id: true, status: true, invoiceNumber: true },
    });

    if (!preInvoice) {
      return { success: false, error: 'Invoice not found in this workspace.' };
    }

    const payableStatuses: InvoiceStatus[] = [
      InvoiceStatus.ISSUED,
      InvoiceStatus.PARTIALLY_PAID,
      InvoiceStatus.OVERDUE,
    ];
    if (!payableStatuses.includes(preInvoice.status)) {
      return {
        success: false,
        error: `Cannot record payment for an invoice in "${preInvoice.status}" status. ` +
          'Only ISSUED, PARTIALLY_PAID, or OVERDUE invoices can receive payments.',
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      // ── SAFETY: Re-read invoice from DB inside transaction ─────────────────
      // Prevents stale balance reads from concurrent payment submissions.
      const liveInvoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: {
          id: true,
          tenantId: true,
          status: true,
          total: true,
          paidAmount: true,
          balance: true,
          dueDate: true,
          invoiceNumber: true,
        },
      });

      if (!liveInvoice) throw new Error('Invoice not found.');

      // ── Tenant verification inside tx ──────────────────────────────────────
      if (liveInvoice.tenantId !== tenantContext.tenantId) {
        throw new Error('Cross-tenant payment access rejected.');
      }

      // ── Status verification inside tx ──────────────────────────────────────
      if (!payableStatuses.includes(liveInvoice.status)) {
        throw new Error(
          `Cannot record payment: invoice status is now "${liveInvoice.status}". ` +
          'Status may have changed since this action was initiated.'
        );
      }
      // ─────────────────────────────────────────────────────────────────────

      // ── Overpayment protection (Decimal-safe) ─────────────────────────────
      const paymentDecimal = new Prisma.Decimal(amount.toFixed(2));
      const balanceResult = calculatePaymentBalance(
        liveInvoice.total,
        liveInvoice.paidAmount,
        paymentDecimal
      );

      if (balanceResult.isOverpayment) {
        throw new Error(
          `Payment of ${amount.toFixed(2)} exceeds the remaining balance of ` +
          `${balanceResult.newBalance.toFixed(2)}. Overpayments are not allowed.`
        );
      }
      // ─────────────────────────────────────────────────────────────────────

      const newPaidAmount = balanceResult.newPaidAmount;
      const newBalance = balanceResult.newBalance;
      const newStatus = determineInvoicePaymentStatus(
        liveInvoice.total,
        newPaidAmount,
        liveInvoice.dueDate
      );

      const paymentNumber = await generatePaymentNumber(tx, tenantContext.tenantId);

      // 5. Create Payment
      const payment = await tx.payment.create({
        data: {
          tenantId: tenantContext.tenantId,
          invoiceId,
          paymentNumber,
          amount: paymentDecimal,
          paymentMethod,
          paymentDate,
          status: PaymentStatus.COMPLETED,
          reference: reference && reference.trim() !== '' ? reference.trim() : null,
          notes: notes && notes.trim() !== '' ? notes.trim() : null,
          createdByUserId: tenantContext.userId,
        },
      });

      // 6-8. Update Invoice atomically
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaidAmount,
          balance: newBalance,
          status: newStatus,
        },
      });

      // 9. Create immutable REVENUE LedgerEntry
      await tx.ledgerEntry.create({
        data: {
          tenantId: tenantContext.tenantId,
          type: LedgerEntryType.REVENUE,
          amount: paymentDecimal,
          entryDate: paymentDate,
          description: `Payment ${paymentNumber} received for Invoice ${liveInvoice.invoiceNumber}`,
          referenceType: 'PAYMENT',
          referenceId: payment.id,
          invoiceId,
          paymentId: payment.id,
          createdByUserId: tenantContext.userId,
        },
      });

      return { payment, newStatus, invoiceNumber: liveInvoice.invoiceNumber };
    });

    revalidatePath(`/${orgSlug}/finance`);
    revalidatePath(`/${orgSlug}/finance/invoices`);
    revalidatePath(`/${orgSlug}/finance/invoices/${invoiceId}`);
    revalidatePath(`/${orgSlug}/finance/payments`);

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'PAYMENT_RECORDED',
      entity: 'PAYMENT',
      entityId: result.payment.id,
      metadata: {
        paymentNumber: result.payment.paymentNumber,
        invoiceId,
        invoiceNumber: result.invoiceNumber,
        amount: amount.toFixed(2),
        paymentMethod,
      },
    });

    return {
      success: true,
      message: `Payment ${result.payment.paymentNumber} recorded. Invoice ${result.invoiceNumber} is now ${result.newStatus}.`,
      data: result.payment,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return { success: false, error: 'Payment number conflict. Please try again.' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record payment.',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. refundPaymentAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Refund (reverse) a payment. OWNER only.
 *
 * All of the following happen atomically inside ONE $transaction:
 * 1. Re-read Payment from DB inside tx
 * 2. Verify tenant ownership inside tx
 * 3. Verify payment is in COMPLETED status (not already REFUNDED)
 * 4. Re-read Invoice inside tx
 * 5. Reduce Invoice.paidAmount by refund amount
 * 6. Increase Invoice.balance by refund amount
 * 7. Recalculate Invoice.status
 * 8. Mark Payment as REFUNDED
 * 9. Create offsetting negative REVENUE LedgerEntry
 *
 * The original Payment record is PRESERVED (status set to REFUNDED, never deleted).
 */
export async function refundPaymentAction(
  orgSlug: string,
  input: RefundPaymentInput
): Promise<FinanceActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const decision = canRefundPayment(tenantContext.role);
    if (!decision.allowed) {
      return { success: false, error: decision.reason || 'Payment refunds are restricted to Workspace Owners only.' };
    }

    const parsed = refundPaymentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || 'Invalid refund request.' };
    }

    const { paymentId, reason } = parsed.data;

    // Optimistic pre-check
    const prePayment = await prisma.payment.findFirst({
      where: { id: paymentId, tenantId: tenantContext.tenantId },
      select: { id: true, status: true, paymentNumber: true, invoiceId: true },
    });

    if (!prePayment) {
      return { success: false, error: 'Payment not found in this workspace.' };
    }

    if (prePayment.status !== PaymentStatus.COMPLETED) {
      return {
        success: false,
        error: `Cannot refund a payment in "${prePayment.status}" status. Only COMPLETED payments can be refunded.`,
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      // ── SAFETY: Re-read Payment inside transaction ──────────────────────────
      const livePayment = await tx.payment.findUnique({
        where: { id: paymentId },
        select: {
          id: true,
          tenantId: true,
          status: true,
          amount: true,
          paymentNumber: true,
          invoiceId: true,
        },
      });

      if (!livePayment) throw new Error('Payment not found.');

      // Tenant verification inside tx
      if (livePayment.tenantId !== tenantContext.tenantId) {
        throw new Error('Cross-tenant payment refund rejected.');
      }

      // Double-refund prevention: check status inside tx
      if (livePayment.status !== PaymentStatus.COMPLETED) {
        throw new Error(
          `Cannot refund: payment status is "${livePayment.status}". ` +
          'This payment may have already been refunded.'
        );
      }
      // ─────────────────────────────────────────────────────────────────────

      // ── Re-read Invoice inside transaction ────────────────────────────────
      const liveInvoice = await tx.invoice.findUnique({
        where: { id: livePayment.invoiceId },
        select: {
          id: true,
          tenantId: true,
          total: true,
          paidAmount: true,
          balance: true,
          dueDate: true,
          invoiceNumber: true,
          status: true,
        },
      });

      if (!liveInvoice) throw new Error('Associated invoice not found.');
      if (liveInvoice.tenantId !== tenantContext.tenantId) {
        throw new Error('Cross-tenant invoice access rejected during refund.');
      }
      // ─────────────────────────────────────────────────────────────────────

      const refundAmount = new Prisma.Decimal(livePayment.amount.toString());

      // Recalculate invoice balances after refund
      const newPaidAmount = new Prisma.Decimal(liveInvoice.paidAmount.toString()).sub(refundAmount);
      const safeNewPaid = newPaidAmount.lessThan(0) ? new Prisma.Decimal('0.00') : newPaidAmount;
      const newBalance = new Prisma.Decimal(liveInvoice.total.toString()).sub(safeNewPaid);

      // Recalculate new invoice status post-refund
      const newStatus = determinePostRefundInvoiceStatus(
        liveInvoice.total,
        safeNewPaid,
        liveInvoice.dueDate,
        liveInvoice.status
      );

      // 8. Mark original payment as REFUNDED (preserve history)
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.REFUNDED },
      });

      // 6-7. Update Invoice
      await tx.invoice.update({
        where: { id: livePayment.invoiceId },
        data: {
          paidAmount: safeNewPaid,
          balance: newBalance,
          status: newStatus,
        },
      });

      // 9. Create offsetting negative REVENUE LedgerEntry (immutable append)
      await tx.ledgerEntry.create({
        data: {
          tenantId: tenantContext.tenantId,
          type: LedgerEntryType.REVENUE,
          amount: refundAmount.negated(), // negative amount = credit reversal
          entryDate: new Date(),
          description: `Refund of Payment ${livePayment.paymentNumber} for Invoice ${liveInvoice.invoiceNumber}${reason ? `: ${reason}` : ''}`,
          referenceType: 'REFUND',
          referenceId: paymentId,
          invoiceId: livePayment.invoiceId,
          paymentId,
          createdByUserId: tenantContext.userId,
        },
      });

      return {
        paymentNumber: livePayment.paymentNumber,
        invoiceNumber: liveInvoice.invoiceNumber,
        newInvoiceStatus: newStatus,
      };
    });

    revalidatePath(`/${orgSlug}/finance`);
    revalidatePath(`/${orgSlug}/finance/invoices`);
    revalidatePath(`/${orgSlug}/finance/invoices/${prePayment.invoiceId}`);
    revalidatePath(`/${orgSlug}/finance/payments`);

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'PAYMENT_REFUNDED',
      entity: 'PAYMENT',
      entityId: paymentId,
      metadata: {
        paymentNumber: result.paymentNumber,
        invoiceNumber: result.invoiceNumber,
        reason,
      },
    });

    return {
      success: true,
      message: `Payment ${result.paymentNumber} has been refunded. Invoice ${result.invoiceNumber} is now ${result.newInvoiceStatus}.`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to refund payment.',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Refund-specific status determination helper
// PAID invoice after partial refund → PARTIALLY_PAID
// Full refund (paidAmount = 0) → ISSUED or OVERDUE depending on due date
// ─────────────────────────────────────────────────────────────────────────────
function determinePostRefundInvoiceStatus(
  total: Prisma.Decimal,
  paidAmount: Prisma.Decimal,
  dueDate: Date | null,
  previousStatus: InvoiceStatus
): InvoiceStatus {
  const decTotal = new Prisma.Decimal(total.toString());
  const decPaid = new Prisma.Decimal(paidAmount.toString());

  if (decPaid.greaterThanOrEqualTo(decTotal) && decTotal.greaterThan(0)) {
    return InvoiceStatus.PAID;
  }

  if (decPaid.greaterThan(0) && decPaid.lessThan(decTotal)) {
    return InvoiceStatus.PARTIALLY_PAID;
  }

  // paidAmount == 0 — determine based on due date
  if (dueDate && new Date(dueDate).getTime() < Date.now()) {
    return InvoiceStatus.OVERDUE;
  }

  // Default: revert to ISSUED (was previously ISSUED/PARTIALLY_PAID/OVERDUE)
  if (
    previousStatus === InvoiceStatus.OVERDUE ||
    previousStatus === InvoiceStatus.PARTIALLY_PAID ||
    previousStatus === InvoiceStatus.PAID
  ) {
    return InvoiceStatus.ISSUED;
  }

  return previousStatus;
}
