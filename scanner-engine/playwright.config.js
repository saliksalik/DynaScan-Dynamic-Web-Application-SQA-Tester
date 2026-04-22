// scanner-engine/playwright.config.js
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: 0,
  workers: 1,                  // Sequential — scanner is a single-target tool
  fullyParallel: false,

  reporter: [
    ['allure-playwright', {
      detail: true,
      outputFolder: path.resolve(__dirname, 'allure-results'),
      suiteTitle: true,
      environmentInfo: {
        target_url: process.env.TARGET_URL || 'unknown',
        node_version: process.version,
        platform: process.platform,
      },
    }],
    ['line'],
  ],

  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,       // We want to detect TLS issues, not crash on them
    bypassCSP: true,               // Required to inject axe-core
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
    // Capture screenshots for every test run so reports include visual evidence.
    screenshot: 'on',
    video: 'off',
    trace: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
