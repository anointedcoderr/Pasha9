# Pasha 9 launch checklist

Tick every item before flipping any provider to Live and inviting
real players. Order matters: top items must already be green before
the next group can be tested.

Built by Anointed Coder.

## Server & networking

- [ ] `PUBLIC_SITE_URL=https://pasha9.com` in `.env`.
- [ ] `SECRETS_KEY` in `.env` is at least 32 bytes (used by
      `lib/crypto/aead.ts` for at-rest encryption).
- [ ] `DATABASE_URL` points at the production Postgres, not staging.
- [ ] HTTPS valid on `pasha9.com`. `curl -I https://pasha9.com`
      returns 200/302 and a valid cert.
- [ ] PM2 running: `pm2 list` shows `pasha9-web Online`.
- [ ] `timedatectl status` shows `NTP service: active` and
      `System clock synchronized: yes`.
- [ ] VPS public IPs are added to the provider portal's IP
      whitelist (every IP that could send outbound to the provider
      AND every IP the provider could see us callback from).
- [ ] Postgres backups scheduled (daily dump minimum).

## Provider configuration

- [ ] `/admin/providers/<id>` Setup tab saved without errors.
- [ ] Test encryption returns OK.
- [ ] Test connection returns OK.
- [ ] Callback URL starts with `https://pasha9.com/api/providers/<key>/callback?key=•••`.
- [ ] Return URL starts with `https://pasha9.com/games/provider/return`.
- [ ] No rose warning on the Callback readiness panel.
- [ ] Health checklist: every required check is green
      (URL https + public, callback secret set, catalog imported,
      callback received, transaction processed). Duplicate-protection
      tested counts as optional but should be green before Live.
- [ ] `launchMinBalance` set to a non-zero value (recommended 1 BDT)
      OR explicitly accepted as 0.

## Catalog

- [ ] `pnpm --filter @pasha9/database import:jili` ran cleanly.
- [ ] Final report shows expected inserted / updated / skipped
      counts. Skipped rows have a non-numeric `gameUid`.
- [ ] `/admin/providers/<id>` Games tab → Total tile matches the
      importer's reported total.
- [ ] Provider chip stayed at **Maintenance** through the import.

## Wallet pipeline

- [ ] **Test launch** on a sample game returns `code 0`.
- [ ] **Simulate callback** with `bet 10 / win 0` →
      `status=accepted`, wallet decrements by 10, ProviderTransaction
      row written.
- [ ] Re-run the same gameRound → `status=duplicate`, wallet
      unchanged.
- [ ] Simulate `bet 0 / win 20` → wallet increments by 20,
      `status=accepted`.
- [ ] Block a test user, simulate a callback for them →
      `status=rejected`, `errorCode=USER_BLOCKED`, no wallet
      movement.
- [ ] Send a synthetic callback with a `member_account` we never
      mapped → 4xx, `errorCode=MEMBER_ACCOUNT_NOT_FOUND`, no wallet
      movement.

## Rollback

- [ ] As super_admin, run Transactions tab → Rollback on an accepted
      row with a real reason. Result panel shows wallet before /
      after + the adjust delta.
- [ ] Re-run Rollback on the same row → `ALREADY_ROLLED_BACK`.
- [ ] `/admin/activity` shows `PROVIDER_TX_ROLLBACK` with the
      operator's id.

## Public surface

- [ ] Homepage rail shows live provider cards with imagedelivery
      thumbnails + provider chip + brand badge.
- [ ] `/games/provider` lobby paginates through every active game.
      Search + category pills work.
- [ ] Zero-balance player click → DepositRequiredModal opens, no
      `/launch` POST hits the wire.
- [ ] Funded player click → window navigates to the real provider
      launch URL.
- [ ] Network panel shows only `{ launchUrl, mode }` in the launch
      response. No token, no secret, no encrypted blob, no internal
      cuid.
- [ ] One real player completes a round and the wallet event is
      visible on the Transactions tab.

## Reports

- [ ] `/admin/providers/<id>` Reports tab returns non-zero totals
      for the smoke-test period.
- [ ] **Export CSV** downloads a `provider-<key>-report.csv` with
      header rows, daily series, top games and top users.

## Regression (must still pass)

- [ ] Homepage, login, register render with no client error.
- [ ] Deposit + Withdrawal pages render and accept submissions.
- [ ] Native games (dice / mines / crash / keno / roulette / slots)
      bet + settle.
- [ ] Lotto purchase + transfer flow.
- [ ] Bonus turnover progresses on both native AND provider bets
      (visible on `/dashboard/bonus`).
- [ ] Affiliate dashboard loads.
- [ ] Reports, recovery, staff, security, notifications,
      integrations admin pages load.
- [ ] Mobile drawer renders. No horizontal overflow on the
      provider lobby.

## Secrets check (final pass)

- [ ] No `localhost`, no `127.0.0.1` in the production `.env`.
- [ ] No API token or secret in any committed file.
- [ ] No API token in any 4xx / 5xx response body (`grep` server
      logs).
- [ ] Browser DevTools → Application → Cookies has no provider
      token / secret cookie.

## Provider live

Only after every box above is checked:

- [ ] Toggle the provider chip to **Live**.
- [ ] `/api/providers` (public) lists the provider.
- [ ] Five real player launches, five real rounds, five real
      callbacks observed in Logs.
- [ ] Rotate the provider token from the portal (if the portal
      supports it) and re-paste in Setup. confirms the operator
      can rotate without engineering involvement.

