/**
 * Shared Accounts Receivable constants, aging definitions, and date calculation utilities.
 * Intentionally NOT marked 'use client' so it can be safely imported by both
 * Server and Client components without triggering React Server Components bundling errors.
 */

export type AgingBucket =
  | 'CURRENT'
  | 'DAYS_1_30'
  | 'DAYS_31_60'
  | 'DAYS_61_90'
  | 'DAYS_OVER_90';

export const agingBucketLabels: Record<AgingBucket, string> = {
  CURRENT: 'Current (Not Due)',
  DAYS_1_30: '1–30 Days Past Due',
  DAYS_31_60: '31–60 Days Past Due',
  DAYS_61_90: '61–90 Days Past Due',
  DAYS_OVER_90: '90+ Days Past Due',
};

export const agingBucketBadges: Record<
  AgingBucket,
  { label: string; shortLabel: string; cls: string; barCls: string }
> = {
  CURRENT: {
    label: 'Current (Not Due)',
    shortLabel: 'Current',
    cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    barCls: 'bg-emerald-500',
  },
  DAYS_1_30: {
    label: '1–30 Days Overdue',
    shortLabel: '1–30d',
    cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    barCls: 'bg-amber-500',
  },
  DAYS_31_60: {
    label: '31–60 Days Overdue',
    shortLabel: '31–60d',
    cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    barCls: 'bg-orange-500',
  },
  DAYS_61_90: {
    label: '61–90 Days Overdue',
    shortLabel: '61–90d',
    cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    barCls: 'bg-rose-500',
  },
  DAYS_OVER_90: {
    label: '90+ Days Overdue',
    shortLabel: '90+d',
    cls: 'bg-red-500/10 text-red-400 border-red-500/20',
    barCls: 'bg-red-600',
  },
};

/**
 * Calculate deterministic days past due based on invoice due date and reference asOf date.
 * Returns 0 if due date is today or in the future.
 * Uses UTC midnight normalization to eliminate timezone shifts and Daylight Saving artifacts.
 */
export function calculateDaysPastDue(
  dueDate: Date | string,
  asOfDate: Date | string = new Date()
): number {
  const dDue = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const dAsOf = typeof asOfDate === 'string' ? new Date(asOfDate) : asOfDate;

  if (isNaN(dDue.getTime()) || isNaN(dAsOf.getTime())) {
    return 0;
  }

  // Normalize to UTC calendar day midnights
  const dueMidnight = Date.UTC(
    dDue.getUTCFullYear(),
    dDue.getUTCMonth(),
    dDue.getUTCDate()
  );
  const asOfMidnight = Date.UTC(
    dAsOf.getUTCFullYear(),
    dAsOf.getUTCMonth(),
    dAsOf.getUTCDate()
  );

  const diffMs = asOfMidnight - dueMidnight;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Categorize an invoice into an aging bucket based on its due date.
 */
export function determineAgingBucket(
  dueDate: Date | string,
  asOfDate: Date | string = new Date()
): AgingBucket {
  const daysPastDue = calculateDaysPastDue(dueDate, asOfDate);

  if (daysPastDue === 0) {
    return 'CURRENT';
  }
  if (daysPastDue <= 30) {
    return 'DAYS_1_30';
  }
  if (daysPastDue <= 60) {
    return 'DAYS_31_60';
  }
  if (daysPastDue <= 90) {
    return 'DAYS_61_90';
  }
  return 'DAYS_OVER_90';
}
