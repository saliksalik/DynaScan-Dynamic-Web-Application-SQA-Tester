const { test, expect } = require('@playwright/test');

const TARGET_URL = process.env.TARGET_URL;
if (!TARGET_URL) throw new Error('TARGET_URL environment variable is required.');

function isApiResponse(response) {
  const type = response.request().resourceType();
  return ['xhr', 'fetch'].includes(type);
}

function isJsonContentType(contentType) {
  return typeof contentType === 'string' && contentType.toLowerCase().includes('application/json');
}

async function captureApiResponses(page) {
  const apiResponses = [];
  page.on('response', (response) => {
    if (isApiResponse(response)) {
      apiResponses.push(response);
    }
  });

  await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  return apiResponses;
}

async function parseJsonResponse(response) {
  const contentType = response.headers()['content-type'] || '';
  if (!isJsonContentType(contentType)) return null;

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function normalizeApiRoute(response) {
  const request = response.request();
  const url = new URL(request.url());
  url.search = '';
  return `${request.method()} ${url.toString()}`;
}

function inferSchema(value) {
  if (value === null) return { type: 'null' };
  if (Array.isArray(value)) {
    return {
      type: 'array',
      items: value.length ? inferSchema(value[0]) : { type: 'unknown' }
    };
  }
  if (typeof value === 'object') {
    const schema = { type: 'object', keys: {} };
    for (const [key, val] of Object.entries(value)) {
      schema.keys[key] = inferSchema(val);
    }
    return schema;
  }
  return { type: typeof value };
}

function schemaEquals(a, b) {
  if (a.type !== b.type) return false;
  if (a.type === 'object') {
    const aKeys = Object.keys(a.keys || {});
    const bKeys = Object.keys(b.keys || {});
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => b.keys[key] && schemaEquals(a.keys[key], b.keys[key]));
  }
  if (a.type === 'array') {
    return schemaEquals(a.items, b.items);
  }
  return true;
}

function hasAuthHeader(request) {
  const headers = request.headers();
  return Boolean(
    headers['authorization'] ||
    headers['x-api-key'] ||
    headers['x-api-token'] ||
    headers.cookie
  );
}

async function getHealthResponse(request) {
  try {
    const healthUrl = new URL('/health', TARGET_URL).toString();
    const response = await request.get(healthUrl);
    if (response.status() === 404) return null;
    return response;
  } catch {
    return null;
  }
}

test.describe('API Monitoring and Health', () => {
  test('captured XHR/fetch API responses are successful', async ({ page }) => {
    const apiResponses = await captureApiResponses(page);

    if (apiResponses.length === 0) {
      test.skip('No API requests were captured on the target page.');
      return;
    }

    const failures = [];
    for (const response of apiResponses) {
      const status = response.status();
      if (status >= 400) {
        failures.push(`${response.request().method()} ${response.url()} returned ${status}`);
      }
    }

    expect(
      failures,
      `Captured API requests returned error statuses:
${failures.join('\n')}`
    ).toHaveLength(0);
  });

  test('captured JSON API responses parse cleanly and use correct content type', async ({ page }) => {
    const apiResponses = await captureApiResponses(page);

    if (apiResponses.length === 0) {
      test.skip('No API requests were captured on the target page.');
      return;
    }

    const parseIssues = [];
    for (const response of apiResponses) {
      const contentType = response.headers()['content-type'] || '';
      const isJson = isJsonContentType(contentType);
      if (isJson) {
        const parsed = await parseJsonResponse(response);
        if (parsed === null) {
          parseIssues.push(`Invalid JSON from ${response.request().method()} ${response.url()}`);
        }
      }
    }

    expect(
      parseIssues,
      `JSON API response validation failed:
${parseIssues.join('\n')}`
    ).toHaveLength(0);
  });

  test('captured JSON API responses follow a stable contract across repeated endpoints', async ({ page }) => {
    const apiResponses = await captureApiResponses(page);

    if (apiResponses.length === 0) {
      test.skip('No API requests were captured on the target page.');
      return;
    }

    const routeSchemas = new Map();
    const contractFailures = [];

    for (const response of apiResponses) {
      const jsonBody = await parseJsonResponse(response);
      if (jsonBody === null) continue;

      const routeKey = normalizeApiRoute(response);
      const schema = inferSchema(jsonBody);

      if (!routeSchemas.has(routeKey)) {
        routeSchemas.set(routeKey, schema);
      } else if (!schemaEquals(routeSchemas.get(routeKey), schema)) {
        contractFailures.push(`Contract mismatch for ${routeKey}`);
      }
    }

    expect(
      contractFailures,
      `API contract inconsistencies detected:
${contractFailures.join('\n')}`
    ).toHaveLength(0);
  });

  test('captured API requests include expected headers and auth behavior', async ({ page }) => {
    const apiResponses = await captureApiResponses(page);

    if (apiResponses.length === 0) {
      test.skip('No API requests were captured on the target page.');
      return;
    }

    const headerFailures = [];

    for (const response of apiResponses) {
      const request = response.request();
      const responseContentType = response.headers()['content-type'];

      if (!responseContentType) {
        headerFailures.push(`Missing Content-Type header in response: ${request.url()}`);
      }

      if ([401, 403].includes(response.status()) && !hasAuthHeader(request)) {
        headerFailures.push(`Authentication header missing for protected response: ${request.method()} ${request.url()}`);
      }
    }

    expect(
      headerFailures,
      `Header/Auth validation issues detected:
${headerFailures.join('\n')}`
    ).toHaveLength(0);
  });

  test('captured API routes handle invalid probes without returning server errors', async ({ request, page }) => {
    const apiResponses = await captureApiResponses(page);

    if (apiResponses.length === 0) {
      test.skip('No API requests were captured on the target page.');
      return;
    }

    const uniqueRoutes = new Map();
    for (const response of apiResponses) {
      const requestObj = response.request();
      const url = new URL(requestObj.url());
      url.search = '';
      const routeKey = `${requestObj.method()} ${url.toString()}`;
      uniqueRoutes.set(routeKey, requestObj.method());
    }

    const probeFailures = [];
    for (const [routeKey, method] of uniqueRoutes) {
      const urlString = routeKey.split(' ').slice(1).join(' ');
      try {
        let probeResponse;
        if (method === 'GET') {
          const url = new URL(urlString);
          url.searchParams.set('sqa_probe', 'invalid');
          probeResponse = await request.get(url.toString());
        } else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          probeResponse = await request.fetch(urlString, {
            method,
            data: { sqa_probe: 'invalid' },
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          probeResponse = await request.fetch(urlString, { method });
        }

        if (probeResponse.status() === 500) {
          probeFailures.push(`${routeKey} returned 500 on invalid probe`);
        }
      } catch (err) {
        probeFailures.push(`${routeKey} invalid probe failed: ${err.message}`);
      }
    }

    expect(
      probeFailures,
      `Negative error-path failures detected:
${probeFailures.join('\n')}`
    ).toHaveLength(0);
  });

  test('captured API calls complete within acceptable latency', async ({ page }) => {
    const apiResponses = await captureApiResponses(page);

    if (apiResponses.length === 0) {
      test.skip('No API requests were captured on the target page.');
      return;
    }

    const slowResponses = [];
    for (const response of apiResponses) {
      const timing = response.timing ? response.timing() : null;
      if (timing && typeof timing.responseEnd === 'number' && typeof timing.startTime === 'number') {
        const latency = timing.responseEnd - timing.startTime;
        if (latency > 2000) {
          slowResponses.push(`${response.request().method()} ${response.url()} took ${Math.round(latency)}ms`);
        }
      }
    }

    expect(
      slowResponses,
      `API latency exceeded threshold for some calls:
${slowResponses.join('\n')}`
    ).toHaveLength(0);
  });

  test('unknown API path returns a safe error status', async ({ request }) => {
    const probePath = `/sqa-probe-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const probeUrl = new URL(probePath, TARGET_URL).toString();
    const response = await request.get(probeUrl);

    expect(
      response.status(),
      `Unknown path ${probePath} should not return 200. Received ${response.status()} instead.`
    ).not.toBe(200);
    expect(
      response.status(),
      `Unknown path ${probePath} must not produce a server error (500). Received 500.`
    ).not.toBe(500);
  });

  test('optional /health endpoint returns a healthy response if present', async ({ request }) => {
    const healthResponse = await getHealthResponse(request);
    if (!healthResponse) {
      test.skip('No /health endpoint detected on target site.');
      return;
    }

    expect(
      [200, 204],
      `/health endpoint must return 200 or 204, got ${healthResponse.status()}`
    ).toContain(healthResponse.status());

    const contentType = healthResponse.headers()['content-type'] || '';
    if (isJsonContentType(contentType)) {
      const healthBody = await healthResponse.json();
      expect(healthBody).toHaveProperty('status');
      expect(healthBody.status).toBeTruthy();
    }
  });
});
