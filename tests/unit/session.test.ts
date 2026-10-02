import { describe, it, expect } from 'vitest';
import { loginSchema, registerSchema } from '../../src/lib/validations/auth';
import { createTenantSchema } from '../../src/lib/validations/tenant';

describe('Validation Schemas & Security Input Tests', () => {
  it('should validate valid login credentials successfully', () => {
    const valid = loginSchema.safeParse({
      email: 'admin@acme.com',
      password: 'Password123!',
    });
    expect(valid.success).toBe(true);
  });

  it('should reject invalid email formats during login', () => {
    const invalid = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'Password123!',
    });
    expect(invalid.success).toBe(false);
  });

  it('should reject passwords shorter than 8 characters', () => {
    const invalid = loginSchema.safeParse({
      email: 'admin@acme.com',
      password: 'short',
    });
    expect(invalid.success).toBe(false);
  });

  it('should validate tenant slug formatting', () => {
    const validTenant = createTenantSchema.safeParse({
      name: 'Acme Corporation',
      slug: 'acme-corp-123',
    });
    expect(validTenant.success).toBe(true);

    const invalidSlug = createTenantSchema.safeParse({
      name: 'Acme Corporation',
      slug: 'Acme Corp with spaces & CAPS',
    });
    expect(invalidSlug.success).toBe(false);
  });
});
