# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: network.spec.js >> HTTP Status Checks (fetch/XHR) >> Zero 5xx server errors in API responses
- Location: tests\network.spec.js:77:3

# Error details

```
Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://ginandjuice.shop/
Call log:
  - navigating to "https://ginandjuice.shop/", waiting until "networkidle"

```

# Test source

```ts
  1   | // scanner-engine/tests/network.spec.js
  2   | /**
  3   |  * network.spec.js — API Health via Network Interception
  4   |  *
  5   |  * Covers:
  6   |  *  1. HTTP Status Assertions (500s, 404 APIs, 401/403, CORS failures)
  7   |  *  2. Performance (response time < 2000ms, payload size < 2MB)
  8   |  *  3. Frontend Efficiency (duplicate requests, empty POST/PUT bodies)
  9   |  */
  10  | 
  11  | const { test, expect } = require('@playwright/test');
  12  | 
  13  | const TARGET_URL = process.env.TARGET_URL;
  14  | if (!TARGET_URL) throw new Error('TARGET_URL environment variable is required.');
  15  | 
  16  | const NETWORK_TYPES = ['fetch', 'xhr'];
  17  | 
  18  | // ─── Shared network state captured on page load ───────────────────────────────
  19  | let capturedRequests = [];
  20  | let capturedResponses = [];
  21  | 
  22  | async function loadAndCapture(page) {
  23  |   capturedRequests = [];
  24  |   capturedResponses = [];
  25  | 
  26  |   page.on('request', (req) => {
  27  |     if (NETWORK_TYPES.includes(req.resourceType())) {
  28  |       capturedRequests.push({
  29  |         url: req.url(),
  30  |         method: req.method(),
  31  |         postData: req.postData(),
  32  |         timestamp: Date.now(),
  33  |         resourceType: req.resourceType(),
  34  |       });
  35  |     }
  36  |   });
  37  | 
  38  |   page.on('response', async (resp) => {
  39  |     if (NETWORK_TYPES.includes(resp.request().resourceType())) {
  40  |       const timing = resp.request().timing();
  41  |       const responseStart = timing?.responseStart ?? 0;
  42  |       const requestStart = timing?.requestStart ?? 0;
  43  |       const responseTime = responseStart > 0 ? responseStart - requestStart : null;
  44  | 
  45  |       let bodySize = 0;
  46  |       let contentType = resp.headers()['content-type'] || '';
  47  |       try {
  48  |         const body = await resp.body();
  49  |         bodySize = body?.length ?? 0;
  50  |       } catch {}
  51  | 
  52  |       capturedResponses.push({
  53  |         url: resp.url(),
  54  |         status: resp.status(),
  55  |         headers: resp.headers(),
  56  |         responseTime,
  57  |         bodySize,
  58  |         contentType,
  59  |       });
  60  |     }
  61  |   });
  62  | 
> 63  |   await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
      |              ^ Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://ginandjuice.shop/
  64  | }
  65  | 
  66  | // ─────────────────────────────────────────────────────────────────────────────
  67  | // 1. HTTP STATUS TESTS
  68  | // ─────────────────────────────────────────────────────────────────────────────
  69  | test.describe('HTTP Status Checks (fetch/XHR)', () => {
  70  |   test.beforeAll(async ({ browser }) => {
  71  |     const context = await browser.newContext({ ignoreHTTPSErrors: true });
  72  |     const page = await context.newPage();
  73  |     await loadAndCapture(page);
  74  |     await context.close();
  75  |   });
  76  | 
  77  |   test('Zero 5xx server errors in API responses', () => {
  78  |     const failures = capturedResponses.filter((r) => r.status >= 500);
  79  |     expect(
  80  |       failures.map((r) => `[${r.status}] ${r.url}`),
  81  |       `Server-side errors detected in API responses:\n${failures.map((r) => `  ${r.status} → ${r.url}`).join('\n')}`
  82  |     ).toHaveLength(0);
  83  |   });
  84  | 
  85  |   test('Zero 404 responses from API endpoints', () => {
  86  |     const notFound = capturedResponses.filter((r) => r.status === 404);
  87  |     expect(
  88  |       notFound.map((r) => r.url),
  89  |       `API endpoints returning 404 (broken client code or stale references):\n${notFound.map((r) => `  ${r.url}`).join('\n')}`
  90  |     ).toHaveLength(0);
  91  |   });
  92  | 
  93  |   test('No unhandled 401 Unauthorized responses', () => {
  94  |     const unauthorized = capturedResponses.filter((r) => r.status === 401);
  95  |     expect(
  96  |       unauthorized.map((r) => r.url),
  97  |       `Unhandled 401 responses — API calls missing authentication tokens:\n${unauthorized.map((r) => `  ${r.url}`).join('\n')}`
  98  |     ).toHaveLength(0);
  99  |   });
  100 | 
  101 |   test('No unhandled 403 Forbidden responses', () => {
  102 |     const forbidden = capturedResponses.filter((r) => r.status === 403);
  103 |     if (forbidden.length > 0) {
  104 |       console.warn(`⚠️  403 responses found (may be intentional access control):\n${forbidden.map((r) => `  ${r.url}`).join('\n')}`);
  105 |     }
  106 |     // Soft check — 403 can be legitimate (access control). Log only.
  107 |   });
  108 | 
  109 |   test('No CORS preflight failures (OPTIONS → non-2xx)', async ({ browser }) => {
  110 |     const context = await browser.newContext({ ignoreHTTPSErrors: true });
  111 |     const page = await context.newPage();
  112 | 
  113 |     const corsFailures = [];
  114 |     page.on('response', (resp) => {
  115 |       if (resp.request().method() === 'OPTIONS' && resp.status() >= 400) {
  116 |         corsFailures.push(`OPTIONS ${resp.url()} → ${resp.status()}`);
  117 |       }
  118 |     });
  119 | 
  120 |     await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
  121 |     await context.close();
  122 | 
  123 |     expect(
  124 |       corsFailures,
  125 |       `CORS preflight failures (may block cross-origin requests in production):\n${corsFailures.join('\n')}`
  126 |     ).toHaveLength(0);
  127 |   });
  128 | });
  129 | 
  130 | // ─────────────────────────────────────────────────────────────────────────────
  131 | // 2. PERFORMANCE TESTS
  132 | // ─────────────────────────────────────────────────────────────────────────────
  133 | test.describe('API Performance (fetch/XHR)', () => {
  134 |   test.beforeAll(async ({ browser }) => {
  135 |     const context = await browser.newContext({ ignoreHTTPSErrors: true });
  136 |     const page = await context.newPage();
  137 |     await loadAndCapture(page);
  138 |     await context.close();
  139 |   });
  140 | 
  141 |   test('All API responses complete within 2000ms', () => {
  142 |     const slowResponses = capturedResponses
  143 |       .filter((r) => r.responseTime !== null && r.responseTime > 2000)
  144 |       .map((r) => `  ${r.responseTime}ms → ${r.url}`);
  145 | 
  146 |     expect(
  147 |       slowResponses,
  148 |       `Slow API responses detected (> 2000ms):\n${slowResponses.join('\n')}`
  149 |     ).toHaveLength(0);
  150 |   });
  151 | 
  152 |   test('No JSON payload exceeds 2MB in size', () => {
  153 |     const TWO_MB = 2 * 1024 * 1024;
  154 |     const oversized = capturedResponses
  155 |       .filter((r) => r.contentType.includes('json') && r.bodySize > TWO_MB)
  156 |       .map((r) => `  ${(r.bodySize / 1024 / 1024).toFixed(2)}MB → ${r.url}`);
  157 | 
  158 |     expect(
  159 |       oversized,
  160 |       `Oversized JSON payloads detected (> 2MB) — consider pagination or compression:\n${oversized.join('\n')}`
  161 |     ).toHaveLength(0);
  162 |   });
  163 | });
```