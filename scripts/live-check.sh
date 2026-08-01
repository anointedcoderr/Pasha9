#!/usr/bin/env bash
# Built by Anointed Coder.
#
# One-line answer: is the latest balance code actually in the RUNNING build?
# It greps the built output for a response key that exists ONLY in the new
# code. Read-only, changes nothing.
#
# Usage: cd /var/www/pasha9/app && bash scripts/live-check.sh

cd "$(cd "$(dirname "$0")/.." && pwd)" || exit 1

echo "commit: $(git rev-parse --short HEAD 2>/dev/null)"
if grep -rqs "credit_balance" apps/web/.next 2>/dev/null; then
  echo "=========================================="
  echo "   RESULT: NEW CODE IS LIVE"
  echo "=========================================="
else
  echo "=========================================="
  echo "   RESULT: OLD BUILD - new code NOT live"
  echo "=========================================="
fi
