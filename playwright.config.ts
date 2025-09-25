/**
 * Playwright Configuration for End-to-End Testing
 * Comprehensive E2E testing setup for production deployment readiness
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  // Test directory
  testDir: './__tests__/e2e',

  // Global test configuration
  globalSetup: require.resolve('./__tests__/e2e/global-setup'),
  globalTeardown: require.resolve('./__tests__/e2e/global-teardown'),

  // Timeout settings
  timeout: 30000,
  expect: {
    timeout: 10000,
  },

  // Retry configuration for CI stability
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }]
  ],

  // Test matching patterns
  testMatch: [
    '**/__tests__/e2e/**/*.test.{ts,js}',
    '**/__tests__/e2e/**/*.spec.{ts,js}'
  ],

  // Global test configuration
  use: {
    // Base URL for tests
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // Browser context options
    contextOptions: {
      ignoreHTTPSErrors: true,
    },

    // Screenshot and video settings
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Tracing for debugging
    trace: 'on-first-retry',

    // Action timeout
    actionTimeout: 10000,

    // Navigation timeout
    navigationTimeout: 30000,
  },

  // Project configurations for different browsers and devices
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'Tablet',
      use: { ...devices['iPad Pro'] },
    },
  ],

  // Web server configuration for local development
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    port: 3000,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
})