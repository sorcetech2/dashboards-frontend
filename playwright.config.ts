import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const port = 3100;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  outputDir: 'output/playwright/test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'output/playwright/report', open: 'never' }]
  ],
  timeout: 60_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: `pnpm dev --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      AUTH_SECRET: 'fixture-only-auth-secret-with-at-least-32-characters',
      NEXTAUTH_URL: baseURL,
      AUTH_USER_REGISTRY_SOURCE: 'local',
      AUTH_USER_REGISTRY_LOCAL_PATH: path.join(
        process.cwd(),
        'tests',
        'fixtures',
        'e2e-user-registry.json'
      ),
      SORCE_DATA_SOURCE: 'local',
      SORCE_DATA_LOCAL_ROOT: path.join(
        process.cwd(),
        'tests',
        'fixtures',
        'dashboard'
      ),
      SORCE_TEAM_STATS_KEY: 'populated-team-stats.json'
    }
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // The desktop environment already provides Chrome. CI installs the
        // pinned Playwright browser to keep hosted runs reproducible.
        channel: process.env.CI ? undefined : 'chrome'
      }
    }
  ]
});
