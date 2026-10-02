/**
 * Phase 6 — General Ledger: Unit Tests
 *
 * Tests the ledger formatting, badge classifications, and calculation behaviors:
 * - Badge categorization for REVENUE, REFUND, EXPENSE, REVERSAL, and CORRECTION
 * - Negative and positive amount handling for ledger entries
 * - Reference type label mappings
 */

import { describe, it, expect } from 'vitest';
import { LedgerEntryType } from '@prisma/client';
import {
  getLedgerEntryBadge,
  ledgerEntryTypeLabels,
  ledgerReferenceTypeLabels,
} from '@/lib/utils/ledger-constants';

describe('General Ledger Constants & Badge Classification', () => {
  it('correctly maps LedgerEntryType labels', () => {
    expect(ledgerEntryTypeLabels[LedgerEntryType.REVENUE]).toBe('Revenue');
    expect(ledgerEntryTypeLabels[LedgerEntryType.EXPENSE]).toBe('Expense');
  });

  it('correctly maps known referenceType labels', () => {
    expect(ledgerReferenceTypeLabels['PAYMENT']).toBe('Payment Receipt');
    expect(ledgerReferenceTypeLabels['REFUND']).toBe('Payment Refund (Reversal)');
    expect(ledgerReferenceTypeLabels['EXPENSE']).toBe('Expense Voucher');
    expect(ledgerReferenceTypeLabels['EXPENSE_CORRECTION_REVERSAL']).toBe(
      'Expense Adjustment (Reversal)'
    );
    expect(ledgerReferenceTypeLabels['EXPENSE_CORRECTION']).toBe(
      'Expense Adjustment (Corrected)'
    );
    expect(ledgerReferenceTypeLabels['EXPENSE_DELETION']).toBe(
      'Expense Deletion (Reversal)'
    );
  });

  describe('getLedgerEntryBadge classification', () => {
    it('classifies positive revenue entry as REVENUE', () => {
      const badge = getLedgerEntryBadge(LedgerEntryType.REVENUE, 'PAYMENT', 500.0);
      expect(badge.label).toBe('REVENUE');
      expect(badge.isNegative).toBe(false);
      expect(badge.cls).toContain('emerald');
    });

    it('classifies refund entry as REFUND with isNegative = true', () => {
      const badge = getLedgerEntryBadge(LedgerEntryType.REVENUE, 'REFUND', -500.0);
      expect(badge.label).toBe('REFUND');
      expect(badge.isNegative).toBe(true);
      expect(badge.cls).toContain('amber');
    });

    it('classifies regular expense entry as EXPENSE', () => {
      const badge = getLedgerEntryBadge(LedgerEntryType.EXPENSE, 'EXPENSE', 150.0);
      expect(badge.label).toBe('EXPENSE');
      expect(badge.isNegative).toBe(false);
      expect(badge.cls).toContain('rose');
    });

    it('classifies expense correction reversal as REVERSAL with isNegative = true', () => {
      const badge = getLedgerEntryBadge(
        LedgerEntryType.EXPENSE,
        'EXPENSE_CORRECTION_REVERSAL',
        -150.0
      );
      expect(badge.label).toBe('REVERSAL');
      expect(badge.isNegative).toBe(true);
      expect(badge.cls).toContain('blue');
    });

    it('classifies expense correction entry as CORRECTION', () => {
      const badge = getLedgerEntryBadge(
        LedgerEntryType.EXPENSE,
        'EXPENSE_CORRECTION',
        180.0
      );
      expect(badge.label).toBe('CORRECTION');
      expect(badge.isNegative).toBe(false);
      expect(badge.cls).toContain('purple');
    });

    it('classifies expense deletion entry as REVERSAL with isNegative = true', () => {
      const badge = getLedgerEntryBadge(
        LedgerEntryType.EXPENSE,
        'EXPENSE_DELETION',
        -200.0
      );
      expect(badge.label).toBe('REVERSAL');
      expect(badge.isNegative).toBe(true);
      expect(badge.cls).toContain('blue');
    });
  });
});
