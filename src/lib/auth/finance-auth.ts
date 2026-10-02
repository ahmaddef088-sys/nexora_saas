import { Role, InvoiceStatus, OrderStatus } from '@prisma/client';

export interface AuthDecision {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if a role can view financial data (dashboard, invoices, payments, expenses, ledger, receivables).
 * All verified workspace roles (OWNER, ADMIN, MEMBER, VIEWER) have read access.
 */
export function canViewFinance(actorRole: Role): boolean {
  return [Role.OWNER, Role.ADMIN, Role.MEMBER, Role.VIEWER].includes(actorRole);
}

/**
 * Check if a role can create draft invoices.
 * OWNER, ADMIN, and MEMBER can draft invoices.
 */
export function canCreateInvoice(actorRole: Role): AuthDecision {
  if (actorRole === Role.OWNER || actorRole === Role.ADMIN || actorRole === Role.MEMBER) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'You do not have permission to create invoices in this workspace.',
  };
}

/**
 * Check if a role can edit an invoice.
 * Only DRAFT invoices can be edited by OWNER, ADMIN, or MEMBER.
 */
export function canEditInvoice(
  actorRole: Role,
  invoiceStatus: InvoiceStatus = InvoiceStatus.DRAFT
): AuthDecision {
  if (invoiceStatus !== InvoiceStatus.DRAFT) {
    return {
      allowed: false,
      reason: `Invoices in "${invoiceStatus}" status cannot be modified. Only DRAFT invoices can be edited.`,
    };
  }

  if (actorRole === Role.OWNER || actorRole === Role.ADMIN || actorRole === Role.MEMBER) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'You do not have permission to edit invoices in this workspace.',
  };
}

/**
 * Check if a role can generate an invoice from an eligible order.
 * OWNER, ADMIN, and MEMBER can generate invoices from confirmed or completed orders.
 */
export function canGenerateInvoiceFromOrder(
  actorRole: Role,
  orderStatus: OrderStatus = OrderStatus.CONFIRMED
): AuthDecision {
  if (orderStatus !== OrderStatus.CONFIRMED && orderStatus !== OrderStatus.COMPLETED) {
    return {
      allowed: false,
      reason: `Cannot generate an invoice for an order in "${orderStatus}" status. Only CONFIRMED or COMPLETED orders can be invoiced.`,
    };
  }

  if (actorRole === Role.OWNER || actorRole === Role.ADMIN || actorRole === Role.MEMBER) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'You do not have permission to generate invoices from orders in this workspace.',
  };
}

/**
 * Check if a role can issue/finalize an invoice (locking historical line item snapshot).
 * OWNER and ADMIN can issue invoices.
 */
export function canIssueInvoice(actorRole: Role): AuthDecision {
  if (actorRole === Role.OWNER || actorRole === Role.ADMIN) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'You do not have permission to issue and finalize invoices in this workspace. Admin or Owner role required.',
  };
}

/**
 * Check if a role can void an invoice.
 * OWNER and ADMIN can void invoices.
 */
export function canVoidInvoice(actorRole: Role): AuthDecision {
  if (actorRole === Role.OWNER || actorRole === Role.ADMIN) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'You do not have permission to void invoices in this workspace. Admin or Owner role required.',
  };
}

/**
 * Check if a role can record payments against issued/partially paid invoices.
 * OWNER and ADMIN can record payments.
 */
export function canRecordPayment(actorRole: Role): AuthDecision {
  if (actorRole === Role.OWNER || actorRole === Role.ADMIN) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'You do not have permission to record payments in this workspace. Admin or Owner role required.',
  };
}

/**
 * Check if a role can refund/reverse a payment.
 * Strictly restricted to OWNER only (ADMIN and below cannot issue refunds).
 */
export function canRefundPayment(actorRole: Role): AuthDecision {
  if (actorRole === Role.OWNER) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'Payment refunds and reversals are restricted to Workspace Owners only.',
  };
}

/**
 * Check if a role can create an expense.
 * OWNER and ADMIN can log expenses.
 */
export function canCreateExpense(actorRole: Role): AuthDecision {
  if (actorRole === Role.OWNER || actorRole === Role.ADMIN) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'You do not have permission to record expenses in this workspace. Admin or Owner role required.',
  };
}

/**
 * Check if a role can edit an existing expense.
 * OWNER and ADMIN can edit expenses.
 */
export function canEditExpense(actorRole: Role): AuthDecision {
  if (actorRole === Role.OWNER || actorRole === Role.ADMIN) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'You do not have permission to edit expenses in this workspace. Admin or Owner role required.',
  };
}

/**
 * Check if a role can delete an expense record.
 * OWNER and ADMIN can delete expenses.
 */
export function canDeleteExpense(actorRole: Role): AuthDecision {
  if (actorRole === Role.OWNER || actorRole === Role.ADMIN) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'You do not have permission to delete expenses in this workspace. Admin or Owner role required.',
  };
}

/**
 * Pure state machine transition validation for Invoice lifecycle.
 *
 * Valid Transitions:
 * - DRAFT -> ISSUED, VOIDED
 * - ISSUED -> PARTIALLY_PAID, PAID, OVERDUE, VOIDED
 * - PARTIALLY_PAID -> PAID, OVERDUE
 * - OVERDUE -> PARTIALLY_PAID, PAID, VOIDED
 * - PAID -> Terminal (no further transitions)
 * - VOIDED -> Terminal (no further transitions)
 */
export function isValidInvoiceStatusTransition(
  currentStatus: InvoiceStatus,
  targetStatus: InvoiceStatus
): boolean {
  if (currentStatus === targetStatus) {
    return false; // No-op transition is invalid/rejected
  }

  switch (currentStatus) {
    case InvoiceStatus.DRAFT:
      return (
        targetStatus === InvoiceStatus.ISSUED ||
        targetStatus === InvoiceStatus.VOIDED
      );

    case InvoiceStatus.ISSUED:
      return (
        targetStatus === InvoiceStatus.PARTIALLY_PAID ||
        targetStatus === InvoiceStatus.PAID ||
        targetStatus === InvoiceStatus.OVERDUE ||
        targetStatus === InvoiceStatus.VOIDED
      );

    case InvoiceStatus.PARTIALLY_PAID:
      return (
        targetStatus === InvoiceStatus.PAID ||
        targetStatus === InvoiceStatus.OVERDUE
      );

    case InvoiceStatus.OVERDUE:
      return (
        targetStatus === InvoiceStatus.PARTIALLY_PAID ||
        targetStatus === InvoiceStatus.PAID ||
        targetStatus === InvoiceStatus.VOIDED
      );

    case InvoiceStatus.PAID:
    case InvoiceStatus.VOIDED:
      return false; // Terminal states cannot transition further

    default:
      return false;
  }
}
