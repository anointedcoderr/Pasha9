#!/usr/bin/env bash
# Built by Anointed Coder.
#
# Read-only. Finds the most recent error in pm2's persistent error log for
# pasha9-web and prints ONLY the message line plus the stack frames that
# point at OUR application code - every node_modules/.pnpm/next-internal
# frame is hidden (just counted). Those internal paths are 150+ characters
# long and wrap into 5-6 lines each on a phone screen, which is why the
# earlier version of this script was unreadable when screenshotted. This
# version is meant to fit in a single screenshot. Changes nothing.
#
# Usage: cd /var/www/pasha9/app && bash scripts/error-log.sh

set -uo pipefail

LOG=$(pm2 jlist 2>/dev/null | grep -o '"pm_err_log_path":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "${LOG:-}" ] || [ ! -f "$LOG" ]; then
  echo "pm2 error log path not found automatically, using pm2 logs instead."
  pm2 logs pasha9-web --lines 400 --nostream --err > /tmp/pasha9-err-fallback.log 2>&1
  LOG=/tmp/pasha9-err-fallback.log
fi

# Anchor on the LAST line that looks like an actual error message: either
# Next.js's own "⨯" error marker, or a bare "<Type>Error: ..." line. Search
# is NOT anchored to line-start because pm2 prefixes every line with an ISO
# timestamp before the real content.
ANCHOR=$(grep -nE '⨯|[A-Za-z]+Error:' "$LOG" | tail -1 | cut -d: -f1)

echo "reading: $LOG"
echo "=========================================="

if [ -z "${ANCHOR:-}" ]; then
  echo "No 'Error:' line found. Showing the last 15 raw lines instead:"
  tail -n 15 "$LOG"
  exit 0
fi

echo "--- error message ---"
sed -n "${ANCHOR}p" "$LOG"

WINDOW_END=$((ANCHOR + 150))
echo ""
echo "--- where it happened (our code only, framework frames hidden) ---"
APP_FRAMES=$(sed -n "${ANCHOR},${WINDOW_END}p" "$LOG" | grep -v 'node_modules' | grep -E '\.(ts|tsx|js|jsx):[0-9]+' | head -6)
if [ -z "${APP_FRAMES:-}" ]; then
  echo "(no application file appears in the visible trace - it may be entirely inside Next.js/a dependency)"
else
  echo "$APP_FRAMES"
fi

HIDDEN=$(sed -n "${ANCHOR},${WINDOW_END}p" "$LOG" | grep -c 'node_modules')
echo ""
echo "(hid $HIDDEN internal Next.js / node_modules frames)"
