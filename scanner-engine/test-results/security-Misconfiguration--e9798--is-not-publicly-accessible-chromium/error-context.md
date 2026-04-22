# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: security.spec.js >> Misconfiguration & Directory Enumeration >> /.env file is not publicly accessible
- Location: tests\security.spec.js:343:3

# Error details

```
Error: apiRequestContext.get: getaddrinfo ENOTFOUND ginandjuice.shop
Call log:
  - → GET https://ginandjuice.shop/.env
    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7727.15 Safari/537.36
    - accept: */*
    - accept-encoding: gzip,deflate,br
    - Accept-Language: en-US,en;q=0.9

```

# Test source

```ts
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
  299 |     const resp = await page.goto(nonExistentPath, { waitUntil: 'domcontentloaded' });
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
> 345 |     const resp = await request.get(url);
      |                                ^ Error: apiRequestContext.get: getaddrinfo ENOTFOUND ginandjuice.shop
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
  400 |       robotsResp = await request.get(robotsUrl);
  401 |     } catch {
  402 |       console.warn('robots.txt not accessible — skipping.');
  403 |       return;
  404 |     }
  405 | 
  406 |     if (robotsResp.status() !== 200) {
  407 |       console.warn(`robots.txt returned HTTP ${robotsResp.status()} — skipping.`);
  408 |       return;
  409 |     }
  410 | 
  411 |     const robotsText = await robotsResp.text();
  412 |     const disallowedPaths = robotsText
  413 |       .split('\n')
  414 |       .filter((line) => line.trim().toLowerCase().startsWith('disallow:'))
  415 |       .map((line) => line.replace(/disallow:\s*/i, '').trim())
  416 |       .filter((p) => p && p !== '/');
  417 | 
  418 |     for (const disallowedPath of disallowedPaths.slice(0, 5)) { // Check first 5
  419 |       const protectedUrl = resolveUrl(TARGET_URL, disallowedPath);
  420 |       try {
  421 |         const resp = await request.get(protectedUrl);
  422 |         const statusCode = resp.status();
  423 | 
  424 |         // Disallowed paths should be forbidden or not found, not openly accessible
  425 |         const isProtected = [401, 403, 404, 410].includes(statusCode) || statusCode >= 500;
  426 |         if (!isProtected) {
  427 |           console.warn(
  428 |             `⚠️  robots.txt Disallow path accessible: ${disallowedPath} → HTTP ${statusCode}`
  429 |           );
  430 |         }
  431 |       } catch { /* Network error, path doesn't resolve */ }
  432 |     }
  433 |   });
  434 | });
  435 | 
  436 | // ─────────────────────────────────────────────────────────────────────────────
  437 | // 6. ACTIVE INJECTION & FUZZING (Data-Driven Testing)
  438 | // ─────────────────────────────────────────────────────────────────────────────
  439 | test.describe('Active Injection & Fuzzing (DDT)', () => {
  440 |   const INJECTION_PAYLOADS = [
  441 |     { type: 'XSS',                          payload: '<script>alert("SQA_XSS_1")</script>' },
  442 |     { type: 'XSS (img onerror)',            payload: '<img src=x onerror=alert("SQA_XSS_2")>' },
  443 |     { type: 'XSS (attribute break)',        payload: '"><svg/onload=alert(1)>' },
  444 |     { type: 'SQLi (basic)',                 payload: "' OR 1=1 --" },
  445 |     { type: 'SQLi (union)',                 payload: "' UNION SELECT null,null --" },
```