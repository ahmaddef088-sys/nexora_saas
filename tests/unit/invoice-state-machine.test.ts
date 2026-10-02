import { describe, it, expect } from 'vitest';
import { InvoiceStatus } from '@prisma/client';
import { isValidInvoiceStatusTransition } from '@/lib/auth/finance-auth';

describe('Invoice State Machine Transition Rules', () => {
  describe('Valid State Transitions', () => {
    it('allows DRAFT -> ISSUED', () => {
      expect(
        isValidInvoiceStatusTransition(InvoiceStatus.DRAFT, InvoiceStatus.ISSUED)
      ).toBe(true);
    });

    it('allows DRAFT -> VOIDED', () => {
      expect(
        isValidInvoiceStatusTransition(InvoiceStatus.DRAFT, InvoiceStatus.VOIDED)
      ).toBe(true);
    });

    it('allows ISSUED -> PARTIALLY_PAID', () => {
      expect(
        isValidInvoiceStatusTransition(
          InvoiceStatus.ISSUED,
          InvoiceStatus.PARTIALLY_PAID
        )
      ).toBe(true);
    });

    it('allows ISSUED -> PAID', () => {
      expect(
        isValidInvoiceStatusTransition(InvoiceStatus.ISSUED, InvoiceStatus.PAID)
      ).toBe(true);
    });

    it('allows ISSUED -> OVERDUE', () => {
      expect(
        isValidInvoiceStatusTransition(
          InvoiceStatus.ISSUED,
          InvoiceStatus.OVERDUE
        )
      ).toBe(true);
    });

    it('allows ISSUED -> VOIDED', () => {
      expect(
        isValidInvoiceStatusTransition(
          InvoiceStatus.ISSUED,
          InvoiceStatus.VOIDED
        )
      ).toBe(true);
    });

    it('allows PARTIALLY_PAID -> PAID', () => {
      expect(
        isValidInvoiceStatusTransition(
          InvoiceStatus.PARTIALLY_PAID,
          InvoiceStatus.PAID
        )
      ).toBe(true);
    });

    it('allows PARTIALLY_PAID -> OVERDUE', () => {
      expect(
        isValidInvoiceStatusTransition(
          InvoiceStatus.PARTIALLY_PAID,
          InvoiceStatus.OVERDUE
        )
      ).toBe(true);
    });

    it('allows OVERDUE -> PARTIALLY_PAID', () => {
      expect(
        isValidInvoiceStatusTransition(
          InvoiceStatus.OVERDUE,
          InvoiceStatus.PARTIALLY_PAID
        )
      ).toBe(true);
    });

    it('allows OVERDUE -> PAID', () => {
      expect(
        isValidInvoiceStatusTransition(
          InvoiceStatus.OVERDUE,
          InvoiceStatus.PAID
        )
      ).toBe(true);
    });

    it('allows OVERDUE -> VOIDED', () => {
      expect(
        isValidInvoiceStatusTransition(
          InvoiceStatus.OVERDUE,
          InvoiceStatus.VOIDED
        )
      ).toBe(true);
    });
  });

  describe('Invalid State Transitions', () => {
    it('rejects self-transitions (no-op transitions)', () => {
      const allStatuses = [
        InvoiceStatus.DRAFT,
        InvoiceStatus.ISSUED,
        InvoiceStatus.PARTIALLY_PAID,
        InvoiceStatus.PAID,
        InvoiceStatus.OVERDUE,
        InvoiceStatus.VOIDED,
      ];

      for (const status of allStatuses) {
        expect(isValidInvoiceStatusTransition(status, status)).toBe(false);
      }
    });

    it('rejects paying a DRAFT invoice directly', () => {
      expect(
        isValidInvoiceStatusTransition(
          InvoiceStatus.DRAFT,
          InvoiceStatus.PARTIALLY_PAID
        )
      ).toBe(false);
      expect(
        isValidInvoiceStatusTransition(InvoiceStatus.DRAFT, InvoiceStatus.PAID)
      ).toBe(false);
      expect(
        isValidInvoiceStatusTransition(
          InvoiceStatus.DRAFT,
          InvoiceStatus.OVERDUE
        )
      ).toBe(false);
    });

    it('rejects reverting ISSUED back to DRAFT', () => {
      expect(
        isValidInvoiceStatusTransition(InvoiceStatus.ISSUED, InvoiceStatus.DRAFT)
      ).toBe(false);
    });

    it('rejects reverting PARTIALLY_PAID back to DRAFT or ISSUED or VOIDED directly', () => {
      expect(
        isValidInvoiceStatusTransition(
          InvoiceStatus.PARTIALLY_PAID,
          InvoiceStatus.DRAFT
        )
      ).toBe(false);
      expect(
        isValidInvoiceStatusTransition(
          InvoiceStatus.PARTIALLY_PAID,
          InvoiceStatus.ISSUED
        )
      ).toBe(false);
      expect(
        isValidInvoiceStatusTransition(
          InvoiceStatus.PARTIALLY_PAID,
          InvoiceStatus.VOIDED
        )
      ).toBe(false);
    });

    it('enforces PAID as a terminal state with no valid transitions', () => {
      const targetStatuses = [
        InvoiceStatus.DRAFT,
        InvoiceStatus.ISSUED,
        InvoiceStatus.PARTIALLY_PAID,
        InvoiceStatus.OVERDUE,
        InvoiceStatus.VOIDED,
      ];

      for (const target of targetStatuses) {
        expect(isValidInvoiceStatusTransition(InvoiceStatus.PAID, target)).toBe(
          false
        );
      }
    });

    it('enforces VOIDED as a terminal state with no valid transitions', () => {
      const targetStatuses = [
        InvoiceStatus.DRAFT,
        InvoiceStatus.ISSUED,
        InvoiceStatus.PARTIALLY_PAID,
        InvoiceStatus.PAID,
        InvoiceStatus.OVERDUE,
      ];

      for (const target of targetStatuses) {
        expect(
          isValidInvoiceStatusTransition(InvoiceStatus.VOIDED, target)
        ).toBe(false);
      }
    });
  });
});
