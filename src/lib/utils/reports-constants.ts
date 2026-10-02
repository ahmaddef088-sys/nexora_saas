export type DateRangePreset =
  | 'ALL'
  | 'TODAY'
  | '7DAYS'
  | '30DAYS'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_YEAR';

export interface DateRangeBounds {
  startDate?: Date;
  endDate?: Date;
}

export const dateRangeLabels: Record<DateRangePreset, string> = {
  ALL: 'All Time',
  TODAY: 'Today',
  '7DAYS': 'Last 7 Days',
  '30DAYS': 'Last 30 Days',
  THIS_MONTH: 'This Month',
  LAST_MONTH: 'Last Month',
  THIS_YEAR: 'This Year',
};

/**
 * Calculate UTC-normalized Date bounds for a preset to avoid timezone & DST drift.
 */
export function getDateRangeBounds(
  preset: DateRangePreset,
  asOfDate: Date = new Date()
): DateRangeBounds {
  const current = new Date(asOfDate);
  const nowUtcYear = current.getUTCFullYear();
  const nowUtcMonth = current.getUTCMonth();
  const nowUtcDate = current.getUTCDate();

  switch (preset) {
    case 'TODAY': {
      const start = new Date(Date.UTC(nowUtcYear, nowUtcMonth, nowUtcDate, 0, 0, 0, 0));
      const end = new Date(Date.UTC(nowUtcYear, nowUtcMonth, nowUtcDate, 23, 59, 59, 999));
      return { startDate: start, endDate: end };
    }

    case '7DAYS': {
      const start = new Date(Date.UTC(nowUtcYear, nowUtcMonth, nowUtcDate - 6, 0, 0, 0, 0));
      const end = new Date(Date.UTC(nowUtcYear, nowUtcMonth, nowUtcDate, 23, 59, 59, 999));
      return { startDate: start, endDate: end };
    }

    case '30DAYS': {
      const start = new Date(Date.UTC(nowUtcYear, nowUtcMonth, nowUtcDate - 29, 0, 0, 0, 0));
      const end = new Date(Date.UTC(nowUtcYear, nowUtcMonth, nowUtcDate, 23, 59, 59, 999));
      return { startDate: start, endDate: end };
    }

    case 'THIS_MONTH': {
      const start = new Date(Date.UTC(nowUtcYear, nowUtcMonth, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(nowUtcYear, nowUtcMonth + 1, 0, 23, 59, 59, 999));
      return { startDate: start, endDate: end };
    }

    case 'LAST_MONTH': {
      const start = new Date(Date.UTC(nowUtcYear, nowUtcMonth - 1, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(nowUtcYear, nowUtcMonth, 0, 23, 59, 59, 999));
      return { startDate: start, endDate: end };
    }

    case 'THIS_YEAR': {
      const start = new Date(Date.UTC(nowUtcYear, 0, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(nowUtcYear, 11, 31, 23, 59, 59, 999));
      return { startDate: start, endDate: end };
    }

    case 'ALL':
    default:
      return {};
  }
}
