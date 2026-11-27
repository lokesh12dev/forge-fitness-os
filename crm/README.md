# FORGE CRM — Multi-Tenant Gym Operations & Billing OS

Bauhaus / Swiss poster-inspired, India-first multi-branch CRM & gym operations platform built with Next.js App Router, strict TypeScript, Tailwind CSS v4, PostgreSQL 16 + Prisma, Redis + BullMQ, Zod, and Vitest + Playwright.

## Quick Start (Docker Compose)

```bash
cp .env.example .env
docker compose up --build
```

Services started on `docker compose up`:
- `crm` (Next.js Web UI & Server Actions) on `http://localhost:3001`
- `postgres` (PostgreSQL 16 multi-tenant datastore) on `5432`
- `redis` (Redis 7 queue store) on `6379`
- `minio` (S3-compatible document/waiver bucket) on `9000` / console `9001`
- `worker` (BullMQ background processor for dunning, webhooks, outreach)

## Local Development (Without Docker Desktop)

Ensure PostgreSQL 16 and Redis are running locally, then:

```bash
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

App runs on `http://localhost:3001`. Seeded roles (password `ForgeCrm@2026`):
- **Owner (All Branches):** `owner@ironworks.in`
- **Manager (Indiranagar BLR Only):** `manager.blr@ironworks.in`
- **Front Desk (BLR):** `frontdesk.blr@ironworks.in`
- **Trainer (Clients Only — Finance Blocked):** `trainer.blr@ironworks.in`
- **Accountant (Read-Only Finance):** `accountant@ironworks.in`

## Architecture

```
Browser (390px / 768px / 1440px Bauhaus UI)
  │
  ├── Next.js App Router (Server Components + Zod Server Actions)
  │     ├── requireAuthContext() -> Session + RBAC Matrix + branchIds scoping
  │     ├── Pure Engines (money.ts, gst.ts, membership-math.ts, dues-ledger.ts)
  │     └── AES-256-GCM Encryption (healthNotesEnc, kycNumberEnc)
  │
  ├── PostgreSQL 16 + Prisma ORM (orgId + branchId scoped, integer paise)
  ├── Redis + BullMQ Worker (dunning retries, webhook reconcile, outreach)
  └── Provider Adapters (Razorpay/Stripe HMAC, WhatsApp Cloud/SMS/Email, Turnstile, S3)
```

## Verification Commands

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # eslint src
npm run test           # Vitest unit + fast-check integer-paise property tests
npm run db:migrate:dry # Prisma schema diff dry-run
npm run build          # Next.js production compile
```

## Operations Runbook: Failed Payments & Message Delivery

### 1. Failed Payment Webhook / Signature DLQ
1. Razorpay & Stripe webhooks arrive at `POST /api/webhooks/payments`.
2. Signature validation uses `RAZORPAY_WEBHOOK_SECRET` / `STRIPE_WEBHOOK_SECRET` via `crypto.timingSafeEqual`. Invalid signatures are **never** marked paid and are persisted into `WebhookEvent` with `status = DLQ`.
3. Duplicate `externalEventId` retries short-circuit idempotently (`idempotentReplay: true`).
4. Payment failures (`payment.failed`) insert a `DunningAttempt` (`RETRY_SCHEDULED`) and can be inspected under `/app/billing` -> `Webhook Inbox`.

### 2. Message Delivery Blocks & Provider Fallbacks
- When `WHATSAPP_CLOUD_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` or `SMS_API_KEY` are unset, adapters safely dispatch with `status = MOCK_SENT` in `CommunicationLog`.
- Outbound marketing/WhatsApp messages always check the latest `ConsentRecord`; opted-out members return `BLOCKED_OPT_OUT` and are never contacted.

## Environment Variables

See `.env.example` for database, Redis, auth/encryption keys, Razorpay/Stripe, WhatsApp Cloud API, Google OAuth, S3/MinIO, and Sentry configuration.
