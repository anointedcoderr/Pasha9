# Provider setup runbook

Step-by-step for an operator to add an external game provider to
Pasha 9 and ramp it to Live. Today the only adapter shipped is
`igamingapis` (JILI). Future adapters follow the same flow.

Built by Anointed Coder.

## 1. Create the provider row

1. Sign in as super_admin.
2. `/admin/providers` → **Add provider**.
3. Fields:
   - **Name**: human label (e.g. `iGamingAPIs / JILI`).
   - **Provider key**: URL slug, lowercase, used in
     `/api/providers/<key>/...` (e.g. `igamingapis`).
   - **Adapter**: pick `igamingapis` from the dropdown.
   - **API base URL**: `https://igamingapis.live/api/v1`.
   - **API token**: paste from the provider portal.
   - **API secret**: paste from the provider portal. Pick the
     correct `secretEncoding` (almost always `utf8` for a
     32-character key).
   - **Callback path**: leave blank to default to
     `/api/providers/<providerKey>/callback`.
   - **Callback secret**: invent a strong random string (≥ 32
     chars). The provider will send this back as `?key=`.
   - **IP whitelist**: comma list of public IPs we expect callbacks
     from. Leave blank to accept any (dangerous in prod).
   - **Clock skew (sec)**: 30 is sane.
   - **Currency**: `BDT`.
   - **Language**: `bn`.
   - **Callback response mode**: `updated_balance` (default) or
     `net_loss_amount`. must match the provider's expectation.
   - **Launch mode**: `redirect` for full-page, `iframe` if the
     provider expects iframe embed.

After save, the provider starts at **Maintenance**.

## 2. Pre-flight from Setup

1. **Test encryption**. Round-trips a sentinel through AES-256-ECB
   with the stored secret. Confirms key length + encoding.
2. **Test connection**. Hits the adapter's `healthCheck`. Expect
   `Health OK`.
3. **Public base URL** = `https://pasha9.com` (or env value).
   Inspect the Callback readiness panel: both URLs must be HTTPS
   and not localhost / private.
4. **Launch minimum balance** = 1 BDT (recommended) so the lobby
   opens DepositRequiredModal before round-tripping a guaranteed
   failure to upstream.
5. Copy the Callback URL + Return URL with the **Copy** buttons.
   Paste them into the provider portal's endpoint configuration.
6. Make sure every public VPS IP is on the provider portal's IP
   whitelist (and on this provider's IP whitelist field too).

## 3. Brand + catalog

1. **Brands** tab → run **Sync brands**. If the upstream catalog
   is gated (HTML response), use **Add Manual Brand** with the
   brandKey supplied by the provider (e.g. `JILI`).
2. **Games** tab. Two options:
   - **Sync games** with a brand_id once the upstream JSON catalog
     is reachable.
   - **Manual import** (single or bulk CSV/JSON) when the operator
     has the catalog out-of-band.
   - For JILI specifically: run `pnpm --filter @pasha9/database import:jili`
     with the authoritative CSV.

## 4. End-to-end smoke

1. **Setup → Simulate callback**. Pick any imported gameUid, leave
   user blank, bet 10, win 0 → wallet decrements, `status=accepted`.
2. Re-run with the same gameRound → `status=duplicate`, wallet
   unchanged.
3. **Games → Test launch** on a sample row. Provider responds
   `code 0 / msg Game launched successfully`.
4. Test from the public site as a funded player. Click the game in
   the lobby or the full `/games/provider` page. Expect navigation
   into the provider's launch URL.
5. Click as a zero-balance player. Expect DepositRequiredModal
   instead of a network call to upstream.

## 5. Go live

1. **Health checklist** on the Setup tab is green except for any
   optional items the operator deliberately skipped.
2. Toggle the provider chip to **Live**.
3. Reload `/games/provider`. The catalog is browsable, paginated,
   searchable, filterable by category.

## 6. Routine maintenance

- **Re-import catalog** when the provider adds titles: rerun the
  importer with a fresh CSV.
- **Rotate token / secret**: paste new values into Setup. Empty
  fields preserve existing values.
- **Rollback a bad callback**: Transactions tab → Rollback action
  (super_admin only). Reason required. Wallet correction is internal
  to Pasha 9; co-ordinate with the provider for their side.
- **Investigate drift**: Setup → Test launch → the timestamp panel
  shows `ageMs`. > 1500 means VPS clock is slow or the request
  itself is slow. Check NTP + system load.

