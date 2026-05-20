# sanjid14 Backup Guide

## Database

- Schedule `pg_dump` to run nightly at 03:00 platform local time.
- Retain 14 daily snapshots, 8 weekly snapshots, and 12 monthly snapshots.
- Encrypt the backup file with `age` or `gpg` before uploading.
- Upload to an S3 compatible bucket with versioning enabled.
- Test restore once per quarter to a staging instance.

```bash
pg_dump --no-owner --format=custom \
  --dbname="$DATABASE_URL" \
  | age -r "age1xyz..." > "backup-$(date -u +%Y%m%dT%H%M%S).dump.age"

aws s3 cp backup-*.dump.age s3://sanjid14-backups/
```

## Object storage

- Enable versioning on the uploads bucket.
- Add a replication rule to a second region if the client requires it.

## Application configuration

- Store `.env` files in the client's password manager.
- Never commit secrets to git.

## Recovery runbook

1. Provision a fresh PostgreSQL instance.
2. Download the latest backup from the storage bucket.
3. Decrypt: `age -d -i private.key backup.dump.age > backup.dump`.
4. Restore: `pg_restore --no-owner --dbname="$NEW_DB_URL" backup.dump`.
5. Run migrations to align with current schema if needed.
6. Verify with smoke tests.

Built by Anointed Coder.
