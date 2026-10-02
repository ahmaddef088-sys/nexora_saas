/**
 * Shared expense constants and category definitions.
 * Intentionally NOT marked 'use client' so it can be safely imported by both
 * Server and Client components without triggering React Client Manifest bundling errors.
 */
import { ExpenseCategory } from '@prisma/client';

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  OFFICE_SUPPLIES: 'Office Supplies',
  UTILITIES: 'Utilities',
  RENT: 'Rent & Facilities',
  SALARIES: 'Salaries & Payroll',
  MARKETING: 'Marketing & Advertising',
  TRAVEL: 'Travel & Entertainment',
  SOFTWARE_SUBSCRIPTION: 'Software & Subscriptions',
  INVENTORY_PURCHASE: 'Inventory Purchase',
  SHIPPING: 'Shipping & Logistics',
  TAXES_AND_FEES: 'Taxes & Regulatory Fees',
  OTHER: 'Other Miscellaneous',
};

export const expenseCategoryBadges: Record<
  ExpenseCategory,
  { label: string; cls: string }
> = {
  OFFICE_SUPPLIES: {
    label: 'Office Supplies',
    cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  UTILITIES: {
    label: 'Utilities',
    cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  RENT: {
    label: 'Rent & Facilities',
    cls: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  SALARIES: {
    label: 'Salaries & Payroll',
    cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  MARKETING: {
    label: 'Marketing & Ads',
    cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  },
  TRAVEL: {
    label: 'Travel & Events',
    cls: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  },
  SOFTWARE_SUBSCRIPTION: {
    label: 'Software & SaaS',
    cls: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  },
  INVENTORY_PURCHASE: {
    label: 'Inventory',
    cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  },
  SHIPPING: {
    label: 'Shipping',
    cls: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  },
  TAXES_AND_FEES: {
    label: 'Taxes & Fees',
    cls: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
  OTHER: {
    label: 'Other',
    cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  },
};
