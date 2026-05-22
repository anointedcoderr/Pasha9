# Pasha9 Handover Checklist

A single document the client should receive at the end of Milestone 3.

## Source code

- [ ] Full monorepo archive (zip or git bundle)
- [ ] README with run instructions
- [ ] All environment variables documented in `.env.example`
- [ ] Branch policy and tagging recommendation included

## Database

- [ ] Prisma schema reviewed by client tech contact
- [ ] Initial migration applied on production database
- [ ] Seed data run once for default categories, providers, bonus rules
- [ ] Backup job configured and verified

## Frontend

- [ ] Vercel project (or VPS Docker setup) handed over
- [ ] Domain configured and TLS certificate active
- [ ] Open Graph and favicon images delivered
- [ ] Final brand name applied across the UI (replacing the Pasha9 placeholder)

## Backend

- [ ] PM2 / systemd service running on the VPS
- [ ] CORS origin and JWT secret rotated for production
- [ ] Rate limiting enabled on auth endpoints
- [ ] Activity log indexes verified

## Payments

- [ ] Payment gateway integrated (if API docs are provided), or
- [ ] Manual proof upload flow validated end to end with a real transaction

## Mobile APK

- [ ] Capacitor wrapper builds for Android
- [ ] Icon and splash screen finalized
- [ ] APK loads the live site and preserves login session
- [ ] APK signed and delivered to the client

## Operations

- [ ] Admin and super-admin accounts handed off with one-time passwords
- [ ] User test account for QA
- [ ] Backup restore tested
- [ ] Logging endpoint or file location documented

## Knowledge transfer

- [ ] 30 minute walkthrough call with the client
- [ ] Telegram or WhatsApp channel kept open for two weeks of post-launch support
- [ ] All pending items from client (logos, real provider list, gateway docs) marked complete

Built by Anointed Coder. Contact: anointedcoder@gmail.com.
