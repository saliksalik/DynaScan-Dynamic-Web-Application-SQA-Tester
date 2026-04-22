# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: structural.spec.js >> Anchor Tag Integrity >> All internal <a> hrefs resolve without 404
- Location: tests\structural.spec.js:25:3

# Error details

```
Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://ginandjuice.shop/
Call log:
  - navigating to "https://ginandjuice.shop/", waiting until "domcontentloaded"

```

# Test source

```ts
  1   | // scanner-engine/tests/structural.spec.js
  2   | /**
  3   |  * structural.spec.js — DOM & Accessibility Checks
  4   |  *
  5   |  * Covers:
  6   |  *  1. Anchor (<a>) tag integrity — no 404 links
  7   |  *  2. Image (<img>) tag integrity — no broken images
  8   |  *  3. axe-core accessibility scan — zero critical violations
  9   |  */
  10  | 
  11  | const { test, expect } = require('@playwright/test');
  12  | const { readFileSync } = require('fs');
  13  | const path = require('path');
  14  | 
  15  | const TARGET_URL = process.env.TARGET_URL;
  16  | if (!TARGET_URL) throw new Error('TARGET_URL environment variable is required.');
  17  | 
  18  | // axe-core source bundled in node_modules
  19  | const AXE_CORE_PATH = require.resolve('axe-core');
  20  | 
  21  | // ─────────────────────────────────────────────────────────────────────────────
  22  | // 1. ANCHOR TAG INTEGRITY
  23  | // ─────────────────────────────────────────────────────────────────────────────
  24  | test.describe('Anchor Tag Integrity', () => {
  25  |   test('All internal <a> hrefs resolve without 404', async ({ page, request }) => {
> 26  |     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
      |                ^ Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://ginandjuice.shop/
  27  | 
  28  |     const targetOrigin = new URL(TARGET_URL).origin;
  29  | 
  30  |     const hrefs = await page.evaluate((origin) => {
  31  |       return Array.from(document.querySelectorAll('a[href]'))
  32  |         .map((a) => a.getAttribute('href'))
  33  |         .filter((href) => {
  34  |           if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
  35  |           try {
  36  |             const url = new URL(href, origin);
  37  |             // Only check same-origin links (avoid hammering external sites)
  38  |             return url.origin === origin;
  39  |           } catch { return false; }
  40  |         })
  41  |         .map((href) => new URL(href, origin).toString());
  42  |     }, targetOrigin);
  43  | 
  44  |     // Deduplicate
  45  |     const uniqueHrefs = [...new Set(hrefs)];
  46  | 
  47  |     if (uniqueHrefs.length === 0) {
  48  |       console.warn('No internal anchor links found on the page.');
  49  |       return;
  50  |     }
  51  | 
  52  |     const broken = [];
  53  |     for (const href of uniqueHrefs.slice(0, 30)) { // Cap at 30 to avoid very long runs
  54  |       try {
  55  |         const resp = await request.head(href, { timeout: 8000 });
  56  |         if (resp.status() === 404) {
  57  |           broken.push(`404 → ${href}`);
  58  |         }
  59  |       } catch (err) {
  60  |         broken.push(`ERR(${err.message}) → ${href}`);
  61  |       }
  62  |     }
  63  | 
  64  |     expect(
  65  |       broken,
  66  |       `Broken internal links detected (404):\n${broken.join('\n')}`
  67  |     ).toHaveLength(0);
  68  |   });
  69  | 
  70  |   test('No <a> tags have empty or javascript: href values', async ({ page }) => {
  71  |     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  72  | 
  73  |     const suspicious = await page.evaluate(() => {
  74  |       return Array.from(document.querySelectorAll('a[href]'))
  75  |         .map((a) => a.getAttribute('href'))
  76  |         .filter((href) => !href || href.trim() === '' || href.startsWith('javascript:'));
  77  |     });
  78  | 
  79  |     if (suspicious.length > 0) {
  80  |       console.warn(`⚠️  Suspicious <a> hrefs (empty or javascript:):\n${suspicious.join('\n')}`);
  81  |     }
  82  |   });
  83  | });
  84  | 
  85  | // ─────────────────────────────────────────────────────────────────────────────
  86  | // 2. IMAGE TAG INTEGRITY
  87  | // ─────────────────────────────────────────────────────────────────────────────
  88  | test.describe('Image Tag Integrity', () => {
  89  |   test('All <img> src attributes resolve without errors', async ({ page, request }) => {
  90  |     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  91  | 
  92  |     const targetOrigin = new URL(TARGET_URL).origin;
  93  | 
  94  |     const imgSrcs = await page.evaluate((origin) => {
  95  |       return Array.from(document.querySelectorAll('img[src]'))
  96  |         .map((img) => img.getAttribute('src'))
  97  |         .filter((src) => src && !src.startsWith('data:'))
  98  |         .map((src) => {
  99  |           try { return new URL(src, origin).toString(); } catch { return null; }
  100 |         })
  101 |         .filter(Boolean);
  102 |     }, targetOrigin);
  103 | 
  104 |     const uniqueSrcs = [...new Set(imgSrcs)];
  105 | 
  106 |     if (uniqueSrcs.length === 0) {
  107 |       console.warn('No <img> tags with external src found.');
  108 |       return;
  109 |     }
  110 | 
  111 |     const broken = [];
  112 |     for (const src of uniqueSrcs.slice(0, 20)) {
  113 |       try {
  114 |         const resp = await request.head(src, { timeout: 8000 });
  115 |         if (resp.status() >= 400) {
  116 |           broken.push(`HTTP ${resp.status()} → ${src}`);
  117 |         }
  118 |       } catch (err) {
  119 |         broken.push(`ERR(${err.message}) → ${src}`);
  120 |       }
  121 |     }
  122 | 
  123 |     expect(
  124 |       broken,
  125 |       `Broken images detected:\n${broken.join('\n')}`
  126 |     ).toHaveLength(0);
```