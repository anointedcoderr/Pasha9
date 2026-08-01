#!/usr/bin/env bash
# Built by Anointed Coder.
#
# Read-only deploy verification. Answers one question with certainty: is the
# RUNNING app actually serving the latest code, or an old build? It checks the
# git commit, greps the BUILT output for a string that only exists in the new
# balance code, and shows where/how pm2 runs the app. Changes nothing.
#
# Usage: cd /var/www/pasha9/app && bash scripts/deploy-check.sh

set -uo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)"

echo "=== 1. source tree commit ==="
git --no-pager log --oneline -1

echo
echo "=== 2. is the NEW balance code in the built output? ==="
# credit_balance is a response key that exists ONLY in the new
# buildCallbackResponse. If the built bundle has it, the new code is compiled.
if grep -rqs "credit_balance" apps/web/.next 2>/dev/null; then
  echo "YES - built bundle contains credit_balance (NEW code is built)."
else
  echo "NO  - built bundle is missing credit_balance (app is an OLD build)."
fi

echo
echo "=== 3. built .next id + last build time ==="
ls -la --time-style=+%Y-%m-%dT%H:%M:%S apps/web/.next/BUILD_ID 2>/dev/null || echo "no apps/web/.next/BUILD_ID"
echo -n "BUILD_ID="; cat apps/web/.next/BUILD_ID 2>/dev/null; echo

echo
echo "=== 4. pm2 process: where + how it runs ==="
pm2 describe pasha9-web 2>/dev/null | grep -iE "script path|script args|exec cwd|exec mode|status|uptime|restarts|created at|version" \
  || pm2 list

echo
echo "=== 5. exact pm2 exec path + cwd (dev vs start, which folder) ==="
pm2 jlist 2>/dev/null \
  | tr '{},' '\n\n\n' \
  | grep -iE "\"name\"|pm_exec_path|pm_cwd|\"args\"|exec_interpreter|\"status\"" \
  | head -25
