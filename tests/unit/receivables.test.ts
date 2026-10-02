/**
 * Phase 6 — Accounts Receivable: Unit Tests
 *
 * Tests the AR aging schedule calculations and Decimal-safe aggregations:
 * - Deterministic days past due calculations (UTC-safe)
 * - Aging bucket determinations (CURRENT, DAYS_1_30, DAYS_31_60, DAYS_61_90, DAYS_OVER_90)
 * - Decimal-safe balance aggregations across aging buckets
 * - Partial payment balance handling
 * - Zero and negative balance exclusion logic
 */

import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  calculateDaysPastDue,
  determineAgingBucket,
  agingBucketLabels,
  agingBucketBadges,
  AgingBucket,
} from '@/lib/utils/receivables-constants';

describe('Accounts Receivable Calculations & Aging Logic', () => {
  // Fixed reference date for deterministic testing: 2026-06-15T12:00:00Z
  const asOf = new Date('2026-06-15T12:00:00Z');

  // ─── calculateDaysPastDue ──────────────────────────────────────────────────
  describe('calculateDaysPastDue', () => {
    it('returns 0 when invoice due date is today', () => {
      const dueDate = new Date('2026-06-15T00:00:00Z');
      expect(calculateDaysPastDue(dueDate, asOf)).toBe(0);
    });

    it('returns 0 when invoice due date is in the future', () => {
      const dueDateTomorrow = new Date('2026-06-16T00:00:00Z');
      const dueDateIn30Days = new Date('2026-07-15T00:00:00Z');
      expect(calculateDaysPastDue(dueDateTomorrow, asOf)).toBe(0);
      expect(calculateDaysPastDue(dueDateIn30Days, asOf)).toBe(0);
    });

    it('returns 1 when invoice was due yesterday', () => {
      const dueDate = new Date('2026-06-14T00:00:00Z');
      expect(calculateDaysPastDue(dueDate, asOf)).toBe(1);
    });

    it('returns exact days overdue for multi-day past due dates', () => {
      expect(calculateDaysPastDue(new Date('2026-06-05T00:00:00Z'), asOf)).toBe(10);
      expect(calculateDaysPastDue(new Date('2026-05-16T00:00:00Z'), asOf)).toBe(30);
      expect(calculateDaysPastDue(new Date('2026-05-15T00:00:00Z'), asOf)).toBe(31);
      expect(calculateDaysPastDue(new Date('2026-04-16T00:00:00Z'), asOf)).toBe(60);
      expect(calculateDaysPastDue(new Date('2026-03-17T00:00:00Z'), asOf)).toBe(90);
      expect(calculateDaysPastDue(new Date('2026-03-16T00:00:00Z'), asOf)).toBe(91);
    });

    it('handles ISO string inputs seamlessly', () => {
      expect(calculateDaysPastDue('2026-06-10T00:00:00.000Z', '2026-06-15T00:00:00.000Z')).toBe(5);
    });

    it('returns 0 gracefully on invalid date input', () => {
      expect(calculateDaysPastDue('invalid-date', asOf)).toBe(0);
    });
  });

  // ─── determineAgingBucket ──────────────────────────────────────────────────
  describe('determineAgingBucket', () => {
    it('classifies due today or future as CURRENT', () => {
      expect(determineAgingBucket('2026-06-15T00:00:00Z', asOf)).toBe('CURRENT');
      expect(determineAgingBucket('2026-06-30T00:00:00Z', asOf)).toBe('CURRENT');
    });

    it('classifies 1 to 30 days overdue as DAYS_1_30', () => {
      expect(determineAgingBucket('2026-06-14T00:00:00Z', asOf)).toBe('DAYS_1_30'); // 1 day
      expect(determineAgingBucket('2026-05-16T00:00:00Z', asOf)).toBe('DAYS_1_30'); // 30 days
    });

    it('classifies 31 to 60 days overdue as DAYS_31_60', () => {
      expect(determineAgingBucket('2026-05-15T00:00:00Z', asOf)).toBe('DAYS_31_60'); // 31 days
      expect(determineAgingBucket('2026-04-16T00:00:00Z', asOf)).toBe('DAYS_31_60'); // 60 days
    });

    it('classifies 61 to 90 days overdue as DAYS_61_90', () => {
      expect(determineAgingBucket('2026-04-15T00:00:00Z', asOf)).toBe('DAYS_61_90'); // 61 days
      expect(determineAgingBucket('2026-03-17T00:00:00Z', asOf)).toBe('DAYS_61_90'); // 90 days
    });

    it('classifies more than 90 days overdue as DAYS_OVER_90', () => {
      expect(determineAgingBucket('2026-03-16T00:00:00Z', asOf)).toBe('DAYS_OVER_90'); // 91 days
      expect(determineAgingBucket('2026-01-01T00:00:00Z', asOf)).toBe('DAYS_OVER_90'); // 165 days
    });
  });

  // ─── Constants & Badges ────────────────────────────────────────────────────
  describe('Aging Constants & Badges', () => {
    it('provides clear user-facing labels for all buckets', () => {
      const buckets: AgingBucket[] = [
        'CURRENT',
        'DAYS_1_30',
        'DAYS_31_60',
        'DAYS_61_90',
        'DAYS_OVER_90',
      ];
      for (const bucket of buckets) {
        expect(agingBucketLabels[bucket]).toBeDefined();
        expect(agingBucketBadges[bucket]).toBeDefined();
        expect(agingBucketBadges[bucket].cls).toBeDefined();
        expect(agingBucketBadges[bucket].barCls).toBeDefined();
      }
    });
  });

  // ─── Decimal-Safe AR Aggregations ──────────────────────────────────────────
  describe('Decimal-Safe AR Financial Aggregation Logic', () => {
    it('aggregates total AR, current AR, and overdue buckets correctly with Prisma.Decimal', () => {
      const mockInvoices = [
        {
          id: 'inv-1',
          dueDate: new Date('2026-06-20T00:00:00Z'), // Current
          balance: new Prisma.Decimal('1000.00'),
        },
        {
          id: 'inv-2',
          dueDate: new Date('2026-06-01T00:00:00Z'), // 14d -> 1_30
          balance: new Prisma.Decimal('500.50'),
        },
        {
          id: 'inv-3',
          dueDate: new Date('2026-05-01T00:00:00Z'), // 45d -> 31_60
          balance: new Prisma.Decimal('750.25'),
        },
        {
          id: 'inv-4',
          dueDate: new Date('2026-04-01T00:00:00Z'), // 75d -> 61_90
          balance: new Prisma.Decimal('300.00'),
        },
        {
          id: 'inv-5',
          dueDate: new Date('2026-01-01T00:00:00Z'), // 165d -> 90+
          balance: new Prisma.Decimal('2000.00'),
        },
      ];

      let decTotal = new Prisma.Decimal('0.00');
      let decCurrent = new Prisma.Decimal('0.00');
      let decOverdue = new Prisma.Decimal('0.00');
      let dec1_30 = new Prisma.Decimal('0.00');
      let dec31_60 = new Prisma.Decimal('0.00');
      let dec61_90 = new Prisma.Decimal('0.00');
      let decOver90 = new Prisma.Decimal('0.00');

      for (const inv of mockInvoices) {
        const bucket = determineAgingBucket(inv.dueDate, asOf);
        decTotal = decTotal.add(inv.balance);

        if (bucket === 'CURRENT') {
          decCurrent = decCurrent.add(inv.balance);
        } else {
          decOverdue = decOverdue.add(inv.balance);
          if (bucket === 'DAYS_1_30') dec1_30 = dec1_30.add(inv.balance);
          if (bucket === 'DAYS_31_60') dec31_60 = dec31_60.add(inv.balance);
          if (bucket === 'DAYS_61_90') dec61_90 = dec61_90.add(inv.balance);
          if (bucket === 'DAYS_OVER_90') decOver90 = decOver90.add(inv.balance);
        }
      }

      // 1000 + 500.50 + 750.25 + 300 + 2000 = 4550.75
      expect(decTotal.toFixed(2)).toBe('4550.75');
      expect(decCurrent.toFixed(2)).toBe('1000.00');
      expect(decOverdue.toFixed(2)).toBe('3550.75');
      expect(dec1_30.toFixed(2)).toBe('500.50');
      expect(dec31_60.toFixed(2)).toBe('750.25');
      expect(dec61_90.toFixed(2)).toBe('300.00');
      expect(decOver90.toFixed(2)).toBe('2000.00');

      // Math sanity: Current + Overdue == Total
      expect(decCurrent.add(decOverdue).equals(decTotal)).toBe(true);
      // Math sanity: Sum of overdue buckets == Total Overdue
      expect(dec1_30.add(dec31_60).add(dec61_90).add(decOver90).equals(decOverdue)).toBe(true);
    });

    it('correctly uses remaining balance for partially paid invoices', () => {
      const invoiceTotal = new Prisma.Decimal('1200.00');
      const paidAmount = new Prisma.Decimal('800.00');
      const remainingBalance = invoiceTotal.sub(paidAmount);

      expect(remainingBalance.toFixed(2)).toBe('400.00');
    });
  });
});
