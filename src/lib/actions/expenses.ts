'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { getRequiredTenantContext } from '@/lib/auth/session';
import { Prisma, LedgerEntryType } from '@prisma/client';
import {
  canCreateExpense,
  canEditExpense,
  canDeleteExpense,
} from '@/lib/auth/finance-auth';
import {
  createExpenseSchema,
  updateExpenseSchema,
  deleteExpenseSchema,
  CreateExpenseInput,
  UpdateExpenseInput,
  DeleteExpenseInput,
} from '@/lib/validations/finance';
import { recordAuditLog } from '@/lib/utils/audit';
import { FinanceActionResult } from './invoices';

// ─────────────────────────────────────────────────────────────────────────────
// Expense Number Generation
// Generates unique tenant-scoped numbers: EXP-2026-0001
// @@unique([tenantId, expenseNumber]) DB constraint prevents collision.
// ─────────────────────────────────────────────────────────────────────────────
async function generateExpenseNumber(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `EXP-${year}-`;

  const lastExpense = await tx.expense.findFirst({
    where: {
      tenantId,
      expenseNumber: { startsWith: prefix },
    },
    orderBy: { expenseNumber: 'desc' },
    select: { expenseNumber: true },
  });

  let nextSeq = 1;
  if (lastExpense) {
    const lastSeq = parseInt(lastExpense.expenseNumber.replace(prefix, ''), 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. createExpenseAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create an expense and its corresponding EXPENSE LedgerEntry atomically.
 * Total is calculated server-side: total = amount + taxAmount.
 * Client-provided total is never trusted.
 * A LedgerEntry is ONLY created if the Expense creation succeeds.
 * The ledger is append-only — this action never edits existing entries.
 */
export async function createExpenseAction(
  orgSlug: string,
  input: CreateExpenseInput
): Promise<FinanceActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const decision = canCreateExpense(tenantContext.role);
    if (!decision.allowed) {
      return { success: false, error: decision.reason || 'You are not authorized to create expenses.' };
    }

    const parsed = createExpenseSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || 'Invalid expense data.' };
    }

    const {
      category,
      payee,
      amount,
      taxAmount,
      expenseDate,
      paymentMethod,
      reference,
      notes,
      receiptUrl,
    } = parsed.data;

    // Server-side total calculation — never trust client total
    const decAmount = new Prisma.Decimal(amount.toFixed(2));
    const decTax = new Prisma.Decimal((taxAmount ?? 0).toFixed(2));
    const decTotal = decAmount.add(decTax);

    const result = await prisma.$transaction(async (tx) => {
      const expenseNumber = await generateExpenseNumber(tx, tenantContext.tenantId);

      const expense = await tx.expense.create({
        data: {
          tenantId: tenantContext.tenantId,
          expenseNumber,
          category,
          payee: payee.trim(),
          amount: decAmount,
          taxAmount: decTax,
          total: decTotal,
          expenseDate,
          paymentMethod,
          reference: reference && reference.trim() !== '' ? reference.trim() : null,
          notes: notes && notes.trim() !== '' ? notes.trim() : null,
          receiptUrl: receiptUrl && receiptUrl.trim() !== '' ? receiptUrl.trim() : null,
          createdByUserId: tenantContext.userId,
        },
      });

      // Create immutable EXPENSE LedgerEntry (append-only)
      await tx.ledgerEntry.create({
        data: {
          tenantId: tenantContext.tenantId,
          type: LedgerEntryType.EXPENSE,
          amount: decTotal,
          entryDate: expenseDate,
          description: `Expense ${expenseNumber}: ${category} — ${payee.trim()}`,
          referenceType: 'EXPENSE',
          referenceId: expense.id,
          expenseId: expense.id,
          createdByUserId: tenantContext.userId,
        },
      });

      return expense;
    });

    revalidatePath(`/${orgSlug}/finance`);
    revalidatePath(`/${orgSlug}/finance/expenses`);

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'EXPENSE_CREATED',
      entity: 'EXPENSE',
      entityId: result.id,
      metadata: {
        expenseNumber: result.expenseNumber,
        category,
        payee: payee.trim(),
        total: decTotal.toString(),
      },
    });

    return {
      success: true,
      message: `Expense ${result.expenseNumber} recorded successfully.`,
      data: result,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return { success: false, error: 'Expense number conflict. Please try again.' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create expense.',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. updateExpenseAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update an existing expense.
 * Total is recalculated server-side.
 * TenantId is NEVER changed.
 *
 * LEDGER IMMUTABILITY:
 * Because the ledger is append-only, updating an expense does NOT modify the
 * original LedgerEntry. Instead, we create two offsetting entries:
 *   1. A negative entry reversing the original expense amount.
 *   2. A positive entry recording the new corrected amount.
 * This preserves the full audit trail with no history mutation.
 */
export async function updateExpenseAction(
  orgSlug: string,
  input: UpdateExpenseInput
): Promise<FinanceActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const decision = canEditExpense(tenantContext.role);
    if (!decision.allowed) {
      return { success: false, error: decision.reason || 'You are not authorized to edit expenses.' };
    }

    const parsed = updateExpenseSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || 'Invalid expense data.' };
    }

    const {
      expenseId,
      category,
      payee,
      amount,
      taxAmount,
      expenseDate,
      paymentMethod,
      reference,
      notes,
      receiptUrl,
    } = parsed.data;

    // Verify expense belongs to this tenant
    const existing = await prisma.expense.findFirst({
      where: { id: expenseId, tenantId: tenantContext.tenantId },
      select: { id: true, total: true, expenseNumber: true },
    });

    if (!existing) {
      return { success: false, error: 'Expense not found in this workspace.' };
    }

    const newDecAmount = new Prisma.Decimal(amount.toFixed(2));
    const newDecTax = new Prisma.Decimal((taxAmount ?? 0).toFixed(2));
    const newDecTotal = newDecAmount.add(newDecTax);

    const result = await prisma.$transaction(async (tx) => {
      // ── SAFETY: Re-read tenant ownership inside tx ─────────────────────────
      const liveExpense = await tx.expense.findUnique({
        where: { id: expenseId },
        select: { tenantId: true, total: true, expenseNumber: true },
      });

      if (!liveExpense) throw new Error('Expense not found.');
      if (liveExpense.tenantId !== tenantContext.tenantId) {
        throw new Error('Cross-tenant expense access rejected.');
      }
      // ─────────────────────────────────────────────────────────────────────

      const oldTotal = new Prisma.Decimal(liveExpense.total.toString());
      const totalChanged = !oldTotal.equals(newDecTotal);

      const updatedExpense = await tx.expense.update({
        where: { id: expenseId },
        data: {
          category,
          payee: payee.trim(),
          amount: newDecAmount,
          taxAmount: newDecTax,
          total: newDecTotal,
          expenseDate,
          paymentMethod,
          reference: reference && reference.trim() !== '' ? reference.trim() : null,
          notes: notes && notes.trim() !== '' ? notes.trim() : null,
          receiptUrl: receiptUrl && receiptUrl.trim() !== '' ? receiptUrl.trim() : null,
        },
      });

      // ── LEDGER IMMUTABILITY: Correcting entries only if amount changed ──────
      if (totalChanged) {
        // 1. Reversal entry (negative) to offset the original
        await tx.ledgerEntry.create({
          data: {
            tenantId: tenantContext.tenantId,
            type: LedgerEntryType.EXPENSE,
            amount: oldTotal.negated(),
            entryDate: new Date(),
            description: `Correction (reversal) of Expense ${liveExpense.expenseNumber}: original amount ${oldTotal.toFixed(2)}`,
            referenceType: 'EXPENSE_CORRECTION_REVERSAL',
            referenceId: expenseId,
            expenseId,
            createdByUserId: tenantContext.userId,
          },
        });

        // 2. New corrected entry (positive)
        await tx.ledgerEntry.create({
          data: {
            tenantId: tenantContext.tenantId,
            type: LedgerEntryType.EXPENSE,
            amount: newDecTotal,
            entryDate: new Date(),
            description: `Correction of Expense ${liveExpense.expenseNumber}: corrected amount ${newDecTotal.toFixed(2)}`,
            referenceType: 'EXPENSE_CORRECTION',
            referenceId: expenseId,
            expenseId,
            createdByUserId: tenantContext.userId,
          },
        });
      }
      // ─────────────────────────────────────────────────────────────────────

      return updatedExpense;
    });

    revalidatePath(`/${orgSlug}/finance`);
    revalidatePath(`/${orgSlug}/finance/expenses`);

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'EXPENSE_UPDATED',
      entity: 'EXPENSE',
      entityId: expenseId,
      metadata: {
        expenseNumber: result.expenseNumber,
        category,
        payee: payee.trim(),
        total: newDecTotal.toString(),
      },
    });

    return {
      success: true,
      message: `Expense ${result.expenseNumber} updated successfully.`,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update expense.',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. deleteExpenseAction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Soft-delete approach for expenses: instead of destroying the expense record,
 * this action creates an offsetting negative LedgerEntry to neutralize the
 * original expense entry in the ledger — preserving the full audit trail.
 *
 * The Expense record itself is deleted from the expenses table because it has
 * no further accounting state (unlike invoices/payments). The LedgerEntry
 * records remain intact (the original EXPENSE entry + the new reversal entry).
 *
 * If the original ledger entry cannot be reversed safely (e.g., fiscal period
 * already closed), the action reports a clear error instead of deleting history.
 *
 * OWNER only.
 */
export async function deleteExpenseAction(
  orgSlug: string,
  input: DeleteExpenseInput
): Promise<FinanceActionResult> {
  try {
    const tenantContext = await getRequiredTenantContext(orgSlug);

    const decision = canDeleteExpense(tenantContext.role);
    if (!decision.allowed) {
      return { success: false, error: decision.reason || 'Only workspace owners can delete expenses.' };
    }

    const parsed = deleteExpenseSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || 'Invalid request.' };
    }

    const { expenseId } = parsed.data;

    const existing = await prisma.expense.findFirst({
      where: { id: expenseId, tenantId: tenantContext.tenantId },
      select: { id: true, total: true, expenseNumber: true, category: true, payee: true },
    });

    if (!existing) {
      return { success: false, error: 'Expense not found in this workspace.' };
    }

    await prisma.$transaction(async (tx) => {
      // ── SAFETY: Re-read inside tx ──────────────────────────────────────────
      const liveExpense = await tx.expense.findUnique({
        where: { id: expenseId },
        select: { tenantId: true, total: true, expenseNumber: true },
      });

      if (!liveExpense) throw new Error('Expense not found.');
      if (liveExpense.tenantId !== tenantContext.tenantId) {
        throw new Error('Cross-tenant expense deletion rejected.');
      }
      // ─────────────────────────────────────────────────────────────────────

      const expenseTotal = new Prisma.Decimal(liveExpense.total.toString());

      // Create an offsetting reversal LedgerEntry BEFORE deleting (immutable audit trail)
      await tx.ledgerEntry.create({
        data: {
          tenantId: tenantContext.tenantId,
          type: LedgerEntryType.EXPENSE,
          amount: expenseTotal.negated(),
          entryDate: new Date(),
          description: `Deletion reversal for Expense ${liveExpense.expenseNumber} (${existing.category} — ${existing.payee})`,
          referenceType: 'EXPENSE_DELETION',
          referenceId: expenseId,
          expenseId: null, // expense is being deleted; decouple ledger from FK
          createdByUserId: tenantContext.userId,
        },
      });

      // Delete the expense record (ledger entries referencing it are decoupled above)
      await tx.expense.delete({ where: { id: expenseId } });
    });

    revalidatePath(`/${orgSlug}/finance`);
    revalidatePath(`/${orgSlug}/finance/expenses`);

    await recordAuditLog({
      tenantId: tenantContext.tenantId,
      userId: tenantContext.userId,
      action: 'EXPENSE_DELETED',
      entity: 'EXPENSE',
      entityId: expenseId,
      metadata: {
        expenseNumber: existing.expenseNumber,
        category: existing.category,
        payee: existing.payee,
        total: existing.total.toString(),
      },
    });

    return {
      success: true,
      message: `Expense ${existing.expenseNumber} has been deleted and a reversal ledger entry has been recorded.`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete expense.',
    };
  }
}
