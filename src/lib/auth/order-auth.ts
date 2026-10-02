import { Role, OrderStatus } from '@prisma/client';

export interface AuthDecision {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if a role can view customers.
 * All verified workspace roles can view customers.
 */
export function canViewCustomers(actorRole: Role): boolean {
  return [Role.OWNER, Role.ADMIN, Role.MEMBER, Role.VIEWER].includes(actorRole);
}

/**
 * Check if a role can create customers.
 * OWNER and ADMIN can create customers.
 */
export function canCreateCustomer(actorRole: Role): AuthDecision {
  if (actorRole === Role.OWNER || actorRole === Role.ADMIN) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'You do not have permission to create customers in this workspace.',
  };
}

/**
 * Check if a role can edit customers.
 * OWNER and ADMIN can edit customers.
 */
export function canEditCustomer(actorRole: Role): AuthDecision {
  if (actorRole === Role.OWNER || actorRole === Role.ADMIN) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'You do not have permission to edit customers in this workspace.',
  };
}

/**
 * Check if a role can archive/deactivate customers.
 * OWNER and ADMIN can archive customers.
 */
export function canArchiveCustomer(actorRole: Role): AuthDecision {
  if (actorRole === Role.OWNER || actorRole === Role.ADMIN) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'You do not have permission to archive customers in this workspace.',
  };
}

/**
 * Check if a role can view orders.
 * All verified workspace roles can view orders.
 */
export function canViewOrders(actorRole: Role): boolean {
  return [Role.OWNER, Role.ADMIN, Role.MEMBER, Role.VIEWER].includes(actorRole);
}

/**
 * Check if a role can create orders (as DRAFT).
 * OWNER, ADMIN, and MEMBER can draft orders.
 */
export function canCreateOrder(actorRole: Role): AuthDecision {
  if (actorRole === Role.OWNER || actorRole === Role.ADMIN || actorRole === Role.MEMBER) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'You do not have permission to create orders in this workspace.',
  };
}

/**
 * Check if a role can edit an order.
 * Only DRAFT orders can be edited by OWNER, ADMIN, or MEMBER.
 */
export function canEditOrder(actorRole: Role, orderStatus: OrderStatus = OrderStatus.DRAFT): AuthDecision {
  if (orderStatus !== OrderStatus.DRAFT) {
    return {
      allowed: false,
      reason: `Orders in ${orderStatus} status cannot be modified. Only DRAFT orders can be edited.`,
    };
  }

  if (actorRole === Role.OWNER || actorRole === Role.ADMIN || actorRole === Role.MEMBER) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'You do not have permission to edit orders in this workspace.',
  };
}

/**
 * Check if a role can confirm an order (triggering inventory deduction).
 * OWNER and ADMIN can confirm orders.
 */
export function canConfirmOrder(actorRole: Role): AuthDecision {
  if (actorRole === Role.OWNER || actorRole === Role.ADMIN) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'You do not have permission to confirm orders and deduct inventory in this workspace.',
  };
}

/**
 * Check if a role can cancel an order (and restore inventory if already confirmed).
 * OWNER and ADMIN can cancel orders.
 */
export function canCancelOrder(actorRole: Role): AuthDecision {
  if (actorRole === Role.OWNER || actorRole === Role.ADMIN) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'You do not have permission to cancel orders in this workspace.',
  };
}

/**
 * Check if a role can mark an order as completed.
 * OWNER and ADMIN can complete orders.
 */
export function canCompleteOrder(actorRole: Role): AuthDecision {
  if (actorRole === Role.OWNER || actorRole === Role.ADMIN) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'You do not have permission to mark orders as completed in this workspace.',
  };
}

/**
 * Pure state machine transition validation for Order lifecycle.
 */
export function isValidStatusTransition(
  currentStatus: OrderStatus,
  targetStatus: OrderStatus
): boolean {
  if (currentStatus === targetStatus) {
    return false; // No-op transition is invalid/rejected
  }

  switch (currentStatus) {
    case OrderStatus.DRAFT:
      return targetStatus === OrderStatus.CONFIRMED || targetStatus === OrderStatus.CANCELLED;
    case OrderStatus.CONFIRMED:
      return targetStatus === OrderStatus.COMPLETED || targetStatus === OrderStatus.CANCELLED;
    case OrderStatus.COMPLETED:
    case OrderStatus.CANCELLED:
      return false; // Terminal states cannot transition further
    default:
      return false;
  }
}
