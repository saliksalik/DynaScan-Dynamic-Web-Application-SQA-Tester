import { useState, useRef, useEffect, useCallback } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────
const STAGES = [
  { key: 'preflight',  label: 'Pre-Flight',  icon: '⬡' },
  { key: 'playwright', label: 'Playwright',  icon: '⬡' },
  { key: 'report',     label: 'Report Gen',  icon: '⬡' },
];

const STATUS = {
  IDLE:     'idle',
  SCANNING: 'scanning',
  BLOCKED:  'blocked',
  DONE:     'done',
  ERROR:    'error',
};

// ─── Utility ──────────────────────────────────────────────────────────────────
function isValidUrl(str) {
  try { const u = new URL(str); return u.protocol === 'http:' || u.protocol === 'https:'; }
  catch { return false; }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HexGrid() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {/* Animated scan beam */}
      <div
        className="absolute left-0 right-0 h-px animate-scan-line"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.4), transparent)', top: 0 }}
      />
      {/* Corner brackets */}
      <div className="absolute top-6 left-6 w-12 h-12 border-t border-l" style={{ borderColor: 'rgba(0,229,255,0.2)' }} />
      <div className="absolute top-6 right-6 w-12 h-12 border-t border-r" style={{ borderColor: 'rgba(0,229,255,0.2)' }} />
      <div className="absolute bottom-6 left-6 w-12 h-12 border-b border-l" style={{ borderColor: 'rgba(0,229,255,0.2)' }} />
      <div className="absolute bottom-6 right-6 w-12 h-12 border-b border-r" style={{ borderColor: 'rgba(0,229,255,0.2)' }} />
    </div>
  );
}

function PulseOrb({ active }) {
  return (
    <div className="relative flex items-center justify-center w-16 h-16">
      {active && (
        <>
          <div className="absolute w-full h-full rounded-full animate-pulse-ring"
            style={{ border: '1px solid rgba(0,229,255,0.4)' }} />
          <div className="absolute w-full h-full rounded-full animate-pulse-ring"
            style={{ border: '1px solid rgba(0,229,255,0.2)', animationDelay: '0.5s' }} />
        </>
      )}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{
          background: active
            ? 'radial-gradient(circle, rgba(0,229,255,0.3) 0%, rgba(0,229,255,0.05) 70%)'
            : 'rgba(10,15,30,0.8)',
          border: `1px solid ${active ? 'rgba(0,229,255,0.6)' : 'rgba(26,35,64,0.8)'}`,
          boxShadow: active ? '0 0 20px rgba(0,229,255,0.3)' : 'none',
          transition: 'all 0.4s ease',
        }}
      >
        <span style={{ color: active ? '#00e5ff' : '#4a5a7a', fontSize: '1.1rem' }}>◈</span>
      </div>
    </div>
  );
}

function StageTracker({ stages, currentStage, percent }) {
  return (
    <div className="flex items-center gap-0 w-full mb-6">
      {STAGES.map((stage, i) => {
        const isActive = stage.key === currentStage;
        const isDone = STAGES.findIndex(s => s.key === currentStage) > i;
        const isLast = i === STAGES.length - 1;
        return (
          <div key={stage.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1">
              <div
                className="stage-pill"
                style={{
                  color: isDone ? '#00ff88' : isActive ? '#00e5ff' : '#4a5a7a',
                  borderColor: isDone ? 'rgba(0,255,136,0.3)' : isActive ? 'rgba(0,229,255,0.4)' : 'rgba(26,35,64,0.6)',
                  background: isDone ? 'rgba(0,255,136,0.05)' : isActive ? 'rgba(0,229,255,0.06)' : 'transparent',
                }}
              >
                {isDone ? '✓' : stage.icon} {stage.label}
              </div>
            </div>
            {!isLast && (
              <div className="flex-1 h-px mx-2"
                style={{ background: isDone ? 'rgba(0,255,136,0.3)' : 'rgba(26,35,64,0.8)' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProgressBar({ percent }) {
  return (
    <div className="w-full h-1 rounded-full overflow-hidden mb-4"
      style={{ background: 'rgba(26,35,64,0.8)' }}>
      <div
        className="h-full rounded-full"
        style={{
          width: `${percent}%`,
          background: 'linear-gradient(90deg, #0099aa, #00e5ff)',
          boxShadow: '0 0 10px rgba(0,229,255,0.4)',
          transition: 'width 0.5s ease',
        }}
      />
    </div>
  );
}

function LogTerminal({ logs }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="log-terminal">
      {logs.length === 0 ? (
        <span style={{ color: 'var(--text-dim)' }}>// Waiting for scan output...</span>
      ) : (
        logs.map((log, i) => (
          <div key={i} className="animate-slide-up"
            style={{
              color: log.type === 'stderr' ? '#ff6688' :
                     log.type === 'system' ? '#00e5ff' :
                     log.type === 'warn' ? '#ffaa00' : '#7ab8d0',
              marginBottom: '1px',
            }}>
            <span style={{ color: 'var(--text-dim)', marginRight: 8 }}>
              {String(i + 1).padStart(3, '0')}
            </span>
            {log.text}
          </div>
        ))
      )}
      <div ref={endRef} />
    </div>
  );
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;

  const colors = {
    blocked: { border: '#ff3355', bg: 'rgba(255,51,85,0.08)', color: '#ff6680' },
    error:   { border: '#ff3355', bg: 'rgba(255,51,85,0.08)', color: '#ff6680' },
    success: { border: '#00ff88', bg: 'rgba(0,255,136,0.06)', color: '#00cc6a' },
  };
  const c = colors[toast.type] || colors.error;

  return (
    <div className="toast" style={{ borderLeftColor: c.border, background: c.bg }}>
      <div style={{ color: c.color, fontFamily: 'JetBrains Mono', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
        {toast.type === 'blocked' ? '⚠ BOT PROTECTION DETECTED' :
         toast.type === 'success' ? '✓ SCAN COMPLETE' : '✗ ERROR'}
      </div>
      <div style={{ color: 'var(--text)', marginTop: 4, fontSize: '0.82rem', lineHeight: 1.5 }}>
        {toast.message}
      </div>
      <button onClick={onClose}
        style={{ position: 'absolute', top: 10, right: 12, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>
        ×
      </button>
    </div>
  );
}

function ReportViewer({ reportUrl }) {
  const [mode, setMode] = useState('link'); // 'link' | 'iframe'

  return (
    <div className="animate-fade-in" style={{ marginTop: 24 }}>
      <div className="flex items-center justify-between mb-3">
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.7rem', color: '#00ff88', letterSpacing: '0.15em' }}>
          ✓ REPORT READY
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMode('link')}
            className="stage-pill"
            style={{
              color: mode === 'link' ? '#00e5ff' : '#4a5a7a',
              borderColor: mode === 'link' ? 'rgba(0,229,255,0.4)' : 'rgba(26,35,64,0.6)',
              background: 'transparent', cursor: 'pointer',
            }}
          >
            LINK VIEW
          </button>
          <button
            onClick={() => setMode('iframe')}
            className="stage-pill"
            style={{
              color: mode === 'iframe' ? '#00e5ff' : '#4a5a7a',
              borderColor: mode === 'iframe' ? 'rgba(0,229,255,0.4)' : 'rgba(26,35,64,0.6)',
              background: 'transparent', cursor: 'pointer',
            }}
          >
            INLINE VIEW
          </button>
        </div>
      </div>

      {mode === 'link' ? (
        <a
          href={reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 glow-cyan"
          style={{
            background: 'rgba(0,229,255,0.04)',
            border: '1px solid rgba(0,229,255,0.2)',
            borderRadius: 4,
            textDecoration: 'none',
            transition: 'background 0.2s',
          }}
        >
          <span style={{ fontSize: '1.3rem' }}>📊</span>
          <div>
            <div style={{ color: '#00e5ff', fontFamily: 'JetBrains Mono', fontSize: '0.8rem' }}>
              Open Allure Report
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem', marginTop: 2 }}>
              {reportUrl}
            </div>
          </div>
          <span style={{ marginLeft: 'auto', color: 'var(--text-dim)' }}>↗</span>
        </a>
      ) : (
        <div style={{ border: '1px solid rgba(26,35,64,0.8)', borderRadius: 4, overflow: 'hidden', height: 600 }}>
          <iframe
            src={reportUrl}
            title="Allure Report"
            style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState(STATUS.IDLE);
  const [logs, setLogs] = useState([]);
  const [percent, setPercent] = useState(0);
  const [currentStage, setCurrentStage] = useState('preflight');
  const [reportUrl, setReportUrl] = useState(null);
  const [scanResult, setScanResult] = useState(null); // 'all_passed' | 'completed_with_failures'
  const [toast, setToast] = useState(null);
  const abortRef = useRef(null);

  const addLog = useCallback((text, type = 'stdout') => {
    setLogs(prev => [...prev, { text, type }]);
  }, []);

  const handleScan = async () => {
    if (!isValidUrl(url)) {
      setToast({ type: 'error', message: 'Please enter a valid HTTP or HTTPS URL.' });
      return;
    }

    // Reset state
    setStatus(STATUS.SCANNING);
    setLogs([]);
    setPercent(0);
    setCurrentStage('preflight');
    setReportUrl(null);
    setScanResult(null);
    setToast(null);

    addLog(`[SCAN INIT] Target: ${url}`, 'system');
    addLog(`[${new Date().toISOString()}] Establishing connection…`, 'system');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });

      // SSE stream reader
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer

        let eventType = null;
        let dataLine = null;

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            dataLine = line.slice(6).trim();
          } else if (line === '' && eventType && dataLine) {
            // Process complete SSE event
            try {
              const payload = JSON.parse(dataLine);
              handleSSEEvent(eventType, payload);
            } catch {}
            eventType = null;
            dataLine = null;
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setStatus(STATUS.ERROR);
        setToast({ type: 'error', message: `Connection error: ${err.message}` });
        addLog(`[ERROR] ${err.message}`, 'stderr');
      }
    }
  };

  const handleSSEEvent = useCallback((event, payload) => {
    switch (event) {
      case 'progress':
        setCurrentStage(payload.stage);
        setPercent(payload.percent || 0);
        addLog(`[${payload.stage.toUpperCase()}] ${payload.message}`, 'system');
        break;

      case 'log':
        if (payload.data) {
          addLog(payload.data, payload.stream === 'stderr' ? 'stderr' : 'stdout');
        }
        break;

      case 'blocked':
        setStatus(STATUS.BLOCKED);
        setToast({ type: 'blocked', message: payload.message });
        addLog(`[BLOCKED] ${payload.message}`, 'warn');
        break;

      case 'done':
        setStatus(STATUS.DONE);
        setReportUrl(payload.reportUrl);
        setScanResult(payload.status);
        addLog(`[COMPLETE] ${payload.message}`, 'system');
        setPercent(100);
        setToast({
          type: 'success',
          message: payload.status === 'all_passed'
            ? 'All tests passed. Report is ready.'
            : 'Scan finished with some test failures. Check the report.',
        });
        break;

      case 'error':
        setStatus(STATUS.ERROR);
        setToast({ type: 'error', message: payload.message });
        addLog(`[ERROR] ${payload.message}`, 'stderr');
        break;
    }
  }, [addLog]);

  const handleAbort = () => {
    abortRef.current?.abort();
    setStatus(STATUS.IDLE);
    addLog('[ABORTED] Scan cancelled by user.', 'warn');
  };

  const isScanning = status === STATUS.SCANNING;

  return (
    <div className="grid-bg scanline min-h-screen" style={{ position: 'relative' }}>
      <HexGrid />

      <div className="relative" style={{ zIndex: 1 }}>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between px-8 py-5"
          style={{ borderBottom: '1px solid rgba(26,35,64,0.6)' }}>
          <div className="flex items-center gap-3">
            <div style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: '1.4rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: '#00e5ff',
            }}
              className="text-glow animate-flicker">
              DYNASCAN
            </div>
            <div className="stage-pill" style={{ color: '#4a5a7a', borderColor: 'rgba(26,35,64,0.8)' }}>
              v1.0.0
            </div>
          </div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>
            DYNAMIC SQA SCANNER — TAAS PLATFORM
          </div>
        </header>

        {/* ── Main Content ─────────────────────────────────────────────── */}
        <main className="max-w-3xl mx-auto px-6 py-12">
          {/* Title block */}
          <div className="text-center mb-12">
            <div className="flex justify-center mb-6">
              <PulseOrb active={isScanning} />
            </div>
            <h1 style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: '#c8d8f0',
              margin: '0 0 12px',
              lineHeight: 1.1,
            }}>
              Automated Security<br />
              <span style={{ color: '#00e5ff' }} className="text-glow">& QA Scanner</span>
            </h1>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', fontFamily: 'JetBrains Mono', letterSpacing: '0.05em' }}>
              DAST · STRUCTURAL · BEHAVIORAL · ACCESSIBILITY · NETWORK
            </p>
          </div>

          {/* ── Scanner Card ──────────────────────────────────────────── */}
          <div
            className="glow-cyan"
            style={{
              background: 'rgba(10,15,30,0.8)',
              border: '1px solid rgba(26,35,64,0.9)',
              borderRadius: 6,
              padding: '28px',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* URL Input Row */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <div style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  fontFamily: 'JetBrains Mono', fontSize: '0.7rem', color: 'var(--text-dim)', pointerEvents: 'none',
                }}>
                  TARGET://
                </div>
                <input
                  type="url"
                  className="scan-input"
                  placeholder="https://target.example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isScanning && handleScan()}
                  disabled={isScanning}
                  style={{ paddingLeft: 90 }}
                />
              </div>
              {isScanning ? (
                <button className="scan-btn" onClick={handleAbort}
                  style={{ borderColor: '#ff3355', color: '#ff3355' }}>
                  ABORT
                </button>
              ) : (
                <button className="scan-btn" onClick={handleScan} disabled={!url.trim()}>
                  SCAN
                </button>
              )}
            </div>

            {/* Info row */}
            <div className="flex gap-4 mb-6 flex-wrap">
              {['NETWORK', 'STRUCTURAL', 'BEHAVIORAL', 'SECURITY'].map(label => (
                <span key={label} className="stage-pill"
                  style={{ color: 'var(--text-dim)', borderColor: 'rgba(26,35,64,0.6)', fontSize: '0.6rem' }}>
                  {label}
                </span>
              ))}
            </div>

            {/* Stage tracker + progress (only when active) */}
            {(isScanning || status === STATUS.DONE || status === STATUS.BLOCKED) && (
              <div className="animate-fade-in mb-4">
                <StageTracker stages={STAGES} currentStage={currentStage} percent={percent} />
                <ProgressBar percent={percent} />
              </div>
            )}

            {/* Log terminal */}
            {logs.length > 0 && <LogTerminal logs={logs} />}

            {/* Scan result summary */}
            {status === STATUS.DONE && scanResult && (
              <div
                className="animate-slide-up mt-4 p-3 flex items-center gap-3"
                style={{
                  background: scanResult === 'all_passed' ? 'rgba(0,255,136,0.04)' : 'rgba(255,170,0,0.04)',
                  border: `1px solid ${scanResult === 'all_passed' ? 'rgba(0,255,136,0.2)' : 'rgba(255,170,0,0.2)'}`,
                  borderRadius: 4,
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>
                  {scanResult === 'all_passed' ? '✅' : '⚠️'}
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono', fontSize: '0.75rem',
                  color: scanResult === 'all_passed' ? '#00ff88' : '#ffaa00',
                }}>
                  {scanResult === 'all_passed'
                    ? 'All tests passed — no issues detected.'
                    : 'Scan complete with failures — review the Allure report for details.'}
                </span>
              </div>
            )}

            {/* Report viewer */}
            {status === STATUS.DONE && reportUrl && (
              <ReportViewer reportUrl={reportUrl} />
            )}
          </div>

          {/* ── Feature Grid ──────────────────────────────────────────── */}
          {status === STATUS.IDLE && (
            <div className="grid grid-cols-2 gap-3 mt-8 animate-fade-in">
              {[
                { icon: '🛡', label: 'DAST Security',   desc: 'XSS, SQLi, NoSQLi, CMDi fuzzing + header compliance' },
                { icon: '🌐', label: 'Network Health',  desc: 'API 5xx/4xx detection, response time, payload size' },
                { icon: '♿', label: 'Accessibility',   desc: 'axe-core WCAG 2.1 AA — zero critical violations' },
                { icon: '🍪', label: 'Cookie Safety',   desc: 'Secure, HttpOnly, SameSite flag enforcement' },
                { icon: '🔍', label: 'DOM Structural',  desc: 'Broken links, broken images, hidden input audit' },
                { icon: '📊', label: 'Allure Reports',  desc: 'Interactive HTML reports with full test detail' },
              ].map(({ icon, label, desc }) => (
                <div key={label} className="p-4"
                  style={{
                    background: 'rgba(10,15,30,0.6)',
                    border: '1px solid rgba(26,35,64,0.7)',
                    borderRadius: 4,
                  }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ fontSize: '0.95rem' }}>{icon}</span>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.65rem', color: '#00e5ff', letterSpacing: '0.1em' }}>
                      {label}
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', margin: 0, lineHeight: 1.4 }}>
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* ── Disclaimer ────────────────────────────────────────────── */}
          <p style={{
            color: 'var(--text-dim)', fontSize: '0.68rem', textAlign: 'center',
            fontFamily: 'JetBrains Mono', marginTop: 32, lineHeight: 1.6,
          }}>
            STRUCTURAL · BEHAVIORAL · SECURITY CHECKS ONLY — NOT BUSINESS LOGIC TESTING<br />
            ONLY SCAN TARGETS YOU OWN OR HAVE EXPLICIT AUTHORIZATION TO TEST
          </p>
        </main>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
