import { describe, it, expect } from 'vitest';
import { Role, InvoiceStatus, OrderStatus } from '@prisma/client';
import {
  canViewFinance,
  canCreateInvoice,
  canEditInvoice,
  canGenerateInvoiceFromOrder,
  canIssueInvoice,
  canVoidInvoice,
  canRecordPayment,
  canRefundPayment,
  canCreateExpense,
  canEditExpense,
  canDeleteExpense,
} from '@/lib/auth/finance-auth';

describe('Financial RBAC Authorization Matrix', () => {
  describe('View Financial Data (canViewFinance)', () => {
    it('allows OWNER, ADMIN, MEMBER, and VIEWER to view financial data', () => {
      expect(canViewFinance(Role.OWNER)).toBe(true);
      expect(canViewFinance(Role.ADMIN)).toBe(true);
      expect(canViewFinance(Role.MEMBER)).toBe(true);
      expect(canViewFinance(Role.VIEWER)).toBe(true);
    });
  });

  describe('Invoice Drafting & Creation (canCreateInvoice, canEditInvoice)', () => {
    it('allows OWNER, ADMIN, and MEMBER to create draft invoices', () => {
      expect(canCreateInvoice(Role.OWNER).allowed).toBe(true);
      expect(canCreateInvoice(Role.ADMIN).allowed).toBe(true);
      expect(canCreateInvoice(Role.MEMBER).allowed).toBe(true);
    });

    it('denies VIEWER from creating draft invoices', () => {
      const decision = canCreateInvoice(Role.VIEWER);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('permission');
    });

    it('allows OWNER, ADMIN, and MEMBER to edit DRAFT invoices', () => {
      expect(canEditInvoice(Role.OWNER, InvoiceStatus.DRAFT).allowed).toBe(true);
      expect(canEditInvoice(Role.ADMIN, InvoiceStatus.DRAFT).allowed).toBe(true);
      expect(canEditInvoice(Role.MEMBER, InvoiceStatus.DRAFT).allowed).toBe(true);
    });

    it('strictly forbids editing non-DRAFT invoices across all roles', () => {
      const nonDraftStatuses = [
        InvoiceStatus.ISSUED,
        InvoiceStatus.PARTIALLY_PAID,
        InvoiceStatus.PAID,
        InvoiceStatus.OVERDUE,
        InvoiceStatus.VOIDED,
      ];

      for (const status of nonDraftStatuses) {
        expect(canEditInvoice(Role.OWNER, status).allowed).toBe(false);
        expect(canEditInvoice(Role.ADMIN, status).allowed).toBe(false);
        expect(canEditInvoice(Role.MEMBER, status).allowed).toBe(false);
        expect(canEditInvoice(Role.VIEWER, status).allowed).toBe(false);
      }
    });
  });

  describe('Order to Invoice Generation (canGenerateInvoiceFromOrder)', () => {
    it('allows OWNER, ADMIN, and MEMBER to generate invoices from CONFIRMED orders', () => {
      expect(canGenerateInvoiceFromOrder(Role.OWNER, OrderStatus.CONFIRMED).allowed).toBe(true);
      expect(canGenerateInvoiceFromOrder(Role.ADMIN, OrderStatus.CONFIRMED).allowed).toBe(true);
      expect(canGenerateInvoiceFromOrder(Role.MEMBER, OrderStatus.CONFIRMED).allowed).toBe(true);
    });

    it('allows OWNER, ADMIN, and MEMBER to generate invoices from COMPLETED orders', () => {
      expect(canGenerateInvoiceFromOrder(Role.OWNER, OrderStatus.COMPLETED).allowed).toBe(true);
      expect(canGenerateInvoiceFromOrder(Role.ADMIN, OrderStatus.COMPLETED).allowed).toBe(true);
      expect(canGenerateInvoiceFromOrder(Role.MEMBER, OrderStatus.COMPLETED).allowed).toBe(true);
    });

    it('rejects invoice generation from DRAFT orders', () => {
      const decision = canGenerateInvoiceFromOrder(Role.OWNER, OrderStatus.DRAFT);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('DRAFT');
    });

    it('rejects invoice generation from CANCELLED orders', () => {
      const decision = canGenerateInvoiceFromOrder(Role.OWNER, OrderStatus.CANCELLED);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toContain('CANCELLED');
    });

    it('denies VIEWER from generating invoices regardless of order status', () => {
      expect(canGenerateInvoiceFromOrder(Role.VIEWER, OrderStatus.CONFIRMED).allowed).toBe(false);
      expect(canGenerateInvoiceFromOrder(Role.VIEWER, OrderStatus.COMPLETED).allowed).toBe(false);
    });
  });

  describe('Invoice Issuance & Voiding (canIssueInvoice, canVoidInvoice)', () => {
    it('allows OWNER and ADMIN to issue invoices', () => {
      expect(canIssueInvoice(Role.OWNER).allowed).toBe(true);
      expect(canIssueInvoice(Role.ADMIN).allowed).toBe(true);
    });

    it('denies MEMBER and VIEWER from issuing invoices', () => {
      expect(canIssueInvoice(Role.MEMBER).allowed).toBe(false);
      expect(canIssueInvoice(Role.VIEWER).allowed).toBe(false);
    });

    it('allows OWNER and ADMIN to void invoices', () => {
      expect(canVoidInvoice(Role.OWNER).allowed).toBe(true);
      expect(canVoidInvoice(Role.ADMIN).allowed).toBe(true);
    });

    it('denies MEMBER and VIEWER from voiding invoices', () => {
      expect(canVoidInvoice(Role.MEMBER).allowed).toBe(false);
      expect(canVoidInvoice(Role.VIEWER).allowed).toBe(false);
    });
  });

  describe('Payments & Refunds (canRecordPayment, canRefundPayment)', () => {
    it('allows OWNER and ADMIN to record payments', () => {
      expect(canRecordPayment(Role.OWNER).allowed).toBe(true);
      expect(canRecordPayment(Role.ADMIN).allowed).toBe(true);
    });

    it('denies MEMBER and VIEWER from recording payments', () => {
      expect(canRecordPayment(Role.MEMBER).allowed).toBe(false);
      expect(canRecordPayment(Role.VIEWER).allowed).toBe(false);
    });

    it('strictly allows ONLY OWNER to refund/reverse payments', () => {
      expect(canRefundPayment(Role.OWNER).allowed).toBe(true);
      expect(canRefundPayment(Role.ADMIN).allowed).toBe(false);
      expect(canRefundPayment(Role.MEMBER).allowed).toBe(false);
      expect(canRefundPayment(Role.VIEWER).allowed).toBe(false);
    });
  });

  describe('Expense Management (canCreateExpense, canEditExpense, canDeleteExpense)', () => {
    it('allows OWNER and ADMIN to create, edit, and delete expenses', () => {
      expect(canCreateExpense(Role.OWNER).allowed).toBe(true);
      expect(canCreateExpense(Role.ADMIN).allowed).toBe(true);

      expect(canEditExpense(Role.OWNER).allowed).toBe(true);
      expect(canEditExpense(Role.ADMIN).allowed).toBe(true);

      expect(canDeleteExpense(Role.OWNER).allowed).toBe(true);
      expect(canDeleteExpense(Role.ADMIN).allowed).toBe(true);
    });

    it('denies MEMBER and VIEWER from mutating expenses', () => {
      expect(canCreateExpense(Role.MEMBER).allowed).toBe(false);
      expect(canCreateExpense(Role.VIEWER).allowed).toBe(false);

      expect(canEditExpense(Role.MEMBER).allowed).toBe(false);
      expect(canEditExpense(Role.VIEWER).allowed).toBe(false);

      expect(canDeleteExpense(Role.MEMBER).allowed).toBe(false);
      expect(canDeleteExpense(Role.VIEWER).allowed).toBe(false);
    });
  });
});
