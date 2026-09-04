import { expect, test } from '@playwright/test';

async function signIn(
  page: import('@playwright/test').Page,
  role: 'viewer' | 'admin'
) {
  await page.goto('/login');
  await page.getByLabel('Username').fill(role);
  await page
    .getByLabel('Password')
    .fill(role === 'admin' ? 'admin-test-password' : 'viewer-test-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\/|$)/);
  // SSR content appears before client event handlers are attached in dev;
  // wait for hydration so the keyboard-only picker check is deterministic.
  await page.waitForLoadState('networkidle');
}

test('unknown credentials fail generically', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Username').fill('unknown');
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText('Invalid username or password.')).toBeVisible();
});

test('viewer can switch teams by keyboard and sign out on mobile', async ({
  page
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page, 'viewer');

  const picker = page.getByRole('combobox', { name: /Selected team/ });
  await expect(picker).toHaveAccessibleName('Selected team: Engineering');
  await picker.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('option', { name: /Design/ })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/dashboard\/design$/);
  await expect(picker).toHaveAccessibleName('Selected team: Design');
  await expect(page.getByRole('link', { name: 'Team Stats' })).toHaveCount(0);

  await page.goto('/dashboard/not-a-team');
  await expect(
    page.getByRole('heading', { name: 'Team not found' })
  ).toBeVisible();
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('admin can reach team statistics', async ({ page }) => {
  await signIn(page, 'admin');
  await page.getByRole('link', { name: 'Team Stats' }).click();
  await expect(page).toHaveURL(/\/teamstats$/);
  await expect(page.getByRole('heading', { name: 'Companies' })).toBeVisible();

  await page.getByRole('link', { name: 'Users' }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(
    page.getByRole('heading', { name: 'Users', exact: true })
  ).toBeVisible();
  await expect(page.getByText('Dashboard users')).toBeVisible();
});
