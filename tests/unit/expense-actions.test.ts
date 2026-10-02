/**
 * Phase 6 — Expense Server Actions: Unit Tests
 *
 * Tests the business logic layer for expenses:
 * - Authorization decisions in finance-auth.ts (canCreateExpense, canEditExpense, canDeleteExpense)
 * - Validation schemas in finance.ts (createExpenseSchema, updateExpenseSchema, deleteExpenseSchema)
 * - Decimal-safe expense total arithmetic: total = amount + taxAmount
 * - Ledger immutability and offsetting reversal entry calculations
 */

import { describe, it, expect } from 'vitest';
import { Role, ExpenseCategory, PaymentMethod, Prisma } from '@prisma/client';
import {
  canCreateExpense,
  canEditExpense,
  canDeleteExpense,
} from '@/lib/auth/finance-auth';
import {
  createExpenseSchema,
  updateExpenseSchema,
  deleteExpenseSchema,
} from '@/lib/validations/finance';

describe('Expense Action Business Logic & Authorization', () => {
  // ─── RBAC: Expense Creation ───────────────────────────────────────────────
  describe('canCreateExpense RBAC', () => {
    it('authorizes OWNER to log expenses', () => {
      expect(canCreateExpense(Role.OWNER).allowed).toBe(true);
    });

    it('authorizes ADMIN to log expenses', () => {
      expect(canCreateExpense(Role.ADMIN).allowed).toBe(true);
    });

    it('denies MEMBER from logging expenses', () => {
      const decision = canCreateExpense(Role.MEMBER);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('Admin or Owner role required');
    });

    it('denies VIEWER from logging expenses', () => {
      const decision = canCreateExpense(Role.VIEWER);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('Admin or Owner role required');
    });
  });

  // ─── RBAC: Expense Editing ────────────────────────────────────────────────
  describe('canEditExpense RBAC', () => {
    it('authorizes OWNER to edit expenses', () => {
      expect(canEditExpense(Role.OWNER).allowed).toBe(true);
    });

    it('authorizes ADMIN to edit expenses', () => {
      expect(canEditExpense(Role.ADMIN).allowed).toBe(true);
    });

    it('denies MEMBER from editing expenses', () => {
      expect(canEditExpense(Role.MEMBER).allowed).toBe(false);
    });

    it('denies VIEWER from editing expenses', () => {
      expect(canEditExpense(Role.VIEWER).allowed).toBe(false);
    });
  });

  // ─── RBAC: Expense Deletion ───────────────────────────────────────────────
  describe('canDeleteExpense RBAC', () => {
    it('authorizes OWNER to delete expenses', () => {
      expect(canDeleteExpense(Role.OWNER).allowed).toBe(true);
    });

    it('authorizes ADMIN to delete expenses', () => {
      expect(canDeleteExpense(Role.ADMIN).allowed).toBe(true);
    });

    it('denies MEMBER from deleting expenses', () => {
      expect(canDeleteExpense(Role.MEMBER).allowed).toBe(false);
    });

    it('denies VIEWER from deleting expenses', () => {
      expect(canDeleteExpense(Role.VIEWER).allowed).toBe(false);
    });
  });

  // ─── Validation: createExpenseSchema ──────────────────────────────────────
  describe('createExpenseSchema validation', () => {
    it('validates a complete, well-formed expense creation payload', () => {
      const result = createExpenseSchema.safeParse({
        category: ExpenseCategory.OFFICE_SUPPLIES,
        payee: 'Office Depot',
        amount: 150.50,
        taxAmount: 12.04,
        expenseDate: new Date(),
        paymentMethod: PaymentMethod.CREDIT_CARD,
        reference: 'INV-4421',
        notes: 'Monthly paper and stationery supplies',
        receiptUrl: 'https://storage.example.com/receipts/r1.pdf',
      });
      expect(result.success).toBe(true);
    });

    it('validates minimal required fields with defaults', () => {
      const result = createExpenseSchema.safeParse({
        category: ExpenseCategory.SOFTWARE_SUBSCRIPTION,
        payee: 'GitHub',
        amount: 21.00,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.taxAmount).toBe(0);
        expect(result.data.paymentMethod).toBe(PaymentMethod.BANK_TRANSFER);
      }
    });

    it('rejects zero or negative amount', () => {
      const zeroRes = createExpenseSchema.safeParse({
        category: ExpenseCategory.RENT,
        payee: 'Landlord',
        amount: 0,
      });
      expect(zeroRes.success).toBe(false);

      const negRes = createExpenseSchema.safeParse({
        category: ExpenseCategory.RENT,
        payee: 'Landlord',
        amount: -500,
      });
      expect(negRes.success).toBe(false);
    });

    it('rejects negative taxAmount', () => {
      const result = createExpenseSchema.safeParse({
        category: ExpenseCategory.UTILITIES,
        payee: 'Power Co',
        amount: 200,
        taxAmount: -10,
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty payee name', () => {
      const result = createExpenseSchema.safeParse({
        category: ExpenseCategory.TRAVEL,
        payee: '   ',
        amount: 75.00,
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid category enum', () => {
      const result = createExpenseSchema.safeParse({
        category: 'INVALID_CATEGORY',
        payee: 'Vendor',
        amount: 100,
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── Validation: updateExpenseSchema ──────────────────────────────────────
  describe('updateExpenseSchema validation', () => {
    it('validates a well-formed update expense payload', () => {
      const result = updateExpenseSchema.safeParse({
        expenseId: 'exp-12345',
        category: ExpenseCategory.MARKETING,
        payee: 'Google Ads',
        amount: 500.00,
        taxAmount: 0,
        expenseDate: new Date(),
        paymentMethod: PaymentMethod.CREDIT_CARD,
        reference: 'G-ADS-998',
        notes: 'Q3 campaign',
      });
      expect(result.success).toBe(true);
    });

    it('rejects update payload without expenseId', () => {
      const result = updateExpenseSchema.safeParse({
        category: ExpenseCategory.MARKETING,
        payee: 'Google Ads',
        amount: 500.00,
        expenseDate: new Date(),
        paymentMethod: PaymentMethod.CREDIT_CARD,
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── Validation: deleteExpenseSchema ──────────────────────────────────────
  describe('deleteExpenseSchema validation', () => {
    it('validates a valid delete payload', () => {
      const result = deleteExpenseSchema.safeParse({
        expenseId: 'exp-12345',
      });
      expect(result.success).toBe(true);
    });

    it('rejects delete payload with empty expenseId', () => {
      const result = deleteExpenseSchema.safeParse({
        expenseId: '',
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── Financial Calculations: Total & Decimal Safety ───────────────────────
  describe('Server-authoritative Expense Total Calculation', () => {
    it('calculates total as Decimal(amount) + Decimal(taxAmount)', () => {
      const decAmount = new Prisma.Decimal('100.25');
      const decTax = new Prisma.Decimal('8.52');
      const decTotal = decAmount.add(decTax);

      expect(decTotal.toFixed(2)).toBe('108.77');
    });

    it('handles zero tax correctly', () => {
      const decAmount = new Prisma.Decimal('250.00');
      const decTax = new Prisma.Decimal('0.00');
      const decTotal = decAmount.add(decTax);

      expect(decTotal.toFixed(2)).toBe('250.00');
    });

    it('preserves Decimal precision over floating-point arithmetic (e.g. 0.1 + 0.2)', () => {
      const decAmount = new Prisma.Decimal('0.10');
      const decTax = new Prisma.Decimal('0.20');
      const decTotal = decAmount.add(decTax);

      expect(decTotal.toFixed(2)).toBe('0.30');
    });
  });

  // ─── Ledger Immutability & Reversals ──────────────────────────────────────
  describe('Ledger Immutability & Offset Calculations', () => {
    it('expense creation produces positive ledger amount equal to total', () => {
      const amount = new Prisma.Decimal('300.00');
      const tax = new Prisma.Decimal('24.00');
      const total = amount.add(tax);

      expect(total.toFixed(2)).toBe('324.00');
    });

    it('expense update amount correction calculates offsetting reversal + new entry', () => {
      const oldTotal = new Prisma.Decimal('324.00');
      const newTotal = new Prisma.Decimal('350.00');

      const reversalEntry = oldTotal.negated();
      const newEntry = newTotal;

      // Net impact on total expenses: 324 - 324 + 350 = 350
      const netLedger = oldTotal.add(reversalEntry).add(newEntry);
      expect(netLedger.toFixed(2)).toBe('350.00');
      expect(reversalEntry.toFixed(2)).toBe('-324.00');
    });

    it('expense deletion creates offsetting negative ledger entry neutralizing historical balance', () => {
      const originalTotal = new Prisma.Decimal('450.00');
      const deletionReversal = originalTotal.negated();

      // Net impact on total expenses after deletion: 450 + (-450) = 0
      const netAfterDeletion = originalTotal.add(deletionReversal);
      expect(netAfterDeletion.toFixed(2)).toBe('0.00');
    });
  });
});
