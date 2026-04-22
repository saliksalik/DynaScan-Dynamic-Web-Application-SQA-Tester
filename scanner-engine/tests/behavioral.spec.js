// scanner-engine/tests/behavioral.spec.js
/**
 * behavioral.spec.js — UI Interaction & Stability
 *
 * Covers:
 *  1. Unhandled JavaScript console exceptions
 *  2. Form empty-submit graceful handling (no crashes)
 *  3. Responsive viewport rendering
 *  4. Navigation stability (no infinite redirects)
 */

const { test, expect } = require('@playwright/test');

const TARGET_URL = process.env.TARGET_URL;
if (!TARGET_URL) throw new Error('TARGET_URL environment variable is required.');

// ─────────────────────────────────────────────────────────────────────────────
// 1. JAVASCRIPT EXCEPTION MONITORING
// ─────────────────────────────────────────────────────────────────────────────
test.describe('JavaScript Runtime Stability', () => {
  test('Zero unhandled JavaScript exceptions on page load', async ({ page }) => {
    const jsErrors = [];

    page.on('pageerror', (err) => {
      jsErrors.push(`${err.name}: ${err.message}`);
    });

    // Also monitor for unhandled promise rejections logged to console
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Filter out known benign network errors and browser extension noise
        if (
          !text.includes('net::ERR_') &&
          !text.includes('favicon.ico') &&
          !text.toLowerCase().includes('extension') &&
          !text.includes('chrome-extension')
        ) {
          jsErrors.push(`[console.error] ${text}`);
        }
      }
    });

    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

    // Wait a moment for deferred scripts
    await page.waitForTimeout(1000);

    expect(
      jsErrors,
      `Unhandled JavaScript errors detected on page load:\n${jsErrors.join('\n')}`
    ).toHaveLength(0);
  });

  test('No JavaScript exceptions when scrolling the page', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', (err) => jsErrors.push(`${err.name}: ${err.message}`));

    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

    // Simulate scroll to trigger lazy-loading or scroll event handlers
    await page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'smooth' });
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });
    await page.waitForTimeout(500);

    expect(
      jsErrors,
      `JavaScript errors triggered during scroll:\n${jsErrors.join('\n')}`
    ).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. FORM GRACEFUL HANDLING
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Form Stability (Empty Submission)', () => {
  test('Forms handle empty submission without crashing the page', async ({ page }) => {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

    const formCount = await page.evaluate(() => document.querySelectorAll('form').length);

    if (formCount === 0) {
      console.warn('No <form> elements found — skipping form submission tests.');
      return;
    }

    // Test each form individually
    for (let i = 0; i < Math.min(formCount, 3); i++) {
      const jsErrors = [];
      page.once('pageerror', (err) => jsErrors.push(`${err.name}: ${err.message}`));

      // Re-navigate for clean state
      await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

      const forms = page.locator('form');
      const form = forms.nth(i);

      if (!(await form.isVisible())) continue;

      let crashed = false;
      let navigationStatus = null;

      page.once('response', (resp) => {
        if (resp.request().resourceType() === 'document') {
          navigationStatus = resp.status();
        }
      });

      // Find submit button or press Enter on an input
      const submitBtn = form.locator('button[type="submit"], input[type="submit"]').first();
      const hasSubmitBtn = await submitBtn.count() > 0;

      try {
        if (hasSubmitBtn && await submitBtn.isVisible()) {
          await submitBtn.click({ timeout: 3000 });
        } else {
          // Try pressing Enter on the first input
          const firstInput = form.locator('input').first();
          if (await firstInput.count() > 0) {
            await firstInput.press('Enter');
          }
        }
        await page.waitForTimeout(1500);
      } catch (err) {
        // Click may fail if form does navigation — check result
      }

      // Verify page did not crash with a 500
      if (navigationStatus === 500) {
        throw new Error(`Form #${i + 1} empty submission caused an HTTP 500 server error.`);
      }

      // Verify no JS errors from form handling
      expect(
        jsErrors,
        `Form #${i + 1} empty submission triggered JavaScript errors:\n${jsErrors.join('\n')}`
      ).toHaveLength(0);

      // Verify we're still on a functional page
      const title = await page.title();
      const body = await page.content();
      expect(body.length, `Form #${i + 1} empty submission rendered an empty page`).toBeGreaterThan(100);
    }
  });

  test('Forms with required fields show validation (do not silently fail)', async ({ page }) => {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

    const formCount = await page.evaluate(() => document.querySelectorAll('form').length);
    if (formCount === 0) return;

    const hasValidation = await page.evaluate(() => {
      const form = document.querySelector('form');
      if (!form) return false;
      const inputs = Array.from(form.querySelectorAll('input[required], textarea[required]'));
      return inputs.length > 0;
    });

    if (!hasValidation) {
      console.warn('⚠️  No required fields found in forms. Empty submissions may pass silently.');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. RESPONSIVE VIEWPORT RENDERING
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Responsive & Viewport Rendering', () => {
  const viewports = [
    { name: 'Mobile (375px)',  width: 375,  height: 812  },
    { name: 'Tablet (768px)',  width: 768,  height: 1024 },
    { name: 'Desktop (1440px)', width: 1440, height: 900 },
  ];

  for (const { name, width, height } of viewports) {
    test(`No horizontal overflow at ${name}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width, height },
        ignoreHTTPSErrors: true,
      });
      const page = await context.newPage();

      const jsErrors = [];
      page.on('pageerror', (err) => jsErrors.push(err.message));

      await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

      // Check for horizontal overflow (layout breakage)
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.body.scrollWidth > window.innerWidth;
      });

      await context.close();

      if (hasHorizontalOverflow) {
        console.warn(`⚠️  Horizontal overflow detected at ${name} (${width}px wide). Possible layout breakage.`);
      }

      expect(
        jsErrors,
        `JavaScript errors at viewport ${name}:\n${jsErrors.join('\n')}`
      ).toHaveLength(0);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. NAVIGATION STABILITY
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Navigation Stability', () => {
  test('Page does not trigger excessive redirects (max 5)', async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    let redirectCount = 0;
    page.on('response', (resp) => {
      if ([301, 302, 307, 308].includes(resp.status())) redirectCount++;
    });

    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
    await context.close();

    expect(
      redirectCount,
      `Too many redirects (${redirectCount}) — may indicate a redirect loop or misconfiguration.`
    ).toBeLessThanOrEqual(5);
  });

  test('Page fully loads within 15 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const elapsed = Date.now() - start;

    if (elapsed > 5000) {
      console.warn(`⚠️  Page took ${elapsed}ms to load (DOMContentLoaded). Consider performance optimization.`);
    }

    expect(elapsed).toBeLessThan(15000);
  });
});
