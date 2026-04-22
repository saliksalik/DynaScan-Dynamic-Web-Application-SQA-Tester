# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: behavioral.spec.js >> Form Stability (Empty Submission) >> Forms handle empty submission without crashing the page
- Location: tests\behavioral.spec.js:82:3

# Error details

```
Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://ginandjuice.shop/
Call log:
  - navigating to "https://ginandjuice.shop/", waiting until "domcontentloaded"

```

# Test source

```ts
  1   | // scanner-engine/tests/behavioral.spec.js
  2   | /**
  3   |  * behavioral.spec.js — UI Interaction & Stability
  4   |  *
  5   |  * Covers:
  6   |  *  1. Unhandled JavaScript console exceptions
  7   |  *  2. Form empty-submit graceful handling (no crashes)
  8   |  *  3. Responsive viewport rendering
  9   |  *  4. Navigation stability (no infinite redirects)
  10  |  */
  11  | 
  12  | const { test, expect } = require('@playwright/test');
  13  | 
  14  | const TARGET_URL = process.env.TARGET_URL;
  15  | if (!TARGET_URL) throw new Error('TARGET_URL environment variable is required.');
  16  | 
  17  | // ─────────────────────────────────────────────────────────────────────────────
  18  | // 1. JAVASCRIPT EXCEPTION MONITORING
  19  | // ─────────────────────────────────────────────────────────────────────────────
  20  | test.describe('JavaScript Runtime Stability', () => {
  21  |   test('Zero unhandled JavaScript exceptions on page load', async ({ page }) => {
  22  |     const jsErrors = [];
  23  | 
  24  |     page.on('pageerror', (err) => {
  25  |       jsErrors.push(`${err.name}: ${err.message}`);
  26  |     });
  27  | 
  28  |     // Also monitor for unhandled promise rejections logged to console
  29  |     page.on('console', (msg) => {
  30  |       if (msg.type() === 'error') {
  31  |         const text = msg.text();
  32  |         // Filter out known benign network errors and browser extension noise
  33  |         if (
  34  |           !text.includes('net::ERR_') &&
  35  |           !text.includes('favicon.ico') &&
  36  |           !text.toLowerCase().includes('extension') &&
  37  |           !text.includes('chrome-extension')
  38  |         ) {
  39  |           jsErrors.push(`[console.error] ${text}`);
  40  |         }
  41  |       }
  42  |     });
  43  | 
  44  |     await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
  45  | 
  46  |     // Wait a moment for deferred scripts
  47  |     await page.waitForTimeout(1000);
  48  | 
  49  |     expect(
  50  |       jsErrors,
  51  |       `Unhandled JavaScript errors detected on page load:\n${jsErrors.join('\n')}`
  52  |     ).toHaveLength(0);
  53  |   });
  54  | 
  55  |   test('No JavaScript exceptions when scrolling the page', async ({ page }) => {
  56  |     const jsErrors = [];
  57  |     page.on('pageerror', (err) => jsErrors.push(`${err.name}: ${err.message}`));
  58  | 
  59  |     await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
  60  | 
  61  |     // Simulate scroll to trigger lazy-loading or scroll event handlers
  62  |     await page.evaluate(() => {
  63  |       window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'smooth' });
  64  |     });
  65  |     await page.waitForTimeout(500);
  66  |     await page.evaluate(() => {
  67  |       window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  68  |     });
  69  |     await page.waitForTimeout(500);
  70  | 
  71  |     expect(
  72  |       jsErrors,
  73  |       `JavaScript errors triggered during scroll:\n${jsErrors.join('\n')}`
  74  |     ).toHaveLength(0);
  75  |   });
  76  | });
  77  | 
  78  | // ─────────────────────────────────────────────────────────────────────────────
  79  | // 2. FORM GRACEFUL HANDLING
  80  | // ─────────────────────────────────────────────────────────────────────────────
  81  | test.describe('Form Stability (Empty Submission)', () => {
  82  |   test('Forms handle empty submission without crashing the page', async ({ page }) => {
> 83  |     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
      |                ^ Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://ginandjuice.shop/
  84  | 
  85  |     const formCount = await page.evaluate(() => document.querySelectorAll('form').length);
  86  | 
  87  |     if (formCount === 0) {
  88  |       console.warn('No <form> elements found — skipping form submission tests.');
  89  |       return;
  90  |     }
  91  | 
  92  |     // Test each form individually
  93  |     for (let i = 0; i < Math.min(formCount, 3); i++) {
  94  |       const jsErrors = [];
  95  |       page.once('pageerror', (err) => jsErrors.push(`${err.name}: ${err.message}`));
  96  | 
  97  |       // Re-navigate for clean state
  98  |       await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  99  | 
  100 |       const forms = page.locator('form');
  101 |       const form = forms.nth(i);
  102 | 
  103 |       if (!(await form.isVisible())) continue;
  104 | 
  105 |       let crashed = false;
  106 |       let navigationStatus = null;
  107 | 
  108 |       page.once('response', (resp) => {
  109 |         if (resp.request().resourceType() === 'document') {
  110 |           navigationStatus = resp.status();
  111 |         }
  112 |       });
  113 | 
  114 |       // Find submit button or press Enter on an input
  115 |       const submitBtn = form.locator('button[type="submit"], input[type="submit"]').first();
  116 |       const hasSubmitBtn = await submitBtn.count() > 0;
  117 | 
  118 |       try {
  119 |         if (hasSubmitBtn && await submitBtn.isVisible()) {
  120 |           await submitBtn.click({ timeout: 3000 });
  121 |         } else {
  122 |           // Try pressing Enter on the first input
  123 |           const firstInput = form.locator('input').first();
  124 |           if (await firstInput.count() > 0) {
  125 |             await firstInput.press('Enter');
  126 |           }
  127 |         }
  128 |         await page.waitForTimeout(1500);
  129 |       } catch (err) {
  130 |         // Click may fail if form does navigation — check result
  131 |       }
  132 | 
  133 |       // Verify page did not crash with a 500
  134 |       if (navigationStatus === 500) {
  135 |         throw new Error(`Form #${i + 1} empty submission caused an HTTP 500 server error.`);
  136 |       }
  137 | 
  138 |       // Verify no JS errors from form handling
  139 |       expect(
  140 |         jsErrors,
  141 |         `Form #${i + 1} empty submission triggered JavaScript errors:\n${jsErrors.join('\n')}`
  142 |       ).toHaveLength(0);
  143 | 
  144 |       // Verify we're still on a functional page
  145 |       const title = await page.title();
  146 |       const body = await page.content();
  147 |       expect(body.length, `Form #${i + 1} empty submission rendered an empty page`).toBeGreaterThan(100);
  148 |     }
  149 |   });
  150 | 
  151 |   test('Forms with required fields show validation (do not silently fail)', async ({ page }) => {
  152 |     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  153 | 
  154 |     const formCount = await page.evaluate(() => document.querySelectorAll('form').length);
  155 |     if (formCount === 0) return;
  156 | 
  157 |     const hasValidation = await page.evaluate(() => {
  158 |       const form = document.querySelector('form');
  159 |       if (!form) return false;
  160 |       const inputs = Array.from(form.querySelectorAll('input[required], textarea[required]'));
  161 |       return inputs.length > 0;
  162 |     });
  163 | 
  164 |     if (!hasValidation) {
  165 |       console.warn('⚠️  No required fields found in forms. Empty submissions may pass silently.');
  166 |     }
  167 |   });
  168 | });
  169 | 
  170 | // ─────────────────────────────────────────────────────────────────────────────
  171 | // 3. RESPONSIVE VIEWPORT RENDERING
  172 | // ─────────────────────────────────────────────────────────────────────────────
  173 | test.describe('Responsive & Viewport Rendering', () => {
  174 |   const viewports = [
  175 |     { name: 'Mobile (375px)',  width: 375,  height: 812  },
  176 |     { name: 'Tablet (768px)',  width: 768,  height: 1024 },
  177 |     { name: 'Desktop (1440px)', width: 1440, height: 900 },
  178 |   ];
  179 | 
  180 |   for (const { name, width, height } of viewports) {
  181 |     test(`No horizontal overflow at ${name}`, async ({ browser }) => {
  182 |       const context = await browser.newContext({
  183 |         viewport: { width, height },
```