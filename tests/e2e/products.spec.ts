import { test, expect } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

test.describe('Products & Inventory E2E', () => {
  test('user can browse products and view stock levels', async ({ page }) => {
    await loginAs(page, DEMO_USERS.acmeAdmin);
    await page.goto('/acme-corp/products');

    await expect(page.getByRole('heading', { name: /Product/i }).first()).toBeVisible();

    // Verify seeded product exists
    await expect(page.getByText('Enterprise Server X1')).toBeVisible();
    await expect(page.getByText('SRV-X1')).toBeVisible();

    // Navigate to Inventory Control
    await page.goto('/acme-corp/products/inventory');
    await expect(page.getByRole('heading', { name: /Inventory/i }).first()).toBeVisible();
  });
});
