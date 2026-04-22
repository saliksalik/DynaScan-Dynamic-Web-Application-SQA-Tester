/**
 * backend/server.js
 * Express Orchestrator — Dynamic SQA Scanner
 *
 * Responsibilities:
 *  1. Pre-flight bot-protection check
 *  2. Spawn Playwright scanner engine
 *  3. Generate Allure HTML report
 *  4. Stream SSE progress events to the frontend
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Serve generated Allure reports as static files
const REPORTS_DIR = path.resolve(__dirname, '../reports');
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
app.use('/reports', express.static(REPORTS_DIR));

// ─── Bot / Protection Signatures ─────────────────────────────────────────────
const BOT_HEADER_SIGNATURES = [
  'cf-ray',            // Cloudflare
  'x-sucuri-id',       // Sucuri
  'x-cacheable',       // Akamai edge
  'x-amz-cf-id',       // AWS CloudFront WAF
  'x-datadome',        // DataDome
  'perimeterx',        // PerimeterX
];

const BOT_BODY_SIGNATURES = [
  'g-recaptcha',
  'h-captcha',
  'cf_clearance',
  'cloudflare',
  '__cf_bm',
  'datadome',
  'px-captcha',
  'recaptcha/api.js',
  'challenges.cloudflare.com',
];

/**
 * preFlightCheck
 * Strategy:
 *  1. Try a fast HEAD request (3s timeout) — only checks reachability + headers
 *  2. If HEAD fails/times-out, fall back to a GET with a longer timeout (20s)
 *  3. A plain network timeout is treated as a WARNING (proceed anyway, let
 *     Playwright handle it), NOT a hard block — only real bot-protection
 *     signals cause a 403 rejection.
 *
 * Returns { blocked: true, reason } or { blocked: false, warning? }
 */
async function preFlightCheck(url) {
  const commonHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  };

  let response = null;

  // ── Attempt 1: fast HEAD ───────────────────────────────────────────────────
  try {
    response = await axios.head(url, {
      timeout: 5000,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: commonHeaders,
    });
  } catch (headErr) {
    // HEAD failed — try a full GET with generous timeout
    try {
      response = await axios.get(url, {
        timeout: 20000,
        maxRedirects: 5,
        validateStatus: () => true,
        responseType: 'text',
        maxContentLength: 500 * 1024, // read at most 500 KB of body
        headers: commonHeaders,
      });
    } catch (getErr) {
      // Both requests failed
      const msg = getErr.message || headErr.message;

      // DNS failure = hard block (URL is invalid / unreachable)
      if (
        msg.includes('ENOTFOUND') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('ERR_NAME_NOT_RESOLVED')
      ) {
        return {
          blocked: true,
          reason: `DNS resolution failed for "${url}". The domain does not exist or is unreachable from this server. Please verify the URL.`,
        };
      }

      // TLS / certificate error = hard block
      if (
        msg.includes('CERT_') ||
        msg.includes('SSL') ||
        msg.includes('certificate')
      ) {
        return {
          blocked: true,
          reason: `SSL/TLS error connecting to "${url}": ${msg}. The site may have an invalid or self-signed certificate.`,
        };
      }

      // Timeout / connection reset = soft warning, let Playwright try
      console.warn(`[PreFlight] Both HEAD and GET timed out for ${url}: ${msg}. Proceeding to Playwright.`);
      return {
        blocked: false,
        warning: `Pre-flight timed out (${msg}), but the scan will proceed — Playwright may still reach the target.`,
      };
    }
  }

  // ── Inspect response ───────────────────────────────────────────────────────
  const headers  = response.headers || {};
  const body     = typeof response.data === 'string' ? response.data : '';
  const bodyLower = body.toLowerCase();

  // 1. Header-based bot-protection detection
  for (const sig of BOT_HEADER_SIGNATURES) {
    if (headers[sig] !== undefined) {
      return {
        blocked: true,
        reason: `Bot protection detected via response header: "${sig}". The target is protected by a WAF/CDN bot management system (e.g., Cloudflare, Akamai). Automated scanning is blocked.`,
      };
    }
  }

  // 2. Body-based CAPTCHA / JS challenge detection
  for (const sig of BOT_BODY_SIGNATURES) {
    if (bodyLower.includes(sig.toLowerCase())) {
      return {
        blocked: true,
        reason: `Bot protection detected in response body ("${sig}" challenge). The target requires human verification (CAPTCHA / JS challenge).`,
      };
    }
  }

  // 3. Cloudflare "Attention Required" 403
  if (
    response.status === 403 &&
    (bodyLower.includes('cloudflare') || bodyLower.includes('attention required'))
  ) {
    return {
      blocked: true,
      reason: 'HTTP 403 with a Cloudflare challenge page detected. Automated scanning is not possible on this target.',
    };
  }

  // 4. Hard 5xx on the root page — warn but don't block (could be transient)
  if (response.status >= 500) {
    console.warn(`[PreFlight] Target returned HTTP ${response.status}. Proceeding anyway.`);
    return {
      blocked: false,
      warning: `Target returned HTTP ${response.status} during pre-flight. The server may be unstable — scan results may be incomplete.`,
    };
  }

  return { blocked: false };
}

// ─── Helper: promisify exec with live output streaming ────────────────────────
function execPromise(cmd, opts = {}, onData) {
  return new Promise((resolve, reject) => {
    const child = exec(cmd, { shell: true, ...opts });

    child.stdout.on('data', (d) => onData && onData('stdout', d.toString()));
    child.stderr.on('data', (d) => onData && onData('stderr', d.toString()));

    child.on('close', (code) => {
      resolve(code);
    });
    child.on('error', reject);
  });
}

function findJavaHome() {
  if (process.platform !== 'win32') return process.env.JAVA_HOME || null;

  const candidates = [
    process.env.JAVA_HOME,
    'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.18.8-hotspot',
    'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.18-hotspot',
    'C:\\Program Files\\Java\\jdk-17',
    'C:\\Program Files\\Java\\jdk-17.0.0',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

// ─── SSE helper ──────────────────────────────────────────────────────────────
function sendSSE(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// ─── POST /api/scan ───────────────────────────────────────────────────────────
app.post('/api/scan', async (req, res) => {
  const { url } = req.body;

  if (!url || !/^https?:\/\/.+/.test(url)) {
    return res.status(400).json({ error: 'A valid HTTP/HTTPS URL is required.' });
  }

  // Set up SSE stream so the frontend gets live progress
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const scanId = uuidv4();

  // ── Step 1: Pre-flight ────────────────────────────────────────────────────
  sendSSE(res, 'progress', { stage: 'preflight', message: '🔍 Running pre-flight bot-protection check…', percent: 5 });

  const preFlightResult = await preFlightCheck(url);
  if (preFlightResult.blocked) {
    sendSSE(res, 'blocked', {
      stage: 'preflight',
      message: preFlightResult.reason,
    });
    return res.end();
  }

  if (preFlightResult.warning) {
    sendSSE(res, 'progress', {
      stage: 'preflight',
      message: `⚠️  Pre-flight warning: ${preFlightResult.warning}`,
      percent: 10,
    });
  } else {
    sendSSE(res, 'progress', { stage: 'preflight', message: '✅ Pre-flight passed. Target is reachable.', percent: 10 });
  }

  // ── Step 2: Run Playwright ────────────────────────────────────────────────
  sendSSE(res, 'progress', { stage: 'playwright', message: '🎭 Launching Playwright scanner suite…', percent: 15 });

  const scannerDir = path.resolve(__dirname, '../scanner-engine');
  const allureResultsDir = path.resolve(scannerDir, 'allure-results');
  const reportOutputDir = path.resolve(REPORTS_DIR, scanId);

  // Clean previous allure-results
  if (fs.existsSync(allureResultsDir)) {
    fs.rmSync(allureResultsDir, { recursive: true, force: true });
  }

  const playwrightCmd = 'npx playwright test --reporter=allure-playwright,line';

  const playwrightExitCode = await execPromise(
    playwrightCmd,
    { cwd: scannerDir, env: { ...process.env, TARGET_URL: url } },
    (stream, data) => {
      // Forward live Playwright output to the client
      sendSSE(res, 'log', { stream, data: data.trim() });
    }
  );

  const playwrightStatus = playwrightExitCode === 0 ? 'all_passed' : 'completed_with_failures';
  sendSSE(res, 'progress', {
    stage: 'playwright',
    message: playwrightExitCode === 0
      ? '✅ Playwright suite completed — all tests passed.'
      : '⚠️  Playwright suite completed — some tests failed (see report for details).',
    percent: 75,
    status: playwrightStatus,
  });

  // ── Step 3: Generate Allure Report ────────────────────────────────────────
  sendSSE(res, 'progress', { stage: 'report', message: '📊 Generating Allure HTML report…', percent: 80 });

  const allureBinaryName = process.platform === 'win32' ? 'allure.cmd' : 'allure';
  const allurePathsToTry = [
    path.resolve(scannerDir, 'node_modules', '.bin', allureBinaryName),
    path.resolve(scannerDir, '..', 'node_modules', '.bin', allureBinaryName),
  ];

  const allureExecutable = allurePathsToTry.find((candidate) => fs.existsSync(candidate));
  const allureCmd = allureExecutable
    ? `"${allureExecutable}" generate "${allureResultsDir}" --clean -o "${reportOutputDir}"`
    : `npx --no-install allure generate "${allureResultsDir}" --clean -o "${reportOutputDir}"`;

  const javaHome = findJavaHome();
  const allureEnv = { ...process.env };
  if (javaHome) {
    allureEnv.JAVA_HOME = javaHome;
    const javaBin = path.join(javaHome, 'bin');
    if (allureEnv.PATH && !allureEnv.PATH.includes(javaBin)) {
      allureEnv.PATH = `${javaBin}${path.delimiter}${allureEnv.PATH}`;
    }
  }

  const allureExitCode = await execPromise(
    allureCmd,
    { cwd: scannerDir, env: allureEnv },
    (stream, data) => sendSSE(res, 'log', { stream, data: data.trim() })
  );

  if (allureExitCode !== 0) {
    sendSSE(res, 'error', { message: 'Allure report generation failed. Check server logs.' });
    return res.end();
  }

  sendSSE(res, 'progress', { stage: 'report', message: '✅ Allure report generated successfully.', percent: 100 });

  // ── Step 4: Done ──────────────────────────────────────────────────────────
  sendSSE(res, 'done', {
    scanId,
    reportUrl: `/reports/${scanId}/index.html`,
    status: playwrightStatus,
    message: 'Scan complete.',
  });

  res.end();
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`[SQA-Backend] Orchestrator running on http://localhost:${PORT}`);
});