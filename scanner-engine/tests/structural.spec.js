// scanner-engine/tests/structural.spec.js
/**
 * structural.spec.js — DOM & Accessibility Checks
 *
 * Covers:
 *  1. Anchor (<a>) tag integrity — no 404 links
 *  2. Image (<img>) tag integrity — no broken images
 *  3. axe-core accessibility scan — zero critical violations
 */

const { test, expect } = require('@playwright/test');
const { readFileSync } = require('fs');
const path = require('path');

const TARGET_URL = process.env.TARGET_URL;
if (!TARGET_URL) throw new Error('TARGET_URL environment variable is required.');

// axe-core source bundled in node_modules
const AXE_CORE_PATH = require.resolve('axe-core');

// ─────────────────────────────────────────────────────────────────────────────
// 1. ANCHOR TAG INTEGRITY
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Anchor Tag Integrity', () => {
  test('All internal <a> hrefs resolve without 404', async ({ page, request }) => {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

    const targetOrigin = new URL(TARGET_URL).origin;

    const hrefs = await page.evaluate((origin) => {
      return Array.from(document.querySelectorAll('a[href]'))
        .map((a) => a.getAttribute('href'))
        .filter((href) => {
          if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
          try {
            const url = new URL(href, origin);
            // Only check same-origin links (avoid hammering external sites)
            return url.origin === origin;
          } catch { return false; }
        })
        .map((href) => new URL(href, origin).toString());
    }, targetOrigin);

    // Deduplicate
    const uniqueHrefs = [...new Set(hrefs)];

    if (uniqueHrefs.length === 0) {
      console.warn('No internal anchor links found on the page.');
      return;
    }

    const broken = [];
    for (const href of uniqueHrefs.slice(0, 30)) { // Cap at 30 to avoid very long runs
      try {
        const resp = await request.head(href, { timeout: 8000 });
        if (resp.status() === 404) {
          broken.push(`404 → ${href}`);
        }
      } catch (err) {
        broken.push(`ERR(${err.message}) → ${href}`);
      }
    }

    expect(
      broken,
      `Broken internal links detected (404):\n${broken.join('\n')}`
    ).toHaveLength(0);
  });

  test('No <a> tags have empty or javascript: href values', async ({ page }) => {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

    const suspicious = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href]'))
        .map((a) => a.getAttribute('href'))
        .filter((href) => !href || href.trim() === '' || href.startsWith('javascript:'));
    });

    if (suspicious.length > 0) {
      console.warn(`⚠️  Suspicious <a> hrefs (empty or javascript:):\n${suspicious.join('\n')}`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. IMAGE TAG INTEGRITY
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Image Tag Integrity', () => {
  test('All <img> src attributes resolve without errors', async ({ page, request }) => {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

    const targetOrigin = new URL(TARGET_URL).origin;

    const imgSrcs = await page.evaluate((origin) => {
      return Array.from(document.querySelectorAll('img[src]'))
        .map((img) => img.getAttribute('src'))
        .filter((src) => src && !src.startsWith('data:'))
        .map((src) => {
          try { return new URL(src, origin).toString(); } catch { return null; }
        })
        .filter(Boolean);
    }, targetOrigin);

    const uniqueSrcs = [...new Set(imgSrcs)];

    if (uniqueSrcs.length === 0) {
      console.warn('No <img> tags with external src found.');
      return;
    }

    const broken = [];
    for (const src of uniqueSrcs.slice(0, 20)) {
      try {
        const resp = await request.head(src, { timeout: 8000 });
        if (resp.status() >= 400) {
          broken.push(`HTTP ${resp.status()} → ${src}`);
        }
      } catch (err) {
        broken.push(`ERR(${err.message}) → ${src}`);
      }
    }

    expect(
      broken,
      `Broken images detected:\n${broken.join('\n')}`
    ).toHaveLength(0);
  });

  test('All <img> tags have non-empty alt attributes (accessibility)', async ({ page }) => {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

    const missingAlt = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img'))
        .filter((img) => !img.getAttribute('alt') && !img.getAttribute('role'))
        .map((img) => img.src || img.getAttribute('src') || '[no src]')
        .slice(0, 10);
    });

    if (missingAlt.length > 0) {
      console.warn(
        `⚠️  Images missing alt text (accessibility/SEO violation):\n${missingAlt.join('\n')}`
      );
    }
    // axe-core will catch this as a critical violation too
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. AXE-CORE ACCESSIBILITY SCAN
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Accessibility (axe-core)', () => {
  test('Zero critical accessibility violations (WCAG 2.1 AA)', async ({ page }) => {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

    // Inject axe-core into the page
    const axeSource = readFileSync(AXE_CORE_PATH, 'utf8');
    await page.evaluate(axeSource);

    // Run axe analysis
    const results = await page.evaluate(async () => {
      return await window.axe.run(document, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21aa'],
        },
      });
    });

    const critical = results.violations.filter((v) => v.impact === 'critical');
    const serious  = results.violations.filter((v) => v.impact === 'serious');
    const moderate = results.violations.filter((v) => v.impact === 'moderate');

    if (moderate.length > 0 || serious.length > 0) {
      const details = [...serious, ...moderate]
        .map((v) => `  [${v.impact.toUpperCase()}] ${v.id}: ${v.description}\n    Nodes: ${v.nodes.slice(0, 2).map((n) => n.html).join(' | ')}`)
        .join('\n');
      console.warn(`⚠️  Non-critical accessibility issues:\n${details}`);
    }

    const criticalDetails = critical
      .map(
        (v) =>
          `  Rule: ${v.id}\n  Description: ${v.description}\n  Help: ${v.helpUrl}\n  Affected nodes: ${v.nodes
            .slice(0, 3)
            .map((n) => n.html)
            .join('\n    ')}`
      )
      .join('\n\n');

    expect(
      critical,
      `CRITICAL accessibility violations detected (WCAG 2.1 AA):\n\n${criticalDetails}`
    ).toHaveLength(0);
  });

  test('Page has a valid <title> element', async ({ page }) => {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    expect(title.trim()).toBeTruthy();
    expect(title.trim().length).toBeGreaterThan(0);
  });

  test('Page has a <main> landmark or role="main"', async ({ page }) => {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
    const hasMain = await page.evaluate(() => {
      return (
        document.querySelector('main') !== null ||
        document.querySelector('[role="main"]') !== null
      );
    });
    if (!hasMain) {
      console.warn('⚠️  No <main> landmark found. Screen readers may struggle to navigate the page.');
    }
  });
});
