#!/usr/bin/env bash
# Built by Anointed Coder.
#
# Turns off the pre-deposit "Important Notice" popup (the one that shows
# when a player opens the Deposit page, before any payment happens). Sets
# the deposit_notice_enabled SystemSetting to 'false'. Safe to re-run.
#
# Usage: cd /var/www/pasha9/app && bash scripts/disable-deposit-notice.sh

set -uo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "${DATABASE_URL:-}" ]; then
  for envf in .env .env.production apps/web/.env apps/web/.env.production; do
    if [ -f "$envf" ] && grep -q '^DATABASE_URL=' "$envf"; then
      export DATABASE_URL="$(grep -m1 '^DATABASE_URL=' "$envf" | cut -d= -f2- | sed -E 's/^"//; s/"$//; s/^'"'"'//; s/'"'"'$//')"
      break
    fi
  done
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "!! DATABASE_URL not found." >&2
  exit 1
fi

# SystemSetting.id has no database-level default (Prisma generates cuid()
# client-side only), so a raw INSERT must supply one. Try UPDATE first
# (the row almost certainly already exists from earlier admin use); only
# INSERT a fresh row if none existed.
psql "$DATABASE_URL" -c "
UPDATE \"SystemSetting\" SET value = 'false', \"updatedAt\" = now()
WHERE key = 'deposit_notice_enabled';

INSERT INTO \"SystemSetting\" (id, key, value, type, \"updatedAt\")
SELECT md5(random()::text || clock_timestamp()::text), 'deposit_notice_enabled', 'false', 'boolean', now()
WHERE NOT EXISTS (SELECT 1 FROM \"SystemSetting\" WHERE key = 'deposit_notice_enabled');
"
echo "Deposit notice popup is now OFF."
