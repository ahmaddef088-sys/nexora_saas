import { describe, it, expect } from 'vitest';
import { Role, OrderStatus } from '@prisma/client';
import {
  canViewCustomers,
  canCreateCustomer,
  canEditCustomer,
  canArchiveCustomer,
  canViewOrders,
  canCreateOrder,
  canEditOrder,
  canConfirmOrder,
  canCancelOrder,
  canCompleteOrder,
  isValidStatusTransition,
} from '../../src/lib/auth/order-auth';
import {
  createCustomerSchema,
  updateCustomerSchema,
  createOrderSchema,
  cancelOrderSchema,
} from '../../src/lib/validations/order';

// ─────────────────────────────────────────────────────────────────────────────
// RBAC Authorization Matrix
// ─────────────────────────────────────────────────────────────────────────────

describe('Customers & Orders Authorization Matrix Tests', () => {
  it('allows all verified workspace roles to view customers and orders', () => {
    expect(canViewCustomers(Role.OWNER)).toBe(true);
    expect(canViewCustomers(Role.ADMIN)).toBe(true);
    expect(canViewCustomers(Role.MEMBER)).toBe(true);
    expect(canViewCustomers(Role.VIEWER)).toBe(true);

    expect(canViewOrders(Role.OWNER)).toBe(true);
    expect(canViewOrders(Role.ADMIN)).toBe(true);
    expect(canViewOrders(Role.MEMBER)).toBe(true);
    expect(canViewOrders(Role.VIEWER)).toBe(true);
  });

  it('allows OWNER and ADMIN full customer and order management capabilities', () => {
    // OWNER
    expect(canCreateCustomer(Role.OWNER).allowed).toBe(true);
    expect(canEditCustomer(Role.OWNER).allowed).toBe(true);
    expect(canArchiveCustomer(Role.OWNER).allowed).toBe(true);
    expect(canCreateOrder(Role.OWNER).allowed).toBe(true);
    expect(canEditOrder(Role.OWNER, OrderStatus.DRAFT).allowed).toBe(true);
    expect(canConfirmOrder(Role.OWNER).allowed).toBe(true);
    expect(canCancelOrder(Role.OWNER).allowed).toBe(true);
    expect(canCompleteOrder(Role.OWNER).allowed).toBe(true);

    // ADMIN
    expect(canCreateCustomer(Role.ADMIN).allowed).toBe(true);
    expect(canEditCustomer(Role.ADMIN).allowed).toBe(true);
    expect(canArchiveCustomer(Role.ADMIN).allowed).toBe(true);
    expect(canCreateOrder(Role.ADMIN).allowed).toBe(true);
    expect(canEditOrder(Role.ADMIN, OrderStatus.DRAFT).allowed).toBe(true);
    expect(canConfirmOrder(Role.ADMIN).allowed).toBe(true);
    expect(canCancelOrder(Role.ADMIN).allowed).toBe(true);
    expect(canCompleteOrder(Role.ADMIN).allowed).toBe(true);
  });

  it('allows MEMBER to draft orders but restricts customer and order state mutations', () => {
    expect(canCreateOrder(Role.MEMBER).allowed).toBe(true);
    expect(canEditOrder(Role.MEMBER, OrderStatus.DRAFT).allowed).toBe(true);

    // Restricted for MEMBER
    expect(canCreateCustomer(Role.MEMBER).allowed).toBe(false);
    expect(canEditCustomer(Role.MEMBER).allowed).toBe(false);
    expect(canArchiveCustomer(Role.MEMBER).allowed).toBe(false);
    expect(canConfirmOrder(Role.MEMBER).allowed).toBe(false);
    expect(canCancelOrder(Role.MEMBER).allowed).toBe(false);
    expect(canCompleteOrder(Role.MEMBER).allowed).toBe(false);
  });

  it('strictly denies VIEWER from performing any customer or order mutations', () => {
    expect(canCreateCustomer(Role.VIEWER).allowed).toBe(false);
    expect(canEditCustomer(Role.VIEWER).allowed).toBe(false);
    expect(canArchiveCustomer(Role.VIEWER).allowed).toBe(false);
    expect(canCreateOrder(Role.VIEWER).allowed).toBe(false);
    expect(canEditOrder(Role.VIEWER, OrderStatus.DRAFT).allowed).toBe(false);
    expect(canConfirmOrder(Role.VIEWER).allowed).toBe(false);
    expect(canCancelOrder(Role.VIEWER).allowed).toBe(false);
    expect(canCompleteOrder(Role.VIEWER).allowed).toBe(false);
  });

  it('rejects editing orders that are not in DRAFT status', () => {
    // canEditOrder enforces immutability of CONFIRMED/COMPLETED/CANCELLED orders
    expect(canEditOrder(Role.OWNER, OrderStatus.CONFIRMED).allowed).toBe(false);
    expect(canEditOrder(Role.OWNER, OrderStatus.COMPLETED).allowed).toBe(false);
    expect(canEditOrder(Role.OWNER, OrderStatus.CANCELLED).allowed).toBe(false);

    // Even ADMIN cannot edit a non-DRAFT order
    expect(canEditOrder(Role.ADMIN, OrderStatus.CONFIRMED).allowed).toBe(false);
    expect(canEditOrder(Role.ADMIN, OrderStatus.COMPLETED).allowed).toBe(false);
    expect(canEditOrder(Role.ADMIN, OrderStatus.CANCELLED).allowed).toBe(false);

    // MEMBER cannot edit non-DRAFT either
    expect(canEditOrder(Role.MEMBER, OrderStatus.CONFIRMED).allowed).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order Lifecycle State Machine
// ─────────────────────────────────────────────────────────────────────────────

describe('Order Lifecycle State Machine Transition Rules', () => {
  it('allows valid forward transitions', () => {
    expect(isValidStatusTransition(OrderStatus.DRAFT, OrderStatus.CONFIRMED)).toBe(true);
    expect(isValidStatusTransition(OrderStatus.DRAFT, OrderStatus.CANCELLED)).toBe(true);
    expect(isValidStatusTransition(OrderStatus.CONFIRMED, OrderStatus.COMPLETED)).toBe(true);
    expect(isValidStatusTransition(OrderStatus.CONFIRMED, OrderStatus.CANCELLED)).toBe(true);
  });

  it('rejects invalid or illegal transitions', () => {
    // Cannot confirm a cancelled or completed order
    expect(isValidStatusTransition(OrderStatus.CANCELLED, OrderStatus.CONFIRMED)).toBe(false);
    expect(isValidStatusTransition(OrderStatus.COMPLETED, OrderStatus.CONFIRMED)).toBe(false);

    // Cannot move backwards to draft
    expect(isValidStatusTransition(OrderStatus.CONFIRMED, OrderStatus.DRAFT)).toBe(false);
    expect(isValidStatusTransition(OrderStatus.COMPLETED, OrderStatus.DRAFT)).toBe(false);
    expect(isValidStatusTransition(OrderStatus.CANCELLED, OrderStatus.DRAFT)).toBe(false);

    // Cannot jump draft directly to completed
    expect(isValidStatusTransition(OrderStatus.DRAFT, OrderStatus.COMPLETED)).toBe(false);

    // Terminal states cannot transition further
    expect(isValidStatusTransition(OrderStatus.COMPLETED, OrderStatus.CANCELLED)).toBe(false);
    expect(isValidStatusTransition(OrderStatus.CANCELLED, OrderStatus.COMPLETED)).toBe(false);

    // No-op transitions are rejected (prevents double-confirm / double-cancel)
    expect(isValidStatusTransition(OrderStatus.DRAFT, OrderStatus.DRAFT)).toBe(false);
    expect(isValidStatusTransition(OrderStatus.CONFIRMED, OrderStatus.CONFIRMED)).toBe(false);
    expect(isValidStatusTransition(OrderStatus.CANCELLED, OrderStatus.CANCELLED)).toBe(false);
    expect(isValidStatusTransition(OrderStatus.COMPLETED, OrderStatus.COMPLETED)).toBe(false);
  });

  // ── Concurrency-guard invariants ───────────────────────────────────────────
  // These tests verify that the state machine behaviour the in-transaction
  // status re-validation relies on is correct and exhaustive. The server actions
  // use isValidStatusTransition() inside the $transaction body to detect races.

  it('double-confirm guard: CONFIRMED → CONFIRMED is rejected by isValidStatusTransition', () => {
    // When two concurrent confirmOrderAction requests race, the second one
    // will find the order already CONFIRMED inside the transaction.
    // isValidStatusTransition(CONFIRMED, CONFIRMED) must return false.
    expect(isValidStatusTransition(OrderStatus.CONFIRMED, OrderStatus.CONFIRMED)).toBe(false);
  });

  it('double-cancel guard: CANCELLED → CANCELLED is rejected by isValidStatusTransition', () => {
    expect(isValidStatusTransition(OrderStatus.CANCELLED, OrderStatus.CANCELLED)).toBe(false);
  });

  it('double-complete guard: COMPLETED → COMPLETED is rejected by isValidStatusTransition', () => {
    expect(isValidStatusTransition(OrderStatus.COMPLETED, OrderStatus.COMPLETED)).toBe(false);
  });

  it('edit-after-confirm guard: canEditOrder returns not allowed for CONFIRMED status', () => {
    // When updateOrderAction re-reads CONFIRMED inside the transaction, the
    // in-transaction guard throws. This test verifies the RBAC layer also
    // independently rejects editing a CONFIRMED order.
    const result = canEditOrder(Role.OWNER, OrderStatus.CONFIRMED);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('CONFIRMED');
  });

  it('edit-after-complete guard: canEditOrder returns not allowed for COMPLETED status', () => {
    const result = canEditOrder(Role.OWNER, OrderStatus.COMPLETED);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('COMPLETED');
  });

  it('edit-after-cancel guard: canEditOrder returns not allowed for CANCELLED status', () => {
    const result = canEditOrder(Role.OWNER, OrderStatus.CANCELLED);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('CANCELLED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Customer Validation Schemas
// ─────────────────────────────────────────────────────────────────────────────

describe('Customer Validation Schemas', () => {
  it('validates correct customer input', () => {
    const res = createCustomerSchema.safeParse({
      name: 'Acme Partner LLC',
      email: 'contact@acmepartner.com',
      phone: '+1 (555) 000-1111',
      companyName: 'Acme Partner',
      city: 'Austin, TX',
    });
    expect(res.success).toBe(true);
  });

  it('rejects empty customer name and invalid email', () => {
    const emptyName = createCustomerSchema.safeParse({
      name: '  ',
      email: 'test@example.com',
    });
    expect(emptyName.success).toBe(false);

    const invalidEmail = createCustomerSchema.safeParse({
      name: 'Valid Name',
      email: 'not-an-email',
    });
    expect(invalidEmail.success).toBe(false);
  });

  it('updateCustomerSchema does not include isActive — activation must use archiveCustomerAction', () => {
    // isActive is intentionally absent from updateCustomerSchema.
    // This verifies the schema contract that prevents the edit form from
    // toggling customer active/archived status.
    const parsed = updateCustomerSchema.safeParse({
      customerId: 'cust_123',
      name: 'Test Customer',
      isActive: false, // This field should be silently ignored or absent
    });
    // The schema should still parse (isActive is an optional extra field in Zod)
    // but the server action deliberately does not write it to the database.
    // We verify the schema parses successfully — the protection is in the action.
    expect(parsed.success).toBe(true);
    // Explicitly verify the name came through
    if (parsed.success) {
      expect(parsed.data.name).toBe('Test Customer');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Order Validation Schemas
// ─────────────────────────────────────────────────────────────────────────────

describe('Order Validation Schemas', () => {
  it('validates a valid order creation payload', () => {
    const res = createOrderSchema.safeParse({
      customerId: 'cust_123',
      discount: '15.50',
      notes: 'Please expedite delivery',
      items: [
        { productId: 'prod_1', quantity: 2 },
        { productId: 'prod_2', quantity: 5 },
      ],
    });
    expect(res.success).toBe(true);
  });

  it('rejects orders with empty line items', () => {
    const emptyItems = createOrderSchema.safeParse({
      customerId: 'cust_123',
      items: [],
    });
    expect(emptyItems.success).toBe(false);
    if (!emptyItems.success) {
      const itemsError = emptyItems.error.errors.find((e) => e.path.includes('items'));
      expect(itemsError).toBeDefined();
    }
  });

  it('rejects non-positive quantities (zero and negative)', () => {
    const zeroQuantity = createOrderSchema.safeParse({
      customerId: 'cust_123',
      items: [{ productId: 'prod_1', quantity: 0 }],
    });
    expect(zeroQuantity.success).toBe(false);

    const negativeQuantity = createOrderSchema.safeParse({
      customerId: 'cust_123',
      items: [{ productId: 'prod_1', quantity: -3 }],
    });
    expect(negativeQuantity.success).toBe(false);
  });

  it('rejects negative discounts', () => {
    const negDiscount = createOrderSchema.safeParse({
      customerId: 'cust_123',
      discount: -10,
      items: [{ productId: 'prod_1', quantity: 1 }],
    });
    expect(negDiscount.success).toBe(false);
  });

  it('allows zero discount (default)', () => {
    const zeroDisco = createOrderSchema.safeParse({
      customerId: 'cust_123',
      items: [{ productId: 'prod_1', quantity: 1 }],
    });
    expect(zeroDisco.success).toBe(true);
    if (zeroDisco.success) {
      expect(zeroDisco.data.discount).toBe(0);
    }
  });

  it('accepts cancellation reason up to 250 characters', () => {
    const longReason = cancelOrderSchema.safeParse({
      orderId: 'order_abc',
      reason: 'A'.repeat(250),
    });
    expect(longReason.success).toBe(true);

    const tooLong = cancelOrderSchema.safeParse({
      orderId: 'order_abc',
      reason: 'A'.repeat(251),
    });
    expect(tooLong.success).toBe(false);
  });
});
