import { describe, it, expect } from 'vitest';
import { InvoiceStatus } from '@prisma/client';
import {
  calculateLineTotal,
  calculateInvoiceSummary,
  calculatePaymentBalance,
  determineInvoicePaymentStatus,
} from '@/lib/utils/finance-calculations';

describe('Financial Calculation Utilities', () => {
  describe('calculateLineTotal', () => {
    it('calculates line total for integer prices', () => {
      const total = calculateLineTotal(3, 50);
      expect(total.toString()).toBe('150');
      expect(total.toFixed(2)).toBe('150.00');
    });

    it('calculates line total for fractional prices with exact 2-decimal precision', () => {
      const total = calculateLineTotal(3, 19.99);
      expect(total.toFixed(2)).toBe('59.97');
    });

    it('handles zero quantity safely', () => {
      const total = calculateLineTotal(0, 99.99);
      expect(total.toFixed(2)).toBe('0.00');
    });

    it('treats negative quantity as zero', () => {
      const total = calculateLineTotal(-5, 99.99);
      expect(total.toFixed(2)).toBe('0.00');
    });
  });

  describe('calculateInvoiceSummary', () => {
    it('computes subtotal from multiple line items with zero tax and zero discount', () => {
      const items = [
        { quantity: 2, unitPrice: 25.0 }, // 50.00
        { quantity: 1, unitPrice: 100.0 }, // 100.00
        { quantity: 4, unitPrice: 12.5 }, // 50.00
      ];

      const summary = calculateInvoiceSummary(items, 0, 0);
      expect(summary.subtotal.toFixed(2)).toBe('200.00');
      expect(summary.discount.toFixed(2)).toBe('0.00');
      expect(summary.taxAmount.toFixed(2)).toBe('0.00');
      expect(summary.total.toFixed(2)).toBe('200.00');
    });

    it('applies standard tax rate accurately', () => {
      const items = [{ quantity: 1, unitPrice: 100.0 }];
      const summary = calculateInvoiceSummary(items, 8.25, 0);

      expect(summary.subtotal.toFixed(2)).toBe('100.00');
      expect(summary.taxAmount.toFixed(2)).toBe('8.25');
      expect(summary.total.toFixed(2)).toBe('108.25');
    });

    it('applies discount before calculating tax', () => {
      // Subtotal: 100.00, Discount: 20.00 -> Taxable: 80.00, Tax 10%: 8.00 -> Total: 88.00
      const items = [{ quantity: 1, unitPrice: 100.0 }];
      const summary = calculateInvoiceSummary(items, 10.0, 20.0);

      expect(summary.subtotal.toFixed(2)).toBe('100.00');
      expect(summary.discount.toFixed(2)).toBe('20.00');
      expect(summary.taxAmount.toFixed(2)).toBe('8.00');
      expect(summary.total.toFixed(2)).toBe('88.00');
    });

    it('caps discount at subtotal to prevent negative invoice totals', () => {
      const items = [{ quantity: 1, unitPrice: 50.0 }];
      const summary = calculateInvoiceSummary(items, 10.0, 150.0); // discount > subtotal

      expect(summary.subtotal.toFixed(2)).toBe('50.00');
      expect(summary.discount.toFixed(2)).toBe('50.00');
      expect(summary.taxAmount.toFixed(2)).toBe('0.00');
      expect(summary.total.toFixed(2)).toBe('0.00');
    });

    it('ignores negative discount and negative tax rates safely', () => {
      const items = [{ quantity: 2, unitPrice: 50.0 }]; // 100.00
      const summary = calculateInvoiceSummary(items, -5, -20);

      expect(summary.subtotal.toFixed(2)).toBe('100.00');
      expect(summary.discount.toFixed(2)).toBe('0.00');
      expect(summary.taxAmount.toFixed(2)).toBe('0.00');
      expect(summary.total.toFixed(2)).toBe('100.00');
    });
  });

  describe('calculatePaymentBalance & Overpayment Protection', () => {
    it('calculates balance after first partial payment', () => {
      const result = calculatePaymentBalance(100.0, 0.0, 40.0);

      expect(result.isOverpayment).toBe(false);
      expect(result.newPaidAmount.toFixed(2)).toBe('40.00');
      expect(result.newBalance.toFixed(2)).toBe('60.00');
    });

    it('calculates balance after second partial payment', () => {
      const result = calculatePaymentBalance(100.0, 40.0, 35.0);

      expect(result.isOverpayment).toBe(false);
      expect(result.newPaidAmount.toFixed(2)).toBe('75.00');
      expect(result.newBalance.toFixed(2)).toBe('25.00');
    });

    it('calculates exact zero balance upon full settlement', () => {
      const result = calculatePaymentBalance(100.0, 75.0, 25.0);

      expect(result.isOverpayment).toBe(false);
      expect(result.newPaidAmount.toFixed(2)).toBe('100.00');
      expect(result.newBalance.toFixed(2)).toBe('0.00');
    });

    it('detects overpayment and returns excess amount without mutating balance', () => {
      const result = calculatePaymentBalance(100.0, 75.0, 50.0); // balance is 25, payment is 50

      expect(result.isOverpayment).toBe(true);
      expect(result.excessAmount.toFixed(2)).toBe('25.00');
      expect(result.newPaidAmount.toFixed(2)).toBe('75.00');
      expect(result.newBalance.toFixed(2)).toBe('25.00');
    });
  });

  describe('determineInvoicePaymentStatus', () => {
    const futureDate = new Date(Date.now() + 86400000 * 7); // +7 days
    const pastDate = new Date(Date.now() - 86400000 * 7); // -7 days

    it('returns PAID when paid amount equals or exceeds total', () => {
      expect(determineInvoicePaymentStatus(100.0, 100.0, futureDate)).toBe(
        InvoiceStatus.PAID
      );
      expect(determineInvoicePaymentStatus(100.0, 150.0, pastDate)).toBe(
        InvoiceStatus.PAID
      );
    });

    it('returns PARTIALLY_PAID for partial payment before due date', () => {
      expect(determineInvoicePaymentStatus(100.0, 40.0, futureDate)).toBe(
        InvoiceStatus.PARTIALLY_PAID
      );
    });

    it('returns PARTIALLY_PAID for partial payment even after due date', () => {
      expect(determineInvoicePaymentStatus(100.0, 40.0, pastDate)).toBe(
        InvoiceStatus.PARTIALLY_PAID
      );
    });

    it('returns ISSUED for zero payment before due date', () => {
      expect(determineInvoicePaymentStatus(100.0, 0.0, futureDate)).toBe(
        InvoiceStatus.ISSUED
      );
    });

    it('returns OVERDUE for zero payment after due date', () => {
      expect(determineInvoicePaymentStatus(100.0, 0.0, pastDate)).toBe(
        InvoiceStatus.OVERDUE
      );
    });
  });
});
