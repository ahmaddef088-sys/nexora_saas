export type AuditEntity =
  | 'MEMBER'
  | 'CATEGORY'
  | 'PRODUCT'
  | 'INVENTORY'
  | 'CUSTOMER'
  | 'ORDER'
  | 'INVOICE'
  | 'PAYMENT'
  | 'EXPENSE';

export const auditEntityLabels: Record<string, string> = {
  MEMBER: 'Team Member',
  CATEGORY: 'Product Category',
  PRODUCT: 'Product',
  INVENTORY: 'Inventory',
  CUSTOMER: 'Customer',
  ORDER: 'Sales Order',
  INVOICE: 'Invoice',
  PAYMENT: 'Payment',
  EXPENSE: 'Expense',
};

export const auditEntityBadges: Record<string, { label: string; cls: string }> = {
  MEMBER: {
    label: 'Member',
    cls: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  CATEGORY: {
    label: 'Category',
    cls: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  },
  PRODUCT: {
    label: 'Product',
    cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  INVENTORY: {
    label: 'Inventory',
    cls: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  },
  CUSTOMER: {
    label: 'Customer',
    cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  ORDER: {
    label: 'Order',
    cls: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  },
  INVOICE: {
    label: 'Invoice',
    cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  PAYMENT: {
    label: 'Payment',
    cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  EXPENSE: {
    label: 'Expense',
    cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  },
};

export const auditActionLabels: Record<string, string> = {
  // Member
  MEMBER_CREATED: 'Member Added',
  MEMBER_ROLE_CHANGED: 'Role Updated',
  MEMBER_STATUS_CHANGED: 'Status Updated',
  MEMBER_PROFILE_UPDATED: 'Profile Updated',
  MEMBER_REMOVED: 'Member Removed',

  // Category & Product
  CATEGORY_CREATED: 'Category Created',
  CATEGORY_UPDATED: 'Category Updated',
  CATEGORY_DELETED: 'Category Deleted',
  PRODUCT_CREATED: 'Product Created',
  PRODUCT_UPDATED: 'Product Updated',
  PRODUCT_ARCHIVED: 'Product Archived',
  INVENTORY_ADJUSTED: 'Inventory Adjusted',

  // Customer
  CUSTOMER_CREATED: 'Customer Created',
  CUSTOMER_UPDATED: 'Customer Updated',
  CUSTOMER_ARCHIVED: 'Customer Archived',

  // Order
  ORDER_CREATED: 'Order Created',
  ORDER_UPDATED: 'Order Updated',
  ORDER_CONFIRMED: 'Order Confirmed',
  ORDER_CANCELLED: 'Order Cancelled',
  ORDER_COMPLETED: 'Order Completed',

  // Invoice
  INVOICE_CREATED: 'Invoice Drafted',
  INVOICE_UPDATED: 'Invoice Updated',
  INVOICE_ISSUED: 'Invoice Issued',
  INVOICE_VOIDED: 'Invoice Voided',
  INVOICE_GENERATED_FROM_ORDER: 'Invoice Generated From Order',

  // Payment
  PAYMENT_RECORDED: 'Payment Recorded',
  PAYMENT_REFUNDED: 'Payment Refunded',

  // Expense
  EXPENSE_CREATED: 'Expense Logged',
  EXPENSE_UPDATED: 'Expense Updated',
  EXPENSE_DELETED: 'Expense Deleted',
};

export function getAuditActionBadge(action: string): { label: string; cls: string } {
  const label = auditActionLabels[action] || action.replace(/_/g, ' ');

  if (action.includes('DELETED') || action.includes('REMOVED') || action.includes('VOIDED') || action.includes('CANCELLED') || action.includes('REFUNDED')) {
    return {
      label,
      cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    };
  }

  if (action.includes('CREATED') || action.includes('ISSUED') || action.includes('CONFIRMED') || action.includes('COMPLETED') || action.includes('RECORDED')) {
    return {
      label,
      cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    };
  }

  if (action.includes('UPDATED') || action.includes('CHANGED') || action.includes('ADJUSTED')) {
    return {
      label,
      cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    };
  }

  return {
    label,
    cls: 'bg-muted text-muted-foreground border-border',
  };
}

export function getAuditEntityBadge(entity: string): { label: string; cls: string } {
  return (
    auditEntityBadges[entity] || {
      label: auditEntityLabels[entity] || entity,
      cls: 'bg-muted text-muted-foreground border-border',
    }
  );
}
