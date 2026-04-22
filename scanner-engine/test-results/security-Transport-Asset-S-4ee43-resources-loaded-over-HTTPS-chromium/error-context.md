# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: security.spec.js >> Transport & Asset Security >> No mixed content: all resources loaded over HTTPS
- Location: tests\security.spec.js:114:3

# Error details

```
Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://ginandjuice.shop/
Call log:
  - navigating to "https://ginandjuice.shop/", waiting until "networkidle"

```

# Test source

```ts
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
  47  |     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
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
> 131 |     await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
      |                ^ Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://ginandjuice.shop/
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
  148 |       insecureForms,
  149 |       `Form(s) submit to insecure HTTP endpoints, exposing credentials in transit:\n${insecureForms.join('\n')}`
  150 |     ).toHaveLength(0);
  151 |   });
  152 | 
  153 |   test('External CDN scripts/stylesheets have Subresource Integrity (SRI) attributes', async ({ page }) => {
  154 |     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  155 | 
  156 |     const targetOrigin = new URL(TARGET_URL).origin;
  157 | 
  158 |     const violations = await page.evaluate((origin) => {
  159 |       const missing = [];
  160 | 
  161 |       document.querySelectorAll('script[src], link[rel="stylesheet"][href]').forEach((el) => {
  162 |         const src = el.src || el.href;
  163 |         try {
  164 |           const url = new URL(src);
  165 |           if (url.origin !== origin && !el.integrity) {
  166 |             missing.push(`<${el.tagName.toLowerCase()}> without integrity: ${src}`);
  167 |           }
  168 |         } catch {}
  169 |       });
  170 | 
  171 |       return missing;
  172 |     }, targetOrigin);
  173 | 
  174 |     // Report as a warning — many CDNs are trusted but SRI is best practice
  175 |     if (violations.length > 0) {
  176 |       console.warn(
  177 |         `⚠️  SRI WARNING: External resources missing integrity attribute (supply-chain risk):\n${violations.join('\n')}`
  178 |       );
  179 |     }
  180 |     // Soft assertion — flag as warning, not hard failure (common in SPAs)
  181 |     // Change to expect(violations).toHaveLength(0) for strict enforcement
  182 |   });
  183 | });
  184 | 
  185 | // ─────────────────────────────────────────────────────────────────────────────
  186 | // 3. COOKIE SAFETY
  187 | // ─────────────────────────────────────────────────────────────────────────────
  188 | test.describe('Cookie Safety', () => {
  189 |   test('All cookies have Secure, HttpOnly flags and SameSite=Lax|Strict', async ({ browser }) => {
  190 |     const context = await browser.newContext({ ignoreHTTPSErrors: true });
  191 |     const page = await context.newPage();
  192 |     await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
  193 | 
  194 |     const cookies = await context.cookies();
  195 |     await context.close();
  196 | 
  197 |     if (cookies.length === 0) {
  198 |       console.warn('No cookies found on the page. Skipping cookie safety checks.');
  199 |       return;
  200 |     }
  201 | 
  202 |     const violations = [];
  203 | 
  204 |     for (const cookie of cookies) {
  205 |       const issues = [];
  206 |       if (isHttps(TARGET_URL) && !cookie.secure) issues.push('missing Secure flag');
  207 |       if (!cookie.httpOnly) issues.push('missing HttpOnly flag');
  208 |       if (!['Lax', 'Strict'].includes(cookie.sameSite)) {
  209 |         issues.push(`SameSite is "${cookie.sameSite}" (expected Lax or Strict)`);
  210 |       }
  211 |       if (issues.length > 0) {
  212 |         violations.push(`Cookie "${cookie.name}": ${issues.join(', ')}`);
  213 |       }
  214 |     }
  215 | 
  216 |     expect(
  217 |       violations,
  218 |       `Insecure cookie configuration detected:\n${violations.join('\n')}`
  219 |     ).toHaveLength(0);
  220 |   });
  221 | });
  222 | 
  223 | // ─────────────────────────────────────────────────────────────────────────────
  224 | // 4. INFORMATION EXPOSURE
  225 | // ─────────────────────────────────────────────────────────────────────────────
  226 | test.describe('Information Exposure', () => {
  227 |   const SENSITIVE_QUERY_KEYS = ['password', 'token', 'auth', 'secret', 'api_key', 'apikey', 'access_token'];
  228 | 
  229 |   test('No sensitive keys leaked in GET request query parameters', async ({ page }) => {
  230 |     const violations = [];
  231 | 
```