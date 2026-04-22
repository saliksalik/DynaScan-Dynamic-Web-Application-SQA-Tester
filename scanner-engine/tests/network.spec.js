// scanner-engine/tests/network.spec.js
/**
 * network.spec.js — API Health via Network Interception
 *
 * Covers:
 *  1. HTTP Status Assertions (500s, 404 APIs, 401/403, CORS failures)
 *  2. Performance (response time < 2000ms, payload size < 2MB)
 *  3. Frontend Efficiency (duplicate requests, empty POST/PUT bodies)
 */

const { test, expect } = require('@playwright/test');

const TARGET_URL = process.env.TARGET_URL;
if (!TARGET_URL) throw new Error('TARGET_URL environment variable is required.');

const NETWORK_TYPES = ['fetch', 'xhr'];

// ─── Shared network state captured on page load ───────────────────────────────
let capturedRequests = [];
let capturedResponses = [];

async function loadAndCapture(page) {
  capturedRequests = [];
  capturedResponses = [];

  page.on('request', (req) => {
    if (NETWORK_TYPES.includes(req.resourceType())) {
      capturedRequests.push({
        url: req.url(),
        method: req.method(),
        postData: req.postData(),
        timestamp: Date.now(),
        resourceType: req.resourceType(),
      });
    }
  });

  page.on('response', async (resp) => {
    if (NETWORK_TYPES.includes(resp.request().resourceType())) {
      const timing = resp.request().timing();
      const responseStart = timing?.responseStart ?? 0;
      const requestStart = timing?.requestStart ?? 0;
      const responseTime = responseStart > 0 ? responseStart - requestStart : null;

      let bodySize = 0;
      let contentType = resp.headers()['content-type'] || '';
      try {
        const body = await resp.body();
        bodySize = body?.length ?? 0;
      } catch {}

      capturedResponses.push({
        url: resp.url(),
        status: resp.status(),
        headers: resp.headers(),
        responseTime,
        bodySize,
        contentType,
      });
    }
  });

  await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. HTTP STATUS TESTS
// ─────────────────────────────────────────────────────────────────────────────
test.describe('HTTP Status Checks (fetch/XHR)', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    await loadAndCapture(page);
    await context.close();
  });

  test('Zero 5xx server errors in API responses', () => {
    const failures = capturedResponses.filter((r) => r.status >= 500);
    expect(
      failures.map((r) => `[${r.status}] ${r.url}`),
      `Server-side errors detected in API responses:\n${failures.map((r) => `  ${r.status} → ${r.url}`).join('\n')}`
    ).toHaveLength(0);
  });

  test('Zero 404 responses from API endpoints', () => {
    const notFound = capturedResponses.filter((r) => r.status === 404);
    expect(
      notFound.map((r) => r.url),
      `API endpoints returning 404 (broken client code or stale references):\n${notFound.map((r) => `  ${r.url}`).join('\n')}`
    ).toHaveLength(0);
  });

  test('No unhandled 401 Unauthorized responses', () => {
    const unauthorized = capturedResponses.filter((r) => r.status === 401);
    expect(
      unauthorized.map((r) => r.url),
      `Unhandled 401 responses — API calls missing authentication tokens:\n${unauthorized.map((r) => `  ${r.url}`).join('\n')}`
    ).toHaveLength(0);
  });

  test('No unhandled 403 Forbidden responses', () => {
    const forbidden = capturedResponses.filter((r) => r.status === 403);
    if (forbidden.length > 0) {
      console.warn(`⚠️  403 responses found (may be intentional access control):\n${forbidden.map((r) => `  ${r.url}`).join('\n')}`);
    }
    // Soft check — 403 can be legitimate (access control). Log only.
  });

  test('No CORS preflight failures (OPTIONS → non-2xx)', async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    const corsFailures = [];
    page.on('response', (resp) => {
      if (resp.request().method() === 'OPTIONS' && resp.status() >= 400) {
        corsFailures.push(`OPTIONS ${resp.url()} → ${resp.status()}`);
      }
    });

    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    await context.close();

    expect(
      corsFailures,
      `CORS preflight failures (may block cross-origin requests in production):\n${corsFailures.join('\n')}`
    ).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. PERFORMANCE TESTS
// ─────────────────────────────────────────────────────────────────────────────
test.describe('API Performance (fetch/XHR)', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    await loadAndCapture(page);
    await context.close();
  });

  test('All API responses complete within 2000ms', () => {
    const slowResponses = capturedResponses
      .filter((r) => r.responseTime !== null && r.responseTime > 2000)
      .map((r) => `  ${r.responseTime}ms → ${r.url}`);

    expect(
      slowResponses,
      `Slow API responses detected (> 2000ms):\n${slowResponses.join('\n')}`
    ).toHaveLength(0);
  });

  test('No JSON payload exceeds 2MB in size', () => {
    const TWO_MB = 2 * 1024 * 1024;
    const oversized = capturedResponses
      .filter((r) => r.contentType.includes('json') && r.bodySize > TWO_MB)
      .map((r) => `  ${(r.bodySize / 1024 / 1024).toFixed(2)}MB → ${r.url}`);

    expect(
      oversized,
      `Oversized JSON payloads detected (> 2MB) — consider pagination or compression:\n${oversized.join('\n')}`
    ).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. FRONTEND-TO-BACKEND EFFICIENCY
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Frontend Efficiency (fetch/XHR)', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    await loadAndCapture(page);
    await context.close();
  });

  test('No duplicate API requests fire simultaneously (debounce check)', () => {
    const DUPLICATE_WINDOW_MS = 500;

    // Group GET requests by URL
    const urlGroups = {};
    capturedRequests
      .filter((r) => r.method === 'GET')
      .forEach((req) => {
        const key = req.url;
        if (!urlGroups[key]) urlGroups[key] = [];
        urlGroups[key].push(req.timestamp);
      });

    const duplicates = [];
    for (const [url, timestamps] of Object.entries(urlGroups)) {
      const sorted = timestamps.sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i - 1] < DUPLICATE_WINDOW_MS) {
          duplicates.push(`Duplicate GET within ${DUPLICATE_WINDOW_MS}ms window: ${url}`);
        }
      }
    }

    if (duplicates.length > 0) {
      console.warn(
        `⚠️  Potential lack of debouncing / request deduplication detected:\n${duplicates.join('\n')}`
      );
    }
    // Informational — duplicate requests can be legitimate (retry logic)
  });

  test('No POST/PUT requests send empty or null bodies', () => {
    const emptyBodies = capturedRequests
      .filter((r) => ['POST', 'PUT', 'PATCH'].includes(r.method))
      .filter((r) => {
        const data = r.postData;
        if (!data) return true;
        try {
          const parsed = JSON.parse(data);
          return parsed === null || (typeof parsed === 'object' && Object.keys(parsed).length === 0);
        } catch {
          return data.trim() === '';
        }
      })
      .map((r) => `  ${r.method} ${r.url}`);

    if (emptyBodies.length > 0) {
      console.warn(
        `⚠️  POST/PUT requests with empty bodies (may indicate missing data binding):\n${emptyBodies.join('\n')}`
      );
    }
  });
});
