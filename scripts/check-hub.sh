#!/usr/bin/env bash
# scripts/check-hub.sh — report sleeve config + probe Bitget Hub (market + loan module).
# Requires .env with BITGET_* paper (demo) keys.
set -euo pipefail
cd "$(dirname "$0")/.."
node --env-file=.env --import tsx scripts/check-hub.ts
