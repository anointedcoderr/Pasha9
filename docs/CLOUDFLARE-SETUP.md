# Cloudflare + Firewall Hardening Runbook for pasha9.com

Built by Anointed Coder.

This runbook puts Cloudflare in front of the live site and then locks the
VPS firewall so only Cloudflare (and SSH) can reach the origin. Follow the
phases in order. Every command is copy-pasteable. Do not skip Phase 4
(crontab) or the scheduled jobs will start depending on Cloudflare.

Facts this runbook assumes (verified against the repo on 2026-07-02):

- Origin VPS: Ubuntu 24.04 at 69.62.76.83, Nginx in front of Next.js on
  127.0.0.1:3000 under PM2.
- TLS on the origin: Let's Encrypt via certbot, HTTP-01, auto renew timer.
- Nginx config lives in the repo at `nginx/pasha9.conf` and is installed by
  copying to `/etc/nginx/sites-available/pasha9` with a symlink into
  `sites-enabled` (see `docs/deployment-guide.md` section 9).
- Inbound endpoints that OUTSIDE services must reach (found in the code):

| Path | Who calls it |
| --- | --- |
| `/api/payments/webhook/zinipay` | ZiniPay deposit webhook |
| `/api/payments/webhook/chaopaopay` | ChaopaoPay deposit callback |
| `/api/payouts/webhook/chaopaopay` | ChaopaoPay payout status callback |
| `/api/providers/igamingapis/callback` | Game provider wallet callback (bet/win). Path shape is `/api/providers/<providerKey>/callback`; `igamingapis` is the only registered provider today |
| `/.well-known/acme-challenge/*` | Let's Encrypt renewal validation |
| `/api/cron/*` | Currently curled from the VPS crontab over the public URL; Phase 4 moves these to loopback |

If any of these get challenged or blocked by Cloudflare, deposits stop
confirming and game rounds stop settling. That is why Phase 3 exists.

---

## Phase 0: prerequisites

1. A Cloudflare account created IN THE CLIENT'S NAME with his email. He
   owns the domain; the account must be his, with the agency added as a
   member later if needed. Do not put the zone on an agency account.
2. Login access to the domain registrar for pasha9.com (nameserver change
   happens there).
3. A quiet-hour maintenance window (low player traffic). The nameserver
   flip itself causes no downtime when done right, but you want room to
   verify payments and game rounds without pressure.
4. SSH access to the VPS as root or a sudoer.
5. Confirm the current site is healthy before touching anything:

```bash
curl -sI https://pasha9.com | head -5
```

Expect `HTTP/2 200`.

---

## Phase 1: Cloudflare onboarding (BEFORE the nameserver flip)

Everything in this phase is preparation inside the Cloudflare dashboard.
Nothing changes for players until Phase 2.

1. Log in to the client's Cloudflare account, click "Add a domain", enter
   `pasha9.com`, choose the Free plan.
2. Cloudflare scans and imports the existing DNS records. Verify them
   against reality before continuing:
   - `A pasha9.com -> 69.62.76.83`, proxy status Proxied (orange cloud).
   - `A www -> 69.62.76.83` (or `CNAME www -> pasha9.com`), Proxied.
   - Any mail (MX) or verification (TXT) records the domain had must be
     kept exactly as they are. MX targets must stay DNS only (grey cloud).
   - Write down the current TTLs shown at the registrar's DNS before the
     flip, so you can judge how long old records may be cached.
3. SSL/TLS app, Overview tab: set the encryption mode to **Full (strict)**.
   The origin already has a valid Let's Encrypt certificate for
   pasha9.com and www.pasha9.com, which is exactly what Full (strict)
   requires. Never use "Flexible"; it would loop with the origin's HTTP
   to HTTPS redirect.
4. SSL/TLS app, Edge Certificates tab: turn **Always Use HTTPS** on.
5. Security app: make sure **Bot Fight Mode is OFF** for now. It cannot be
   scoped by path on the Free plan and it will challenge the payment
   gateway webhooks and the game provider callback. Revisit only after the
   Phase 3 skip rules are proven in production.
6. Do NOT change the nameservers yet. Note the two Cloudflare nameservers
   the dashboard assigns (something like `ada.ns.cloudflare.com` and
   `rick.ns.cloudflare.com`).

---

## Phase 2: the nameserver flip and verification

1. At the registrar, replace the domain's nameservers with the two
   Cloudflare nameservers from Phase 1 step 6. Change nothing else.
2. Wait. Registrar propagation is usually minutes but can take hours.
   Check from your machine:

```bash
dig NS pasha9.com +short
```

Expect the two Cloudflare nameservers.

3. Confirm the A record now resolves to Cloudflare edge IPs (no longer
   69.62.76.83; that is correct and expected while proxied):

```bash
dig A pasha9.com +short
```

4. Confirm the site loads through Cloudflare and the response carries a
   Cloudflare ray id:

```bash
curl -sI https://pasha9.com | grep -i -E "cf-ray|server"
```

Expect a `cf-ray:` header and `server: cloudflare`.

5. Log in on the site as a test player, load a game list page, open the
   admin panel. All should behave exactly as before.

IMPORTANT: do NOT run the firewall script yet. The origin must stay open
until Cloudflare is confirmed proxying (this phase) AND the crontab has
moved to loopback (Phase 4).

---

## Phase 3: WAF skip rules for callbacks

Why: payment confirmations and game provider callbacks are
server-to-server POSTs. They cannot solve a browser challenge. If
Cloudflare's managed rules or bot products ever challenge them, deposits
sit unconfirmed and game rounds fail to settle, silently. These skip
rules make that impossible for the exact paths involved and nothing else.

In the Cloudflare dashboard:

1. Go to Security, then WAF, then Custom rules, click "Create rule".
2. Name: `skip-payment-and-provider-callbacks`.
3. Use "Edit expression" and paste:

```
starts_with(http.request.uri.path, "/api/payments/webhook/")
or starts_with(http.request.uri.path, "/api/payouts/webhook/")
or (starts_with(http.request.uri.path, "/api/providers/") and ends_with(http.request.uri.path, "/callback"))
or starts_with(http.request.uri.path, "/api/cron/")
or starts_with(http.request.uri.path, "/.well-known/acme-challenge/")
```

4. Action: **Skip**. Tick, at minimum: All managed rules, and under "More
   components to skip": Bot Fight Mode, Zone Lockdown, User Agent
   Blocking. Leave rate limiting unticked unless you later add rate rules
   that would hit these paths.
5. Deploy the rule.

Notes:

- The payment and payout webhook matches are prefix based on purpose. The
  routes are dynamic (`/api/payments/webhook/[provider]` and
  `/api/payouts/webhook/[provider]`) and more gateways are already
  scaffolded in the code; pinning the two providers live today by exact
  path would silently drop the exemption for any gateway enabled later
  (bKash, for example). A prefix match covers a new gateway the day it
  goes live.
- The provider callback match is kept tight: path must start with
  `/api/providers/` and end with `/callback`. Today that means only
  `/api/providers/igamingapis/callback`; if a second provider adapter is
  registered later it is covered automatically.
- These paths are not left unprotected: each one has its own application
  level auth (HMAC signature verification for the payment webhooks, a
  callback secret plus optional IP whitelist for the provider callback,
  and a Bearer secret for `/api/cron/*`).
- `/api/cron/*` stays in the skip list as a belt-and-braces measure even
  though Phase 4 moves the crontab off the public URL.

---

## Phase 4: move the crontab to loopback

The VPS crontab currently curls `https://pasha9.com/api/cron/...` with a
Bearer secret. Behind Cloudflare those calls would leave the box, hit the
Cloudflare edge, and come back; any future bot rule could challenge them
and every scheduled job would silently stop. Pointing them at the local
PM2 process removes Cloudflare from the path entirely. Same paths, same
Bearer header, same behaviour.

One trap to know before touching anything: cron does NOT expand shell
variables inside job lines. A crontab line containing
`Bearer $CRON_SECRET` sends that literal text as the token, every job
gets a 401, and nothing complains anywhere. So the secret has to be
baked into the crontab as its literal value at write time. The snippet
below does exactly that.

1. Find which user owns the cron lines (`crontab -l` as root first,
   then other users if needed) and run everything below AS THAT USER.
2. Check the current crontab for any extra jobs beyond the four cron
   curls and the nightly backup. If there are extras, add them into the
   heredoc in step 3 before running it, because the snippet rewrites
   the whole crontab.
3. Back up the crontab, read the real secret out of the app env file,
   and confirm it loaded. Copy-paste as one block:

```bash
crontab -l > ~/crontab.bak.$(date +%F) 2>/dev/null || true
CRON_SECRET="$(grep -m1 '^CRON_SECRET=' /var/www/pasha9/app/.env | cut -d= -f2- | tr -d '"' | tr -d "'")"
[ -n "$CRON_SECRET" ] && echo "secret loaded (${#CRON_SECRET} chars)" || echo "EMPTY: STOP HERE, do not write the crontab"
```

   Only continue when it printed `secret loaded`. Then write the whole
   crontab in one go. The heredoc is intentionally unquoted so
   `$CRON_SECRET` expands NOW, while writing; the installed crontab
   carries the literal value and cron never has to expand anything:

```bash
crontab - <<EOF
# Pasha9 scheduled jobs. Loopback on purpose: these must never depend on
# Cloudflare or public DNS. Built by Anointed Coder.

# Lotto draw rollover - every minute. Idempotent: no-op when no draw is due.
* * * * * curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/lotto-rollover > /dev/null

# Referral hold maturity + ReferralBalance refresh - hourly.
17 * * * * curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/referral-mature > /dev/null

# Account-recovery sweep - twice daily.
13 5,17 * * * curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/recovery-sweep > /dev/null

# Cashback maturity - daily just after midnight UTC.
5 0 * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/cashback >> /var/log/cashback-cron.log 2>&1

# Nightly database + uploads backup (unchanged).
30 3 * * * /var/www/pasha9/app/scripts/backup-db.sh >> /var/log/pasha9/backup.log 2>&1
EOF
```

4. Verify what actually got installed:

```bash
crontab -l
```

   Every curl line must show the literal secret value after `Bearer`
   (NOT the text `$CRON_SECRET`) and point at `http://127.0.0.1:3000`.
   If you see `$CRON_SECRET` in the output, the heredoc was quoted or
   the variable was empty; restore the backup and redo step 3.

5. Prove one of them works over loopback right now (the shell still has
   `$CRON_SECRET` set from step 3):

```bash
curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/referral-mature
```

Expect a JSON success body, not a 401.

---

## Phase 5: deploy the Nginx change, fix certbot renewal, then the firewall

### 5a. Nginx real IP restore

The repo's `nginx/pasha9.conf` now carries the Cloudflare
`set_real_ip_from` block, the certbot managed `ssl_certificate` lines,
and the acme-challenge webroot on both 80 and 443, so it is valid
standalone; there is no certbot step in this phase section. The one
thing that can differ per box is the certificate path: certbot
sometimes issues under a different lineage name (for example
`pasha9.com-0001`). Verify that BEFORE copying anything.

1. Pull and compare the cert paths, live file versus repo file:

```bash
cd /var/www/pasha9/app
git pull origin m1-production

grep ssl_certificate /etc/nginx/sites-available/pasha9
grep ssl_certificate nginx/pasha9.conf
```

Both must point at the same `/etc/letsencrypt/live/<name>/` directory.
If the live file uses a different lineage (for example
`/etc/letsencrypt/live/pasha9.com-0001/fullchain.pem`), edit the repo
copy at `nginx/pasha9.conf`, in BOTH 443 server blocks, to match the
LIVE paths before going any further. Do not "fix" the live paths to
match the repo; the live paths are the ones certbot actually issued.

2. Back up the live file, copy the repo file over, and test. `nginx -t`
   must pass BEFORE any reload:

```bash
sudo cp /etc/nginx/sites-available/pasha9 /etc/nginx/sites-available/pasha9.bak.$(date +%F)
sudo cp nginx/pasha9.conf /etc/nginx/sites-available/pasha9
sudo nginx -t
```

3. Only if `nginx -t` printed `syntax is ok` and `test is successful`:

```bash
sudo systemctl reload nginx
```

If `nginx -t` failed, restore the backup IMMEDIATELY and do not reload
until the test passes; the running Nginx keeps serving the old config
until a reload, so a fast restore means zero impact:

```bash
sudo cp /etc/nginx/sites-available/pasha9.bak.$(date +%F) /etc/nginx/sites-available/pasha9
sudo nginx -t && sudo systemctl reload nginx
```

### 5b. Switch certbot renewal to webroot

Why this step exists: "Always Use HTTPS" at the Cloudflare edge 301s
every HTTP request, including certbot's HTTP-01 challenge fetches, to
https. The config from 5a serves `/.well-known/acme-challenge/` from
`/var/www/letsencrypt` on port 80 AND on both 443 hosts, so the
redirected challenge still lands on the right files, but only if the
renewal actually writes its challenge files into that webroot. Switch
the renewal to the webroot authenticator now:

```bash
sudo mkdir -p /var/www/letsencrypt
sudo certbot certonly --webroot -w /var/www/letsencrypt -d pasha9.com -d www.pasha9.com --deploy-hook "systemctl reload nginx"
```

If certbot asks about the existing certificate, choose the renew/replace
option so the stored renewal parameters get updated to webroot. To do
the same thing by hand instead, edit
`/etc/letsencrypt/renewal/pasha9.com.conf`: under `[renewalparams]` set
`authenticator = webroot`, and add a `[[webroot_map]]` section mapping
both `pasha9.com` and `www.pasha9.com` to `/var/www/letsencrypt`.

The proof that renewals survive the Cloudflare move is the mandatory
`certbot renew --dry-run` item in Phase 6.

### 5c. Firewall: Cloudflare-only 80/443

Only now, with Cloudflare proxying (Phase 2 verified) and cron on
loopback (Phase 4 done). Dry run first, read the output, then apply:

```bash
cd /var/www/pasha9/app
chmod +x scripts/cloudflare-ufw.sh
sudo ./scripts/cloudflare-ufw.sh --dry-run
sudo ./scripts/cloudflare-ufw.sh
```

The script allows and rate limits SSH before anything else, sets the
default policy to deny incoming / allow outgoing (without that, scoped
allow rules would be a silent no-op), fetches the current Cloudflare
ranges, refuses to continue if the ranges look wrong, scopes 80/443 to
those ranges, removes generic 80/443 allows, and only enables ufw after
confirming the SSH rule exists. It finishes by verifying the default
policy, that 80/443 only allow the Cloudflare ranges, and that port
3000 has no allow rule; read those check results, they are the point of
the exercise. Keep your current SSH session open until you have
confirmed a SECOND ssh login works.

Verify the lockdown:

```bash
# Through Cloudflare: works.
curl -sI https://pasha9.com | head -3

# Direct to the origin IP from your own machine: must now time out.
curl -m 10 -k https://69.62.76.83/ ; echo "exit=$?"
```

Expect exit=28 (timeout) on the direct hit.

---

## Phase 6: verification checklist

Work through every line; this is a live casino.

- [ ] `https://pasha9.com` loads, `cf-ray` header present.
- [ ] Player login works (session cookie set, no redirect loop).
- [ ] Deposit callback test: create a small real deposit through ZiniPay
      or ChaopaoPay, or use the admin provider tools to simulate, and
      confirm the deposit flips to completed. Check
      Admin > Payments for the new gateway transaction row.
- [ ] Game launch: open a game as a test player, place a minimal bet,
      confirm the round settles (provider callback arrived). Admin >
      Providers > callback logs shows a fresh entry with HTTP 200.
- [ ] Admin panel loads and admin login works.
- [ ] Uploads: in the admin, upload a banner video around 20 to 25 MB.
      It must succeed (Nginx allows up to 90M; Cloudflare Free allows
      request bodies up to 100 MB).
- [ ] Real player IPs are being seen again: open Admin > Security (or the
      activity log) and confirm NEW rows show varied residential-looking
      IPs, not addresses inside Cloudflare ranges like `172.64.x.x`,
      `104.16.x.x` or `162.158.x.x`. If every new row shows a Cloudflare
      range, the Nginx real IP block did not deploy; redo Phase 5a.
- [ ] Cron jobs: after the next hour boundary, check the cashback log and
      `pm2 logs pasha9-web` for cron activity; the loopback calls from
      Phase 4 must be returning 200.
- [ ] Certbot renewal, MANDATORY: with "Always Use HTTPS" at the edge,
      HTTP-01 challenges reach the origin over https after a 301, and
      renewals only work because Phase 5a serves the acme-challenge
      webroot on both 80 and 443 and Phase 5b switched the renewal to
      the webroot authenticator. Prove it now; do not sign off this
      checklist while the dry run fails:

```bash
sudo certbot renew --dry-run
```

If the dry run fails, or a real renewal ever fails later, fall back to
DNS-01 with a Cloudflare API token, which needs no inbound HTTP at all
(create a token with Zone.DNS edit permission for pasha9.com, store it
in `/root/.secrets/cloudflare.ini` as
`dns_cloudflare_api_token = <token>`, `chmod 600` the file), then:

```bash
sudo apt install -y python3-certbot-dns-cloudflare && sudo certbot certonly --dns-cloudflare --dns-cloudflare-credentials /root/.secrets/cloudflare.ini -d pasha9.com -d www.pasha9.com --deploy-hook "systemctl reload nginx"
```

---

## Phase 7: optional later steps

1. **Cloudflare Origin CA certificate.** Replace the Let's Encrypt cert
   with a Cloudflare Origin CA cert (15 year validity, no renewals to
   babysit). Generate it in SSL/TLS > Origin Server, install the pair on
   the VPS, point the `ssl_certificate` lines in
   `/etc/nginx/sites-available/pasha9` at it, keep Full (strict). The spot
   is marked with a comment in `nginx/pasha9.conf`. Only do this after the
   firewall lockdown; an Origin CA cert is only trusted by Cloudflare.
2. **Fresh origin IP.** 69.62.76.83 has been public in DNS history for
   months, so attackers can find it regardless of Cloudflare. Ask the
   host for a new IP (or a second IP), move the site to it, update the
   Cloudflare A record, and never publish the new IP anywhere. The ufw
   lockdown already blunts direct attacks in the meantime.
3. **Pro plan WAF.** The Pro plan adds the full managed ruleset and lets
   Super Bot Fight Mode distinguish verified bots; worth it once revenue
   justifies it.
4. **Cloudflare rate-limiting rules** on `/api/auth/login`,
   `/api/admin/login`, and the OTP endpoints (`/api/auth/otp/request`,
   `/api/auth/otp/verify`, the `/api/auth/forgot*` family). The app has
   its own in-memory limiter, but edge rules stop credential stuffing
   before it consumes origin resources.

---

## Rollback

Both moves reverse with one command each; you can do either without the
other.

- **Bypass Cloudflare instantly:** in the Cloudflare dashboard, DNS app,
  click the orange cloud on the `pasha9.com` and `www` records so they
  turn grey (DNS only). Traffic goes straight to the origin within the
  record TTL. Remember: if the ufw lockdown is active, ALSO disable the
  firewall (next line) or players cannot reach the origin directly.
- **Disable the firewall:**

```bash
sudo ufw disable
```

To restore later, re-run `sudo ./scripts/cloudflare-ufw.sh`.

---

## Required app-code follow-ups (report only; apps/web is owned by another team right now)

The app derives the client IP by taking the FIRST entry of
`x-forwarded-for` and only falling back to `x-real-ip`:

- `apps/web/lib/auth/session.ts` (`getClientIp`, line 218): used by
  activity logging and admin guards.
- `apps/web/app/api/providers/[providerKey]/callback/route.ts` (local
  `getClientIp`, line 26): used by the provider callback IP WHITELIST, a
  security control.
- About a dozen auth routes parse `x-forwarded-for` directly with the
  same first-entry pattern: `api/auth/login` rate limiting keys,
  `api/auth/otp/request`, `api/auth/otp/verify`, the `forgot`/`reset`
  family, and `api/support/tickets`.

Verdict for the cutover: these features KEEP WORKING behind Cloudflare
once the Nginx real IP block from Phase 5a is live, because Nginx rebuilds
`X-Real-IP` and appends the restored real address to `X-Forwarded-For`.
For normal browser traffic the first entry is the real player IP.

However, the first-entry parse is spoofable and always has been: any
caller can send its own `X-Forwarded-For: 1.2.3.4` header and the app
will log and rate-limit against the fake address, because upstream
proxies APPEND to that header rather than replace it. Behind Cloudflare
this stays exactly as spoofable as it is today, no worse, but it should
be fixed:

- Recommended change (for the owning team): prefer `x-real-ip` (which
  Nginx sets itself and a client can never influence) over
  `x-forwarded-for`, or take the LAST entry of `x-forwarded-for` instead
  of the first. Highest priority is the provider callback whitelist check,
  since that one is a security gate rather than telemetry.
