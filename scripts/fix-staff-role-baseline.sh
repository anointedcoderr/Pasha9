#!/usr/bin/env bash
# Built by Anointed Coder.
#
# One-time data fix: removes the 8 permissions the "staff" role used to grant
# to EVERY staff account by default (including deposits.review and
# withdrawals.review - approving real deposits/withdrawals), independent of
# whatever a Super Admin toggles per person in the Staff page picker. Going
# forward, staff access is 100% opt-in via that picker (packages/database/
# prisma/seed.ts no longer seeds a staff role baseline either, so this stays
# correct after future deploys).
#
# Also force-logs-out every currently active staff session, so the fix takes
# effect immediately rather than waiting for their access token to expire on
# its own (their existing token still carries the old, broader permission
# claim until they log in again).
#
# Safe to re-run. Only touches rows tied to the "staff" role.
#
# Usage: cd /var/www/pasha9/app && bash scripts/fix-staff-role-baseline.sh

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

echo "=== before: permissions currently on the staff role baseline ==="
psql "$DATABASE_URL" -c "
SELECT p.key FROM \"RolePermission\" rp
JOIN \"Permission\" p ON p.id = rp.\"permissionId\"
JOIN \"Role\" r ON r.id = rp.\"roleId\"
WHERE r.key = 'staff';
"

echo "=== removing them ==="
psql "$DATABASE_URL" -c "
DELETE FROM \"RolePermission\"
WHERE \"roleId\" = (SELECT id FROM \"Role\" WHERE key = 'staff');
"

echo "=== logging out currently active staff sessions so the fix applies immediately ==="
psql "$DATABASE_URL" -c "
UPDATE \"Session\" SET \"revokedAt\" = now()
WHERE \"revokedAt\" IS NULL
  AND \"userId\" IN (SELECT id FROM \"User\" WHERE \"roleId\" = (SELECT id FROM \"Role\" WHERE key = 'staff'));
"

echo "Done. Staff accounts now have access ONLY to sections explicitly granted per person. They will need to log in again."
