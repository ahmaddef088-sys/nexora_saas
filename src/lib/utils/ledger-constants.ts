/**
 * Shared ledger constants and display definitions.
 * Intentionally NOT marked 'use client' so it can be safely imported by both
 * Server and Client components without triggering React Server Components bundling errors.
 */
import { LedgerEntryType } from '@prisma/client';

export const ledgerEntryTypeLabels: Record<LedgerEntryType, string> = {
  REVENUE: 'Revenue',
  EXPENSE: 'Expense',
};

export const ledgerReferenceTypeLabels: Record<string, string> = {
  PAYMENT: 'Payment Receipt',
  REFUND: 'Payment Refund (Reversal)',
  EXPENSE: 'Expense Voucher',
  EXPENSE_CORRECTION_REVERSAL: 'Expense Adjustment (Reversal)',
  EXPENSE_CORRECTION: 'Expense Adjustment (Corrected)',
  EXPENSE_DELETION: 'Expense Deletion (Reversal)',
};

export function getLedgerEntryBadge(
  type: LedgerEntryType,
  referenceType: string,
  amountNumber: number
): { label: string; cls: string; isNegative: boolean } {
  const isNegative = amountNumber < 0;

  if (type === LedgerEntryType.REVENUE) {
    if (isNegative || referenceType === 'REFUND') {
      return {
        label: 'REFUND',
        cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        isNegative: true,
      };
    }
    return {
      label: 'REVENUE',
      cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      isNegative: false,
    };
  }

  // EXPENSE
  if (isNegative || referenceType === 'EXPENSE_CORRECTION_REVERSAL' || referenceType === 'EXPENSE_DELETION') {
    return {
      label: 'REVERSAL',
      cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      isNegative: true,
    };
  }

  if (referenceType === 'EXPENSE_CORRECTION') {
    return {
      label: 'CORRECTION',
      cls: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      isNegative: false,
    };
  }

  return {
    label: 'EXPENSE',
    cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    isNegative: false,
  };
}
