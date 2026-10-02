import { test, expect } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

test.describe('Users & Team Memberships E2E', () => {
  test('OWNER can view team members list and search members', async ({ page }) => {
    await loginAs(page, DEMO_USERS.acmeAdmin);
    await page.goto('/acme-corp/users');

    // Verify members table displays seeded members
    await expect(page.getByText('Acme Admin').first()).toBeVisible();
    await expect(page.getByText('admin@acme.com').first()).toBeVisible();
    await expect(page.getByText('Alex Member').first()).toBeVisible();
    await expect(page.getByText('member@acme.com').first()).toBeVisible();

    // Search filter
    const searchInput = page.getByPlaceholder(/Search by name or email/i);
    await searchInput.fill('Alex');
    await expect(page.getByText('Alex Member').first()).toBeVisible();
  });
});
