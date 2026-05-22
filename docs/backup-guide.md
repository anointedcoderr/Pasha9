# Pasha9 Backup Guide

Built by Anointed Coder.

## What gets backed up

- PostgreSQL database `pasha9_prod` via `pg_dump`, gzip compressed
- Uploads directory `/var/www/pasha9/uploads/` via `tar -czf`

## Where it lives

```
/var/backups/pasha9/db/pasha9-YYYYMMDD-HHMMSS.sql.gz
/var/backups/pasha9/uploads/uploads-YYYYMMDD-HHMMSS.tar.gz
```

Both directories are outside `/var/www`, so they are not exposed by Nginx.

## Automatic schedule

The deploy user crontab runs the backup nightly at 03:30 server time:

```
30 3 * * *  /var/www/pasha9/app/scripts/backup-db.sh >> /var/log/pasha9/backup.log 2>&1
```

The script keeps 14 days of files and deletes anything older.

## Manual backup

```bash
sudo -iu deploy /var/www/pasha9/app/scripts/backup-db.sh
```

## Restore

```bash
pm2 stop pasha9-web

# Database (replace TIMESTAMP)
gunzip -c /var/backups/pasha9/db/pasha9-TIMESTAMP.sql.gz | psql -U pasha9 pasha9_prod

# Uploads
sudo tar -xzf /var/backups/pasha9/uploads/uploads-TIMESTAMP.tar.gz -C /var/www/pasha9/

pm2 start pasha9-web
```

## Off-server copy

For a real disaster recovery story, mirror `/var/backups/pasha9/` to an off-server target:

- Object storage: `rclone sync /var/backups/pasha9 remote:pasha9-backups`
- Another VPS via rsync over SSH
- Encrypted local drive copied weekly

This is optional in Milestone 1. The client is responsible for picking an off-site destination before public launch.

## Pre-handover backup

Before final delivery, run a manual backup and copy the resulting two files to a safe location outside the VPS. Document the filenames in the handover checklist.
