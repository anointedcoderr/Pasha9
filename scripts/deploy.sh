#!/usr/bin/env bash
# Built by Anointed Coder.
# Pasha9 production deploy script. Run on the VPS as the deploy user.
#
# Usage:
#   cd /var/www/pasha9/app && ./scripts/deploy.sh [branch]
#
# Default branch is m1-production - that is the live production line for
# this project (main is frozen at the Milestone 1 baseline and is 200+
# commits behind). Deploying the old default 'main' silently shipped a
# whole-milestone-old build, which is why recent features looked
# "not deployed". The default is pinned to the real production branch
# here. Idempotent: safe to re-run on every push.

set -euo pipefail

BRANCH="${1:-m1-production}"
APP_DIR="/var/www/pasha9/app"
WEB_FILTER="@pasha9/web"
DB_FILTER="@pasha9/database"

cd "$APP_DIR"

echo "==> Pasha9 deploy on branch $BRANCH at $(date -Iseconds)"

echo "==> git fetch and reset to origin/$BRANCH"
git fetch --prune origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> show what we are about to build (sanity)"
git --no-pager log --oneline -3

echo "==> install dependencies (incl devDependencies)"
# --prod=false forces devDependencies (prisma CLI, tsx, turbo, typescript)
# to install even when NODE_ENV=production is exported in the shell.
# Without it, pnpm prunes them and 'prisma generate' / 'next build' fail
# with ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL.
unset NODE_ENV
pnpm install --frozen-lockfile --prod=false

echo "==> sync database schema (this project uses prisma db push, not"
echo "    migrations: the lone init migration is a stale baseline, so"
echo "    migrate deploy was a no-op. db push is additive + safe here)."
# db push connects to Postgres, so it needs DATABASE_URL in THIS shell. PM2
# injects it into the running app, but an interactive deploy shell does not
# have it, and prisma run from packages/database does not auto-load the app
# env. Load it from the app env file so db push never dies with P1012
# "Environment variable not found: DATABASE_URL".
if [ -z "${DATABASE_URL:-}" ]; then
  for envf in .env .env.production apps/web/.env apps/web/.env.production; do
    if [ -f "$envf" ] && grep -q '^DATABASE_URL=' "$envf"; then
      export DATABASE_URL="$(grep -m1 '^DATABASE_URL=' "$envf" | cut -d= -f2-)"
      echo "==> loaded DATABASE_URL from $envf"
      break
    fi
  done
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "!! DATABASE_URL not found in .env / .env.production. Set it, then re-run." >&2
  exit 1
fi
pnpm --filter "$DB_FILTER" exec prisma generate
pnpm --filter "$DB_FILTER" exec prisma db push

echo "==> CLEAN build: wipe .next + turbo cache so a stale compiled"
echo "    artifact can never be served (this exact cache previously hid"
echo "    new features even after a successful pull)."
rm -rf apps/web/.next apps/web/.turbo .turbo
pnpm --filter "$WEB_FILTER" build

echo "==> restart PM2 process"
pm2 restart pasha9-web --update-env
pm2 save

echo "==> done. Recent logs:"
pm2 logs pasha9-web --lines 20 --nostream
