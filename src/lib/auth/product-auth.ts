import { Role } from '@prisma/client';

export interface AuthDecision {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if an actor role can view the products catalog.
 * All verified workspace roles have read access.
 */
export function canViewProducts(actorRole: Role): boolean {
  return [Role.OWNER, Role.ADMIN, Role.MEMBER, Role.VIEWER].includes(actorRole);
}

/**
 * Check if an actor role can create a new product.
 * OWNER and ADMIN can create products.
 */
export function canCreateProduct(actorRole: Role): AuthDecision {
  if (actorRole === Role.OWNER || actorRole === Role.ADMIN) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'You do not have permission to create products in this workspace.',
  };
}

/**
 * Check if an actor role can edit product details.
 * OWNER and ADMIN can edit products.
 */
export function canEditProduct(actorRole: Role): AuthDecision {
  if (actorRole === Role.OWNER || actorRole === Role.ADMIN) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'You do not have permission to edit products in this workspace.',
  };
}

/**
 * Check if an actor role can archive/deactivate a product.
 * OWNER and ADMIN can archive products.
 */
export function canArchiveProduct(actorRole: Role): AuthDecision {
  if (actorRole === Role.OWNER || actorRole === Role.ADMIN) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'You do not have permission to archive products in this workspace.',
  };
}

/**
 * Check if an actor role can create/edit categories.
 * OWNER and ADMIN can manage categories.
 */
export function canManageCategories(actorRole: Role): AuthDecision {
  if (actorRole === Role.OWNER || actorRole === Role.ADMIN) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'You do not have permission to manage categories in this workspace.',
  };
}

/**
 * Check if an actor role can perform inventory adjustments (Stock In, Stock Out, Adjustment).
 * OWNER and ADMIN can adjust inventory.
 */
export function canAdjustInventory(actorRole: Role): AuthDecision {
  if (actorRole === Role.OWNER || actorRole === Role.ADMIN) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'You do not have permission to adjust inventory in this workspace.',
  };
}

/**
 * Check if an actor role can view the inventory movement history audit trail.
 * All verified workspace roles have read access.
 */
export function canViewInventoryHistory(actorRole: Role): boolean {
  return [Role.OWNER, Role.ADMIN, Role.MEMBER, Role.VIEWER].includes(actorRole);
}
