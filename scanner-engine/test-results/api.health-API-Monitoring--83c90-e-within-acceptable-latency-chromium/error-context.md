# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api.health.spec.js >> API Monitoring and Health >> captured API calls complete within acceptable latency
- Location: tests\api.health.spec.js:264:3

# Error details

```
Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://ginandjuice.shop/
Call log:
  - navigating to "https://ginandjuice.shop/", waiting until "networkidle"

```

# Test source

```ts
  1   | const { test, expect } = require('@playwright/test');
  2   | 
  3   | const TARGET_URL = process.env.TARGET_URL;
  4   | if (!TARGET_URL) throw new Error('TARGET_URL environment variable is required.');
  5   | 
  6   | function isApiResponse(response) {
  7   |   const type = response.request().resourceType();
  8   |   return ['xhr', 'fetch'].includes(type);
  9   | }
  10  | 
  11  | function isJsonContentType(contentType) {
  12  |   return typeof contentType === 'string' && contentType.toLowerCase().includes('application/json');
  13  | }
  14  | 
  15  | async function captureApiResponses(page) {
  16  |   const apiResponses = [];
  17  |   page.on('response', (response) => {
  18  |     if (isApiResponse(response)) {
  19  |       apiResponses.push(response);
  20  |     }
  21  |   });
  22  | 
> 23  |   await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
      |              ^ Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://ginandjuice.shop/
  24  |   await page.waitForTimeout(1500);
  25  | 
  26  |   return apiResponses;
  27  | }
  28  | 
  29  | async function parseJsonResponse(response) {
  30  |   const contentType = response.headers()['content-type'] || '';
  31  |   if (!isJsonContentType(contentType)) return null;
  32  | 
  33  |   try {
  34  |     return await response.json();
  35  |   } catch {
  36  |     return null;
  37  |   }
  38  | }
  39  | 
  40  | function normalizeApiRoute(response) {
  41  |   const request = response.request();
  42  |   const url = new URL(request.url());
  43  |   url.search = '';
  44  |   return `${request.method()} ${url.toString()}`;
  45  | }
  46  | 
  47  | function inferSchema(value) {
  48  |   if (value === null) return { type: 'null' };
  49  |   if (Array.isArray(value)) {
  50  |     return {
  51  |       type: 'array',
  52  |       items: value.length ? inferSchema(value[0]) : { type: 'unknown' }
  53  |     };
  54  |   }
  55  |   if (typeof value === 'object') {
  56  |     const schema = { type: 'object', keys: {} };
  57  |     for (const [key, val] of Object.entries(value)) {
  58  |       schema.keys[key] = inferSchema(val);
  59  |     }
  60  |     return schema;
  61  |   }
  62  |   return { type: typeof value };
  63  | }
  64  | 
  65  | function schemaEquals(a, b) {
  66  |   if (a.type !== b.type) return false;
  67  |   if (a.type === 'object') {
  68  |     const aKeys = Object.keys(a.keys || {});
  69  |     const bKeys = Object.keys(b.keys || {});
  70  |     if (aKeys.length !== bKeys.length) return false;
  71  |     return aKeys.every((key) => b.keys[key] && schemaEquals(a.keys[key], b.keys[key]));
  72  |   }
  73  |   if (a.type === 'array') {
  74  |     return schemaEquals(a.items, b.items);
  75  |   }
  76  |   return true;
  77  | }
  78  | 
  79  | function hasAuthHeader(request) {
  80  |   const headers = request.headers();
  81  |   return Boolean(
  82  |     headers['authorization'] ||
  83  |     headers['x-api-key'] ||
  84  |     headers['x-api-token'] ||
  85  |     headers.cookie
  86  |   );
  87  | }
  88  | 
  89  | async function getHealthResponse(request) {
  90  |   try {
  91  |     const healthUrl = new URL('/health', TARGET_URL).toString();
  92  |     const response = await request.get(healthUrl);
  93  |     if (response.status() === 404) return null;
  94  |     return response;
  95  |   } catch {
  96  |     return null;
  97  |   }
  98  | }
  99  | 
  100 | test.describe('API Monitoring and Health', () => {
  101 |   test('captured XHR/fetch API responses are successful', async ({ page }) => {
  102 |     const apiResponses = await captureApiResponses(page);
  103 | 
  104 |     if (apiResponses.length === 0) {
  105 |       test.skip('No API requests were captured on the target page.');
  106 |       return;
  107 |     }
  108 | 
  109 |     const failures = [];
  110 |     for (const response of apiResponses) {
  111 |       const status = response.status();
  112 |       if (status >= 400) {
  113 |         failures.push(`${response.request().method()} ${response.url()} returned ${status}`);
  114 |       }
  115 |     }
  116 | 
  117 |     expect(
  118 |       failures,
  119 |       `Captured API requests returned error statuses:
  120 | ${failures.join('\n')}`
  121 |     ).toHaveLength(0);
  122 |   });
  123 | 
```