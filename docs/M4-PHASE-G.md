# M4 Phase G - About + sponsors + public payment-method management

Phase G replaces the last hardcoded public arrays (`AMBASSADORS`,
`SPONSORS`, `PAYMENT_METHODS` in `Footer.tsx`) with DB-backed CRUD
sitting on the Phase A `BrandAmbassador`, `Sponsor`, and
`PublicPaymentMethod` tables. Each block is wrapped in a
`PublicSection` row so the operator can hide the whole strip or
rename it (EN + BN) without touching code.

## Schema changes

None. Phase G only reads/writes Phase A tables.

## Files changed

### New

- `apps/web/app/api/content/about-display/route.ts` - public read for the three blocks.
- `apps/web/app/api/admin/brand-ambassadors/route.ts` + `[id]/route.ts` - GET / POST / PATCH / DELETE.
- `apps/web/app/api/admin/sponsors/route.ts` + `[id]/route.ts` - same shape.
- `apps/web/app/api/admin/public-payment-methods/route.ts` + `[id]/route.ts` - same shape.
- `apps/web/app/api/admin/public-sections/route.ts` + `[id]/route.ts` - GET list (group=about | payment_display), PATCH single row.
- `apps/web/components/admin/PublicSectionHeader.tsx` - reusable inline editor for the matching PublicSection row.
- `apps/web/app/(admin)/admin/brand-ambassadors/page.tsx`
- `apps/web/app/(admin)/admin/sponsors/page.tsx`
- `apps/web/app/(admin)/admin/public-payment-methods/page.tsx`
- `docs/M4-PHASE-G.md`

### Modified

- `apps/web/components/site/Footer.tsx` - drops `AMBASSADORS`, `SPONSORS`, `PAYMENT_METHODS` constants; fetches `/api/content/about-display` and renders the three blocks from the DB.
- `apps/web/components/admin/AdminSidebar.tsx` + `AdminMobileDrawer.tsx` - "Brand Ambassadors", "Sponsorships", "Public Payment Display" entries in the Content and Media group.
- `apps/web/lib/constants/routes.ts` - `ROUTES.admin.brandAmbassadors`, `sponsors`, `publicPaymentMethods`.
- `apps/web/lib/i18n/dictionaries/en.json` + `bn.json` - the three new nav labels.

## How ambassador management works

`/admin/brand-ambassadors`:

- Top of the page: `PublicSectionHeader` strip exposes the matching
  `about_ambassadors` PublicSection row. Operator can toggle
  `Visible / Hidden` and edit EN + BN title + subtitle inline.
  Hidden = the whole ambassador block disappears from the public
  footer, regardless of how many ambassadors are active.
- Per-row card: name EN + name BN + subtitle / year + `<ImageUpload>`
  bound to category `ambassadors` (constraint enforced server-side).
- Per-row controls: Active/Hidden toggle (removes from public when
  Hidden), Up/Down reorder (swaps adjacent positions), Save (only
  triggers the patch with the dirty fields), Delete (confirm
  prompt).
- New row defaults: `nameEn='New ambassador'`, `subtitle='2025/2026'`,
  position appended at the end (max + 10), `isActive=true`.

All admin endpoints require `settings.write` and record an
`AMBASSADOR_CREATE / PATCH / DELETE` ActivityLog entry.

## How sponsor management works

`/admin/sponsors`: identical shape to `/admin/brand-ambassadors`,
backed by the `Sponsor` table. PublicSectionHeader binds to
`about_sponsors`. ImageUpload category is `sponsors`. Default new
row: `nameEn='New sponsor'`, `subtitle='2025/2026'`.

## How public payment display works

`/admin/public-payment-methods`:

- PublicSectionHeader binds to `public_payment_methods`.
- Per-row card: button text (the pill label, e.g. "bKash") +
  `<ImageUpload>` bound to category `payment_icons`.
- Active/Hidden toggle, Up/Down reorder, Save, Delete.
- Default new row: `buttonText='New brand'`, position appended.

**This is the public DISPLAY pill row** (icon + brand name shown to
visitors). It is completely SEPARATE from the gateway-side
`PaymentMethod` rows managed at `/admin/payment-methods`. Disabling
a public pill does NOT touch deposit / payout pipelines.

## How public sections now render

`Footer.tsx` calls `/api/content/about-display` once on mount. The
endpoint returns:

```json
{
  "ok": true,
  "sections": {
    "ambassadors": { "isVisible": true, "titleEn": "...", "titleBn": "..." },
    "sponsors":    { "isVisible": true, "titleEn": "...", "titleBn": "..." },
    "paymentMethods": { "isVisible": true, "titleEn": "...", "titleBn": "..." }
  },
  "ambassadors": [...],
  "sponsors": [...],
  "paymentMethods": [...]
}
```

- Inactive rows (`isActive=false`) never appear in the array.
- When `PublicSection.isVisible=false` the endpoint returns an empty
  array for that block so the Footer can render the matching strip
  as missing.
- Internal error returns an empty payload with HTTP 200 so the
  footer degrades silently without taking down the page.
- The Footer hides each `FooterSection` when its array is empty so
  visitors never see a heading with no items.
- Titles render in EN or BN based on the current language; falls
  back to EN if BN is empty.
- Icons render as actual `<img>` when the operator uploaded one;
  fall back to a 2-letter initial badge otherwise.

## VPS deploy commands

```bash
cd /var/www/pasha9/app
git fetch origin
git reset --hard origin/m1-production
unset NODE_ENV
pnpm install --prod=false
set -a; source .env; set +a

# No schema delta this phase.
pnpm exec prisma generate --schema packages/database/prisma/schema.prisma

pnpm check:branding
pnpm build
pm2 restart pasha9-web --update-env
pm2 save
pm2 status
```

## Test checklist

1. Public footer no longer uses `AMBASSADORS`, `SPONSORS`,
   `PAYMENT_METHODS` constants. The constants are removed from the
   source.
2. `/admin/brand-ambassadors` opens; PublicSectionHeader loads the
   `about_ambassadors` row.
3. Add a new ambassador, edit name EN + BN + subtitle, save - public
   footer updates on next page load.
4. Disable an ambassador - the row disappears from the public footer.
5. Reorder ambassadors with Up / Down - public order matches.
6. Upload an ambassador icon via the ImageUpload widget; wrong
   dimensions are warned and not uploaded; the right size posts and
   the URL persists.
7. `/admin/sponsors` works identically for sponsors.
8. `/admin/public-payment-methods` works identically for the public
   payment pills.
9. Toggle `about_ambassadors` PublicSection to Hidden - the whole
   ambassador block disappears from the public footer.
10. Toggle `about_sponsors` to Hidden - the sponsor block disappears.
11. Toggle `public_payment_methods` to Hidden - the payment pill
    block disappears.
12. EN <-> BN: titles + ambassador / sponsor names use the BN value
    when available, fall back to EN otherwise.
13. With every row disabled, the footer shows no fake placeholder
    text in the affected block; the heading is hidden too.
14. Phase C deposit flow still works.
15. Phase D promotion claim still works.
16. Phase E referral claim still works.
17. Phase F lotto pages still work.
18. Phase B homepage sections still render.
19. JILI launch still works.
20. Provider callback simulation still works.
21. User transaction history still works.
22. Admin transaction log still works.
23. Sidebar remains fixed.
24. No application error overlay.
25. Mobile 320 / 375 / 430: ambassador / sponsor cards stack
    cleanly; payment pills wrap; nothing overflows; bottom nav
    does not cover any public button.

## What remains for final QA and handover

- Run the full Phase B-G acceptance test grid on the VPS (every
  Phase F-1 checklist + every page covered in this doc + the
  Phase C ledger regression).
- Update `docs/M4-DELIVERY.md` if it exists, otherwise write a
  short handover note pointing at:
    - `docs/M4-PHASE-A.md` through `docs/M4-PHASE-G.md`
    - The four crons (`/api/cron/lotto-rollover`,
      `/api/cron/referral-mature`, `/api/cron/recovery-sweep`,
      and any existing M3 jobs).
    - The four backfill / seed commands
      (`pnpm seed`, `pnpm --filter @pasha9/database referral:backfill`,
      `pnpm --filter @pasha9/database import:jili`, optional
      lotto seed-default).
    - The SystemSetting keys an operator can edit
      (`deposit_notice_enabled`, `referral_claim_cadence`,
      `referral_hold_days`, `referral_turnover_x`,
      `promotion_claim_engine`, `lotto_enabled`,
      `lotto_claim_mode`, `lotto_ticket_rate_amount`,
      `lotto_ticket_rate_count`).
- Verify cron secrets are set on the VPS (`CRON_SECRET`).
- Smoke-test every nav entry: every admin page should open without
  application error and respect `settings.write` permission.
- Confirm the Phase G ImageUpload widget works against the
  `ambassadors`, `sponsors`, `payment_icons` UploadConstraint rows
  (already seeded in Phase A).
