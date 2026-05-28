# Third-Party Notices

Built by Anointed Coder.

## Pasha Native Games (Phase 1: Dice + Mines)

The native-game engines under `apps/web/lib/native-games/` are an
original TypeScript implementation built on top of Node `crypto`. No
third-party source code is copied or adapted. The server-side
provably-fair scheme (HMAC-SHA256 over a hashed server seed, a client
seed and a per-round nonce), the dice probability + payout math, the
Mines combinatorial multiplier formula and the deterministic
Fisher-Yates shuffle for mine placement are based on publicly known
formulas that can be inspected in many open-source casino projects.

Five public repositories were consulted as research for design ideas,
rule wording and math validation only. Their source code is NOT
imported, adapted, vendored, or otherwise included in this codebase.

| Repository                              | License                  | Used for                                                                 |
| --------------------------------------- | ------------------------ | ------------------------------------------------------------------------ |
| floatinghotpot/casino-server            | MIT                      | Cross-reference for room / session lifecycle modelling.                  |
| johakr/html5-slot-machine               | MIT                      | Slot reel mechanics research (future Phase, not used by Phase 1).        |
| gambasolutions/provably-fair            | (no license header)      | Reading reference for the HMAC stream pattern (we re-implemented).       |
| lucasholder/fair                        | (no license header)      | Reading reference for verification flow design (we re-implemented).      |
| oanapopescu93/casino                    | NO LICENSE (rights reserved) | Not used. Repository inspected; its roulette logic was flagged as biased and explicitly excluded from any work here. |

The Phase 1 commit message and this notice document the inspection
trail so future contributors understand exactly why these repositories
appear in research notes but not in the codebase. Anyone introducing
a future engine that does adapt third-party code must add its license
text under `licenses/` and update this table accordingly.

## Runtime dependencies

Direct npm / pnpm dependencies (Next.js, Prisma, Tailwind, lucide-react,
zod, bcrypt, jsonwebtoken, otpauth, etc.) ship under their own
permissive licenses (MIT / Apache-2.0). See `pnpm licenses list` from
the repo root for the live, machine-generated breakdown.
