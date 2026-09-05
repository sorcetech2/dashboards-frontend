import { expect, test } from '@playwright/test';

// Cold `next dev` route compilation dominates the first visit to each route.
const FIRST_ROUTE_TIMEOUT_MS = process.env.CI ? 60_000 : 20_000;

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
  // `next dev` compiles /dashboard on the first request, which can take far
  // longer than the default expect timeout on a cold CI runner.
  await expect(page).toHaveURL(/\/dashboard(?:\/|$)/, {
    timeout: FIRST_ROUTE_TIMEOUT_MS
  });
}

/**
 * Open the team picker with the keyboard. The server-rendered trigger exists
 * before React attaches its handlers, so an early Space press is swallowed;
 * retry until the listbox actually opens rather than waiting on a network
 * signal that never settles while the dev server keeps its HMR socket open.
 */
async function openTeamPickerByKeyboard(
  page: import('@playwright/test').Page,
  picker: import('@playwright/test').Locator
) {
  await expect(async () => {
    await picker.focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('option', { name: /Design/ })).toBeVisible({
      timeout: 1_000
    });
  }).toPass({ timeout: FIRST_ROUTE_TIMEOUT_MS });
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
  await openTeamPickerByKeyboard(page, picker);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/dashboard\/design$/, {
    timeout: FIRST_ROUTE_TIMEOUT_MS
  });
  await expect(picker).toHaveAccessibleName('Selected team: Design');
  await expect(page.getByRole('link', { name: 'Team Stats' })).toHaveCount(0);

  await page.goto('/dashboard/not-a-team');
  await expect(
    page.getByRole('heading', { name: 'Team not found' })
  ).toBeVisible({ timeout: FIRST_ROUTE_TIMEOUT_MS });
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/dashboard$/, {
    timeout: FIRST_ROUTE_TIMEOUT_MS
  });

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('admin can reach team statistics', async ({ page }) => {
  await signIn(page, 'admin');
  await page.getByRole('link', { name: 'Team Stats' }).click();
  await expect(page).toHaveURL(/\/teamstats$/, {
    timeout: FIRST_ROUTE_TIMEOUT_MS
  });
  await expect(page.getByRole('heading', { name: 'Companies' })).toBeVisible({
    timeout: FIRST_ROUTE_TIMEOUT_MS
  });

  await page.getByRole('link', { name: 'Users' }).click();
  await expect(page).toHaveURL(/\/admin\/users$/, {
    timeout: FIRST_ROUTE_TIMEOUT_MS
  });
  await expect(
    page.getByRole('heading', { name: 'Users', exact: true })
  ).toBeVisible({ timeout: FIRST_ROUTE_TIMEOUT_MS });
  await expect(page.getByText('Dashboard users')).toBeVisible();
});
