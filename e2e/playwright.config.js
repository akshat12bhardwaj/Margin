import { defineConfig, devices } from '@playwright/test';

const PORT = 5055;
export const DB = 'mongodb://127.0.0.1:27017/academic_marketplace_e2e';

export default defineConfig({
  testDir: './tests',
  // The specs share one database and build on each other's data.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  globalSetup: './global-setup.js',
  use: { baseURL: `http://localhost:${PORT}`, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node ../server/src/index.js',
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    stdout: 'pipe',
    env: {
      MONGODB_URI: DB,
      JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e-1234',
      PORT: String(PORT),
      NODE_ENV: 'test',
      CLIENT_URL: `http://localhost:${PORT}`,
      AUTH_RATE_LIMIT: '100000',
      UPLOAD_DIR: './test-results/uploads',
    },
  },
});
