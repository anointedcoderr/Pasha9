#!/usr/bin/env bash
# Built by Anointed Coder.
# Pasha9 database and uploads backup.
#
# Reads the database name from DATABASE_URL or PG* environment variables.
# Writes:
#   /var/backups/pasha9/db/pasha9-YYYYMMDD-HHMMSS.sql.gz
#   /var/backups/pasha9/uploads/uploads-YYYYMMDD-HHMMSS.tar.gz
# Rotates files older than 14 days.
#
# Recommended cron (deploy user crontab):
#   30 3 * * *  /var/www/pasha9/app/scripts/backup-db.sh >> /var/log/pasha9/backup.log 2>&1

set -euo pipefail

BACKUP_DIR="/var/backups/pasha9"
DB_DIR="$BACKUP_DIR/db"
UPLOAD_DIR_SRC="/var/www/pasha9/uploads"
UPLOAD_DIR_OUT="$BACKUP_DIR/uploads"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$DB_DIR" "$UPLOAD_DIR_OUT"

DB_NAME="${PGDATABASE:-pasha9_prod}"
DB_USER="${PGUSER:-pasha9}"

echo "==> Pasha9 backup $STAMP"

echo "==> pg_dump $DB_NAME"
pg_dump --no-owner --no-privileges --clean --if-exists -U "$DB_USER" "$DB_NAME" | gzip -c > "$DB_DIR/pasha9-$STAMP.sql.gz"

if [ -d "$UPLOAD_DIR_SRC" ]; then
  echo "==> tar uploads"
  tar -C "$(dirname "$UPLOAD_DIR_SRC")" -czf "$UPLOAD_DIR_OUT/uploads-$STAMP.tar.gz" "$(basename "$UPLOAD_DIR_SRC")"
fi

echo "==> rotate older than 14 days"
find "$DB_DIR" -type f -name "pasha9-*.sql.gz" -mtime +14 -delete
find "$UPLOAD_DIR_OUT" -type f -name "uploads-*.tar.gz" -mtime +14 -delete

echo "==> done."
ls -lh "$DB_DIR" | tail -5
