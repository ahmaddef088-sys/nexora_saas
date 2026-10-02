import { test, expect } from '@playwright/test';
import { DEMO_USERS, loginAs, signOut } from './helpers/auth';

test.describe('Authentication & Session Management E2E', () => {
  test('unauthenticated user is redirected to login with callbackUrl', async ({ page }) => {
    await page.goto('/acme-corp');
    await page.waitForURL('**/login?callbackUrl=%2Facme-corp*');
    await expect(page.getByRole('heading', { name: /Sign in to Nexora/i })).toBeVisible();
  });

  test('user can log in successfully with valid credentials', async ({ page }) => {
    await loginAs(page, DEMO_USERS.acmeAdmin);
    await expect(page).toHaveURL(/\/acme-corp/);
    await expect(page.getByText('Acme Corporation').first()).toBeVisible();
    await expect(page.getByText('Acme Admin').first()).toBeVisible();
  });

  test('login fails with clear error message on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input#email', 'invalid@user.com');
    await page.fill('input#password', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    const alert = page.locator('div[role="alert"]').filter({ hasText: /Invalid email address or password/i });
    await expect(alert).toBeVisible();
  });

  test('user can sign out successfully and protected routes become inaccessible', async ({ page }) => {
    await loginAs(page, DEMO_USERS.acmeAdmin);
    await signOut(page);

    // Attempting to navigate back to protected dashboard should redirect to login
    await page.goto('/acme-corp');
    await page.waitForURL('**/login*');
    await expect(page.getByRole('heading', { name: /Sign in to Nexora/i })).toBeVisible();
  });
});
