import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end smoke tests. By default they run against the in-browser mock
 * backend; with E2E_REAL_API=1 they run against the Django API on :8000
 * (start it and run `python manage.py seed_demo --reset` first).
 */
const realApi = !!process.env.E2E_REAL_API;
const port = realApi ? 5184 : 5174;
export default defineConfig({
  testDir: './e2e',
  // The real API has one shared database, so tests that change data run one at a time
  fullyParallel: !realApi,
  workers: realApi ? 1 : undefined,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${port}`, trace: 'on-first-retry' },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } } },
  ],
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    env: { VITE_MOCK_LATENCY_MS: '0', VITE_USE_MOCKS: realApi ? 'false' : 'true', VITE_SHOW_DEMO: 'true' },
  },
});
