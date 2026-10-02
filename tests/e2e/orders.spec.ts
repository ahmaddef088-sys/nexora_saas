import { test, expect } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

test.describe('Orders Lifecycle E2E', () => {
  test('user can access orders dashboard and view order listings', async ({ page }) => {
    await loginAs(page, DEMO_USERS.acmeAdmin);
    await page.goto('/acme-corp/orders');

    await expect(page.getByRole('heading', { name: /Orders/i }).first()).toBeVisible();

    // Verify KPI summary cards
    await expect(page.getByText('Total Orders').first()).toBeVisible();
    await expect(page.getByText('Total Volume').first()).toBeVisible();
  });
});
