#!/usr/bin/env bash
# Built by Anointed Coder.
#
# Read-only. Prints the tail of pm2's persistent error log for pasha9-web,
# straight from the log FILE rather than the live ring buffer `pm2 logs`
# shows by default (which can cut off the top of a multi-line stack trace -
# the exact "Error: ..." line and the app file that threw it - if other
# output pushed it out of the last 20 lines). Changes nothing.
#
# Usage: cd /var/www/pasha9/app && bash scripts/error-log.sh

set -uo pipefail

LOG=$(pm2 jlist 2>/dev/null | grep -o '"pm_err_log_path":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "${LOG:-}" ] || [ ! -f "$LOG" ]; then
  echo "Could not find the pm2 error log path automatically. Falling back to pm2 logs:"
  pm2 logs pasha9-web --lines 80 --nostream --err
  exit 0
fi

echo "log file: $LOG"
echo "=========================================="
tail -n 80 "$LOG"
