# Pasha 9 API Guide

REST endpoints exposed by the Next.js Route Handlers in `apps/web/app/api/*`. Built by Anointed Coder.

All endpoints return JSON. Success responses include `ok: true`. Errors include `ok: false`, `code`, optional `message`, and may include `issues` when the failure is a Zod validation error.

Sessions are tracked via two httpOnly cookies (`pasha9_session` and `pasha9_refresh`). The frontend includes them automatically; integrations should set `credentials: 'include'`.

## Auth

| Method | Path                       | Purpose                                                     | Auth     |
|--------|----------------------------|-------------------------------------------------------------|----------|
| POST   | /api/auth/register         | Create a player account and start a session                 | public   |
| POST   | /api/auth/login            | Sign in with phone or username                              | public   |
| POST   | /api/auth/logout           | Revoke the refresh session and clear cookies                | session  |
| GET    | /api/auth/me               | Return the current user (role, wallet, profile)             | session  |
| POST   | /api/auth/forgot           | Issue a password reset token                                | public   |
| POST   | /api/auth/reset            | Consume a reset token and rotate the password               | public   |
| POST   | /api/auth/otp/request      | Send a 6-digit OTP for signup, login, reset or verification | public   |
| POST   | /api/auth/otp/verify       | Verify the OTP and consume it                               | public   |
| POST   | /api/admin/login           | Sign in as super admin, admin, or staff                     | public   |

Examples:

```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "rafiq01",
  "phone": "01710000123",
  "password": "secret123",
  "referral": "ABCDE12"
}
```

```http
POST /api/auth/login
Content-Type: application/json

{ "identifier": "rafiq01", "password": "secret123" }
```

```http
POST /api/admin/login
Content-Type: application/json

{ "username": "pasha9.admin", "password": "..." }
```

## Public content

| Method | Path                         | Purpose                                  |
|--------|------------------------------|------------------------------------------|
| GET    | /api/content/banners         | Active hero banners ordered by position  |
| GET    | /api/content/popups          | The current active popup, if any         |
| GET    | /api/content/promo-text      | Active marquee promo lines               |
| GET    | /api/content/homepage        | Section keyed copy for the homepage      |

## Admin CMS

Requires the matching permission (`banners.write`, `popups.write`, `promo.write`, `homepage.write`, `settings.write`, `users.read`, `activity.read`).

| Method | Path                                     | Purpose                                       |
|--------|------------------------------------------|-----------------------------------------------|
| GET    | /api/admin/banners                       | List all banners                              |
| POST   | /api/admin/banners                       | Create a banner                               |
| PATCH  | /api/admin/banners/:id                   | Update a banner                               |
| DELETE | /api/admin/banners/:id                   | Delete a banner                               |
| GET    | /api/admin/popups                        | List popups                                   |
| POST   | /api/admin/popups                        | Create a popup                                |
| PATCH  | /api/admin/popups/:id                    | Update a popup                                |
| DELETE | /api/admin/popups/:id                    | Delete a popup                                |
| GET    | /api/admin/promo-text                    | List promo lines                              |
| POST   | /api/admin/promo-text                    | Create a promo line                           |
| PATCH  | /api/admin/promo-text/:id                | Update a promo line                           |
| DELETE | /api/admin/promo-text/:id                | Delete a promo line                           |
| GET    | /api/admin/homepage                      | Read all HomepageContent sections             |
| PUT    | /api/admin/homepage                      | Upsert one section (body keyed by `section`)  |
| GET    | /api/admin/users                         | List users with role and wallet               |
| GET    | /api/admin/activity                      | Read the audit log (most recent first)        |
| GET    | /api/admin/settings                      | Read all SystemSetting rows                   |
| PATCH  | /api/admin/settings                      | Update multiple settings in a single payload  |
| POST   | /api/admin/uploads                       | Multipart upload to /uploads/{category}/...   |

The upload route accepts a `category` form field (`banners`, `games`, `payment-proofs`, `apk`) and a `file` part. It returns `{ url }` pointing into `/uploads/...` served by Nginx.

## Rate limits

In-memory limiter, per-route:

- `register`, `login`: 10 per minute per IP
- `admin-login`: 8 per minute per IP
- `forgot`, `reset`: 5 per minute per IP
- `otp/request`: 10 per minute per IP, 5 per 5 minutes per phone
- `otp/verify`: 20 per minute per IP

Limits are warmed at process boot; restarts reset them. Switch to a Redis adapter when more than one PM2 instance runs.

## Error code reference

| Code                       | HTTP | Meaning                                                                |
|----------------------------|------|------------------------------------------------------------------------|
| `BAD_JSON`                 | 400  | Request body was not valid JSON                                        |
| `VALIDATION`               | 400  | Zod validation failed; details in `issues`                             |
| `INVALID_CREDENTIALS`      | 401  | Phone, username, or password was incorrect                             |
| `UNAUTHENTICATED`          | 401  | No valid session cookie                                                |
| `FORBIDDEN`                | 403  | Session lacks required role or permission                              |
| `USER_BLOCKED`             | 403  | User status is `blocked`                                               |
| `USERNAME_TAKEN`           | 409  | Username already exists                                                |
| `PHONE_TAKEN`              | 409  | Phone already exists                                                   |
| `RATE_LIMITED`             | 429  | Bucket exhausted; try again later                                      |
| `OTP_PROVIDER_NOT_CONFIGURED` | 503 | SMS adapter is not configured in this environment                    |
| `OTP_MISMATCH`             | 400  | The code does not match the latest OTP record                          |
| `INVALID_TOKEN`            | 400  | Password reset token is missing, expired, or already consumed          |

Built by Anointed Coder.
