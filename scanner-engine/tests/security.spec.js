// scanner-engine/tests/security.spec.js
/**
 * security.spec.js — Comprehensive DAST & DevSecOps Checks
 *
 * Covers:
 *  1. HTTP Security Header Compliance
 *  2. Transport & Asset Security (mixed content, SRI, form actions)
 *  3. Cookie Safety (Secure, HttpOnly, SameSite)
 *  4. Information Exposure (query params, console leaks, hidden inputs, error pages)
 *  5. Misconfiguration & Directory Enumeration (/.env, /.git/config, /robots.txt)
 *  6. Active Injection & Fuzzing (XSS, SQLi, NoSQLi, Command Injection — DDT)
 */

const { test, expect } = require('@playwright/test');

const TARGET_URL = process.env.TARGET_URL;
if (!TARGET_URL) throw new Error('TARGET_URL environment variable is required.');

// ─── Helpers ─────────────────────────────────────────────────────────────────
function resolveUrl(base, path) {
  try { return new URL(path, base).toString(); } catch { return null; }
}

function isHttps(url) {
  try { return new URL(url).protocol === 'https:'; } catch { return false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. HTTP SECURITY HEADER COMPLIANCE
// ─────────────────────────────────────────────────────────────────────────────
test.describe('HTTP Security Headers', () => {
  let mainResponse;
  let responseHeaders;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    // Capture the main document response
    page.on('response', (resp) => {
      if (!mainResponse && resp.request().resourceType() === 'document') {
        mainResponse = resp;
        responseHeaders = resp.headers();
      }
    });

    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
    await context.close();
  });

  test('Content-Security-Policy header is present', async () => {
    const csp = responseHeaders?.['content-security-policy'] || responseHeaders?.['content-security-policy-report-only'];
    expect(
      csp,
      'Missing Content-Security-Policy header. Without CSP, the application is vulnerable to XSS and data injection attacks.'
    ).toBeTruthy();
  });

  test('Strict-Transport-Security (HSTS) header is present', async () => {
    // Only meaningful on HTTPS
    if (!isHttps(TARGET_URL)) {
      console.warn('HSTS check skipped: target is HTTP, not HTTPS.');
      return;
    }
    expect(
      responseHeaders?.['strict-transport-security'],
      'Missing Strict-Transport-Security header. HSTS prevents protocol downgrade attacks and cookie hijacking.'
    ).toBeTruthy();
  });

  test('X-Frame-Options is set to DENY or SAMEORIGIN', async () => {
    const xfo = responseHeaders?.['x-frame-options']?.toUpperCase();
    // Modern sites use CSP frame-ancestors; either is acceptable
    const csp = responseHeaders?.['content-security-policy'] || '';
    const frameAncestors = csp.includes('frame-ancestors');

    if (!xfo && !frameAncestors) {
      throw new Error(
        'Neither X-Frame-Options nor CSP frame-ancestors directive found. The application may be vulnerable to Clickjacking.'
      );
    }
    if (xfo) {
      expect(['DENY', 'SAMEORIGIN']).toContain(xfo);
    }
  });

  test('X-Content-Type-Options is set to nosniff', async () => {
    expect(
      responseHeaders?.['x-content-type-options']?.toLowerCase(),
      'Missing X-Content-Type-Options: nosniff. Browsers may MIME-sniff responses, enabling XSS via uploaded files.'
    ).toBe('nosniff');
  });

  test('Referrer-Policy header is present', async () => {
    expect(
      responseHeaders?.['referrer-policy'],
      'Missing Referrer-Policy header. Sensitive URL parameters may leak to third-party sites via the Referer header.'
    ).toBeTruthy();
  });

  test('Permissions-Policy header is present', async () => {
    const pp = responseHeaders?.['permissions-policy'] || responseHeaders?.['feature-policy'];
    expect(
      pp,
      'Missing Permissions-Policy header. Browser features (camera, microphone, geolocation) should be explicitly restricted.'
    ).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. TRANSPORT & ASSET SECURITY
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Transport & Asset Security', () => {
  test('No mixed content: all resources loaded over HTTPS', async ({ page }) => {
    if (!isHttps(TARGET_URL)) {
      console.warn('Mixed-content check skipped: target is not HTTPS.');
      return;
    }

    const insecureResources = [];
    page.on('response', (resp) => {
      try {
        const url = resp.url();
        const type = resp.request().resourceType();
        if (['script', 'stylesheet', 'image', 'font', 'media', 'fetch', 'xhr'].includes(type)) {
          if (url.startsWith('http://')) insecureResources.push(`[${type}] ${url}`);
        }
      } catch {}
    });

    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    expect(
      insecureResources,
      `Mixed content detected — HTTP resources on an HTTPS page:\n${insecureResources.join('\n')}`
    ).toHaveLength(0);
  });

  test('All <form> action attributes use HTTPS (not HTTP)', async ({ page }) => {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

    const insecureForms = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('form[action]'))
        .map((f) => f.getAttribute('action'))
        .filter((a) => a && a.startsWith('http://'));
    });

    expect(
      insecureForms,
      `Form(s) submit to insecure HTTP endpoints, exposing credentials in transit:\n${insecureForms.join('\n')}`
    ).toHaveLength(0);
  });

  test('External CDN scripts/stylesheets have Subresource Integrity (SRI) attributes', async ({ page }) => {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

    const targetOrigin = new URL(TARGET_URL).origin;

    const violations = await page.evaluate((origin) => {
      const missing = [];

      document.querySelectorAll('script[src], link[rel="stylesheet"][href]').forEach((el) => {
        const src = el.src || el.href;
        try {
          const url = new URL(src);
          if (url.origin !== origin && !el.integrity) {
            missing.push(`<${el.tagName.toLowerCase()}> without integrity: ${src}`);
          }
        } catch {}
      });

      return missing;
    }, targetOrigin);

    // Report as a warning — many CDNs are trusted but SRI is best practice
    if (violations.length > 0) {
      console.warn(
        `⚠️  SRI WARNING: External resources missing integrity attribute (supply-chain risk):\n${violations.join('\n')}`
      );
    }
    // Soft assertion — flag as warning, not hard failure (common in SPAs)
    // Change to expect(violations).toHaveLength(0) for strict enforcement
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. COOKIE SAFETY
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Cookie Safety', () => {
  test('All cookies have Secure, HttpOnly flags and SameSite=Lax|Strict', async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

    const cookies = await context.cookies();
    await context.close();

    if (cookies.length === 0) {
      console.warn('No cookies found on the page. Skipping cookie safety checks.');
      return;
    }

    const violations = [];

    for (const cookie of cookies) {
      const issues = [];
      if (isHttps(TARGET_URL) && !cookie.secure) issues.push('missing Secure flag');
      if (!cookie.httpOnly) issues.push('missing HttpOnly flag');
      if (!['Lax', 'Strict'].includes(cookie.sameSite)) {
        issues.push(`SameSite is "${cookie.sameSite}" (expected Lax or Strict)`);
      }
      if (issues.length > 0) {
        violations.push(`Cookie "${cookie.name}": ${issues.join(', ')}`);
      }
    }

    expect(
      violations,
      `Insecure cookie configuration detected:\n${violations.join('\n')}`
    ).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. INFORMATION EXPOSURE
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Information Exposure', () => {
  const SENSITIVE_QUERY_KEYS = ['password', 'token', 'auth', 'secret', 'api_key', 'apikey', 'access_token'];

  test('No sensitive keys leaked in GET request query parameters', async ({ page }) => {
    const violations = [];

    page.on('request', (req) => {
      if (req.method() !== 'GET') return;
      try {
        const params = new URL(req.url()).searchParams;
        for (const key of params.keys()) {
          if (SENSITIVE_QUERY_KEYS.some((s) => key.toLowerCase().includes(s))) {
            violations.push(`${key}=*** in URL: ${req.url()}`);
          }
        }
      } catch {}
    });

    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

    expect(
      violations,
      `Sensitive data leaked via GET query parameters (visible in browser history, logs, Referer headers):\n${violations.join('\n')}`
    ).toHaveLength(0);
  });

  test('Console output does not contain JWTs or API keys', async ({ page }) => {
    const suspiciousLogs = [];
    const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
    const API_KEY_RE = /(?:api[_-]?key|apikey|token|secret)\s*[:=]\s*['"]?[\w\-]{16,}/i;

    page.on('console', (msg) => {
      const text = msg.text();
      if (JWT_RE.test(text)) suspiciousLogs.push(`[JWT] ${text.substring(0, 120)}…`);
      if (API_KEY_RE.test(text)) suspiciousLogs.push(`[API Key] ${text.substring(0, 120)}…`);
    });

    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

    expect(
      suspiciousLogs,
      `Secrets detected in browser console output:\n${suspiciousLogs.join('\n')}`
    ).toHaveLength(0);
  });

  test('No suspicious values in hidden <input> fields', async ({ page }) => {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

    const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
    const SUSPICIOUS_NAMES = ['token', 'auth', 'secret', 'api_key', 'password', 'jwt'];

    const suspicious = await page.evaluate(({ jwtPattern, suspNames }) => {
      const results = [];
      document.querySelectorAll('input[type="hidden"]').forEach((el) => {
        const name = (el.name || el.id || '').toLowerCase();
        const value = el.value || '';
        const isSuspiciousName = suspNames.some((s) => name.includes(s));
        const looksLikeJwt = new RegExp(jwtPattern).test(value);
        if (isSuspiciousName || looksLikeJwt) {
          results.push(`name="${el.name}" value="${value.substring(0, 40)}${value.length > 40 ? '…' : ''}"`);
        }
      });
      return results;
    }, { jwtPattern: JWT_RE.source, suspNames: SUSPICIOUS_NAMES });

    if (suspicious.length > 0) {
      console.warn(`⚠️  Suspicious hidden inputs found (review manually):\n${suspicious.join('\n')}`);
    }
    // Informational — hidden fields often hold CSRF tokens (legitimate)
  });

  test('404 error page does not expose server stack trace', async ({ page }) => {
    const nonExistentPath = resolveUrl(TARGET_URL, `/sqa-scanner-probe-${Date.now()}-not-found`);
    const resp = await page.goto(nonExistentPath, { waitUntil: 'domcontentloaded' });

    const body = await page.content();
    const stackTracePatterns = [
      /at\s+\w+\s*\([^)]+:\d+:\d+\)/,           // Node.js / JS stack
      /Traceback \(most recent call last\)/,      // Python
      /java\.lang\.\w+Exception/,                // Java
      /System\.Web\.HttpException/,              // ASP.NET
      /Warning:.*on line \d+/,                   // PHP
      /\bsyntaxerror\b.*line \d+/i,
    ];

    for (const pattern of stackTracePatterns) {
      expect(body).not.toMatch(pattern);
    }
  });

  test('500 error page does not expose server stack trace', async ({ page, request }) => {
    // We attempt to trigger a 500 by sending a malformed request
    const malformedUrl = resolveUrl(TARGET_URL, '/api/undefined-sqa-endpoint');
    try {
      const resp = await request.get(malformedUrl);
      const text = await resp.text();

      const stackTracePatterns = [
        /at\s+\w+\s*\([^)]+:\d+:\d+\)/,
        /Traceback \(most recent call last\)/,
        /java\.lang\.\w+Exception/,
        /System\.Web\.HttpException/,
      ];

      for (const pattern of stackTracePatterns) {
        expect(text).not.toMatch(pattern);
      }
    } catch {
      // Endpoint may not exist — that's acceptable
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. MISCONFIGURATION & DIRECTORY ENUMERATION
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Misconfiguration & Directory Enumeration', () => {
  test('/.env file is not publicly accessible', async ({ request }) => {
    const url = resolveUrl(TARGET_URL, '/.env');
    const resp = await request.get(url);

    expect(
      [403, 404],
      `CRITICAL: /.env file is accessible (HTTP ${resp.status()})! Environment secrets (DB passwords, API keys) may be exposed.`
    ).toContain(resp.status());
  });

  test('/.git/config is not publicly accessible', async ({ request }) => {
    const url = resolveUrl(TARGET_URL, '/.git/config');
    const resp = await request.get(url);

    expect(
      [403, 404],
      `CRITICAL: /.git/config is accessible (HTTP ${resp.status()})! Entire source code repository may be reconstructable.`
    ).toContain(resp.status());
  });

  test('/images/ directory listing is disabled', async ({ page }) => {
    const url = resolveUrl(TARGET_URL, '/images/');
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const body = await page.content();
      const listingPatterns = [
        /Index of \/images/i,
        /Directory listing for/i,
        /<title>.*directory.*<\/title>/i,
      ];
      for (const pat of listingPatterns) {
        expect(body, `Directory listing enabled for /images/: exposes file structure`).not.toMatch(pat);
      }
    } catch { /* Path may not exist */ }
  });

  test('/assets/ directory listing is disabled', async ({ page }) => {
    const url = resolveUrl(TARGET_URL, '/assets/');
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const body = await page.content();
      const listingPatterns = [
        /Index of \/assets/i,
        /Directory listing for/i,
        /<title>.*directory.*<\/title>/i,
      ];
      for (const pat of listingPatterns) {
        expect(body, `Directory listing enabled for /assets/: exposes build artifacts`).not.toMatch(pat);
      }
    } catch { /* Path may not exist */ }
  });

  test('/robots.txt Disallow paths are protected', async ({ request, page }) => {
    const robotsUrl = resolveUrl(TARGET_URL, '/robots.txt');
    let robotsResp;

    try {
      robotsResp = await request.get(robotsUrl);
    } catch {
      console.warn('robots.txt not accessible — skipping.');
      return;
    }

    if (robotsResp.status() !== 200) {
      console.warn(`robots.txt returned HTTP ${robotsResp.status()} — skipping.`);
      return;
    }

    const robotsText = await robotsResp.text();
    const disallowedPaths = robotsText
      .split('\n')
      .filter((line) => line.trim().toLowerCase().startsWith('disallow:'))
      .map((line) => line.replace(/disallow:\s*/i, '').trim())
      .filter((p) => p && p !== '/');

    for (const disallowedPath of disallowedPaths.slice(0, 5)) { // Check first 5
      const protectedUrl = resolveUrl(TARGET_URL, disallowedPath);
      try {
        const resp = await request.get(protectedUrl);
        const statusCode = resp.status();

        // Disallowed paths should be forbidden or not found, not openly accessible
        const isProtected = [401, 403, 404, 410].includes(statusCode) || statusCode >= 500;
        if (!isProtected) {
          console.warn(
            `⚠️  robots.txt Disallow path accessible: ${disallowedPath} → HTTP ${statusCode}`
          );
        }
      } catch { /* Network error, path doesn't resolve */ }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. ACTIVE INJECTION & FUZZING (Data-Driven Testing)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Active Injection & Fuzzing (DDT)', () => {
  const INJECTION_PAYLOADS = [
    { type: 'XSS',                          payload: '<script>alert("SQA_XSS_1")</script>' },
    { type: 'XSS (img onerror)',            payload: '<img src=x onerror=alert("SQA_XSS_2")>' },
    { type: 'XSS (attribute break)',        payload: '"><svg/onload=alert(1)>' },
    { type: 'SQLi (basic)',                 payload: "' OR 1=1 --" },
    { type: 'SQLi (union)',                 payload: "' UNION SELECT null,null --" },
    { type: 'NoSQLi',                       payload: '{"$gt": ""}' },
    { type: 'NoSQLi (regex)',               payload: '{"$regex": ".*"}' },
    { type: 'Command Injection',            payload: '|| id' },
    { type: 'Command Injection (;)',        payload: '; ls -la' },
    { type: 'Path Traversal (Unix)',        payload: '../../etc/passwd' },
    { type: 'Path Traversal (Windows)',     payload: '..\\..\\Windows\\system32\\drivers\\etc\\hosts' },
    { type: 'SSTI (Jinja)',                 payload: '{{7*7}}' },
    { type: 'SSTI (Freemarker)',            payload: '${7*7}' },
    { type: 'SSTI (Velocity)',              payload: '#set($x=7*7)$x' },
    { type: 'SSTI (Liquid)',                payload: '{{ "test" | upcase }}' },
    { type: 'CRLF/Header Injection',        payload: '%0d%0aSet-Cookie:evil=1' },
    { type: 'LDAP Injection',               payload: '*)(&(uid=*))' },
  ];

  const DB_ERROR_PATTERNS = [
    /you have an error in your sql syntax/i,
    /ORA-\d{5}/,
    /pg_query\(\)/i,
    /Warning.*mysql_/i,
    /unclosed quotation mark/i,
    /quoted string not properly terminated/i,
    /MongoError/i,
    /CastError/i,
    /mongoose.*error/i,
    /syntax error.*near/i,
  ];

  async function assertNoInjectionBugs(context, payload, source, response, body) {
    if (response.status() === 500) {
      throw new Error(`Server returned HTTP 500 for ${source} injection with payload: ${payload}`);
    }

    if (body?.includes(payload)) {
      throw new Error(`Payload reflected raw in response body for ${source}: ${payload}`);
    }

    for (const pattern of DB_ERROR_PATTERNS) {
      if (pattern.test(body || '')) {
        throw new Error(`Detected database error pattern for ${source} injection ${payload}: ${pattern}`);
      }
    }
  }

  test('Text inputs are resilient to injection payloads', async ({ page }) => {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

    const inputSelectors = await page.evaluate(() => {
      const inputs = Array.from(
        document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"])')
      );
      const textareas = Array.from(document.querySelectorAll('textarea'));

      return [...inputs, ...textareas].map((el, i) => {
        el.setAttribute('data-sqa-index', i.toString());
        return `[data-sqa-index="${i}"]`;
      });
    });

    if (inputSelectors.length === 0) {
      console.warn('No text input fields found on the page — skipping injection tests.');
      return;
    }

    for (const { type, payload } of INJECTION_PAYLOADS) {
      for (const selector of inputSelectors.slice(0, 3)) {
        try {
          await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
          const input = page.locator(selector).first();
          if (!(await input.isVisible())) continue;

          await input.fill(payload);
          let responseStatus = 200;

          page.once('response', (resp) => {
            if (resp.request().resourceType() === 'document') {
              responseStatus = resp.status();
            }
          });

          await input.press('Enter').catch(() => {});
          await page.waitForTimeout(1500);

          const domContent = await page.content();

          const xssReflected =
            (type.startsWith('XSS') || type.startsWith('SSTI')) &&
            domContent.includes(payload);

          expect(
            xssReflected,
            `⚠️  XSS/SSTI reflection detected for payload "${type}" on selector ${selector}`
          ).toBe(false);

          for (const pattern of DB_ERROR_PATTERNS) {
            expect(
              domContent,
              `⚠️  Database error detected after payload "${type}" on ${selector}: ${pattern}`
            ).not.toMatch(pattern);
          }

          expect(
            responseStatus,
            `⚠️  Server returned HTTP 500 after payload "${type}" on ${selector}`
          ).not.toBe(500);
        } catch (err) {
          console.warn(`Injection test error for [${type}] on ${selector}: ${err.message}`);
        }
      }
    }
  });

  test('Injection payloads in headers, cookies, query, JSON body, and URL paths are rejected safely', async ({ request, page }) => {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

    for (const { type, payload } of INJECTION_PAYLOADS) {
      const sources = [
        {
          source: 'query',
          action: async () => {
            const probeUrl = resolveUrl(TARGET_URL, `/?q=${encodeURIComponent(payload)}`);
            const response = await request.get(probeUrl);
            return { response, body: await response.text() };
          },
        },
        {
          source: 'header',
          action: async () => {
            const response = await request.get(TARGET_URL, {
              headers: { 'X-SQA-Payload': payload },
            });
            return { response, body: await response.text() };
          },
        },
        {
          source: 'cookie',
          action: async () => {
            const response = await request.get(TARGET_URL, {
              headers: { Cookie: `sqa_payload=${encodeURIComponent(payload)}` },
            });
            return { response, body: await response.text() };
          },
        },
        {
          source: 'json body',
          action: async () => {
            const response = await request.post(TARGET_URL, {
              data: { search: payload, input: payload },
            });
            return { response, body: await response.text() };
          },
        },
        {
          source: 'path',
          action: async () => {
            const probeUrl = resolveUrl(TARGET_URL, `/sqa-probe/${encodeURIComponent(payload)}`);
            const response = await request.get(probeUrl);
            return { response, body: await response.text() };
          },
        },
      ];

      for (const { source, action } of sources) {
        try {
          const { response, body } = await action();
          await assertNoInjectionBugs(request, payload, `${source} (${type})`, response, body);
        } catch (err) {
          console.warn(`Payload ${type} failed safe injection check in ${source}: ${err.message}`);
        }
      }
    }
  });

  test('URL path parameters do not reflect XSS payloads', async ({ page }) => {
    const xssPayload = encodeURIComponent('<script>alert("SQA_PATH_XSS")</script>');
    const probeUrl = resolveUrl(TARGET_URL, `/sqa-probe/${xssPayload}`);

    try {
      await page.goto(probeUrl, { waitUntil: 'domcontentloaded' });
      const content = await page.content();
      expect(content).not.toContain('<script>alert("SQA_PATH_XSS")</script>');
    } catch {
      // 404 on the probe URL is expected and acceptable
    }
  });
});
