#!/usr/bin/env bash

# Resolve directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "================================================================"
echo "  LUMINA CITY — Autonomous Intelligent City Showcase"
echo "  Offline Local Launcher"
echo "================================================================"
echo ""

# Helper to open browser
open_browser() {
  local url="$1"
  if command -v open >/dev/null 2>&1; then
    open "$url"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" &
  fi
}

# 1. Prefer Node.js launcher if available (zero external dependencies)
if command -v node >/dev/null 2>&1; then
  echo "[OK] Node.js detected. Launching offline server..."
  echo ""
  node launch.js
  exit 0
fi

# 2. Fallback to Python 3
if command -v python3 >/dev/null 2>&1; then
  echo "[OK] Python 3 detected. Using Python HTTP server..."
  if [ ! -f "dist/index.html" ]; then
    echo "[!] Error: 'dist' folder not found. Please build the project with 'npm run build' first."
    exit 1
  fi
  open_browser "http://localhost:8080"
  python3 -m http.server 8080 --directory dist
  exit 0
fi

# 3. Fallback to Python
if command -v python >/dev/null 2>&1; then
  echo "[OK] Python detected. Using Python HTTP server..."
  if [ ! -f "dist/index.html" ]; then
    echo "[!] Error: 'dist' folder not found. Please build the project with 'npm run build' first."
    exit 1
  fi
  open_browser "http://localhost:8080"
  python -m http.server 8080 --directory dist
  exit 0
fi

echo "[X] Error: Neither Node.js nor Python is available in your PATH."
echo "Please install Node.js (or Python) to run the offline local server."
exit 1
