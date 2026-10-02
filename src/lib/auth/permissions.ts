import { Role } from '@prisma/client';

export type Permission =
  | 'org:manage'
  | 'users:manage'
  | 'users:read'
  | 'products:manage'
  | 'products:read'
  | 'orders:manage'
  | 'orders:read'
  | 'finance:manage'
  | 'finance:read'
  | 'reports:read'
  | 'audit:read';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: [
    'org:manage',
    'users:manage',
    'users:read',
    'products:manage',
    'products:read',
    'orders:manage',
    'orders:read',
    'finance:manage',
    'finance:read',
    'reports:read',
    'audit:read',
  ],
  ADMIN: [
    'users:manage',
    'users:read',
    'products:manage',
    'products:read',
    'orders:manage',
    'orders:read',
    'finance:read',
    'reports:read',
    'audit:read',
  ],
  MEMBER: [
    'users:read',
    'products:manage',
    'products:read',
    'orders:manage',
    'orders:read',
    'reports:read',
  ],
  VIEWER: [
    'users:read',
    'products:read',
    'orders:read',
    'reports:read',
  ],
};

/**
 * Check if a given role possesses a specific permission.
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if a role possesses ALL specified permissions.
 */
export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every((perm) => hasPermission(role, perm));
}
