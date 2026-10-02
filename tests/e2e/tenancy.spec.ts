import { test, expect } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

test.describe('Multi-Tenant Isolation E2E', () => {
  test('Acme user accesses Acme dashboard and cannot access Globex workspace (403)', async ({ page }) => {
    // 1. Log in as Acme Admin
    await loginAs(page, DEMO_USERS.acmeAdmin);
    await expect(page.getByText('Acme Corporation').first()).toBeVisible();

    // 2. Attempt direct URL manipulation to Globex tenant workspace
    await page.goto('/globex-corp');

    // Verify 403 Forbidden / Access Denied UI
    const heading = page.locator('h1, h2');
    await expect(heading.filter({ hasText: /Access Denied|Forbidden|Unauthorized/i }).first()).toBeVisible();
  });

  test('Globex user accesses Globex dashboard and cannot access Acme workspace (403)', async ({ page }) => {
    // 1. Log in as Globex Owner
    await loginAs(page, DEMO_USERS.globexOwner);
    await expect(page.getByText('Globex Corporation').first()).toBeVisible();

    // 2. Attempt direct URL manipulation to Acme tenant workspace
    await page.goto('/acme-corp');

    // Verify 403 Forbidden / Access Denied UI
    const heading = page.locator('h1, h2');
    await expect(heading.filter({ hasText: /Access Denied|Forbidden|Unauthorized/i }).first()).toBeVisible();
  });

  test('direct access to financial/order subroutes of unauthorized tenant is blocked', async ({ page }) => {
    await loginAs(page, DEMO_USERS.acmeAdmin);

    // Direct access to Globex finance routes
    await page.goto('/globex-corp/finance/invoices');
    const heading = page.locator('h1, h2');
    await expect(heading.filter({ hasText: /Access Denied|Forbidden|Unauthorized/i }).first()).toBeVisible();

    // Direct access to Globex reports route
    await page.goto('/globex-corp/reports');
    await expect(heading.filter({ hasText: /Access Denied|Forbidden|Unauthorized/i }).first()).toBeVisible();
  });
});
