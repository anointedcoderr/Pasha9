#!/usr/bin/env bash
# Built by Anointed Coder.
#
# Read-only pre/post-deploy check for the staff permission redesign (see
# scripts/rbac-audit.sql for what it looks at and why). Connects with the
# app's own DATABASE_URL, same pattern as scripts/balance-audit.sh. Changes
# no data.
#
# Usage on the VPS:
#   cd /var/www/pasha9/app && bash scripts/rbac-audit.sh

set -uo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "${DATABASE_URL:-}" ]; then
  for envf in .env .env.production apps/web/.env apps/web/.env.production; do
    if [ -f "$envf" ] && grep -q '^DATABASE_URL=' "$envf"; then
      export DATABASE_URL="$(grep -m1 '^DATABASE_URL=' "$envf" | cut -d= -f2- | sed -E 's/^"//; s/"$//; s/^'"'"'//; s/'"'"'$//')"
      echo "==> loaded DATABASE_URL from $envf"
      break
    fi
  done
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "!! DATABASE_URL not found in .env / .env.production / apps/web/.env." >&2
  exit 1
fi

psql "$DATABASE_URL" -f scripts/rbac-audit.sql
