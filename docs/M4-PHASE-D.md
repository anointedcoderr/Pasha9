# M4 Phase D - Promotion banners, claim flow, ImageUpload widget

Phase D ships the rest of the promotion stack:

- Operator-managed promotion banners + terms (desktop / mobile /
  thumbnail / background, EN + BN terms).
- Reusable `<ImageUpload>` widget driven by `UploadConstraint` rows
  so every banner field shows the required dimensions, accepted MIME
  types, byte cap, EN/BN helper note, and warns the operator on
  wrong dimensions before posting the file.
- Auth-aware Claim button on the public `/promotions` page.
- Typed `POST /api/promotions/[id]/claim` flows that respect the
  `PromotionClaim @@unique` and grant through the existing bonus
  engine so wallet / locked balance / Transaction ledger behave
  identically to deposit bonuses.

## Schema changes

None. Phase D only reads / writes the `BonusRule` banner + terms
columns added in Phase A and the `PromotionClaim` table added in
Phase A.

## Files changed

### New

- `apps/web/components/admin/ImageUpload.tsx` - reusable widget.
- `apps/web/app/api/admin/upload-constraints/[categoryKey]/route.ts` - GET single constraint.
- `apps/web/lib/promotions/claim.ts` - typed claim service.
- `apps/web/app/api/promotions/[id]/claim/route.ts` - player claim endpoint.
- `docs/M4-PHASE-D.md`.

### Modified

- `apps/web/lib/uploads/storage.ts` - 9 new categories (`banners_mobile`, `promo_desktop`, `promo_mobile`, `promo_thumbnail`, `promo_background`, `ambassadors`, `sponsors`, `payment_icons`, `provider_banners`) with per-category MIME + byte limits.
- `apps/web/app/api/admin/uploads/route.ts` - ALLOWED list extended.
- `apps/web/app/api/admin/bonus-rules/route.ts` - schema, serializer + create now handle `bannerDesktopUrl / bannerMobileUrl / thumbnailUrl / backgroundUrl / termsEn / termsBn`. Serializer surfaces `claimCount` (PromotionClaim) + `grantCount` (UserBonus) for the admin card.
- `apps/web/app/api/admin/bonus-rules/[id]/route.ts` - PATCH handles the same fields.
- `apps/web/app/api/content/promotions/route.ts` - returns the new banner / terms columns, per-visitor `claimedToday` / `claimedThisWeek` / `lastClaimAt` flags, and a `disabledReason` chip for `first_deposit`, `vip`, `referral`, `invite`, `manual`.
- `apps/web/app/(site)/promotions/page.tsx` - rewritten for auth-aware claim, banner imagery (`<picture>` desktop / mobile), collapsible Terms section, inline result toast.
- `apps/web/app/(admin)/admin/bonuses/page.tsx` - editor adds a Presentation Assets section using `<ImageUpload>` (4 fields) + EN / BN Terms textareas. Rule cards now show banner preview, `Claims` count, and forward banner / terms fields to PATCH.

## How promotion claim works

`POST /api/promotions/[id]/claim` requires a signed-in active user
(returns 401 otherwise) and is rate-limited at 10 calls per 10 min
per user. The endpoint delegates to `lib/promotions/claim.ts`.

`runPromotionClaim(input)`:

1. Loads the BonusRule. Returns `NOT_FOUND`, `INACTIVE` or
   `OUT_OF_WINDOW` if the rule is missing / hidden / outside its
   `startsAt`..`endsAt` window.
2. Type-routes:
   - `first_deposit` -> `AUTO_FIRST_DEPOSIT` ("credits automatically
     after first qualifying deposit").
   - `referral` -> `AUTO_REFERRAL`.
   - `vip` -> `VIP_NOT_CONFIGURED`.
   - `invite` / `manual` -> `NOT_MANUAL` (admin-only).
   - `daily` / `weekly` / `reload` / `promo` -> proceed to claim.
3. Picks the `dayBucket`:
   - `daily / reload / promo` -> `YYYY-MM-DD` (UTC day).
   - `weekly` -> `YYYY-Www` (ISO week).
4. Verifies the player has a `Wallet` row (returns `WALLET_NOT_FOUND`
   otherwise so the player knows to deposit first).
5. Computes `flatPayout`: uses `BonusRule.amount` (flat). If that is
   zero but `percentage > 0` and `maxBonus > 0`, derives `maxBonus *
   percentage / 100` as the payout. Caps at `maxBonus`. Returns
   `NOT_ELIGIBLE` if the final payout is zero.
6. Inside one transaction:
   - Creates the `PromotionClaim` row first. The
     `@@unique([userId, ruleId, dayBucket])` index blocks duplicate
     attempts at the database layer.
   - Calls `grantBonusInTx(tx, ...)` (existing bonus engine) which
     creates the `UserBonus` grant, credits `Wallet.bonusBalance +
     lockedBalance`, writes a `Transaction(type='bonus')` row, and
     releases immediately if the rule has no turnover.
   - Patches the claim row with the resulting `bonusGrantId`.
7. On unique-constraint collision (`P2002`) the endpoint returns
   `ALREADY_CLAIMED` with the previous claim id + grant id so the UI
   can show "you already claimed this".

ActivityLog gets two action keys: `PROMOTION_CLAIM_GRANT` on success,
`PROMOTION_CLAIM_REJECT` on every failure (with the error code in
meta) so operators can audit attempts.

## How `<ImageUpload>` validation works

On mount the widget fetches
`/api/admin/upload-constraints/[categoryKey]`. The endpoint returns
the matching `UploadConstraint` row, or a safe `fallback: true`
default (4 MB, PNG/JPG/WEBP, no dimension lock) if the row is
missing.

Per upload:

1. **MIME** check against `acceptedMime` (comma-separated list).
2. **Byte** check against `maxBytes`.
3. **Dimension** check when both `requiredWidth` and `requiredHeight`
   are set. The widget decodes the file via `Image.naturalWidth /
   naturalHeight` and compares before posting.
4. POST to `/api/admin/uploads` with `file` + `category`. The
   upload endpoint enforces the same MIME / byte rules server-side
   (storage.ts maps).
5. On success the widget calls `onChange(url)` with the
   `/uploads/<category>/...` URL. Operator can `Open` to preview or
   `Clear` to remove (sends `null`).
6. All failures surface as a single-line warning above the picker
   with the offending value (`Image is 1200x600. Required 1440x480.
   Resize and try again.`).

The constraint header bar always renders three chips:
required-dimension, accepted-MIME list, max bytes; plus the EN or BN
helper note. When the constraint row is missing the widget shows a
`constraint missing, defaults applied` chip so the operator knows
they should seed the row.

## How My Bonuses works

`/dashboard/bonus` already existed (shipped in M2D) and reads
`/api/bonuses/me`. No Phase D changes were needed:

- Three summary tiles: Released, Locked, Forfeited.
- Active grants section: each row shows the rule name, type, amount,
  turnover progress bar (progress / required, percentage), expiry
  countdown, source. Empty state links to `/deposit`.
- Available promotions section: lists the same `BonusRule` rows
  surfaced on `/promotions`.
- History section: completed / expired / cancelled grants.

Promotion claims granted via Phase D add a `UserBonus` row with
`sourceType='promotion_claim'` and `sourceId=<PromotionClaim.id>` so
they appear in the Active grants section like any other bonus.

## VPS deploy commands

```bash
cd /var/www/pasha9/app
git fetch origin
git reset --hard origin/m1-production
unset NODE_ENV
pnpm install --prod=false
set -a; source .env; set +a

pnpm exec prisma generate --schema packages/database/prisma/schema.prisma
pnpm check:branding
pnpm build
pm2 restart pasha9-web --update-env
pm2 save
pm2 status
```

No `prisma db push`. No seed re-run required (Phase A
`UploadConstraint` rows for `promo_desktop`, `promo_mobile`,
`promo_thumbnail`, `promo_background` are already in place).

## Test checklist

1. `/promotions` opens. No fake claim behaviour.
2. Guest clicks Claim. The page routes to `/?signup=1`.
3. Signed-in player clicks Claim on a Daily promo. Toast says
   "X BDT bonus credited to your account."
4. Second click on the same Daily promo today returns
   `ALREADY_CLAIMED`. Wallet does not move.
5. Weekly promo: claim once. Second click in the same ISO week
   returns `ALREADY_CLAIMED`. Next ISO week the button unlocks.
6. VIP-type rule: claim returns `VIP_NOT_CONFIGURED`. Card chip
   shows the message inline.
7. First-deposit rule: claim returns `AUTO_FIRST_DEPOSIT`. Card
   chip shows "Auto-credited on first deposit".
8. Promotion banner: admin opens a rule, uploads a desktop banner
   that is the wrong dimensions - widget warns inline and does NOT
   upload.
9. Same admin uploads the correct dimensions. Widget calls back
   with the `/uploads/promo_desktop/...` URL. Save. Public
   `/promotions` card now uses the uploaded banner.
10. Upload a 10 MB image to a 1 MB-capped category - widget warns
    `File is 10 MB. Max 1 MB.` and refuses to send it.
11. Upload a `.txt` file - widget warns `Unsupported file type`.
12. Admin saves Terms EN + BN. Public `/promotions` card shows the
    collapsible Terms section in the active language.
13. Admin Bonus Rules tab shows banner preview thumbnail + Claims
    count on each card.
14. `/dashboard/bonus` shows the granted promo claim as an active
    grant with the correct turnover progress.
15. Empty `/dashboard/bonus` (new user, no grants) shows the
    "No active grants right now" empty state plus a link to deposit.
    No fake data.
16. Phase C deposit flow still works.
17. User transaction history still shows approved deposit, bonus,
    bet and win records (Phase C hotfix preserved).
18. Phase B homepage sections still render.
19. JILI launch still works.
20. Provider callback simulation (bet 10 + win 20 same gameRound)
    still creates two accepted `ProviderTransaction` rows.
21. Admin sidebar stays fixed.
22. No application error overlay on `/`, `/promotions`,
    `/dashboard/bonus`, `/admin`, `/admin/bonuses`.
23. Mobile 320 / 375 / 430: promo banner does not overflow; Claim
    button reachable above the bottom nav (page reserves
    `pb-24 md:pb-6`).

## What remains for Phase E

Referral redesign:

- Replace mock stats on `/(site)/referral/page.tsx` with real data
  from `AffiliateCommission` + new `ReferralBalance` / `ReferralClaim`
  rows.
- Build `/api/me/referrals` (stats + claim list + invited users) and
  `/api/me/referrals/claim` (player-initiated transfer from referral
  balance to main wallet, gated by cadence + turnover settings).
- Backfill script that initialises `ReferralBalance` for existing
  affiliates from their accumulated `AffiliateCommission` rows.
- Weekly cron `/api/cron/referral-mature` that moves matured
  commissions from `pendingAmount` to `claimableAmount`.
- Admin page `/admin/referral-claims` showing pending / claimable /
  claimed ledger + cadence settings (`weekly` / `monthly` / `manual`
  / `auto`).
