import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string().min(2, 'Tenant name must be at least 2 characters long'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters long')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  logoUrl: z.string().url('Logo must be a valid URL').optional().or(z.literal('')),
});

export const updateTenantSchema = createTenantSchema.partial();

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
