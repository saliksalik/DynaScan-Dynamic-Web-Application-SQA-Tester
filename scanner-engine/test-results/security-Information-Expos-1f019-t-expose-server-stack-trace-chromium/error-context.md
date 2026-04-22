# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: security.spec.js >> Information Exposure >> 404 error page does not expose server stack trace
- Location: tests\security.spec.js:297:3

# Error details

```
Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://ginandjuice.shop/sqa-scanner-probe-1776823151338-not-found
Call log:
  - navigating to "https://ginandjuice.shop/sqa-scanner-probe-1776823151338-not-found", waiting until "domcontentloaded"

```

# Test source

```ts
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
  232 |     page.on('request', (req) => {
  233 |       if (req.method() !== 'GET') return;
  234 |       try {
  235 |         const params = new URL(req.url()).searchParams;
  236 |         for (const key of params.keys()) {
  237 |           if (SENSITIVE_QUERY_KEYS.some((s) => key.toLowerCase().includes(s))) {
  238 |             violations.push(`${key}=*** in URL: ${req.url()}`);
  239 |           }
  240 |         }
  241 |       } catch {}
  242 |     });
  243 | 
  244 |     await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
  245 | 
  246 |     expect(
  247 |       violations,
  248 |       `Sensitive data leaked via GET query parameters (visible in browser history, logs, Referer headers):\n${violations.join('\n')}`
  249 |     ).toHaveLength(0);
  250 |   });
  251 | 
  252 |   test('Console output does not contain JWTs or API keys', async ({ page }) => {
  253 |     const suspiciousLogs = [];
  254 |     const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
  255 |     const API_KEY_RE = /(?:api[_-]?key|apikey|token|secret)\s*[:=]\s*['"]?[\w\-]{16,}/i;
  256 | 
  257 |     page.on('console', (msg) => {
  258 |       const text = msg.text();
  259 |       if (JWT_RE.test(text)) suspiciousLogs.push(`[JWT] ${text.substring(0, 120)}…`);
  260 |       if (API_KEY_RE.test(text)) suspiciousLogs.push(`[API Key] ${text.substring(0, 120)}…`);
  261 |     });
  262 | 
  263 |     await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
  264 | 
  265 |     expect(
  266 |       suspiciousLogs,
  267 |       `Secrets detected in browser console output:\n${suspiciousLogs.join('\n')}`
  268 |     ).toHaveLength(0);
  269 |   });
  270 | 
  271 |   test('No suspicious values in hidden <input> fields', async ({ page }) => {
  272 |     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  273 | 
  274 |     const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
  275 |     const SUSPICIOUS_NAMES = ['token', 'auth', 'secret', 'api_key', 'password', 'jwt'];
  276 | 
  277 |     const suspicious = await page.evaluate(({ jwtPattern, suspNames }) => {
  278 |       const results = [];
  279 |       document.querySelectorAll('input[type="hidden"]').forEach((el) => {
  280 |         const name = (el.name || el.id || '').toLowerCase();
  281 |         const value = el.value || '';
  282 |         const isSuspiciousName = suspNames.some((s) => name.includes(s));
  283 |         const looksLikeJwt = new RegExp(jwtPattern).test(value);
  284 |         if (isSuspiciousName || looksLikeJwt) {
  285 |           results.push(`name="${el.name}" value="${value.substring(0, 40)}${value.length > 40 ? '…' : ''}"`);
  286 |         }
  287 |       });
  288 |       return results;
  289 |     }, { jwtPattern: JWT_RE.source, suspNames: SUSPICIOUS_NAMES });
  290 | 
  291 |     if (suspicious.length > 0) {
  292 |       console.warn(`⚠️  Suspicious hidden inputs found (review manually):\n${suspicious.join('\n')}`);
  293 |     }
  294 |     // Informational — hidden fields often hold CSRF tokens (legitimate)
  295 |   });
  296 | 
  297 |   test('404 error page does not expose server stack trace', async ({ page }) => {
  298 |     const nonExistentPath = resolveUrl(TARGET_URL, `/sqa-scanner-probe-${Date.now()}-not-found`);
> 299 |     const resp = await page.goto(nonExistentPath, { waitUntil: 'domcontentloaded' });
      |                             ^ Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://ginandjuice.shop/sqa-scanner-probe-1776823151338-not-found
  300 | 
  301 |     const body = await page.content();
  302 |     const stackTracePatterns = [
  303 |       /at\s+\w+\s*\([^)]+:\d+:\d+\)/,           // Node.js / JS stack
  304 |       /Traceback \(most recent call last\)/,      // Python
  305 |       /java\.lang\.\w+Exception/,                // Java
  306 |       /System\.Web\.HttpException/,              // ASP.NET
  307 |       /Warning:.*on line \d+/,                   // PHP
  308 |       /\bsyntaxerror\b.*line \d+/i,
  309 |     ];
  310 | 
  311 |     for (const pattern of stackTracePatterns) {
  312 |       expect(body).not.toMatch(pattern);
  313 |     }
  314 |   });
  315 | 
  316 |   test('500 error page does not expose server stack trace', async ({ page, request }) => {
  317 |     // We attempt to trigger a 500 by sending a malformed request
  318 |     const malformedUrl = resolveUrl(TARGET_URL, '/api/undefined-sqa-endpoint');
  319 |     try {
  320 |       const resp = await request.get(malformedUrl);
  321 |       const text = await resp.text();
  322 | 
  323 |       const stackTracePatterns = [
  324 |         /at\s+\w+\s*\([^)]+:\d+:\d+\)/,
  325 |         /Traceback \(most recent call last\)/,
  326 |         /java\.lang\.\w+Exception/,
  327 |         /System\.Web\.HttpException/,
  328 |       ];
  329 | 
  330 |       for (const pattern of stackTracePatterns) {
  331 |         expect(text).not.toMatch(pattern);
  332 |       }
  333 |     } catch {
  334 |       // Endpoint may not exist — that's acceptable
  335 |     }
  336 |   });
  337 | });
  338 | 
  339 | // ─────────────────────────────────────────────────────────────────────────────
  340 | // 5. MISCONFIGURATION & DIRECTORY ENUMERATION
  341 | // ─────────────────────────────────────────────────────────────────────────────
  342 | test.describe('Misconfiguration & Directory Enumeration', () => {
  343 |   test('/.env file is not publicly accessible', async ({ request }) => {
  344 |     const url = resolveUrl(TARGET_URL, '/.env');
  345 |     const resp = await request.get(url);
  346 | 
  347 |     expect(
  348 |       [403, 404],
  349 |       `CRITICAL: /.env file is accessible (HTTP ${resp.status()})! Environment secrets (DB passwords, API keys) may be exposed.`
  350 |     ).toContain(resp.status());
  351 |   });
  352 | 
  353 |   test('/.git/config is not publicly accessible', async ({ request }) => {
  354 |     const url = resolveUrl(TARGET_URL, '/.git/config');
  355 |     const resp = await request.get(url);
  356 | 
  357 |     expect(
  358 |       [403, 404],
  359 |       `CRITICAL: /.git/config is accessible (HTTP ${resp.status()})! Entire source code repository may be reconstructable.`
  360 |     ).toContain(resp.status());
  361 |   });
  362 | 
  363 |   test('/images/ directory listing is disabled', async ({ page }) => {
  364 |     const url = resolveUrl(TARGET_URL, '/images/');
  365 |     try {
  366 |       await page.goto(url, { waitUntil: 'domcontentloaded' });
  367 |       const body = await page.content();
  368 |       const listingPatterns = [
  369 |         /Index of \/images/i,
  370 |         /Directory listing for/i,
  371 |         /<title>.*directory.*<\/title>/i,
  372 |       ];
  373 |       for (const pat of listingPatterns) {
  374 |         expect(body, `Directory listing enabled for /images/: exposes file structure`).not.toMatch(pat);
  375 |       }
  376 |     } catch { /* Path may not exist */ }
  377 |   });
  378 | 
  379 |   test('/assets/ directory listing is disabled', async ({ page }) => {
  380 |     const url = resolveUrl(TARGET_URL, '/assets/');
  381 |     try {
  382 |       await page.goto(url, { waitUntil: 'domcontentloaded' });
  383 |       const body = await page.content();
  384 |       const listingPatterns = [
  385 |         /Index of \/assets/i,
  386 |         /Directory listing for/i,
  387 |         /<title>.*directory.*<\/title>/i,
  388 |       ];
  389 |       for (const pat of listingPatterns) {
  390 |         expect(body, `Directory listing enabled for /assets/: exposes build artifacts`).not.toMatch(pat);
  391 |       }
  392 |     } catch { /* Path may not exist */ }
  393 |   });
  394 | 
  395 |   test('/robots.txt Disallow paths are protected', async ({ request, page }) => {
  396 |     const robotsUrl = resolveUrl(TARGET_URL, '/robots.txt');
  397 |     let robotsResp;
  398 | 
  399 |     try {
```