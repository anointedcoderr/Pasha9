# Pasha 9 Migration Guide

Built by Anointed Coder.

Use this when moving Pasha9 to a different VPS, switching PostgreSQL hosts, or upgrading the OS.

## 1. Take a backup on the source VPS

```bash
sudo -iu deploy /var/www/pasha9/app/scripts/backup-db.sh
```

Copy the two newest files from `/var/backups/pasha9/db/` and `/var/backups/pasha9/uploads/` to your laptop.

## 2. Provision the new VPS

Follow `docs/deployment-guide.md` sections 2 to 5 to install the toolchain, create the database, and the directories. Do not run the seed yet.

## 3. Move the database

```bash
# On the new VPS
scp pasha9-TIMESTAMP.sql.gz deploy@NEW_VPS:/tmp/
ssh deploy@NEW_VPS
gunzip -c /tmp/pasha9-TIMESTAMP.sql.gz | psql -U pasha9 pasha9_prod
```

## 4. Move the uploads

```bash
scp uploads-TIMESTAMP.tar.gz deploy@NEW_VPS:/tmp/
ssh deploy@NEW_VPS
sudo tar -xzf /tmp/uploads-TIMESTAMP.tar.gz -C /var/www/pasha9/
```

## 5. Configure the app

Continue with `docs/deployment-guide.md` sections 6 to 11. Use the same JWT secrets as the previous VPS if you want existing sessions to remain valid. Generate fresh secrets if you want to force every user to log in again.

## 6. Switch DNS

Update the `pasha9.com` and `www.pasha9.com` A records to the new VPS IP. TTL on Cloudflare is normally fast. Confirm with `dig +short pasha9.com`.

## 7. Confirm

- `https://pasha9.com` opens
- A test login works
- Admin sees the same banners, popups, homepage content
- The old VPS Nginx is stopped (`sudo systemctl stop nginx`) to avoid split traffic during DNS propagation

## 8. Decommission the old VPS

After 7 days of stable traffic on the new host, archive the source VPS and cancel the subscription.

## Schema migrations between versions

Pasha9 uses Prisma Migrate. To roll a new schema change:

```bash
# On a developer machine with DATABASE_URL pointing to a dev DB
pnpm --filter @pasha9/database exec prisma migrate dev --name your_change_name
git add packages/database/prisma/migrations
git commit -m "feat(db): your change"
git push

# On the VPS
./scripts/deploy.sh main
# deploy.sh runs `prisma migrate deploy` automatically
```

Never edit applied migration SQL by hand. If a migration is wrong, create a follow-up migration that fixes it.

## Rollback

```bash
# Stop traffic
pm2 stop pasha9-web

# Restore the latest pre-incident backup
gunzip -c /var/backups/pasha9/db/pasha9-OLDER.sql.gz | psql -U pasha9 pasha9_prod

# Revert the code
cd /var/www/pasha9/app
git reset --hard PREVIOUS_GOOD_COMMIT
pnpm install --frozen-lockfile
pnpm --filter @pasha9/web build

pm2 start pasha9-web
```

Document any rollback in the activity log of the next admin login so the support team has context.
