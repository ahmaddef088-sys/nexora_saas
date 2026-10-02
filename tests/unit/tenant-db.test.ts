import { describe, it, expect } from 'vitest';
import { getTenantDb } from '../../src/lib/db/tenant-db';
import { hasPermission, hasAllPermissions } from '../../src/lib/auth/permissions';

describe('Multi-Tenancy Foundation Unit Tests', () => {
  it('should throw an error if tenantId is missing or empty', () => {
    expect(() => getTenantDb('')).toThrowError(
      'Tenant isolation failure: Missing or invalid tenantId'
    );
  });

  it('should instantiate a scoped DB client when valid tenantId is provided', () => {
    const tenantDb = getTenantDb('tenant_123');
    expect(tenantDb).toBeDefined();
  });

  it('should correctly evaluate RBAC role permissions', () => {
    // OWNER has full management
    expect(hasPermission('OWNER', 'org:manage')).toBe(true);
    expect(hasPermission('OWNER', 'users:manage')).toBe(true);
    expect(hasPermission('OWNER', 'finance:manage')).toBe(true);

    // ADMIN has operational but not root org management
    expect(hasPermission('ADMIN', 'org:manage')).toBe(false);
    expect(hasPermission('ADMIN', 'users:manage')).toBe(true);
    expect(hasPermission('ADMIN', 'finance:read')).toBe(true);
    expect(hasPermission('ADMIN', 'finance:manage')).toBe(false);

    // MEMBER has member-level operational access
    expect(hasPermission('MEMBER', 'products:manage')).toBe(true);
    expect(hasPermission('MEMBER', 'users:manage')).toBe(false);

    // VIEWER has read-only access
    expect(hasPermission('VIEWER', 'products:read')).toBe(true);
    expect(hasPermission('VIEWER', 'products:manage')).toBe(false);
    expect(hasPermission('VIEWER', 'finance:manage')).toBe(false);
  });

  it('should evaluate compound permissions with hasAllPermissions', () => {
    expect(hasAllPermissions('OWNER', ['users:manage', 'products:manage', 'finance:manage'])).toBe(true);
    expect(hasAllPermissions('ADMIN', ['users:manage', 'products:manage', 'org:manage'])).toBe(false);
  });
});
