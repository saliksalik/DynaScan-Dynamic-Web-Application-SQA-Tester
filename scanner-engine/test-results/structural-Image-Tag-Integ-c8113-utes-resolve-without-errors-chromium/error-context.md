# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: structural.spec.js >> Image Tag Integrity >> All <img> src attributes resolve without errors
- Location: tests\structural.spec.js:89:3

# Error details

```
Error: Broken images detected:
HTTP 405 → https://ginandjuice.shop/image/scanme/productcatalog/products/pineapple_edition.png
HTTP 405 → https://ginandjuice.shop/image/scanme/productcatalog/products/11.png
HTTP 405 → https://ginandjuice.shop/image/scanme/productcatalog/products/10.png
HTTP 405 → https://ginandjuice.shop/image/scanme/blog/posts/5.jpg
HTTP 405 → https://ginandjuice.shop/image/scanme/blog/posts/3.jpg

expect(received).toHaveLength(expected)

Expected length: 0
Received length: 5
Received array:  ["HTTP 405 → https://ginandjuice.shop/image/scanme/productcatalog/products/pineapple_edition.png", "HTTP 405 → https://ginandjuice.shop/image/scanme/productcatalog/products/11.png", "HTTP 405 → https://ginandjuice.shop/image/scanme/productcatalog/products/10.png", "HTTP 405 → https://ginandjuice.shop/image/scanme/blog/posts/5.jpg", "HTTP 405 → https://ginandjuice.shop/image/scanme/blog/posts/3.jpg"]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - paragraph [ref=e4]: This is a deliberately vulnerable web application designed for testing web vulnerability scanners. Put your scanner to the test!
    - generic [ref=e6]:
      - link [ref=e7] [cursor=pointer]:
        - /url: /
      - navigation [ref=e10]:
        - list [ref=e11]:
          - listitem [ref=e12]:
            - link "Products" [ref=e13] [cursor=pointer]:
              - /url: /catalog
          - listitem [ref=e14]:
            - link "Blog" [ref=e15] [cursor=pointer]:
              - /url: /blog
          - listitem [ref=e16]:
            - link "Our story" [ref=e17] [cursor=pointer]:
              - /url: /about
        - list [ref=e18]:
          - listitem [ref=e19]:
            - link [ref=e20] [cursor=pointer]:
              - /url: /my-account
              - img [ref=e21]
          - listitem [ref=e23]:
            - link "0" [ref=e24] [cursor=pointer]:
              - /url: /catalog/cart
              - generic [ref=e25]: "0"
              - img [ref=e26]
  - generic [ref=e28]:
    - generic [ref=e29]:
      - generic [ref=e30]:
        - link "View all products" [ref=e31] [cursor=pointer]:
          - /url: /catalog
        - generic [ref=e32]:
          - img [ref=e33]
          - img [ref=e34]
          - img [ref=e35]
      - generic [ref=e36]:
        - generic [ref=e37]:
          - paragraph [ref=e39]: Created in 2022 by the man Distiller's World has called "the evil genius of gin", Gin & Juice Shop is open 24/7 to satisfy all of your web vulnerability scanner evaluation needs.
          - generic [ref=e42]:
            - link "Pineapple Edition Cocktail $30.50 View details" [ref=e43] [cursor=pointer]:
              - /url: /catalog/product?productId=1
              - img [ref=e44]
              - heading "Pineapple Edition Cocktail" [level=3] [ref=e45]
              - img [ref=e46]
              - generic [ref=e47]: $30.50
              - generic [ref=e48]: View details
            - link "Create Your Own Cocktail $84.96 View details" [ref=e49] [cursor=pointer]:
              - /url: /catalog/product?productId=2
              - img [ref=e50]
              - heading "Create Your Own Cocktail" [level=3] [ref=e51]
              - img [ref=e52]
              - generic [ref=e53]: $84.96
              - generic [ref=e54]: View details
            - link "Fruit Overlays $92.79 View details" [ref=e55] [cursor=pointer]:
              - /url: /catalog/product?productId=3
              - img [ref=e56]
              - heading "Fruit Overlays" [level=3] [ref=e57]
              - img [ref=e58]
              - generic [ref=e59]: $92.79
              - generic [ref=e60]: View details
          - link "View all products" [ref=e61] [cursor=pointer]:
            - /url: /catalog
        - generic [ref=e62]:
          - generic [ref=e63]:
            - generic [ref=e64]:
              - link [ref=e65] [cursor=pointer]:
                - /url: /blog/post?postId=3
                - img [ref=e66]
              - heading "A Hairy Day" [level=2] [ref=e67]
              - link "View post" [ref=e68] [cursor=pointer]:
                - /url: /blog/post?postId=3
            - generic [ref=e69]:
              - link [ref=e70] [cursor=pointer]:
                - /url: /blog/post?postId=4
                - img [ref=e71]
              - heading "The Complaint" [level=2] [ref=e72]
              - link "View post" [ref=e73] [cursor=pointer]:
                - /url: /blog/post?postId=4
          - link "View all blog posts" [ref=e74] [cursor=pointer]:
            - /url: /blog
    - generic [ref=e75]:
      - generic [ref=e78]:
        - heading "Never miss a deal - subscribe now" [level=2] [ref=e79]
        - paragraph [ref=e80]: Join our worldwide community of gin and juice fanatics, for exclusive news on our latest deals, new releases, collaborations, and more.
        - generic [ref=e81]:
          - textbox "Email address" [ref=e82]
          - button "Subscribe" [ref=e83] [cursor=pointer]
        - generic [ref=e86]: © 2023 PortSwigger Ltd.
      - navigation [ref=e90]:
        - list [ref=e91]:
          - listitem [ref=e92]:
            - link "Products" [ref=e93] [cursor=pointer]:
              - /url: /catalog
          - listitem [ref=e94]:
            - link "Blog" [ref=e95] [cursor=pointer]:
              - /url: /blog
          - listitem [ref=e96]:
            - link "Our story" [ref=e97] [cursor=pointer]:
              - /url: /about
```

# Test source

```ts
  26  |     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
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
> 126 |     ).toHaveLength(0);
      |       ^ Error: Broken images detected:
  127 |   });
  128 | 
  129 |   test('All <img> tags have non-empty alt attributes (accessibility)', async ({ page }) => {
  130 |     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  131 | 
  132 |     const missingAlt = await page.evaluate(() => {
  133 |       return Array.from(document.querySelectorAll('img'))
  134 |         .filter((img) => !img.getAttribute('alt') && !img.getAttribute('role'))
  135 |         .map((img) => img.src || img.getAttribute('src') || '[no src]')
  136 |         .slice(0, 10);
  137 |     });
  138 | 
  139 |     if (missingAlt.length > 0) {
  140 |       console.warn(
  141 |         `⚠️  Images missing alt text (accessibility/SEO violation):\n${missingAlt.join('\n')}`
  142 |       );
  143 |     }
  144 |     // axe-core will catch this as a critical violation too
  145 |   });
  146 | });
  147 | 
  148 | // ─────────────────────────────────────────────────────────────────────────────
  149 | // 3. AXE-CORE ACCESSIBILITY SCAN
  150 | // ─────────────────────────────────────────────────────────────────────────────
  151 | test.describe('Accessibility (axe-core)', () => {
  152 |   test('Zero critical accessibility violations (WCAG 2.1 AA)', async ({ page }) => {
  153 |     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  154 | 
  155 |     // Inject axe-core into the page
  156 |     const axeSource = readFileSync(AXE_CORE_PATH, 'utf8');
  157 |     await page.evaluate(axeSource);
  158 | 
  159 |     // Run axe analysis
  160 |     const results = await page.evaluate(async () => {
  161 |       return await window.axe.run(document, {
  162 |         runOnly: {
  163 |           type: 'tag',
  164 |           values: ['wcag2a', 'wcag2aa', 'wcag21aa'],
  165 |         },
  166 |       });
  167 |     });
  168 | 
  169 |     const critical = results.violations.filter((v) => v.impact === 'critical');
  170 |     const serious  = results.violations.filter((v) => v.impact === 'serious');
  171 |     const moderate = results.violations.filter((v) => v.impact === 'moderate');
  172 | 
  173 |     if (moderate.length > 0 || serious.length > 0) {
  174 |       const details = [...serious, ...moderate]
  175 |         .map((v) => `  [${v.impact.toUpperCase()}] ${v.id}: ${v.description}\n    Nodes: ${v.nodes.slice(0, 2).map((n) => n.html).join(' | ')}`)
  176 |         .join('\n');
  177 |       console.warn(`⚠️  Non-critical accessibility issues:\n${details}`);
  178 |     }
  179 | 
  180 |     const criticalDetails = critical
  181 |       .map(
  182 |         (v) =>
  183 |           `  Rule: ${v.id}\n  Description: ${v.description}\n  Help: ${v.helpUrl}\n  Affected nodes: ${v.nodes
  184 |             .slice(0, 3)
  185 |             .map((n) => n.html)
  186 |             .join('\n    ')}`
  187 |       )
  188 |       .join('\n\n');
  189 | 
  190 |     expect(
  191 |       critical,
  192 |       `CRITICAL accessibility violations detected (WCAG 2.1 AA):\n\n${criticalDetails}`
  193 |     ).toHaveLength(0);
  194 |   });
  195 | 
  196 |   test('Page has a valid <title> element', async ({ page }) => {
  197 |     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  198 |     const title = await page.title();
  199 |     expect(title.trim()).toBeTruthy();
  200 |     expect(title.trim().length).toBeGreaterThan(0);
  201 |   });
  202 | 
  203 |   test('Page has a <main> landmark or role="main"', async ({ page }) => {
  204 |     await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
  205 |     const hasMain = await page.evaluate(() => {
  206 |       return (
  207 |         document.querySelector('main') !== null ||
  208 |         document.querySelector('[role="main"]') !== null
  209 |       );
  210 |     });
  211 |     if (!hasMain) {
  212 |       console.warn('⚠️  No <main> landmark found. Screen readers may struggle to navigate the page.');
  213 |     }
  214 |   });
  215 | });
  216 | 
```