# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: behavioral.spec.js >> Responsive & Viewport Rendering >> No horizontal overflow at Desktop (1440px)
- Location: tests\behavioral.spec.js:181:5

# Error details

```
Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://ginandjuice.shop/
Call log:
  - navigating to "https://ginandjuice.shop/", waiting until "domcontentloaded"

```

# Test source

```ts
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
  184 |         ignoreHTTPSErrors: true,
  185 |       });
  186 |       const page = await context.newPage();
  187 | 
  188 |       const jsErrors = [];
  189 |       page.on('pageerror', (err) => jsErrors.push(err.message));
  190 | 
> 191 |       await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
      |                  ^ Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://ginandjuice.shop/
  192 | 
  193 |       // Check for horizontal overflow (layout breakage)
  194 |       const hasHorizontalOverflow = await page.evaluate(() => {
  195 |         return document.body.scrollWidth > window.innerWidth;
  196 |       });
  197 | 
  198 |       await context.close();
  199 | 
  200 |       if (hasHorizontalOverflow) {
  201 |         console.warn(`⚠️  Horizontal overflow detected at ${name} (${width}px wide). Possible layout breakage.`);
  202 |       }
  203 | 
  204 |       expect(
  205 |         jsErrors,
  206 |         `JavaScript errors at viewport ${name}:\n${jsErrors.join('\n')}`
  207 |       ).toHaveLength(0);
  208 |     });
  209 |   }
  210 | });
  211 | 
  212 | // ─────────────────────────────────────────────────────────────────────────────
  213 | // 4. NAVIGATION STABILITY
  214 | // ─────────────────────────────────────────────────────────────────────────────
  215 | test.describe('Navigation Stability', () => {
  216 |   test('Page does not trigger excessive redirects (max 5)', async ({ browser }) => {
  217 |     const context = await browser.newContext({ ignoreHTTPSErrors: true });
  218 |     const page = await context.newPage();
  219 | 
  220 |     let redirectCount = 0;
  221 |     page.on('response', (resp) => {
  222 |       if ([301, 302, 307, 308].includes(resp.status())) redirectCount++;
  223 |     });
  224 | 
  225 |     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  226 |     await context.close();
  227 | 
  228 |     expect(
  229 |       redirectCount,
  230 |       `Too many redirects (${redirectCount}) — may indicate a redirect loop or misconfiguration.`
  231 |     ).toBeLessThanOrEqual(5);
  232 |   });
  233 | 
  234 |   test('Page fully loads within 15 seconds', async ({ page }) => {
  235 |     const start = Date.now();
  236 |     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  237 |     const elapsed = Date.now() - start;
  238 | 
  239 |     if (elapsed > 5000) {
  240 |       console.warn(`⚠️  Page took ${elapsed}ms to load (DOMContentLoaded). Consider performance optimization.`);
  241 |     }
  242 | 
  243 |     expect(elapsed).toBeLessThan(15000);
  244 |   });
  245 | });
  246 | 
```