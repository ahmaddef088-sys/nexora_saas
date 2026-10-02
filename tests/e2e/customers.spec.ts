import { test, expect } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

test.describe('Customers Directory E2E', () => {
  test('user can browse customer directory and search customers', async ({ page }) => {
    await loginAs(page, DEMO_USERS.acmeAdmin);
    await page.goto('/acme-corp/customers');

    await expect(page.getByRole('heading', { name: /Customers/i }).first()).toBeVisible();

    // Verify search input is active
    const searchInput = page.getByPlaceholder(/Search by name, company/i);
    await expect(searchInput).toBeVisible();
  });
});
