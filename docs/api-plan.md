# Pasha 9 API Plan

Reference for the endpoints implemented in Milestone 2. All routes use JSON, JWT bearer auth, and Zod validation.

## Auth

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| POST | /api/auth/register | none | Create a new user, returns access + refresh token |
| POST | /api/auth/login | none | Exchange phone + password for JWT |
| POST | /api/auth/logout | user | Invalidate refresh token |
| GET  | /api/auth/me | user | Current user profile snapshot |
| POST | /api/auth/refresh | refresh token | Issue a new access token |

## User

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| GET  | /api/user/profile | user | Profile details |
| PATCH| /api/user/profile | user | Update mutable fields |
| GET  | /api/user/dashboard | user | Aggregated dashboard payload |

## Wallet

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| GET | /api/wallet | user | Balance, bonus, locked |
| GET | /api/wallet/transactions | user | Paginated transactions |

## Deposit

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| POST | /api/deposits | user | Submit deposit request |
| GET  | /api/deposits/my | user | List user deposits |

## Withdrawal

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| POST | /api/withdrawals | user | Submit withdrawal request |
| GET  | /api/withdrawals/my | user | List user withdrawals |

## Referral

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| GET  | /api/referrals | user | Three level chain |
| GET  | /api/referrals/stats | user | Total invited, earned, pending, claimed |
| POST | /api/referrals/copy-link-log | user | Optional usage telemetry |

## Games

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| GET  | /api/games | any | Game catalogue with filters |
| GET  | /api/games/categories | any | Category list |
| GET  | /api/games/providers | any | Provider list |
| POST | /api/games/launch | user | Get a one-shot launch URL |

## Admin

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| GET  | /api/admin/stats | admin | Dashboard totals + daily series |
| GET  | /api/admin/users | admin | Paginated user list |
| GET  | /api/admin/users/:id | admin | User detail |
| PATCH| /api/admin/users/:id/status | admin | Activate, block, mark pending |
| PATCH| /api/admin/users/:id/balance | admin | Adjust balance (reason required, audit logged) |
| GET  | /api/admin/deposits | admin | Deposit queue |
| PATCH| /api/admin/deposits/:id/approve | admin | Approve a deposit |
| PATCH| /api/admin/deposits/:id/reject | admin | Reject a deposit |
| GET  | /api/admin/withdrawals | admin | Withdrawal queue |
| PATCH| /api/admin/withdrawals/:id/approve | admin | Approve a withdrawal |
| PATCH| /api/admin/withdrawals/:id/reject | admin | Reject a withdrawal |
| GET  | /api/admin/transactions | admin | Transaction log |
| GET  | /api/admin/referrals | admin | All referral relations |
| CRUD | /api/admin/bonus-rules | admin | Bonus rule management |
| CRUD | /api/admin/banners | admin | Banner CRUD |
| CRUD | /api/admin/popups | admin | Popup CRUD |
| CRUD | /api/admin/promo-texts | admin | Promo text CRUD |
| CRUD | /api/admin/games | admin | Game CRUD |
| CRUD | /api/admin/categories | admin | Category CRUD |
| CRUD | /api/admin/providers | admin | Provider CRUD |
| GET  | /api/admin/logs | admin | Activity log |
| GET  | /api/admin/settings | admin | Read system settings |
| PATCH| /api/admin/settings | super_admin | Update system settings |

## Conventions

- Pagination via `?page=1&pageSize=20`
- Filter via standard query params (status, type, dateFrom, dateTo)
- Error envelope `{ ok: false, error: { code, message, fields? } }`
- Success envelope `{ ok: true, data }`
- Rate limit 100 requests per minute per IP on auth endpoints
- Every admin write triggers an ActivityLog insert with admin id, action, target, detail
