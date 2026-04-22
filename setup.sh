#!/usr/bin/env bash
# setup.sh — One-shot setup script for DynaScan
set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   DynaScan — TaaS Platform Setup     ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Check Node ────────────────────────────────────────────────────────────────
NODE_VER=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ -z "$NODE_VER" ] || [ "$NODE_VER" -lt 18 ]; then
  echo "✗ Node.js 18+ is required. Install from https://nodejs.org"
  exit 1
fi
echo "✓ Node.js $(node -v)"

# ── Check Java (needed by Allure) ─────────────────────────────────────────────
if ! command -v java &>/dev/null; then
  echo "⚠  Java not found. Allure requires Java 11+."
  echo "   Install from https://adoptium.net or via your package manager."
  echo "   Continuing anyway — you can install Java later."
else
  echo "✓ Java $(java -version 2>&1 | head -1)"
fi

# ── Install workspace dependencies ────────────────────────────────────────────
echo ""
echo "→ Installing root dependencies..."
npm install --silent

echo "→ Installing frontend dependencies..."
npm install --workspace=frontend --silent

echo "→ Installing backend dependencies..."
npm install --workspace=backend --silent

echo "→ Installing scanner-engine dependencies..."
npm install --workspace=scanner-engine --silent

# ── Install Playwright browsers ───────────────────────────────────────────────
echo "→ Installing Playwright Chromium browser..."
(cd scanner-engine && npx playwright install chromium --with-deps)

# ── Install Allure CLI ────────────────────────────────────────────────────────
if ! command -v allure &>/dev/null; then
  echo "→ Installing Allure commandline globally..."
  npm install -g allure-commandline --silent
  echo "✓ Allure CLI installed"
else
  echo "✓ Allure CLI already installed: $(allure --version)"
fi

# ── Create reports dir ────────────────────────────────────────────────────────
mkdir -p reports

echo ""
echo "╔══════════════════════════════════════╗"
echo "║          Setup Complete! 🚀           ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "  Start the app:  npm run dev"
echo "  Open browser:   http://localhost:5173"
echo ""
