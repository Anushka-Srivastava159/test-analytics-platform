import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  /* workers: process.env.CI ? 1 : undefined, */
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['html'],['json', { outputFile: 'results/results.json' }]],
  /* Stamped into results.json under config.metadata. The pipeline needs a run
     identity to key on — the JSON report carries none of its own. */
  metadata: {
    runId: process.env.GITHUB_RUN_ID ?? 'local',
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? '1',
    commit: process.env.GITHUB_SHA ?? '',
    branch: process.env.GITHUB_REF_NAME ?? '',
    ci: !!process.env.CI,
  },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL: 'https://www.saucedemo.com',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry', screenshot: 'only-on-failure'},
  /* Configure projects for major browsers */
  projects: [
    {name: 'api', testMatch: /api\/.*\.spec\.ts/, 
      use:{baseURL: 'https://jsonplaceholder.typicode.com'}},
    {name: 'chromium', testIgnore: /api\//, use: { ...devices['Desktop Chrome'] }},
    {name: 'firefox', testIgnore: /api\//, use: { ...devices['Desktop Firefox'] }},
    {name: 'webkit', testIgnore: /api\//, use: { ...devices['Desktop Safari'] }},
  ],
    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  //],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
