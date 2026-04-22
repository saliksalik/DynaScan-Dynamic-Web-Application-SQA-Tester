# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: security.spec.js >> Information Exposure >> No sensitive keys leaked in GET request query parameters
- Location: tests\security.spec.js:229:3

# Error details

```
Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://ginandjuice.shop/
Call log:
  - navigating to "https://ginandjuice.shop/", waiting until "networkidle"

```

# Test source

```ts
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
> 244 |     await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
      |                ^ Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://ginandjuice.shop/
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
```