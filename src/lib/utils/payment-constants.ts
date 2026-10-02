/**
 * Shared payment method display labels.
 * This module is intentionally NOT marked 'use client' so it can be safely
 * imported by both Server Components and Client Components without triggering
 * the React Client Manifest resolution error.
 */
import { PaymentMethod } from '@prisma/client';

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Bank Transfer',
  CREDIT_CARD: 'Credit Card',
  CASH: 'Cash',
  CHECK: 'Check',
  STRIPE: 'Stripe',
  OTHER: 'Other',
};
