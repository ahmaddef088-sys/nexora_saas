import { z } from 'zod';
import { PaymentMethod, ExpenseCategory } from '@prisma/client';

export const invoiceItemInputSchema = z.object({
  productId: z.string().trim().optional().or(z.literal('')),
  description: z
    .string()
    .trim()
    .min(1, 'Line item description is required')
    .max(250, 'Description must not exceed 250 characters'),
  quantity: z.coerce
    .number({ invalid_type_error: 'Quantity must be a valid number' })
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1 unit'),
  unitPrice: z.coerce
    .number({ invalid_type_error: 'Unit price must be a valid number' })
    .min(0, 'Unit price cannot be negative'),
});

export const createInvoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer selection is required'),
  dueDate: z.coerce.date({ invalid_type_error: 'Please enter a valid due date' }),
  taxRate: z.coerce
    .number({ invalid_type_error: 'Tax rate must be a number' })
    .min(0, 'Tax rate cannot be negative')
    .max(100, 'Tax rate cannot exceed 100%')
    .default(0),
  discount: z.coerce
    .number({ invalid_type_error: 'Discount must be a number' })
    .min(0, 'Discount cannot be negative')
    .default(0),
  notes: z
    .string()
    .trim()
    .max(1000, 'Notes must not exceed 1000 characters')
    .optional()
    .or(z.literal('')),
  terms: z
    .string()
    .trim()
    .max(1000, 'Terms must not exceed 1000 characters')
    .optional()
    .or(z.literal('')),
  items: z
    .array(invoiceItemInputSchema)
    .min(1, 'An invoice must contain at least one line item'),
});

export const updateInvoiceSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  customerId: z.string().min(1, 'Customer selection is required'),
  dueDate: z.coerce.date({ invalid_type_error: 'Please enter a valid due date' }),
  taxRate: z.coerce
    .number({ invalid_type_error: 'Tax rate must be a number' })
    .min(0, 'Tax rate cannot be negative')
    .max(100, 'Tax rate cannot exceed 100%')
    .default(0),
  discount: z.coerce
    .number({ invalid_type_error: 'Discount must be a number' })
    .min(0, 'Discount cannot be negative')
    .default(0),
  notes: z
    .string()
    .trim()
    .max(1000, 'Notes must not exceed 1000 characters')
    .optional()
    .or(z.literal('')),
  terms: z
    .string()
    .trim()
    .max(1000, 'Terms must not exceed 1000 characters')
    .optional()
    .or(z.literal('')),
  items: z
    .array(invoiceItemInputSchema)
    .min(1, 'An invoice must contain at least one line item'),
});

export const generateInvoiceFromOrderSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  dueDate: z.coerce.date().optional(),
  taxRate: z.coerce
    .number({ invalid_type_error: 'Tax rate must be a number' })
    .min(0, 'Tax rate cannot be negative')
    .max(100, 'Tax rate cannot exceed 100%')
    .default(0),
  notes: z
    .string()
    .trim()
    .max(1000, 'Notes must not exceed 1000 characters')
    .optional()
    .or(z.literal('')),
  terms: z
    .string()
    .trim()
    .max(1000, 'Terms must not exceed 1000 characters')
    .optional()
    .or(z.literal('')),
});

export const issueInvoiceSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
});

export const voidInvoiceSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  reason: z
    .string()
    .trim()
    .max(250, 'Void reason must not exceed 250 characters')
    .optional()
    .or(z.literal('')),
});

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  amount: z.coerce
    .number({ invalid_type_error: 'Payment amount must be a number' })
    .positive('Payment amount must be greater than 0'),
  paymentMethod: z.nativeEnum(PaymentMethod, {
    errorMap: () => ({ message: 'Invalid payment method' }),
  }),
  paymentDate: z.coerce.date().default(() => new Date()),
  reference: z
    .string()
    .trim()
    .max(100, 'Reference must not exceed 100 characters')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .trim()
    .max(500, 'Notes must not exceed 500 characters')
    .optional()
    .or(z.literal('')),
});

export const refundPaymentSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  reason: z
    .string()
    .trim()
    .max(250, 'Refund reason must not exceed 250 characters')
    .optional()
    .or(z.literal('')),
});

export const createExpenseSchema = z.object({
  category: z.nativeEnum(ExpenseCategory, {
    errorMap: () => ({ message: 'Invalid expense category' }),
  }),
  payee: z
    .string()
    .trim()
    .min(1, 'Payee name is required')
    .max(200, 'Payee name must not exceed 200 characters'),
  amount: z.coerce
    .number({ invalid_type_error: 'Expense amount must be a number' })
    .positive('Expense amount must be greater than 0'),
  taxAmount: z.coerce
    .number({ invalid_type_error: 'Tax amount must be a number' })
    .min(0, 'Tax amount cannot be negative')
    .default(0),
  expenseDate: z.coerce.date().default(() => new Date()),
  paymentMethod: z
    .nativeEnum(PaymentMethod, {
      errorMap: () => ({ message: 'Invalid payment method' }),
    })
    .default(PaymentMethod.BANK_TRANSFER),
  reference: z
    .string()
    .trim()
    .max(100, 'Reference must not exceed 100 characters')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .trim()
    .max(1000, 'Notes must not exceed 1000 characters')
    .optional()
    .or(z.literal('')),
  receiptUrl: z
    .string()
    .trim()
    .max(500, 'Receipt URL must not exceed 500 characters')
    .optional()
    .or(z.literal('')),
});

export const updateExpenseSchema = z.object({
  expenseId: z.string().min(1, 'Expense ID is required'),
  category: z.nativeEnum(ExpenseCategory, {
    errorMap: () => ({ message: 'Invalid expense category' }),
  }),
  payee: z
    .string()
    .trim()
    .min(1, 'Payee name is required')
    .max(200, 'Payee name must not exceed 200 characters'),
  amount: z.coerce
    .number({ invalid_type_error: 'Expense amount must be a number' })
    .positive('Expense amount must be greater than 0'),
  taxAmount: z.coerce
    .number({ invalid_type_error: 'Tax amount must be a number' })
    .min(0, 'Tax amount cannot be negative')
    .default(0),
  expenseDate: z.coerce.date({ invalid_type_error: 'Please enter a valid expense date' }),
  paymentMethod: z.nativeEnum(PaymentMethod, {
    errorMap: () => ({ message: 'Invalid payment method' }),
  }),
  reference: z
    .string()
    .trim()
    .max(100, 'Reference must not exceed 100 characters')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .trim()
    .max(1000, 'Notes must not exceed 1000 characters')
    .optional()
    .or(z.literal('')),
  receiptUrl: z
    .string()
    .trim()
    .max(500, 'Receipt URL must not exceed 500 characters')
    .optional()
    .or(z.literal('')),
});

export const deleteExpenseSchema = z.object({
  expenseId: z.string().min(1, 'Expense ID is required'),
});

export type InvoiceItemInput = z.infer<typeof invoiceItemInputSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type GenerateInvoiceFromOrderInput = z.infer<typeof generateInvoiceFromOrderSchema>;
export type IssueInvoiceInput = z.infer<typeof issueInvoiceSchema>;
export type VoidInvoiceInput = z.infer<typeof voidInvoiceSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type DeleteExpenseInput = z.infer<typeof deleteExpenseSchema>;
