import { describe, it, expect } from 'vitest';
import {
  auditEntityLabels,
  auditEntityBadges,
  auditActionLabels,
  getAuditActionBadge,
  getAuditEntityBadge,
} from '@/lib/utils/audit-constants';

describe('Audit Constants and Badges', () => {
  it('should have labels for all core business entities', () => {
    const expectedEntities = [
      'MEMBER',
      'CATEGORY',
      'PRODUCT',
      'INVENTORY',
      'CUSTOMER',
      'ORDER',
      'INVOICE',
      'PAYMENT',
      'EXPENSE',
    ];

    for (const entity of expectedEntities) {
      expect(auditEntityLabels[entity]).toBeDefined();
      expect(typeof auditEntityLabels[entity]).toBe('string');
      expect(auditEntityBadges[entity]).toBeDefined();
    }
  });

  it('should map known actions to clear, readable labels', () => {
    expect(auditActionLabels['MEMBER_CREATED']).toBe('Member Added');
    expect(auditActionLabels['ORDER_CONFIRMED']).toBe('Order Confirmed');
    expect(auditActionLabels['INVOICE_ISSUED']).toBe('Invoice Issued');
    expect(auditActionLabels['PAYMENT_RECORDED']).toBe('Payment Recorded');
    expect(auditActionLabels['PAYMENT_REFUNDED']).toBe('Payment Refunded');
    expect(auditActionLabels['EXPENSE_CREATED']).toBe('Expense Logged');
    expect(auditActionLabels['EXPENSE_DELETED']).toBe('Expense Deleted');
  });

  it('should assign destructive badge styles to deletions, cancellations, reversals and voids', () => {
    const deleteBadge = getAuditActionBadge('EXPENSE_DELETED');
    expect(deleteBadge.cls).toContain('text-rose-400');

    const voidBadge = getAuditActionBadge('INVOICE_VOIDED');
    expect(voidBadge.cls).toContain('text-rose-400');

    const refundBadge = getAuditActionBadge('PAYMENT_REFUNDED');
    expect(refundBadge.cls).toContain('text-rose-400');

    const cancelBadge = getAuditActionBadge('ORDER_CANCELLED');
    expect(cancelBadge.cls).toContain('text-rose-400');
  });

  it('should assign positive badge styles to creation, confirmation, completion, and recording', () => {
    const createBadge = getAuditActionBadge('MEMBER_CREATED');
    expect(createBadge.cls).toContain('text-emerald-400');

    const issueBadge = getAuditActionBadge('INVOICE_ISSUED');
    expect(issueBadge.cls).toContain('text-emerald-400');

    const recordBadge = getAuditActionBadge('PAYMENT_RECORDED');
    expect(recordBadge.cls).toContain('text-emerald-400');
  });

  it('should assign warning/amber badge styles to updates and adjustments', () => {
    const updateBadge = getAuditActionBadge('PRODUCT_UPDATED');
    expect(updateBadge.cls).toContain('text-amber-400');

    const adjustBadge = getAuditActionBadge('INVENTORY_ADJUSTED');
    expect(adjustBadge.cls).toContain('text-amber-400');
  });

  it('should return safe fallback badge for unknown actions and entities', () => {
    const unknownAction = getAuditActionBadge('CUSTOM_UNKNOWN_ACTION');
    expect(unknownAction.label).toBe('CUSTOM UNKNOWN ACTION');
    expect(unknownAction.cls).toContain('bg-muted');

    const unknownEntity = getAuditEntityBadge('CUSTOM_UNKNOWN_ENTITY');
    expect(unknownEntity.label).toBe('CUSTOM_UNKNOWN_ENTITY');
    expect(unknownEntity.cls).toContain('bg-muted');
  });
});
