import { describe, it, expect } from 'vitest';
import {
  DateRangePreset,
  dateRangeLabels,
  getDateRangeBounds,
} from '@/lib/utils/reports-constants';

describe('Reports Constants & Date Range Bounds', () => {
  const asOf = new Date('2026-08-23T12:00:00.000Z');

  it('should have labels for all date range presets', () => {
    const presets: DateRangePreset[] = [
      'ALL',
      'TODAY',
      '7DAYS',
      '30DAYS',
      'THIS_MONTH',
      'LAST_MONTH',
      'THIS_YEAR',
    ];

    for (const p of presets) {
      expect(dateRangeLabels[p]).toBeDefined();
      expect(typeof dateRangeLabels[p]).toBe('string');
    }
  });

  it('should return empty bounds for ALL preset', () => {
    const bounds = getDateRangeBounds('ALL', asOf);
    expect(bounds.startDate).toBeUndefined();
    expect(bounds.endDate).toBeUndefined();
  });

  it('should return 24-hour UTC span for TODAY preset', () => {
    const bounds = getDateRangeBounds('TODAY', asOf);
    expect(bounds.startDate).toBeDefined();
    expect(bounds.endDate).toBeDefined();
    expect(bounds.startDate?.toISOString()).toBe('2026-08-23T00:00:00.000Z');
    expect(bounds.endDate?.toISOString()).toBe('2026-08-23T23:59:59.999Z');
  });

  it('should return 7-day UTC span for 7DAYS preset', () => {
    const bounds = getDateRangeBounds('7DAYS', asOf);
    expect(bounds.startDate?.toISOString()).toBe('2026-08-17T00:00:00.000Z');
    expect(bounds.endDate?.toISOString()).toBe('2026-08-23T23:59:59.999Z');
  });

  it('should return full current month span for THIS_MONTH preset', () => {
    const bounds = getDateRangeBounds('THIS_MONTH', asOf);
    expect(bounds.startDate?.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(bounds.endDate?.toISOString()).toBe('2026-08-31T23:59:59.999Z');
  });

  it('should return full previous month span for LAST_MONTH preset', () => {
    const bounds = getDateRangeBounds('LAST_MONTH', asOf);
    expect(bounds.startDate?.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(bounds.endDate?.toISOString()).toBe('2026-07-31T23:59:59.999Z');
  });

  it('should return full year span for THIS_YEAR preset', () => {
    const bounds = getDateRangeBounds('THIS_YEAR', asOf);
    expect(bounds.startDate?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(bounds.endDate?.toISOString()).toBe('2026-12-31T23:59:59.999Z');
  });
});
