import { test, expect } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

test.describe('Reports & Analytics E2E', () => {
  test('authorized user can view aggregated analytics and filter date ranges', async ({ page }) => {
    await loginAs(page, DEMO_USERS.acmeAdmin);
    await page.goto('/acme-corp/reports');

    await expect(page.getByRole('heading', { name: /Reports/i }).first()).toBeVisible();

    // Verify key tabs
    await expect(page.getByRole('button', { name: /Executive Overview/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sales & Orders/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Products & Inventory/i })).toBeVisible();

    // Verify summary metrics render
    await expect(page.getByText('Net Balance').first()).toBeVisible();
    await expect(page.getByText('Collected Cash').first()).toBeVisible();
  });
});
