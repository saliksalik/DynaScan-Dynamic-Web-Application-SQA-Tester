# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api.health.spec.js >> API Monitoring and Health >> captured API routes handle invalid probes without returning server errors
- Location: tests\api.health.spec.js:213:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.goto: Test timeout of 60000ms exceeded.
Call log:
  - navigating to "https://ginandjuice.shop/", waiting until "networkidle"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - paragraph [ref=e4]: This is a deliberately vulnerable web application designed for testing web vulnerability scanners. Put your scanner to the test!
    - generic [ref=e6]:
      - link [ref=e7] [cursor=pointer]:
        - /url: /
      - navigation [ref=e10]:
        - list [ref=e11]:
          - listitem [ref=e12]:
            - link "Products" [ref=e13] [cursor=pointer]:
              - /url: /catalog
          - listitem [ref=e14]:
            - link "Blog" [ref=e15] [cursor=pointer]:
              - /url: /blog
          - listitem [ref=e16]:
            - link "Our story" [ref=e17] [cursor=pointer]:
              - /url: /about
        - list [ref=e18]:
          - listitem [ref=e19]:
            - link [ref=e20] [cursor=pointer]:
              - /url: /my-account
              - img [ref=e21]
          - listitem [ref=e22]:
            - link "0" [ref=e23] [cursor=pointer]:
              - /url: /catalog/cart
              - generic [ref=e24]: "0"
              - img [ref=e25]
  - generic [ref=e26]:
    - generic [ref=e27]:
      - generic [ref=e28]:
        - link "View all products" [ref=e29] [cursor=pointer]:
          - /url: /catalog
        - generic [ref=e30]:
          - img
          - img [ref=e31]
          - img [ref=e32]
      - generic [ref=e33]:
        - generic [ref=e34]:
          - paragraph [ref=e36]: Created in 2022 by the man Distiller's World has called "the evil genius of gin", Gin & Juice Shop is open 24/7 to satisfy all of your web vulnerability scanner evaluation needs.
          - generic [ref=e39]:
            - link "Pineapple Edition Cocktail $30.50 View details" [ref=e40] [cursor=pointer]:
              - /url: /catalog/product?productId=1
              - img [ref=e41]
              - heading "Pineapple Edition Cocktail" [level=3] [ref=e42]
              - img [ref=e43]
              - generic [ref=e44]: $30.50
              - generic [ref=e45]: View details
            - link "Create Your Own Cocktail $84.96 View details" [ref=e46] [cursor=pointer]:
              - /url: /catalog/product?productId=2
              - img [ref=e47]
              - heading "Create Your Own Cocktail" [level=3] [ref=e48]
              - img [ref=e49]
              - generic [ref=e50]: $84.96
              - generic [ref=e51]: View details
            - link "Fruit Overlays $92.79 View details" [ref=e52] [cursor=pointer]:
              - /url: /catalog/product?productId=3
              - img [ref=e53]
              - heading "Fruit Overlays" [level=3] [ref=e54]
              - img [ref=e55]
              - generic [ref=e56]: $92.79
              - generic [ref=e57]: View details
          - link "View all products" [ref=e58] [cursor=pointer]:
            - /url: /catalog
        - generic [ref=e59]:
          - generic [ref=e60]:
            - generic [ref=e61]:
              - link [ref=e62] [cursor=pointer]:
                - /url: /blog/post?postId=3
                - img [ref=e63]
              - heading "A Hairy Day" [level=2] [ref=e64]
              - link "View post" [ref=e65] [cursor=pointer]:
                - /url: /blog/post?postId=3
            - generic [ref=e66]:
              - link [ref=e67] [cursor=pointer]:
                - /url: /blog/post?postId=4
                - img [ref=e68]
              - heading "The Complaint" [level=2] [ref=e69]
              - link "View post" [ref=e70] [cursor=pointer]:
                - /url: /blog/post?postId=4
          - link "View all blog posts" [ref=e71] [cursor=pointer]:
            - /url: /blog
    - generic [ref=e72]:
      - generic [ref=e75]:
        - heading "Never miss a deal - subscribe now" [level=2] [ref=e76]
        - paragraph [ref=e77]: Join our worldwide community of gin and juice fanatics, for exclusive news on our latest deals, new releases, collaborations, and more.
        - generic [ref=e78]:
          - textbox "Email address" [ref=e79]
          - button "Subscribe" [ref=e80] [cursor=pointer]
        - generic [ref=e83]: © 2023 PortSwigger Ltd.
      - navigation [ref=e87]:
        - list [ref=e88]:
          - listitem [ref=e89]:
            - link "Products" [ref=e90] [cursor=pointer]:
              - /url: /catalog
          - listitem [ref=e91]:
            - link "Blog" [ref=e92] [cursor=pointer]:
              - /url: /blog
          - listitem [ref=e93]:
            - link "Our story" [ref=e94] [cursor=pointer]:
              - /url: /about
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
      |              ^ Error: page.goto: Test timeout of 60000ms exceeded.
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