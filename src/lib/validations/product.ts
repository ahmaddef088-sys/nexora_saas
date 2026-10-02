import { z } from 'zod';
import { MovementType } from '@prisma/client';

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Category name must be at least 2 characters long')
    .max(100, 'Category name must not exceed 100 characters'),
  description: z
    .string()
    .trim()
    .max(500, 'Description must not exceed 500 characters')
    .optional()
    .or(z.literal('')),
});

export const updateCategorySchema = z.object({
  categoryId: z.string().min(1, 'Category ID is required'),
  name: z
    .string()
    .trim()
    .min(2, 'Category name must be at least 2 characters long')
    .max(100, 'Category name must not exceed 100 characters'),
  description: z
    .string()
    .trim()
    .max(500, 'Description must not exceed 500 characters')
    .optional()
    .or(z.literal('')),
});

export const createProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Product name must be at least 2 characters long')
    .max(150, 'Product name must not exceed 150 characters'),
  sku: z
    .string()
    .trim()
    .min(2, 'SKU must be at least 2 characters long')
    .max(50, 'SKU must not exceed 50 characters')
    .transform((val) => val.toUpperCase()),
  description: z
    .string()
    .trim()
    .max(1000, 'Description must not exceed 1000 characters')
    .optional()
    .or(z.literal('')),
  price: z.coerce
    .number({ invalid_type_error: 'Price must be a valid number' })
    .min(0, 'Price cannot be negative'),
  cost: z.coerce
    .number({ invalid_type_error: 'Cost must be a valid number' })
    .min(0, 'Cost cannot be negative')
    .default(0),
  categoryId: z.string().optional().nullable().or(z.literal('')),
  initialStock: z.coerce
    .number()
    .int('Stock quantity must be an integer')
    .min(0, 'Initial stock cannot be negative')
    .default(0),
  reorderLevel: z.coerce
    .number()
    .int('Reorder level must be an integer')
    .min(0, 'Reorder level cannot be negative')
    .default(0),
});

export const updateProductSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  name: z
    .string()
    .trim()
    .min(2, 'Product name must be at least 2 characters long')
    .max(150, 'Product name must not exceed 150 characters'),
  sku: z
    .string()
    .trim()
    .min(2, 'SKU must be at least 2 characters long')
    .max(50, 'SKU must not exceed 50 characters')
    .transform((val) => val.toUpperCase()),
  description: z
    .string()
    .trim()
    .max(1000, 'Description must not exceed 1000 characters')
    .optional()
    .or(z.literal('')),
  price: z.coerce
    .number({ invalid_type_error: 'Price must be a valid number' })
    .min(0, 'Price cannot be negative'),
  cost: z.coerce
    .number({ invalid_type_error: 'Cost must be a valid number' })
    .min(0, 'Cost cannot be negative'),
  categoryId: z.string().optional().nullable().or(z.literal('')),
  reorderLevel: z.coerce
    .number()
    .int('Reorder level must be an integer')
    .min(0, 'Reorder level cannot be negative')
    .default(0),
  isActive: z.boolean().optional(),
});

export const archiveProductSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  isActive: z.boolean().optional(),
});

export const inventoryAdjustmentSchema = z
  .object({
    productId: z.string().min(1, 'Product ID is required'),
    type: z.nativeEnum(MovementType, {
      errorMap: () => ({ message: 'Please select a valid adjustment type (STOCK_IN, STOCK_OUT, ADJUSTMENT)' }),
    }),
    quantity: z.coerce
      .number({ invalid_type_error: 'Quantity must be a valid number' })
      .int('Quantity must be an integer'),
    reason: z
      .string()
      .trim()
      .max(250, 'Reason must not exceed 250 characters')
      .optional()
      .or(z.literal('')),
  })
  .refine(
    (data) => {
      if (data.type === MovementType.STOCK_IN || data.type === MovementType.STOCK_OUT) {
        return data.quantity > 0;
      }
      if (data.type === MovementType.ADJUSTMENT) {
        return data.quantity >= 0;
      }
      return false;
    },
    {
      message: 'Quantity must be greater than 0 for Stock In/Out, or 0 or greater for Adjustment.',
      path: ['quantity'],
    }
  );

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ArchiveProductInput = z.infer<typeof archiveProductSchema>;
export type InventoryAdjustmentInput = z.infer<typeof inventoryAdjustmentSchema>;
