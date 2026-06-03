# M4 Phase C - Deposit flow, notice popup, proof upload, tier bonuses, mandatory reject reason

Phase C wires the deposit player journey end-to-end:

- Pre-deposit notice popup the operator can write and toggle from a new
  admin page.
- Live tier-based bonus preview while the player types the amount.
- Real payment-proof file upload through `/api/deposits/proof`.
- Upay added to the public payment methods alongside bKash / Nagad /
  Rocket / Bank / USDT.
- Admin deposit reviewers see the snapshot bonus + total credit + proof
  link in the queue table, and rejections now require a written reason
  that is saved to `Deposit.rejectionReason` and visible to the player.

## Schema changes

Three additive columns on `Deposit` (`prisma db push` safe, no data
migration):

| Column | Type | Purpose |
|---|---|---|
| `bonusPercentage` | `Decimal?(5,2)` | Bonus tier percentage at submit time |
| `bonusAmount` | `Decimal?(14,2)` | Calculated bonus amount at submit time |
| `rejectionReason` | `String?` | Player-visible reject reason (separate from internal `adminNote`) |

No new models in Phase C. `DepositNotice` and `DepositBonusTier` were
already added in Phase A.

## How the deposit notice works

`/admin/deposit-notice` is the editor:

- Global toggle row at the top flips `SystemSetting.deposit_notice_enabled`.
- Each `DepositNotice` row carries EN + BN title, body, CTA label, and
  position. Per-row enabled flag.
- The body rendering preserves line breaks (`whitespace-pre-wrap`) so
  the operator can write a numbered list with blank lines between
  items.

Public flow:

- Deposit page calls `/api/content/deposit-notice` on mount.
- If the global flag is on AND at least one row is enabled AND the
  player has not acknowledged the popup in this tab session, the
  popup opens. Acknowledgement is stored in `sessionStorage` under
  `pasha9_deposit_notice_ack` so the popup stays closed for the rest
  of the session, then re-prompts on the next browser tab.
- Acknowledgement is per-tab session, not persisted across sessions:
  the player still sees the notice once per visit.
- The popup is full-screen on mobile (anchored to the bottom) with a
  scrolling body and a sticky CTA at the foot. It uses no portal-prone
  Radix primitives so it cannot collide with the DOM mutation guards.

## How deposit bonus tiers work

`/admin/deposit-bonus-tiers` is a flat table. Each row has min deposit,
percentage, position, active toggle.

On save, the admin endpoint calls `syncTierToBonusRule(tier)` which
upserts a `BonusRule` of `type='reload'` with stable
`code='deposit_tier_<id>'`. The rule carries:

- `percentage` mirrored from the tier
- `minDeposit` mirrored from the tier
- `priority = max(100, floor(minDeposit / 100))` so the biggest matching
  tier wins on approval
- `status` mirrors the tier's `isActive` (active vs hidden)
- `meta.managedBy = 'deposit_bonus_tier'` so future tooling can spot
  managed rows

The existing `applyDepositBonuses` engine picks the highest-priority
matching reload rule for every deposit, so no engine changes were
needed. Re-saving a tier upserts in place (no duplicates). Deleting a
tier drops the matching BonusRule.

There is also a `Resync rules` button in the admin that calls
`/api/admin/deposit-bonus-tiers/resync`, which re-runs the sync for
every tier AND drops any orphaned `deposit_tier_*` BonusRule rows
whose tier no longer exists.

Live preview:

- `/api/content/deposit-preview?amount=N` returns the best-matching
  active tier and the computed `bonusAmount` + `totalCredit`.
- The deposit form debounces preview lookups by 250 ms while the
  player types. Zero amount or no matching tier shows an info line
  instead of a green box so the player is not misled.
- The same `pickBestTier` helper runs on `/api/deposits` POST so the
  promised values are stamped on the Deposit row at submit time.

## How proof upload works

New endpoint `/api/deposits/proof`:

- Multipart `file` field, authenticated player only.
- Rate-limited to 10 uploads per 10 minutes per user.
- Reuses `lib/uploads/storage.ts` with category `payment-proofs`:
  - Accepted MIME: `image/png`, `image/jpeg`, `image/webp`, `application/pdf`.
  - Max 8 MB.
  - Stored under `/uploads/payment-proofs/<nanoid>-<stem>.<ext>` and
    served by Nginx.
- Response includes the public URL only (never the absolute disk
  path). The deposit form attaches it as `proofUrl` on the next
  submit.
- `/api/deposits` now validates that `proofUrl` starts with `/uploads/`
  so the form cannot inject an off-site URL.

Admin deposits table now renders a `View` link for any deposit with a
`proofUrl` so reviewers see the screenshot inline.

## Reject reason is now required

`/api/admin/deposits/[id]/reject` schema requires
`rejectionReason` (min 3 chars). When missing it returns
`400 REASON_REQUIRED`. The reason is stored on `Deposit.rejectionReason`
and surfaced to the player wherever deposit history is shown.

Admin deposits page client-side guards the submit so the operator sees
the `Rejection reason is required` toast instantly. The shared
`ApprovalModal` now relabels the textarea to `Rejection reason` (red
border when the input is non-empty but too short) for reject actions.

A best-effort `sendSms` fires the `deposit_rejected` template so the
player sees the reason via SMS. Failure is logged but never blocks
the admin action.

## Files changed

### Schema + seed
- `packages/database/prisma/schema.prisma` - `Deposit` gets 3 optional cols.
- `packages/database/prisma/seed.ts` - PaymentMethod seed adds Upay (position 4).

### New libs
- `apps/web/lib/bonuses/deposit-tiers.ts` - `pickBestTier`, `syncTierToBonusRule`, `removeTierBonusRule`, `resyncAllTiers`.

### Public APIs
- `apps/web/app/api/content/deposit-notice/route.ts` - public read (gated by SystemSetting).
- `apps/web/app/api/content/deposit-preview/route.ts` - public live preview.

### Player API
- `apps/web/app/api/deposits/proof/route.ts` - multipart upload to `payment-proofs`.
- `apps/web/app/api/deposits/route.ts` - rewritten to snapshot bonus + validate proofUrl prefix.

### Admin APIs
- `apps/web/app/api/admin/deposit-notices/route.ts` (GET + POST).
- `apps/web/app/api/admin/deposit-notices/[id]/route.ts` (PATCH + DELETE).
- `apps/web/app/api/admin/deposit-notices/settings/route.ts` (PATCH global toggle).
- `apps/web/app/api/admin/deposit-bonus-tiers/route.ts` (GET + POST + materialise).
- `apps/web/app/api/admin/deposit-bonus-tiers/[id]/route.ts` (PATCH + DELETE + sync).
- `apps/web/app/api/admin/deposit-bonus-tiers/resync/route.ts` (POST resync sweep).
- `apps/web/app/api/admin/deposits/route.ts` - returns bonusPercentage / bonusAmount / totalCredit / rejectionReason.
- `apps/web/app/api/admin/deposits/[id]/reject/route.ts` - reason required; sends SMS.

### Admin pages
- `apps/web/app/(admin)/admin/deposit-notice/page.tsx` - notice editor + global toggle.
- `apps/web/app/(admin)/admin/deposit-bonus-tiers/page.tsx` - tier editor + resync button.
- `apps/web/app/(admin)/admin/deposits/page.tsx` - Bonus + Total credit + Proof columns; mandatory reason validation.
- `apps/web/components/admin/ApprovalModal.tsx` - relabel textarea for reject actions.

### Public page
- `apps/web/app/(site)/deposit/page.tsx` - DB-driven methods, notice popup, live bonus preview, real proof upload.

### Nav + i18n
- `apps/web/components/admin/AdminSidebar.tsx` + `AdminMobileDrawer.tsx` - Deposit Notice + Deposit Bonus Tiers entries.
- `apps/web/lib/constants/routes.ts` - `ROUTES.admin.depositNotice`, `depositBonusTiers`.
- `apps/web/lib/i18n/dictionaries/en.json` + `bn.json` - labels.

### Doc
- `docs/M4-PHASE-C.md`.

## VPS deploy commands

```bash
cd /var/www/pasha9/app
git fetch origin
git reset --hard origin/m1-production
unset NODE_ENV
pnpm install --prod=false
set -a; source .env; set +a

# Push the 3 additive Deposit columns. Safe.
pnpm exec prisma generate --schema packages/database/prisma/schema.prisma
pnpm exec prisma db push --schema packages/database/prisma/schema.prisma

# Re-run the seed to upsert the Upay PaymentMethod row.
pnpm --filter @pasha9/database seed

pnpm check:branding
pnpm build
pm2 restart pasha9-web --update-env
pm2 save
pm2 status
```

## Test checklist

1. `/deposit` opens without error. No mock methods leak.
2. Upay appears in the deposit methods list (after re-running the seed
   or inserting an Upay PaymentMethod row).
3. Enable the global deposit-notice toggle and enable at least one
   notice row. `/deposit` shows the popup before the form. After
   tapping `I understand` the popup stays closed for the rest of the
   tab session.
4. Disable the global toggle. `/deposit` loads straight into the form.
5. Add a tier in `/admin/deposit-bonus-tiers` (1000 = 3%). Type 1000
   into the deposit form. Preview shows 3% / +30 / total 1030.
6. Add tier 5000 = 5%, 10000 = 8%. Type 10000. Preview shows 8% / +800
   / total 10800.
7. Submit the deposit (with proof). New deposit row carries the
   bonus snapshot.
8. Upload a `.txt` file. Upload widget shows `Unsupported file type`.
9. Upload a 12 MB file. Upload widget shows `File too large`.
10. Submit without a proof. Upload field is optional; submit still
    works.
11. `/admin/deposits` shows Bonus column (`+ N (%)`), Total credit
    column, Proof column with `View` link.
12. Click Reject without typing. Toast says `Rejection reason is required`.
13. Type a reason and reject. Player gets the SMS; admin row shows
    rejected.
14. Approve a deposit. The bonus engine runs as before. Lottery
    accrual + affiliate commissions still hook in (existing behaviour
    unchanged).
15. JILI launch still works.
16. Provider callback simulation: bet 10 then win 20 on the same
    gameRound still creates two accepted `ProviderTransaction` rows.
17. Homepage sections from Phase B still render.
18. Admin sidebar stays fixed.
19. No application error overlay on `/`, `/deposit`, `/admin`,
    `/admin/deposits`, `/admin/deposit-notice`, `/admin/deposit-bonus-tiers`.
20. Mobile at 320 / 375 / 430: notice popup scrolls inside; form
    fields wrap; payment method buttons reflow; bonus preview is
    readable.

## What remains for Phase D

Promotion logic + banner upload validation:

- Wire `BonusRule.bannerDesktopUrl / bannerMobileUrl / thumbnailUrl /
  backgroundUrl / termsEn / termsBn` (Phase A columns) through the
  admin promotion editor.
- Typed claim flows behind `/api/promotions/[id]/claim` for
  `first_deposit` / `daily` / `weekly` / `vip` / `cashback`, idempotent
  via `PromotionClaim @@unique([userId, ruleId, dayBucket])`.
- Gate the public Claim button on auth state so logged-in users never
  see the login modal.
- Build the `My Bonuses` user page (`/dashboard/bonus`) showing active /
  claimed / expired and wager progress.
- Reusable `<ImageUpload>` widget driven by `UploadConstraint` rows so
  every banner field shows required dimensions, accepted MIME, max
  bytes, and warns on wrong dimensions.
