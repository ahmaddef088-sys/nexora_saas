import { Page, expect } from '@playwright/test';

export const DEMO_USERS = {
  acmeAdmin: {
    name: 'Acme Admin',
    email: 'admin@acme.com',
    password: process.env.SEED_DEFAULT_PASSWORD || 'Password123!',
    slug: 'acme-corp',
    tenantName: 'Acme Corporation',
    role: 'OWNER',
  },
  acmeMember: {
    name: 'Alex Member',
    email: 'member@acme.com',
    password: process.env.SEED_DEFAULT_PASSWORD || 'Password123!',
    slug: 'acme-corp',
    tenantName: 'Acme Corporation',
    role: 'MEMBER',
  },
  globexOwner: {
    name: 'Globex Owner',
    email: 'owner@globex.com',
    password: process.env.SEED_DEFAULT_PASSWORD || 'Password123!',
    slug: 'globex-corp',
    tenantName: 'Globex Corporation',
    role: 'OWNER',
  },
};

/**
 * Log in as a specific user and navigate to target URL.
 */
export async function loginAs(
  page: Page,
  user: typeof DEMO_USERS.acmeAdmin = DEMO_USERS.acmeAdmin,
  targetUrl?: string
) {
  const destination = targetUrl || `/${user.slug}`;
  const loginUrl = `/login?callbackUrl=${encodeURIComponent(destination)}`;
  await page.goto(loginUrl);

  // Fill in credentials
  await page.fill('input#email', user.email);
  await page.fill('input#password', user.password);
  await page.click('button[type="submit"]');

  // Wait for redirect to destination
  await page.waitForURL(`**${destination}*`);
}

/**
 * Sign out from the current dashboard session.
 */
export async function signOut(page: Page) {
  const signOutBtn = page.getByRole('button', { name: /Sign Out|Logout/i }).first();
  if (await signOutBtn.isVisible()) {
    await signOutBtn.click();
    await page.waitForURL('**/login*');
  }
}

/**
 * Verify 403 Forbidden / Access Denied UI is rendered.
 */
export async function expectAccessDenied(page: Page) {
  const heading = page.locator('h1, h2');
  await expect(heading.filter({ hasText: /Access Denied|Unauthorized|Forbidden/i }).first()).toBeVisible();
}
