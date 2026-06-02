# Provider roadmap

Internal recommendation list for the next providers the operator
should evaluate after JILI / iGamingAPIs is live. None of these
are connected today. Each requires its own commercial credentials,
its own adapter class, and its own KYC / commercial paperwork.

The Pasha 9 architecture is provider-agnostic: every adapter
implements `ProviderAdapter` in `apps/web/lib/providers/types.ts`
and is registered in `apps/web/lib/providers/registry.ts`. Wiring
a new provider is mechanical once credentials and docs are in hand.

Built by Anointed Coder.

## Recommended priorities (Babu88-style platform)

The shape below mirrors a full Babu88-class catalogue: one premium
slots aggregator, one premium live casino brand, a crash specialist,
a sportsbook, and at least one fishing brand beyond JILI. Each
provider is an independent commercial relationship.



### 1. PG Soft (mobile slots)
- Why: dominant mobile slots brand in the Bangladesh / South Asia
  market; player demand is high.
- Type: slots aggregator (similar contract to JILI).
- Effort: 3 to 5 days for a new adapter once credentials arrive.
- Needs: PG Soft direct contract OR a reseller/aggregator that
  carries the brand.

### 2. Pragmatic Play (premium slots + live)
- Why: premium recognition, both slots and live casino verticals.
- Type: slots + live casino aggregator.
- Effort: 5 to 8 days. Live-casino streaming UI may need its own
  iframe handling.
- Needs: direct contract OR a reseller.

### 3. Evolution (or equivalent live casino brand)
- Why: live casino is the highest-margin vertical; missing it caps
  player value-per-hour.
- Type: live dealer streaming via iframe.
- Effort: 7 to 10 days for adapter + lobby card design pass.
- Needs: licensed live casino contract; KYC + jurisdiction
  requirements are stricter.

### 4. Spribe / Aviator-style crash provider
- Why: Aviator is a regional flagship; current native crash game
  is a complement, not a replacement, for the third-party brand.
- Type: real-time crash game over WebSocket.
- Effort: 5 to 7 days; protocol is typically heavier than the
  HTTP-only JILI integration.
- Needs: Spribe (or equivalent) direct contract.

### 5. Sportsbook (when sports is in scope)
- Why: vertical expansion. Requires a real sportsbook provider
  (BetConstruct, Pinnacle, BetRadar etc.).
- Type: sportsbook iframe + odds feed.
- Effort: 14 to 21 days minimum; sportsbook integrations carry
  their own settlement engine and bet types that do not map onto
  the `ProviderTransaction` ledger directly.

### 6. Additional fishing provider (optional)
- Why: JILI fishing covers the basics. A second brand (PG Fishing,
  CQ9 Fishing) widens the catalogue for fishing-heavy players.
- Effort: 3 to 4 days per brand.

### 7. Payment + payout providers (separate track)
- Out of scope for this provider list. M2 deposit/withdrawal
  already supports a pluggable payment provider layer. Add a
  high-risk gateway (NagaD, bKash partner, crypto on-ramp, etc.)
  based on the operator's licensing posture.

## What every new provider requires

- Commercial contract or reseller agreement (the most common
  reason an integration stalls).
- API token + secret (treat them like JILI's: AEAD-encrypt on save
  via the existing Setup form, never in env or code).
- Documented callback contract (parameters, signature, IP source).
- IP whitelist of the Pasha 9 production egress IPs.
- A bidirectional clock-drift expectation, surfaced via
  `launchTimestampOffsetMs` if needed.

## What we already have (and do NOT rebuild per provider)

- AES-256-ECB + AES-256-GCM helpers (`lib/providers/crypto.ts`,
  `lib/crypto/aead.ts`).
- Adapter registry (`lib/providers/registry.ts`).
- Wallet pipeline with idempotency, blocked-user guard, member
  account mapping, bonus turnover hook
  (`lib/providers/wallet.ts`, `lib/providers/player-account.ts`).
- Admin Setup, Brands, Games, Logs, Transactions, Reports UI.
- Public lobby (homepage rail + `/games/provider` full lobby).
- Manual catalog import + bulk CSV/JSON paths.
- Test launch + Simulate callback admin tooling.
- Rollback action.

## Featured games inside an existing provider

Once a provider is live, the admin can promote individual titles via
`ExternalGame.isFeatured` + `ExternalGame.sortOrder` (M3 Phase 3F).
Featured games surface first in the homepage rail and in
`/games/provider`; ties are broken by `sortOrder DESC` then
`displayName`. Set both from `/admin/providers/<id>` -> Games tab
-> Edit on any row.

This means JILI alone can fill a Babu88-style featured-games rail
today: pick 12 to 20 high-RTP titles, mark them Featured, set
descending sort orders, and the homepage rail puts them at the top.

## Important honesty

This document lists **candidates**, not connected providers. Do
not claim PG Soft, Pragmatic, Evolution, Spribe, or any other
brand is integrated unless commercial credentials exist AND an
adapter is shipped AND the live launch checklist is green.

