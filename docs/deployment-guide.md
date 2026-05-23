# Pasha 9 Deployment Guide

Live deployment of the Pasha9 platform to an Ubuntu 24.04 VPS serving `pasha9.com` and `www.pasha9.com`. Built by Anointed Coder.

Run every command below as the `deploy` user unless the prompt explicitly shows `sudo` or `root@`. Expected output is shown so you can confirm each step.

## 1. DNS prerequisite

Point both A records to the VPS IP before starting. Verify with:

```bash
dig +short pasha9.com
dig +short www.pasha9.com
```

Both should print the same IPv4 address.

## 2. First-time server hardening (run as root)

```bash
apt update && apt upgrade -y
timedatectl set-timezone Asia/Dhaka

# Deploy user
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys

# Optional: disable root SSH password login
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload ssh

# 2 GB swap
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Expected: each command returns 0. `free -h` now shows 2.0G under Swap.

## 3. Toolchain (run as root)

```bash
# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# pnpm via corepack
corepack enable
corepack prepare pnpm@latest --activate

# PM2 globally
npm install -g pm2

# PostgreSQL 16, Nginx, Certbot
apt install -y postgresql nginx certbot python3-certbot-nginx ufw

# UFW
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

Expected:
- `node -v` prints `v20.x.x`
- `pnpm -v` prints a version
- `pm2 -v` prints a version
- `systemctl is-active postgresql nginx` both print `active`
- `ufw status` shows the three allow rules

## 4. PostgreSQL role and database (run as root)

```bash
sudo -u postgres psql <<'SQL'
CREATE USER pasha9 WITH PASSWORD 'REPLACE_WITH_STRONG_PASSWORD';
CREATE DATABASE pasha9_prod OWNER pasha9;
GRANT ALL PRIVILEGES ON DATABASE pasha9_prod TO pasha9;
SQL
```

Bind PostgreSQL to localhost only (this is the default on a stock install). Confirm with:

```bash
grep '^listen_addresses' /etc/postgresql/16/main/postgresql.conf
```

Expected: `listen_addresses = 'localhost'` (or commented, which also defaults to localhost).

## 5. App directories (run as deploy)

```bash
sudo mkdir -p /var/www/pasha9/app /var/www/pasha9/uploads /var/log/pasha9 /var/www/letsencrypt
sudo chown -R deploy:deploy /var/www/pasha9 /var/log/pasha9
sudo chown -R www-data:www-data /var/www/letsencrypt

mkdir -p /var/www/pasha9/uploads/{banners,games,payment-proofs,apk}
```

## 6. Clone and configure the app (run as deploy)

```bash
cd /var/www/pasha9
git clone https://github.com/anointedcoderr/Pasha9.git app
cd app
git checkout m1-production   # until M1 is merged to main
pnpm install --frozen-lockfile

# Generate JWT secrets
node -e "console.log('JWT_ACCESS_SECRET='+require('crypto').randomBytes(48).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET='+require('crypto').randomBytes(48).toString('hex'))"

# Create the production env file. Paste the printed secrets above and the
# PostgreSQL password from step 4. Do not commit this file.
cat > /var/www/pasha9/app/.env.production <<EOF
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://pasha9.com
DATABASE_URL=postgresql://pasha9:REPLACE_PASSWORD@localhost:5432/pasha9_prod
JWT_ACCESS_SECRET=PASTE_FROM_NODE_OUTPUT_ABOVE
JWT_REFRESH_SECRET=PASTE_FROM_NODE_OUTPUT_ABOVE
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
BCRYPT_ROUNDS=12
UPLOAD_ROOT=/var/www/pasha9/uploads
PASHA9_OTP_PROVIDER=noop
SEED_SUPERADMIN_USERNAME=pasha9.admin
SEED_SUPERADMIN_PHONE=01700000001
SEED_SUPERADMIN_PASSWORD=PICK_A_STRONG_FIRST_LOGIN_PASSWORD
EOF
chmod 600 .env.production

# Symlink so Next.js + Prisma pick it up
ln -sf .env.production apps/web/.env.production
ln -sf ../../.env.production packages/database/.env
```

## 7. Build, migrate, seed (run as deploy)

```bash
cd /var/www/pasha9/app
pnpm --filter @pasha9/web build
pnpm --filter @pasha9/database run migrate:deploy
pnpm --filter @pasha9/database run seed:prod
```

Expected: build summary lists every route, migrate prints `Applied 1 migration: 20260521120000_init`, seed prints `Pasha9 seed: done`.

## 8. PM2 (run as deploy)

```bash
cd /var/www/pasha9/app
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd  # then run the sudo command it prints
```

Expected: `pm2 status` shows `pasha9-web` as `online`.

## 9. Nginx (run as root)

```bash
cp /var/www/pasha9/app/nginx/pasha9.conf /etc/nginx/sites-available/pasha9
ln -sf /etc/nginx/sites-available/pasha9 /etc/nginx/sites-enabled/pasha9
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

Expected: `nginx -t` prints `syntax is ok` and `test is successful`.

## 10. SSL via Let's Encrypt (run as root)

```bash
certbot --nginx -d pasha9.com -d www.pasha9.com --redirect --agree-tos --email info@anointedcoder.com -n
systemctl status certbot.timer
```

Expected: certbot prints "Successfully deployed certificate". The timer status shows `active (waiting)` for auto-renew.

## 11. Verify

```bash
curl -I https://pasha9.com
curl -I https://www.pasha9.com
```

Both should return 200 (apex) or 301 (www to apex). Open `https://pasha9.com/admin/login` and log in with the seeded super admin.

## 12. Backup cron (run as deploy)

```bash
crontab -e
# Add:
30 3 * * *  /var/www/pasha9/app/scripts/backup-db.sh >> /var/log/pasha9/backup.log 2>&1
```

Expected: `/var/backups/pasha9/db/` and `/var/backups/pasha9/uploads/` are written nightly.

## 13. Subsequent deploys

```bash
cd /var/www/pasha9/app
./scripts/deploy.sh main
```

The script pulls the branch, installs, builds, applies migrations, reloads PM2, and prints the last 20 log lines.

## Reminders

- Do not commit `.env.production`. Generate fresh JWT secrets per environment.
- Change the seeded super admin password after first login (admin profile page).
- Once the SMS provider lands, switch `PASHA9_OTP_PROVIDER` and add the API key in the admin Settings page rather than the env file when possible.
- Keep `pnpm-lock.yaml` in source control to guarantee reproducible builds across deploys.
