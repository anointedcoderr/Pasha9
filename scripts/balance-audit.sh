#!/usr/bin/env bash
# Built by Anointed Coder.
#
# Read-only balance diagnostic runner. Prints the most recent provider
# callbacks (see scripts/balance-audit.sql) so we can see, per callback, the
# stored wallet balance versus the credit_amount we return to the game.
#
# It connects with the app's own DATABASE_URL, loaded the same way deploy.sh
# loads it, so there is no database-name guessing and no sudo. This does not
# change any data.
#
# Usage on the VPS:
#   cd /var/www/pasha9/app && bash scripts/balance-audit.sh

set -uo pipefail

# Run from the repo root so the env files and the .sql resolve.
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
  echo "   Set it in the app env file, then re-run." >&2
  exit 1
fi

psql "$DATABASE_URL" -f scripts/balance-audit.sql
