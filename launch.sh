#!/bin/sh
set -e

cd "$(dirname "$0")/app"

# Finder does not inherit the shell setup that usually puts nvm's npm on PATH.
if ! command -v npm >/dev/null 2>&1; then
  NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh"
  fi
fi

if ! command -v npm >/dev/null 2>&1; then
  printf '%s\n' "Afterlight needs Node.js and npm to start. Install Node.js, then run this launcher again." >&2
  exit 1
fi

# IDE terminals (Antigravity, VS Code, ...) export BROWSER pointing at themselves,
# which hijacks `vite --open`; clear it so macOS opens the real default browser.
# Pin one instead by setting it here, e.g. BROWSER="Google Chrome".
unset BROWSER

# First run on a fresh clone: install dependencies before starting.
if [ ! -x node_modules/.bin/vite ]; then
  npm install
fi

exec npm run dev -- --open
