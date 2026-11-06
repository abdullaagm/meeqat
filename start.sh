#!/usr/bin/env sh
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo "Node.js is not installed (sudo apt install nodejs)"; exit 1; }
exec node server.js
