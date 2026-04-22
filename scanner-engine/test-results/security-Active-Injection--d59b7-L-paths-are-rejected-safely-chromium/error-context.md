# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: security.spec.js >> Active Injection & Fuzzing (DDT) >> Injection payloads in headers, cookies, query, JSON body, and URL paths are rejected safely
- Location: tests\security.spec.js:557:3

# Error details

```
Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://ginandjuice.shop/
Call log:
  - navigating to "https://ginandjuice.shop/", waiting until "domcontentloaded"

```

# Test source

```ts
  458 |   ];
  459 | 
  460 |   const DB_ERROR_PATTERNS = [
  461 |     /you have an error in your sql syntax/i,
  462 |     /ORA-\d{5}/,
  463 |     /pg_query\(\)/i,
  464 |     /Warning.*mysql_/i,
  465 |     /unclosed quotation mark/i,
  466 |     /quoted string not properly terminated/i,
  467 |     /MongoError/i,
  468 |     /CastError/i,
  469 |     /mongoose.*error/i,
  470 |     /syntax error.*near/i,
  471 |   ];
  472 | 
  473 |   async function assertNoInjectionBugs(context, payload, source, response, body) {
  474 |     if (response.status() === 500) {
  475 |       throw new Error(`Server returned HTTP 500 for ${source} injection with payload: ${payload}`);
  476 |     }
  477 | 
  478 |     if (body?.includes(payload)) {
  479 |       throw new Error(`Payload reflected raw in response body for ${source}: ${payload}`);
  480 |     }
  481 | 
  482 |     for (const pattern of DB_ERROR_PATTERNS) {
  483 |       if (pattern.test(body || '')) {
  484 |         throw new Error(`Detected database error pattern for ${source} injection ${payload}: ${pattern}`);
  485 |       }
  486 |     }
  487 |   }
  488 | 
  489 |   test('Text inputs are resilient to injection payloads', async ({ page }) => {
  490 |     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  491 | 
  492 |     const inputSelectors = await page.evaluate(() => {
  493 |       const inputs = Array.from(
  494 |         document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"])')
  495 |       );
  496 |       const textareas = Array.from(document.querySelectorAll('textarea'));
  497 | 
  498 |       return [...inputs, ...textareas].map((el, i) => {
  499 |         el.setAttribute('data-sqa-index', i.toString());
  500 |         return `[data-sqa-index="${i}"]`;
  501 |       });
  502 |     });
  503 | 
  504 |     if (inputSelectors.length === 0) {
  505 |       console.warn('No text input fields found on the page — skipping injection tests.');
  506 |       return;
  507 |     }
  508 | 
  509 |     for (const { type, payload } of INJECTION_PAYLOADS) {
  510 |       for (const selector of inputSelectors.slice(0, 3)) {
  511 |         try {
  512 |           await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  513 |           const input = page.locator(selector).first();
  514 |           if (!(await input.isVisible())) continue;
  515 | 
  516 |           await input.fill(payload);
  517 |           let responseStatus = 200;
  518 | 
  519 |           page.once('response', (resp) => {
  520 |             if (resp.request().resourceType() === 'document') {
  521 |               responseStatus = resp.status();
  522 |             }
  523 |           });
  524 | 
  525 |           await input.press('Enter').catch(() => {});
  526 |           await page.waitForTimeout(1500);
  527 | 
  528 |           const domContent = await page.content();
  529 | 
  530 |           const xssReflected =
  531 |             (type.startsWith('XSS') || type.startsWith('SSTI')) &&
  532 |             domContent.includes(payload);
  533 | 
  534 |           expect(
  535 |             xssReflected,
  536 |             `⚠️  XSS/SSTI reflection detected for payload "${type}" on selector ${selector}`
  537 |           ).toBe(false);
  538 | 
  539 |           for (const pattern of DB_ERROR_PATTERNS) {
  540 |             expect(
  541 |               domContent,
  542 |               `⚠️  Database error detected after payload "${type}" on ${selector}: ${pattern}`
  543 |             ).not.toMatch(pattern);
  544 |           }
  545 | 
  546 |           expect(
  547 |             responseStatus,
  548 |             `⚠️  Server returned HTTP 500 after payload "${type}" on ${selector}`
  549 |           ).not.toBe(500);
  550 |         } catch (err) {
  551 |           console.warn(`Injection test error for [${type}] on ${selector}: ${err.message}`);
  552 |         }
  553 |       }
  554 |     }
  555 |   });
  556 | 
  557 |   test('Injection payloads in headers, cookies, query, JSON body, and URL paths are rejected safely', async ({ request, page }) => {
> 558 |     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
      |                ^ Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://ginandjuice.shop/
  559 | 
  560 |     for (const { type, payload } of INJECTION_PAYLOADS) {
  561 |       const sources = [
  562 |         {
  563 |           source: 'query',
  564 |           action: async () => {
  565 |             const probeUrl = resolveUrl(TARGET_URL, `/?q=${encodeURIComponent(payload)}`);
  566 |             const response = await request.get(probeUrl);
  567 |             return { response, body: await response.text() };
  568 |           },
  569 |         },
  570 |         {
  571 |           source: 'header',
  572 |           action: async () => {
  573 |             const response = await request.get(TARGET_URL, {
  574 |               headers: { 'X-SQA-Payload': payload },
  575 |             });
  576 |             return { response, body: await response.text() };
  577 |           },
  578 |         },
  579 |         {
  580 |           source: 'cookie',
  581 |           action: async () => {
  582 |             const response = await request.get(TARGET_URL, {
  583 |               headers: { Cookie: `sqa_payload=${encodeURIComponent(payload)}` },
  584 |             });
  585 |             return { response, body: await response.text() };
  586 |           },
  587 |         },
  588 |         {
  589 |           source: 'json body',
  590 |           action: async () => {
  591 |             const response = await request.post(TARGET_URL, {
  592 |               data: { search: payload, input: payload },
  593 |             });
  594 |             return { response, body: await response.text() };
  595 |           },
  596 |         },
  597 |         {
  598 |           source: 'path',
  599 |           action: async () => {
  600 |             const probeUrl = resolveUrl(TARGET_URL, `/sqa-probe/${encodeURIComponent(payload)}`);
  601 |             const response = await request.get(probeUrl);
  602 |             return { response, body: await response.text() };
  603 |           },
  604 |         },
  605 |       ];
  606 | 
  607 |       for (const { source, action } of sources) {
  608 |         try {
  609 |           const { response, body } = await action();
  610 |           await assertNoInjectionBugs(request, payload, `${source} (${type})`, response, body);
  611 |         } catch (err) {
  612 |           console.warn(`Payload ${type} failed safe injection check in ${source}: ${err.message}`);
  613 |         }
  614 |       }
  615 |     }
  616 |   });
  617 | 
  618 |   test('URL path parameters do not reflect XSS payloads', async ({ page }) => {
  619 |     const xssPayload = encodeURIComponent('<script>alert("SQA_PATH_XSS")</script>');
  620 |     const probeUrl = resolveUrl(TARGET_URL, `/sqa-probe/${xssPayload}`);
  621 | 
  622 |     try {
  623 |       await page.goto(probeUrl, { waitUntil: 'domcontentloaded' });
  624 |       const content = await page.content();
  625 |       expect(content).not.toContain('<script>alert("SQA_PATH_XSS")</script>');
  626 |     } catch {
  627 |       // 404 on the probe URL is expected and acceptable
  628 |     }
  629 |   });
  630 | });
  631 | 
```