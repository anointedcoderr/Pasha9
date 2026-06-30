# Unified Bonus Management - design

Date: 2026-06-24. Built by Anointed Coder.

## Context

Two admin sections configure deposit bonuses today and confuse the operator:

- "Deposit Bonus Tiers" edits the `DepositBonusTier` model (a simple min-deposit to percent ladder). Every change syncs a managed `BonusRule` row (code `deposit_tier_<id>`, `meta.managedBy = 'deposit_bonus_tier'`, type `reload`) via `apps/web/lib/bonuses/deposit-tiers.ts`. The tier model also backs the deposit-form preview (`pickBestTier`).
- "Bonus Rules" (page title "Promotions and Bonus Engine", route `apps/web/app/(admin)/admin/bonuses`) edits `BonusRule` directly: all promotion types, caps, codes, windows, banners.

The grant engine (`apps/web/lib/bonuses/engine.ts`) and the withdrawal gate read ONLY `BonusRule` / `UserBonus`. `DepositBonusTier` is read only for the preview and self-heal. So merging is a UI consolidation, not a money-path rewrite.

## Goals (operator requests)

1. One unified Bonus Management section instead of two.
2. The deposit page shows only the bonuses the specific logged-in user is currently eligible for.
3. Configurable claim limits per bonus (once per account / day / week / month / unlimited / custom count).
4. A deposit bonus can also grant N free spins on a chosen in-house wheel.

## Approved decisions

- Merge: UI consolidation. Keep the existing models, present one page, hide the auto-generated tier rules from the advanced list so a rule never appears twice. No data migration.
- Free spins: in-house wheel only. Provider free rounds are not feasible (the aggregator adapter has no free-spin capability). Build a grantable free-spin mechanism, since none exists today.

## Design by item

### 2. Eligibility-aware deposit display (the visible bug)

Today `apps/web/app/api/content/deposit-preview/route.ts` is a public, amount-only GET with no session. `pickBestTier(amount)` returns the best active tier for any visitor, so a user who already used the first-deposit bonus still sees it.

Fix: make the preview user-aware. When a session is present, apply the same eligibility the grant engine uses (`evaluateDepositCandidates`): first-deposit rules only before the first approved deposit; reload/daily/weekly only inside their window and under the claim limit (item 3). Guests and logged-out users see the public "up to X%" as before. No schema change.

### 3. Configurable claim limits

No claim-limit field exists on `BonusRule` or `DepositBonusTier` today; reload rules fire on every deposit with no cap, and the only per-user guard is a hardcoded one-time first-deposit check.

Add to `BonusRule`: `claimPeriod String? @default("unlimited")` (values: account | day | week | month | unlimited) and `claimLimit Int @default(0)` (max grants within the period; 0 with a non-unlimited period means 1). Enforce in `evaluateDepositCandidates` by counting prior `UserBonus` grants of that rule within the period window, generalizing the existing first-deposit guard. Surface the controls in the unified admin editor and respect them in the item-2 display. Schema evolves via `prisma db push` (additive).

### 1. Unified Bonus Management page

One admin section replaces both nav entries. The full `BonusRule` editor is the home for every bonus type. The simple deposit-tier ladder stays as an easy mode within the page (it keeps writing `DepositBonusTier` plus its managed rule). The advanced rule list filters out `meta.managedBy = 'deposit_bonus_tier'` rows so a tier never appears as a duplicate editable rule. Remove the second sidebar entry.

### 4. Free-spin grants

Add a `FreeSpinGrant` model: `userId`, `tierKey` (target wheel: lucky | grand | supreme), `spinsGranted Int`, `spinsUsed Int @default(0)`, `sourceType`, `sourceId`, `expiresAt DateTime?`, `createdAt`. Add free-spin config to the triggering rule via `BonusRule.meta.freeSpins = { count, tierKey }` plus admin inputs. In `applyDepositBonuses`, after the cash grant, create a `FreeSpinGrant` row when the rule carries free-spin config. In the spin route (`apps/web/app/api/rewards/spin/route.ts`), at the free-spin decision point, add granted-but-unused spins for the tier to the daily allowance, and draw down `spinsUsed` when a granted free spin is consumed. The player sees their granted free-spin balance on the spin screen.

## Staging (each stage builds, passes the branding gate, and deploys on its own)

1. Eligibility-aware display (item 2). No schema change.
2. Claim limits (item 3). Additive schema + engine + display + admin editor.
3. Unified Bonus Management page (item 1). UI consolidation.
4. Free-spin grants (item 4). New model + engine hook + spin-route consumption + admin inputs.

## Out of scope

Provider-side free spins / free rounds (not supported by the current aggregator integration).
