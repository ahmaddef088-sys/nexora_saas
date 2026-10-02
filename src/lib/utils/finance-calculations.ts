import { Prisma, InvoiceStatus } from '@prisma/client';

/**
 * Convert any numeric, string, or Decimal value into a normalized Prisma.Decimal.
 */
export function toDecimal(value: number | string | Prisma.Decimal | null | undefined): Prisma.Decimal {
  if (value === null || value === undefined) {
    return new Prisma.Decimal('0.00');
  }
  if (value instanceof Prisma.Decimal) {
    return value;
  }
  if (typeof value === 'number') {
    if (isNaN(value)) return new Prisma.Decimal('0.00');
    return new Prisma.Decimal(value.toFixed(2));
  }
  const str = value.trim();
  if (str === '') return new Prisma.Decimal('0.00');
  return new Prisma.Decimal(str);
}

/**
 * Calculate the line total for an invoice item: quantity * unitPrice.
 * Ensures strict 2-decimal precision.
 */
export function calculateLineTotal(
  quantity: number,
  unitPrice: number | string | Prisma.Decimal
): Prisma.Decimal {
  const q = Math.max(0, Math.floor(quantity));
  const price = toDecimal(unitPrice);
  const total = price.mul(q);
  return new Prisma.Decimal(total.toFixed(2));
}

export interface InvoiceSummary {
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  total: Prisma.Decimal;
}

/**
 * Compute subtotal, applied discount, tax amount, and total for an invoice.
 * Safe from floating-point inaccuracies.
 *
 * Rules:
 * - Subtotal = sum of all line totals
 * - Applied Discount = min(discount, subtotal) (discount cannot exceed subtotal)
 * - Taxable Subtotal = max(0, Subtotal - Applied Discount)
 * - Tax Amount = round(Taxable Subtotal * (taxRate / 100), 2)
 * - Total = Taxable Subtotal + Tax Amount
 */
export function calculateInvoiceSummary(
  items: Array<{ quantity: number; unitPrice: number | string | Prisma.Decimal }>,
  taxRate: number | string | Prisma.Decimal = 0,
  discount: number | string | Prisma.Decimal = 0
): InvoiceSummary {
  let subtotal = new Prisma.Decimal('0.00');

  for (const item of items) {
    const lineTotal = calculateLineTotal(item.quantity, item.unitPrice);
    subtotal = subtotal.add(lineTotal);
  }

  const reqDiscount = toDecimal(discount);
  // Discount cannot exceed subtotal and cannot be negative
  const validDiscount = reqDiscount.lessThan(0)
    ? new Prisma.Decimal('0.00')
    : reqDiscount.greaterThan(subtotal)
    ? subtotal
    : reqDiscount;

  const taxableSubtotal = subtotal.sub(validDiscount);

  const rate = toDecimal(taxRate);
  const validTaxRate = rate.lessThan(0)
    ? new Prisma.Decimal('0.00')
    : rate.greaterThan(100)
    ? new Prisma.Decimal('100.00')
    : rate;

  const rawTax = taxableSubtotal.mul(validTaxRate).div(100);
  const taxAmount = new Prisma.Decimal(rawTax.toFixed(2));

  const total = taxableSubtotal.add(taxAmount);

  return {
    subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
    discount: new Prisma.Decimal(validDiscount.toFixed(2)),
    taxRate: new Prisma.Decimal(validTaxRate.toFixed(2)),
    taxAmount,
    total: new Prisma.Decimal(total.toFixed(2)),
  };
}

export interface PaymentBalanceResult {
  newPaidAmount: Prisma.Decimal;
  newBalance: Prisma.Decimal;
  isOverpayment: boolean;
  excessAmount: Prisma.Decimal;
}

/**
 * Calculate updated paid amount and remaining balance after applying a payment.
 * Detects overpayment atomically.
 */
export function calculatePaymentBalance(
  total: number | string | Prisma.Decimal,
  currentPaid: number | string | Prisma.Decimal,
  newPaymentAmount: number | string | Prisma.Decimal
): PaymentBalanceResult {
  const decTotal = toDecimal(total);
  const decCurrentPaid = toDecimal(currentPaid);
  const decPayment = toDecimal(newPaymentAmount);

  const currentBalance = decTotal.sub(decCurrentPaid);

  if (decPayment.greaterThan(currentBalance)) {
    return {
      newPaidAmount: decCurrentPaid,
      newBalance: currentBalance,
      isOverpayment: true,
      excessAmount: decPayment.sub(currentBalance),
    };
  }

  const newPaidAmount = decCurrentPaid.add(decPayment);
  const newBalance = decTotal.sub(newPaidAmount);

  return {
    newPaidAmount: new Prisma.Decimal(newPaidAmount.toFixed(2)),
    newBalance: new Prisma.Decimal(newBalance.toFixed(2)),
    isOverpayment: false,
    excessAmount: new Prisma.Decimal('0.00'),
  };
}

/**
 * Determine resulting invoice status based on total, paidAmount, and dueDate.
 *
 * Payment status rules:
 * - paidAmount >= total => PAID
 * - 0 < paidAmount < total => PARTIALLY_PAID (including if invoice was OVERDUE)
 * - paidAmount == 0 and past due date => OVERDUE
 * - paidAmount == 0 and not past due date => ISSUED
 */
export function determineInvoicePaymentStatus(
  total: number | string | Prisma.Decimal,
  paidAmount: number | string | Prisma.Decimal,
  dueDate?: Date | null
): InvoiceStatus {
  const decTotal = toDecimal(total);
  const decPaid = toDecimal(paidAmount);

  // Fully paid
  if (decPaid.greaterThanOrEqualTo(decTotal) && decTotal.greaterThan(0)) {
    return InvoiceStatus.PAID;
  }

  // Partially paid
  if (decPaid.greaterThan(0) && decPaid.lessThan(decTotal)) {
    return InvoiceStatus.PARTIALLY_PAID;
  }

  // Zero payment made
  if (dueDate && new Date(dueDate).getTime() < Date.now()) {
    return InvoiceStatus.OVERDUE;
  }

  return InvoiceStatus.ISSUED;
}
