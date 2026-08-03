#!/usr/bin/env bash
# Built by Anointed Coder.
#
# Read-only. Every admin login attempt (success or failure) writes a
# LoginAttempt row with the exact reason (unknown_user / bad_password /
# blocked / ok / etc). This shows the last 10 admin-surface attempts plus
# the actual staff/admin user rows, so we see WHY a staff login is being
# rejected instead of guessing. Changes nothing.
#
# Usage: cd /var/www/pasha9/app && bash scripts/check-staff-login.sh

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

echo "=== last 10 admin-surface login attempts (why each was accepted/rejected) ==="
psql "$DATABASE_URL" -c "
SELECT to_char(\"createdAt\", 'HH24:MI:SS') AS t, identifier, reason, success
FROM \"LoginAttempt\"
WHERE surface = 'admin'
ORDER BY \"createdAt\" DESC
LIMIT 10;
"

echo "=== staff / admin accounts on file (role, status, username length, password hash present) ==="
psql "$DATABASE_URL" -c "
SELECT u.username, r.key AS role, u.status,
       length(u.username) AS username_len,
       (u.\"passwordHash\" IS NOT NULL AND length(u.\"passwordHash\") > 0) AS has_password_hash,
       u.\"createdAt\"
FROM \"User\" u
JOIN \"Role\" r ON r.id = u.\"roleId\"
WHERE r.key IN ('staff', 'admin', 'super_admin')
ORDER BY u.\"createdAt\" DESC
LIMIT 15;
"
