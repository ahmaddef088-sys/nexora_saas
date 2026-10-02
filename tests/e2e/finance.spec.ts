import { test, expect } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

test.describe('Financial Management Hub E2E', () => {
  test('user can view Invoices, Payments, Expenses, Receivables, and General Ledger', async ({ page }) => {
    test.setTimeout(60000);
    await loginAs(page, DEMO_USERS.acmeAdmin);

    // 1. Invoices
    await page.goto('/acme-corp/finance/invoices');
    await expect(page.getByRole('heading', { name: /Invoices/i }).first()).toBeVisible();

    // 2. Payments
    await page.goto('/acme-corp/finance/payments');
    await expect(page.getByRole('heading', { name: /Payments/i }).first()).toBeVisible();

    // 3. Expenses
    await page.goto('/acme-corp/finance/expenses');
    await expect(page.getByRole('heading', { name: /Expenses/i }).first()).toBeVisible();

    // 4. Accounts Receivable
    await page.goto('/acme-corp/finance/receivables');
    await expect(page.getByRole('heading', { name: /Accounts Receivable/i }).first()).toBeVisible();

    // 5. General Ledger
    await page.goto('/acme-corp/finance/ledger');
    await expect(page.getByRole('heading', { name: /General Ledger/i }).first()).toBeVisible();
  });
});
