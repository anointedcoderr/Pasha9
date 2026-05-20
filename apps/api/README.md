# sanjid14 API

Backend service for the sanjid14 platform. Implementation begins in Milestone 2.

## Stack

- Node.js + NestJS
- TypeScript
- PostgreSQL via Prisma
- JWT authentication with role-based access
- Zod or class-validator input validation
- Audit logging for every admin action

## Modules planned

```
src/auth        Login, register, JWT, password reset
src/users       Profile, preferences, language
src/wallet      Balances, transaction read endpoints
src/deposits    Submission and admin approval flow
src/withdrawals Submission and admin approval flow
src/referrals   Code generation, three level commission
src/bonuses     Bonus rules, claim flow, wagering tracking
src/banners     Banner / popup / promo text CRUD
src/games       Listing, launch, provider config
src/admin       Cross cutting admin endpoints, stats
src/common      Guards, interceptors, decorators, audit
```

## API endpoints

See `docs/api-plan.md` for the full route table.

## Notes

- Real money games must connect through licensed provider APIs or audited RNG logic.
- The platform never exposes a hidden "force win" or "force loss" toggle.
- Built by Anointed Coder. Contact: anointedcoder@gmail.com.
