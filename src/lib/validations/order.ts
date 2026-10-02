import { z } from 'zod';
import { OrderStatus } from '@prisma/client';

export const createCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Customer name must be at least 2 characters long')
    .max(150, 'Customer name must not exceed 150 characters'),
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address')
    .max(150, 'Email must not exceed 150 characters')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .trim()
    .max(50, 'Phone number must not exceed 50 characters')
    .optional()
    .or(z.literal('')),
  companyName: z
    .string()
    .trim()
    .max(150, 'Company name must not exceed 150 characters')
    .optional()
    .or(z.literal('')),
  address: z
    .string()
    .trim()
    .max(255, 'Address must not exceed 255 characters')
    .optional()
    .or(z.literal('')),
  city: z
    .string()
    .trim()
    .max(100, 'City must not exceed 100 characters')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .trim()
    .max(1000, 'Notes must not exceed 1000 characters')
    .optional()
    .or(z.literal('')),
});

export const updateCustomerSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  name: z
    .string()
    .trim()
    .min(2, 'Customer name must be at least 2 characters long')
    .max(150, 'Customer name must not exceed 150 characters'),
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address')
    .max(150, 'Email must not exceed 150 characters')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .trim()
    .max(50, 'Phone number must not exceed 50 characters')
    .optional()
    .or(z.literal('')),
  companyName: z
    .string()
    .trim()
    .max(150, 'Company name must not exceed 150 characters')
    .optional()
    .or(z.literal('')),
  address: z
    .string()
    .trim()
    .max(255, 'Address must not exceed 255 characters')
    .optional()
    .or(z.literal('')),
  city: z
    .string()
    .trim()
    .max(100, 'City must not exceed 100 characters')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .trim()
    .max(1000, 'Notes must not exceed 1000 characters')
    .optional()
    .or(z.literal('')),
  isActive: z.boolean().optional(),
});

export const archiveCustomerSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  isActive: z.boolean().optional(),
});

export const orderItemInputSchema = z.object({
  productId: z.string().min(1, 'Product selection is required'),
  quantity: z.coerce
    .number({ invalid_type_error: 'Quantity must be a valid number' })
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1 unit'),
});

export const createOrderSchema = z.object({
  customerId: z.string().min(1, 'Customer selection is required'),
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
  items: z
    .array(orderItemInputSchema)
    .min(1, 'An order must contain at least one product item'),
});

export const updateOrderSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  customerId: z.string().min(1, 'Customer selection is required'),
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
  items: z
    .array(orderItemInputSchema)
    .min(1, 'An order must contain at least one product item'),
});

export const confirmOrderSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
});

export const cancelOrderSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  reason: z
    .string()
    .trim()
    .max(250, 'Cancellation reason must not exceed 250 characters')
    .optional()
    .or(z.literal('')),
});

export const completeOrderSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ArchiveCustomerInput = z.infer<typeof archiveCustomerSchema>;
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type ConfirmOrderInput = z.infer<typeof confirmOrderSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type CompleteOrderInput = z.infer<typeof completeOrderSchema>;
