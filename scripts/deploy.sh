#!/usr/bin/env bash
# Built by Anointed Coder.
# Pasha9 production deploy script. Run on the VPS as the deploy user.
#
# Usage:
#   cd /var/www/pasha9/app && ./scripts/deploy.sh [branch]
#
# Default branch is main. Idempotent: safe to re-run on every push.

set -euo pipefail

BRANCH="${1:-main}"
APP_DIR="/var/www/pasha9/app"
WEB_FILTER="@pasha9/web"
DB_FILTER="@pasha9/database"

cd "$APP_DIR"

echo "==> Pasha9 deploy on branch $BRANCH at $(date -Iseconds)"

echo "==> git fetch and reset to origin/$BRANCH"
git fetch --prune origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> install dependencies"
pnpm install --frozen-lockfile

echo "==> build web app"
pnpm --filter "$WEB_FILTER" build

echo "==> apply database migrations"
pnpm --filter "$DB_FILTER" run migrate:deploy

echo "==> reload PM2 process"
pm2 reload pasha9-web --update-env

echo "==> done. Recent logs:"
pm2 logs pasha9-web --lines 20 --nostream
