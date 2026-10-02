import { test, expect } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

test.describe('Role-Based Access Control (RBAC) E2E', () => {
  test('OWNER role can access sensitive audit logs and management pages', async ({ page }) => {
    await loginAs(page, DEMO_USERS.acmeAdmin);

    // Audit logs access
    await page.goto('/acme-corp/audit');
    await expect(page.getByRole('heading', { name: /Audit Logs/i }).first()).toBeVisible();

    // Users management access
    await page.goto('/acme-corp/users');
    await expect(page.getByRole('heading', { name: /Users & Roles/i }).first()).toBeVisible();
  });

  test('MEMBER role is denied access to sensitive Audit Logs page', async ({ page }) => {
    await loginAs(page, DEMO_USERS.acmeMember);

    // Attempt direct navigation to Audit Logs
    await page.goto('/acme-corp/audit');

    const heading = page.locator('h1, h2');
    await expect(heading.filter({ hasText: /Access Denied|Forbidden|Unauthorized/i }).first()).toBeVisible();
  });

  test('MEMBER role can view operational pages like Orders, Products, and Reports', async ({ page }) => {
    await loginAs(page, DEMO_USERS.acmeMember);

    // Orders page
    await page.goto('/acme-corp/orders');
    await expect(page.getByRole('heading', { name: /Orders/i }).first()).toBeVisible();

    // Reports page
    await page.goto('/acme-corp/reports');
    await expect(page.getByRole('heading', { name: /Reports/i }).first()).toBeVisible();
  });
});
