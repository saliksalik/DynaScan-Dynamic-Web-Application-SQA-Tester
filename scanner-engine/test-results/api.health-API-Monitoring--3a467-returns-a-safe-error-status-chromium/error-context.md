# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api.health.spec.js >> API Monitoring and Health >> unknown API path returns a safe error status
- Location: tests\api.health.spec.js:290:3

# Error details

```
Error: apiRequestContext.get: getaddrinfo ENOTFOUND ginandjuice.shop
Call log:
  - → GET https://ginandjuice.shop/sqa-probe-1776823106646-6zfbd6fb527
    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7727.15 Safari/537.36
    - accept: */*
    - accept-encoding: gzip,deflate,br
    - Accept-Language: en-US,en;q=0.9

```

# Test source

```ts
  193 |     for (const response of apiResponses) {
  194 |       const request = response.request();
  195 |       const responseContentType = response.headers()['content-type'];
  196 | 
  197 |       if (!responseContentType) {
  198 |         headerFailures.push(`Missing Content-Type header in response: ${request.url()}`);
  199 |       }
  200 | 
  201 |       if ([401, 403].includes(response.status()) && !hasAuthHeader(request)) {
  202 |         headerFailures.push(`Authentication header missing for protected response: ${request.method()} ${request.url()}`);
  203 |       }
  204 |     }
  205 | 
  206 |     expect(
  207 |       headerFailures,
  208 |       `Header/Auth validation issues detected:
  209 | ${headerFailures.join('\n')}`
  210 |     ).toHaveLength(0);
  211 |   });
  212 | 
  213 |   test('captured API routes handle invalid probes without returning server errors', async ({ request, page }) => {
  214 |     const apiResponses = await captureApiResponses(page);
  215 | 
  216 |     if (apiResponses.length === 0) {
  217 |       test.skip('No API requests were captured on the target page.');
  218 |       return;
  219 |     }
  220 | 
  221 |     const uniqueRoutes = new Map();
  222 |     for (const response of apiResponses) {
  223 |       const requestObj = response.request();
  224 |       const url = new URL(requestObj.url());
  225 |       url.search = '';
  226 |       const routeKey = `${requestObj.method()} ${url.toString()}`;
  227 |       uniqueRoutes.set(routeKey, requestObj.method());
  228 |     }
  229 | 
  230 |     const probeFailures = [];
  231 |     for (const [routeKey, method] of uniqueRoutes) {
  232 |       const urlString = routeKey.split(' ').slice(1).join(' ');
  233 |       try {
  234 |         let probeResponse;
  235 |         if (method === 'GET') {
  236 |           const url = new URL(urlString);
  237 |           url.searchParams.set('sqa_probe', 'invalid');
  238 |           probeResponse = await request.get(url.toString());
  239 |         } else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
  240 |           probeResponse = await request.fetch(urlString, {
  241 |             method,
  242 |             data: { sqa_probe: 'invalid' },
  243 |             headers: { 'Content-Type': 'application/json' }
  244 |           });
  245 |         } else {
  246 |           probeResponse = await request.fetch(urlString, { method });
  247 |         }
  248 | 
  249 |         if (probeResponse.status() === 500) {
  250 |           probeFailures.push(`${routeKey} returned 500 on invalid probe`);
  251 |         }
  252 |       } catch (err) {
  253 |         probeFailures.push(`${routeKey} invalid probe failed: ${err.message}`);
  254 |       }
  255 |     }
  256 | 
  257 |     expect(
  258 |       probeFailures,
  259 |       `Negative error-path failures detected:
  260 | ${probeFailures.join('\n')}`
  261 |     ).toHaveLength(0);
  262 |   });
  263 | 
  264 |   test('captured API calls complete within acceptable latency', async ({ page }) => {
  265 |     const apiResponses = await captureApiResponses(page);
  266 | 
  267 |     if (apiResponses.length === 0) {
  268 |       test.skip('No API requests were captured on the target page.');
  269 |       return;
  270 |     }
  271 | 
  272 |     const slowResponses = [];
  273 |     for (const response of apiResponses) {
  274 |       const timing = response.timing ? response.timing() : null;
  275 |       if (timing && typeof timing.responseEnd === 'number' && typeof timing.startTime === 'number') {
  276 |         const latency = timing.responseEnd - timing.startTime;
  277 |         if (latency > 2000) {
  278 |           slowResponses.push(`${response.request().method()} ${response.url()} took ${Math.round(latency)}ms`);
  279 |         }
  280 |       }
  281 |     }
  282 | 
  283 |     expect(
  284 |       slowResponses,
  285 |       `API latency exceeded threshold for some calls:
  286 | ${slowResponses.join('\n')}`
  287 |     ).toHaveLength(0);
  288 |   });
  289 | 
  290 |   test('unknown API path returns a safe error status', async ({ request }) => {
  291 |     const probePath = `/sqa-probe-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  292 |     const probeUrl = new URL(probePath, TARGET_URL).toString();
> 293 |     const response = await request.get(probeUrl);
      |                                    ^ Error: apiRequestContext.get: getaddrinfo ENOTFOUND ginandjuice.shop
  294 | 
  295 |     expect(
  296 |       response.status(),
  297 |       `Unknown path ${probePath} should not return 200. Received ${response.status()} instead.`
  298 |     ).not.toBe(200);
  299 |     expect(
  300 |       response.status(),
  301 |       `Unknown path ${probePath} must not produce a server error (500). Received 500.`
  302 |     ).not.toBe(500);
  303 |   });
  304 | 
  305 |   test('optional /health endpoint returns a healthy response if present', async ({ request }) => {
  306 |     const healthResponse = await getHealthResponse(request);
  307 |     if (!healthResponse) {
  308 |       test.skip('No /health endpoint detected on target site.');
  309 |       return;
  310 |     }
  311 | 
  312 |     expect(
  313 |       [200, 204],
  314 |       `/health endpoint must return 200 or 204, got ${healthResponse.status()}`
  315 |     ).toContain(healthResponse.status());
  316 | 
  317 |     const contentType = healthResponse.headers()['content-type'] || '';
  318 |     if (isJsonContentType(contentType)) {
  319 |       const healthBody = await healthResponse.json();
  320 |       expect(healthBody).toHaveProperty('status');
  321 |       expect(healthBody.status).toBeTruthy();
  322 |     }
  323 |   });
  324 | });
  325 | 
```