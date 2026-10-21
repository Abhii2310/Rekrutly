import { defineConfig } from '@playwright/test';

// The specs need RECRUITER_PASSCODE and the app needs the rest, so read .env.local the way `npm run dev` does.
try { process.loadEnvFile('.env.local'); } catch { /* CI sets the variables itself */ }

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: 'tests/e2e',
  // The specs share one database and reset demo data, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  timeout: 300_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: { baseURL, trace: 'retain-on-failure' },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : { command: 'npm run dev', url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
