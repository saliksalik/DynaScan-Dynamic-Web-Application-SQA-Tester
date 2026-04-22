# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: security.spec.js >> HTTP Security Headers >> Content-Security-Policy header is present
- Location: tests\security.spec.js:51:3

# Error details

```
Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://ginandjuice.shop/
Call log:
  - navigating to "https://ginandjuice.shop/", waiting until "domcontentloaded"

```

# Test source

```ts
  1   | // scanner-engine/tests/security.spec.js
  2   | /**
  3   |  * security.spec.js — Comprehensive DAST & DevSecOps Checks
  4   |  *
  5   |  * Covers:
  6   |  *  1. HTTP Security Header Compliance
  7   |  *  2. Transport & Asset Security (mixed content, SRI, form actions)
  8   |  *  3. Cookie Safety (Secure, HttpOnly, SameSite)
  9   |  *  4. Information Exposure (query params, console leaks, hidden inputs, error pages)
  10  |  *  5. Misconfiguration & Directory Enumeration (/.env, /.git/config, /robots.txt)
  11  |  *  6. Active Injection & Fuzzing (XSS, SQLi, NoSQLi, Command Injection — DDT)
  12  |  */
  13  | 
  14  | const { test, expect } = require('@playwright/test');
  15  | 
  16  | const TARGET_URL = process.env.TARGET_URL;
  17  | if (!TARGET_URL) throw new Error('TARGET_URL environment variable is required.');
  18  | 
  19  | // ─── Helpers ─────────────────────────────────────────────────────────────────
  20  | function resolveUrl(base, path) {
  21  |   try { return new URL(path, base).toString(); } catch { return null; }
  22  | }
  23  | 
  24  | function isHttps(url) {
  25  |   try { return new URL(url).protocol === 'https:'; } catch { return false; }
  26  | }
  27  | 
  28  | // ─────────────────────────────────────────────────────────────────────────────
  29  | // 1. HTTP SECURITY HEADER COMPLIANCE
  30  | // ─────────────────────────────────────────────────────────────────────────────
  31  | test.describe('HTTP Security Headers', () => {
  32  |   let mainResponse;
  33  |   let responseHeaders;
  34  | 
  35  |   test.beforeAll(async ({ browser }) => {
  36  |     const context = await browser.newContext({ ignoreHTTPSErrors: true });
  37  |     const page = await context.newPage();
  38  | 
  39  |     // Capture the main document response
  40  |     page.on('response', (resp) => {
  41  |       if (!mainResponse && resp.request().resourceType() === 'document') {
  42  |         mainResponse = resp;
  43  |         responseHeaders = resp.headers();
  44  |       }
  45  |     });
  46  | 
> 47  |     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
      |                ^ Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://ginandjuice.shop/
  48  |     await context.close();
  49  |   });
  50  | 
  51  |   test('Content-Security-Policy header is present', async () => {
  52  |     const csp = responseHeaders?.['content-security-policy'] || responseHeaders?.['content-security-policy-report-only'];
  53  |     expect(
  54  |       csp,
  55  |       'Missing Content-Security-Policy header. Without CSP, the application is vulnerable to XSS and data injection attacks.'
  56  |     ).toBeTruthy();
  57  |   });
  58  | 
  59  |   test('Strict-Transport-Security (HSTS) header is present', async () => {
  60  |     // Only meaningful on HTTPS
  61  |     if (!isHttps(TARGET_URL)) {
  62  |       console.warn('HSTS check skipped: target is HTTP, not HTTPS.');
  63  |       return;
  64  |     }
  65  |     expect(
  66  |       responseHeaders?.['strict-transport-security'],
  67  |       'Missing Strict-Transport-Security header. HSTS prevents protocol downgrade attacks and cookie hijacking.'
  68  |     ).toBeTruthy();
  69  |   });
  70  | 
  71  |   test('X-Frame-Options is set to DENY or SAMEORIGIN', async () => {
  72  |     const xfo = responseHeaders?.['x-frame-options']?.toUpperCase();
  73  |     // Modern sites use CSP frame-ancestors; either is acceptable
  74  |     const csp = responseHeaders?.['content-security-policy'] || '';
  75  |     const frameAncestors = csp.includes('frame-ancestors');
  76  | 
  77  |     if (!xfo && !frameAncestors) {
  78  |       throw new Error(
  79  |         'Neither X-Frame-Options nor CSP frame-ancestors directive found. The application may be vulnerable to Clickjacking.'
  80  |       );
  81  |     }
  82  |     if (xfo) {
  83  |       expect(['DENY', 'SAMEORIGIN']).toContain(xfo);
  84  |     }
  85  |   });
  86  | 
  87  |   test('X-Content-Type-Options is set to nosniff', async () => {
  88  |     expect(
  89  |       responseHeaders?.['x-content-type-options']?.toLowerCase(),
  90  |       'Missing X-Content-Type-Options: nosniff. Browsers may MIME-sniff responses, enabling XSS via uploaded files.'
  91  |     ).toBe('nosniff');
  92  |   });
  93  | 
  94  |   test('Referrer-Policy header is present', async () => {
  95  |     expect(
  96  |       responseHeaders?.['referrer-policy'],
  97  |       'Missing Referrer-Policy header. Sensitive URL parameters may leak to third-party sites via the Referer header.'
  98  |     ).toBeTruthy();
  99  |   });
  100 | 
  101 |   test('Permissions-Policy header is present', async () => {
  102 |     const pp = responseHeaders?.['permissions-policy'] || responseHeaders?.['feature-policy'];
  103 |     expect(
  104 |       pp,
  105 |       'Missing Permissions-Policy header. Browser features (camera, microphone, geolocation) should be explicitly restricted.'
  106 |     ).toBeTruthy();
  107 |   });
  108 | });
  109 | 
  110 | // ─────────────────────────────────────────────────────────────────────────────
  111 | // 2. TRANSPORT & ASSET SECURITY
  112 | // ─────────────────────────────────────────────────────────────────────────────
  113 | test.describe('Transport & Asset Security', () => {
  114 |   test('No mixed content: all resources loaded over HTTPS', async ({ page }) => {
  115 |     if (!isHttps(TARGET_URL)) {
  116 |       console.warn('Mixed-content check skipped: target is not HTTPS.');
  117 |       return;
  118 |     }
  119 | 
  120 |     const insecureResources = [];
  121 |     page.on('response', (resp) => {
  122 |       try {
  123 |         const url = resp.url();
  124 |         const type = resp.request().resourceType();
  125 |         if (['script', 'stylesheet', 'image', 'font', 'media', 'fetch', 'xhr'].includes(type)) {
  126 |           if (url.startsWith('http://')) insecureResources.push(`[${type}] ${url}`);
  127 |         }
  128 |       } catch {}
  129 |     });
  130 | 
  131 |     await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
  132 |     expect(
  133 |       insecureResources,
  134 |       `Mixed content detected — HTTP resources on an HTTPS page:\n${insecureResources.join('\n')}`
  135 |     ).toHaveLength(0);
  136 |   });
  137 | 
  138 |   test('All <form> action attributes use HTTPS (not HTTP)', async ({ page }) => {
  139 |     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  140 | 
  141 |     const insecureForms = await page.evaluate(() => {
  142 |       return Array.from(document.querySelectorAll('form[action]'))
  143 |         .map((f) => f.getAttribute('action'))
  144 |         .filter((a) => a && a.startsWith('http://'));
  145 |     });
  146 | 
  147 |     expect(
```