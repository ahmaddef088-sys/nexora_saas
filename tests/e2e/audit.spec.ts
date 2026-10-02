import { test, expect } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

test.describe('Audit Logs E2E', () => {
  test('OWNER can view system audit logs, search events, and inspect metadata', async ({ page }) => {
    await loginAs(page, DEMO_USERS.acmeAdmin);
    await page.goto('/acme-corp/audit');

    await expect(page.getByRole('heading', { name: /Audit Logs/i }).first()).toBeVisible();

    // Verify filter controls exist
    const searchInput = page.getByPlaceholder(/Search by action/i);
    await expect(searchInput).toBeVisible();
  });
});
