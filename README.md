# DynaScan — Dynamic SQA Scanner (TaaS Platform)

A **Testing-as-a-Service** web application that takes a target URL, runs a suite of generic Playwright tests (network, structural, behavioral, DAST security), and generates a unified Allure HTML report.

---

## Architecture

```
dynamic-sqa-scanner/
├── frontend/          React 18 + Vite + Tailwind CSS  (port 5173)
├── backend/           Node.js + Express orchestrator   (port 3001)
├── scanner-engine/    Playwright test suites + axe-core
└── reports/           Allure HTML report outputs
```

---

## Dashboard Screenshots

### Website Layout

![Website Layout](dashboard%20images/Website%20Layout.png)

### Scanning Execution

![Scanning starts and tests get executed](dashboard%20images/Scanning%20starts%20and%20tests%20get%20executed.png)

### Scan Complete

![Scan Complete](dashboard%20images/Scan%20Complete%20.png)

### Metrics Report

![Metrics report](dashboard%20images/Metrics%20report.png)

### Allure Report Generated

![Allure report generated](dashboard%20images/Alure%20report%20Generated.png)

### All Test Information Stored

![All test information stored](dashboard%20images/All%20test%20inforfamtion%20stored%20.png)

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18.x |
| npm | ≥ 9.x |
| Java | ≥ 11 (required by Allure CLI) |
| Allure CLI | `npm install -g allure-commandline` |

### 1. Install Dependencies

```bash
# From the repo root
cd dynamic-sqa-scanner

# Install all workspace dependencies
npm install
npm install --workspace=frontend
npm install --workspace=backend
npm install --workspace=scanner-engine

# Install Playwright browsers
cd scanner-engine
npx playwright install chromium
cd ..
```

### 2. Install Allure Commandline

```bash
npm install -g allure-commandline
```

### 3. Start Development Servers

```bash
# From repo root — starts backend (3001) + frontend (5173) concurrently
npm run dev
```

Or start individually:

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

### 4. Open the App

```
http://localhost:5173
```

Enter any publicly accessible URL (that you own or have authorization to test) and click **SCAN**.

---

## What Each Test Suite Checks

### `network.spec.js` — API Health
- Zero HTTP 5xx errors in fetch/XHR traffic
- Zero 404 API endpoint responses
- No unhandled 401/403 responses
- No CORS preflight failures
- All API responses < 2000ms
- No JSON payloads > 2MB
- Duplicate request detection (debounce audit)
- Empty POST/PUT body detection

### `structural.spec.js` — DOM & Accessibility
- All same-origin `<a>` hrefs return non-404
- All `<img>` src attributes resolve
- axe-core WCAG 2.1 AA — zero critical violations
- Missing `alt` attribute audit
- `<main>` landmark presence check

### `behavioral.spec.js` — UI Stability
- Zero unhandled JS exceptions on page load
- Zero JS exceptions during scroll
- Forms handle empty submission without crashes
- Responsive viewport rendering (375/768/1440px)
- Navigation redirect count ≤ 5
- Page loads within 15 seconds

### `security.spec.js` — DAST & DevSecOps
- **Headers:** CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **Transport:** No mixed content, no insecure form actions, SRI on CDN assets
- **Cookies:** Secure, HttpOnly, SameSite=Lax|Strict
- **Info Exposure:** No secrets in query params, no JWTs in console, hidden input audit, stack trace detection on 404/500
- **Misconfig:** /.env and /.git/config are 403/404, directory listing disabled, robots.txt Disallow paths protected
- **Injection DDT:** XSS, SQLi, NoSQLi, Command Injection, Path Traversal, SSTI payloads across all text inputs

---

## Bot Protection Pre-Flight

Before any scan, the backend makes a lightweight HTTP request to the target and checks for:

- **Cloudflare** (`cf-ray` header, challenge page body)
- **Akamai** (`x-cacheable` header)
- **DataDome** (`x-datadome` header)
- **PerimeterX** (`perimeterx` header)
- **Sucuri** (`x-sucuri-id` header)
- **CAPTCHAs** (`g-recaptcha`, `h-captcha` in body)

If detected, a **403** is returned and the UI shows a warning toast — no Playwright processes are spawned.

---

## SSE Live Streaming

The backend uses **Server-Sent Events (SSE)** to stream real-time progress and Playwright log output to the frontend while the scan runs. Event types:

| Event | Payload |
|-------|---------|
| `progress` | `{ stage, message, percent }` |
| `log` | `{ stream: 'stdout'|'stderr', data }` |
| `blocked` | `{ message }` |
| `done` | `{ scanId, reportUrl, status }` |
| `error` | `{ message }` |

---

## Reports

Generated Allure reports are served statically at:
```
http://localhost:3001/reports/<scanId>/index.html
```

The frontend proxies this via Vite's dev proxy. Reports persist between server restarts (stored in `/reports/<scanId>/`).

---

## Security Notice

> ⚠️ **Only scan targets you own or have explicit written authorization to test.**
> 
> This tool performs active probing including injection fuzzing. Unauthorized scanning may be illegal under the Computer Fraud and Abuse Act (CFAA) and equivalent laws in other jurisdictions.

---

## Folder Structure (Full)

```
dynamic-sqa-scanner/
├── package.json                    # Root monorepo config
├── README.md
│
├── backend/
│   ├── package.json
│   └── server.js                   # Express orchestrator + SSE + pre-flight
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                 # Full scanner UI with SSE client
│       └── index.css               # Dark terminal aesthetic + animations
│
├── scanner-engine/
│   ├── package.json
│   ├── playwright.config.js        # Allure reporter config
│   └── tests/
│       ├── network.spec.js         # API health via network interception
│       ├── structural.spec.js      # DOM + axe-core accessibility
│       ├── behavioral.spec.js      # JS errors, forms, responsive
│       └── security.spec.js        # DAST, injection, headers, cookies
│
└── reports/                        # Allure HTML outputs (auto-created)
    └── <scanId>/
        └── index.html
```
