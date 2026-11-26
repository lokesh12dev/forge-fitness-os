# FORGE CRM — Master Architecture, Data Model, Roles Matrix & Phased Build Plan

> **Note:** The existing FORGE Consumer Training OS documentation has been preserved verbatim at [FORGE-APP-PLAN.md](./FORGE-APP-PLAN.md). This document defines **FORGE CRM**, a multi-tenant India-first B2B gym CRM and operations SaaS platform.

---

## 1. Product Scope, Workspace Placement & Stack

**FORGE CRM** will live in a dedicated sibling Next.js workspace at `/crm` (`http://localhost:3001`), keeping the existing FORGE member training app (`/app`, port `3000`, SQLite + Drizzle) intact while providing a clean REST/webhook bridge in Phase 3 to sync assigned workout/diet plans and logged sessions.

### Stack
| Layer | Technology | Notes |
| --- | --- | --- |
| **Framework** | Next.js 16 (App Router) + TypeScript (`strict: true`) | Server Actions + Route Handlers with Zod request/form validation |
| **Styling** | Tailwind CSS v4 (Bauhaus / Swiss Poster Tokens) | `#F6F1E4` paper, `#151515` ink, `#C8372B` red, `#2B4BCC` blue, `#EBC95B` yellow; light + dark theme |
| **Database** | PostgreSQL 16 + Prisma ORM | Native PostgreSQL 16 (`postgresql@16` verified locally) & Docker `postgres:16-alpine`; every tenant table includes `orgId` + `branchId` |
| **Queue & Cache** | Redis + BullMQ | Local `redis-server` v8 / Docker `redis:7-alpine`; handles billing dunning, webhook retries, DLQ, scheduled reports, and campaign fan-out |
| **Auth & Sessions** | Auth.js v5 / Custom Iron Session Adapter | Email + password (Argon2id/scrypt), Phone OTP (adapter), Google OAuth (adapter), HTTP-only `SameSite=Lax` cookies, CSRF protection |
| **Payments** | Razorpay + Stripe Provider Adapters | UPI QR/intent, cards, autopay mandates, HMAC-SHA256 webhook verification, idempotency keys, mock webhook simulator when keys absent |
| **Messaging** | WhatsApp Business Cloud API + SMS + Email Adapters | Template approval states, opt-in/opt-out enforcement, mock delivery adapter + inbox log when keys absent |
| **Storage** | S3-Compatible Client (MinIO / AWS S3) + Signed URLs | Local signed file store fallback when MinIO/S3 env vars omitted; MIME + size validation on uploads |
| **Observability** | Sentry SDK + Structured JSON Logger + `requestId` | Health checks (`/api/health`, `/api/ready`), BullMQ queue inspector in Admin |
| **Testing & CI** | Vitest + Fast-check/Property Math Tests + Playwright | Multi-viewport desktop (`1440px`), tablet (`768px`), mobile (`390px`), migration dry-run |
| **Infra** | `docker-compose.yml` (`postgres`, `redis`, `minio`, `crm`, `worker`) | One-command boot |

### Core Engineering Invariants
1. **Integer Money Only**: Every currency amount is stored in **integer paise** (`Int` / `BigInt`, e.g., `₹1,999.00 = 199900`) — zero floating-point arithmetic anywhere in pricing, GST splits, dues, refunds, or charts.
2. **UTC Storage / Branch Timezone Display**: All datetimes are stored in UTC (`timestamptz`) and formatted strictly in `branch.timezone` (default `Asia/Kolkata`). Date arithmetic (`extension`, `freeze`, `T-7` expiry) operates in calendar date math per branch TZ.
3. **Strict Multi-Tenant Server Scoping**: Every server query reads `session.orgId` and authorized `branchIds` from verified session state via `scopedDb(ctx)` — never trusting client-supplied `orgId` or unauthorized `branchId`.
4. **Encryption & Compliance (India DPDP Act 2023 + GDPR)**: Sensitive medical (`healthNotesEnc`) and KYC (`kycNumberEnc`) fields are encrypted at rest with AES-256-GCM. Explicit marketing/WhatsApp/email opt-in records and IP+timestamped digital waivers are mandatory before outreach.
5. **Idempotent Webhooks**: Payment webhooks verify HMAC signature, record `WebhookEvent(provider, externalEventId)` in a unique transaction, and never mark an invoice `PAID` without cryptographic verification or an audited staff cash/manual settlement.

---

## 2. Bauhaus / Swiss Poster Design System

- **Palette (Light / Default):** Paper `#F6F1E4`, Ink `#151515`, Red `#C8372B`, Blue `#2B4BCC`, Yellow `#EBC95B`, White `#FFFFFF`, Grey `#6F6B61`.
- **Palette (Dark Theme Toggle):** Canvas `#151515`, Panel `#222222`, Elevated `#2B2B2B`, Text `#F6F1E4`, Muted `#9B968B`, borders `#F6F1E4`.
- **Contrast Rules:** Crisp white (`#FFFFFF`) text on Red/Blue/Ink blocks; `#151515` ink on Yellow/Paper/White blocks. Never place text over decorative geometry. Color is always reinforced by uppercase labels, icons, or crisp stripe/hatch patterns.
- **Typography:** `Archivo Black` (`uppercase`, `line-height: 0.9`, negative tracking) for display headlines; `Space Grotesk` with `tabular-nums` for body & numbers. Scale strictly `12 / 14 / 16 / 18 / 24 / 32 / 44 / 64` px — **zero text below `12px`**. Eyebrow labels `12–13px` bold uppercase, `0.12em` tracking, prefixed `//`, max 2 lines.
- **Rules & Motion:** Flat color blocks, `2px` (`2px–3px`) solid `#151515` borders, `0px` corner radius (`rounded-none`; true circles only for explicit Bauhaus dots, avatars, or geometric illustrations), zero gradients/shadows/blur/glass/emoji/stock photos/purple/indigo/teal. Mechanical `150–200ms` transitions honoring `prefers-reduced-motion`.
- **Reusable Primitive Library (`/crm/src/components/ui`):** `Button` (`primary` `#C8372B` `56px`/`40px`, `secondary` `#151515`, `tertiary` bordered), `StatTile`, `DataTable` (sticky thead, `2px` dividers, column chooser, saved filters, row action menu, CSV export), `FilterBar`, `KanbanBoard`, `Timeline`, `Drawer`, `Modal`, `Toast`, `EmptyState`, `SegmentedProgress`, `Calendar`, `Charts` (thick SVG strokes, square points, labelled axes), `StatusPill` (`ACTIVE` `#2B4BCC`, `EXPIRING` `#EBC95B`, `OVERDUE` `#C8372B`, `FROZEN` `#6F6B61`), `Avatar`, `QRCode`.
- **Shell & Responsive Breakpoints:** `4px` base grid, `12-column` desktop grid (`1440px`), tablet rail (`768px`), mobile (`390px`) bottom tab bar with `>= 48px` tap targets, global `⌘K` search palette, branch switcher, quick-add (`+ Member`, `+ Payment`, `+ Check-in`), theme toggle.

---

## 3. Data Model (PostgreSQL + Prisma)

Every tenant table carries `orgId String` and `branchId String` (or nullable `branchId` when org-wide such as Org Settings / Catalog Plan definitions, always filtered server-side by `orgId`). Core indexes on `(orgId, status, expiryDate)` and `(memberId, visitedAt)`.

### Phase 1 Tables (Implemented in Phase 1)
| Model | Key Columns | Scoping & Indexes |
| --- | --- | --- |
| `Organization` | `id`, `name`, `slug`, `logoUrl`, `primaryColor`, `currency` (`INR`), `timezone` (`Asia/Kolkata`), `gstin`, `legalStateCode`, `invoicePrefix`, `taxRatesJson`, `demoLoaded` | Root tenant |
| `Branch` | `id`, `orgId`, `name`, `code`, `address`, `stateCode`, `timezone`, `hoursJson`, `invoiceSeriesPrefix`, `nextInvoiceSeq`, `isActive` | `@@index([orgId])` |
| `BranchHoliday` | `id`, `orgId`, `branchId`, `date`, `title`, `closedAllDay` | `@@index([orgId, branchId, date])` |
| `User` | `id`, `email`, `phone`, `name`, `passwordHash`, `googleSub`, `avatarUrl`, `isActive` | Unique `email`, `phone` |
| `OrgMembership` | `id`, `orgId`, `userId`, `role` (`OWNER\|MANAGER\|FRONTDESK\|TRAINER\|ACCOUNTANT\|MEMBER`), `branchIds String[]`, `invitedById`, `acceptedAt` | `@@unique([orgId, userId])`, `@@index([orgId, role])` |
| `Session` | `id`, `userId`, `orgId`, `activeBranchId`, `tokenHash`, `expiresAt`, `ip`, `userAgent` | `@@index([userId])`, `@@index([expiresAt])` |
| `OtpChallenge` | `id`, `phoneOrEmail`, `codeHash`, `channel`, `attempts`, `expiresAt`, `verifiedAt` | `@@index([phoneOrEmail])` |
| `AuditLog` | `id`, `orgId`, `branchId`, `actorUserId`, `actorRole`, `action`, `resourceType`, `resourceId`, `diffJson`, `ip`, `requestId`, `createdAt` | Immutable append-only; `@@index([orgId, createdAt])` |
| `ConsentRecord` | `id`, `orgId`, `branchId`, `memberId`, `channel` (`WHATSAPP\|SMS\|EMAIL\|MARKETING\|HEALTH_DATA`), `granted`, `source`, `ip`, `recordedAt` | `@@index([orgId, memberId, channel])` |
| `MemberGroup` | `id`, `orgId`, `branchId`, `type` (`FAMILY\|COUPLE\|CORPORATE`), `name`, `primaryMemberId` | `@@index([orgId, branchId])` |
| `Member` | `id`, `orgId`, `branchId`, `memberCode`, `qrToken`, `fullName`, `phone`, `email`, `dob`, `gender`, `address`, `stateCode`, `emergencyName`, `emergencyPhone`, `goals`, `healthNotesEnc`, `status` (`ACTIVE\|EXPIRING\|OVERDUE\|FROZEN\|EXPIRED`), `expiryDate`, `groupId`, `assignedTrainerId`, `referralCode`, `referredByMemberId`, `tags String[]`, `mergedIntoMemberId`, `deletedAt` | `@@unique([orgId, memberCode])`, `@@unique([orgId, qrToken])`, `@@index([orgId, status, expiryDate])`, `@@index([orgId, branchId, phone])` |
| `MemberMeasurement` | `id`, `orgId`, `branchId`, `memberId`, `recordedAt`, `weightGrams`, `bodyFatBps`, `chestMm`, `waistMm`, `hipsMm`, `armMm`, `thighMm`, `notes` | `@@index([memberId, recordedAt])` |
| `MemberDocument` | `id`, `orgId`, `branchId`, `memberId`, `kind` (`WAIVER\|KYC_AADHAAR\|KYC_PAN\|MEDICAL\|OTHER`), `fileKey`, `kycLast4`, `kycNumberEnc`, `signedAt`, `signedIp`, `signerName` | `@@index([orgId, memberId])` |
| `MemberNote` | `id`, `orgId`, `branchId`, `memberId`, `authorUserId`, `kind` (`NOTE\|CALL\|FOLLOWUP`), `body`, `pinned`, `createdAt` | `@@index([orgId, memberId, createdAt])` |
| `Plan` | `id`, `orgId`, `branchId` (nullable for org-wide), `name`, `code`, `billingModel` (`MONTHLY\|QUARTERLY\|HALF_YEARLY\|ANNUAL\|PT_PACK\|CLASS_PACK\|DAY_PASS\|TRIAL`), `durationDays`, `sessionCredits`, `pricePaise`, `joiningFeePaise`, `sacCode` (`999723`), `gstRateBps` (`1800`), `maxFreezeDays`, `freezeFeePaise`, `autoRenewDefault`, `isActive` | `@@index([orgId, billingModel, isActive])` |
| `PlanAddon` | `id`, `orgId`, `branchId`, `name`, `kind` (`LOCKER\|TOWEL\|STEAM\|PARKING`), `pricePaise`, `durationDays`, `gstRateBps`, `isActive` | `@@index([orgId])` |
| `PromoCode` | `id`, `orgId`, `code`, `discountType` (`PERCENT_BPS\|FIXED_PAISE`), `discountValue`, `scope` (`PROMO\|EARLY_BIRD\|REFERRAL`), `maxRedemptions`, `redeemedCount`, `validFrom`, `validUntil`, `isActive` | `@@unique([orgId, code])` |
| `Membership` | `id`, `orgId`, `branchId`, `memberId`, `planId`, `status`, `startDate`, `endDate`, `basePricePaise`, `discountPaise`, `joiningFeePaise`, `sessionsTotal`, `sessionsRemaining`, `autoRenew`, `freezeDaysUsed`, `upgradedFromId`, `transferredFromMemberId` | `@@index([orgId, branchId, status, endDate])`, `@@index([memberId])` |
| `MembershipFreeze` | `id`, `orgId`, `branchId`, `membershipId`, `memberId`, `startDate`, `endDate`, `daysCount`, `feePaise`, `reason`, `approvedById` | `@@index([membershipId])` |
| `Invoice` | `id`, `orgId`, `branchId`, `memberId`, `membershipId`, `invoiceNumber`, `issueDate`, `dueDate`, `status` (`DRAFT\|ISSUED\|PARTIALLY_PAID\|PAID\|VOID\|REFUNDED`), `currency`, `sacCode`, `placeOfSupplyState`, `subtotalPaise`, `discountPaise`, `taxablePaise`, `cgstPaise`, `sgstPaise`, `igstPaise`, `totalPaise`, `paidPaise`, `balanceDuePaise` | `@@unique([orgId, branchId, invoiceNumber])`, `@@index([orgId, status, dueDate])` |
| `InvoiceLineItem` | `id`, `orgId`, `branchId`, `invoiceId`, `description`, `quantity`, `unitPricePaise`, `discountPaise`, `gstRateBps`, `cgstPaise`, `sgstPaise`, `igstPaise`, `totalPaise` | `@@index([invoiceId])` |
| `Payment` | `id`, `orgId`, `branchId`, `memberId`, `invoiceId`, `amountPaise`, `method` (`UPI\|CARD\|CASH\|BANK_TRANSFER\|SPLIT`), `provider` (`RAZORPAY\|STRIPE\|MANUAL`), `providerOrderId`, `providerPaymentId`, `idempotencyKey`, `status` (`PENDING\|CAPTURED\|FAILED\|REFUNDED`), `paidAt`, `collectedById`, `splitMetaJson` | `@@unique([idempotencyKey])`, `@@index([orgId, branchId, paidAt])` |
| `CreditNoteRefund` | `id`, `orgId`, `branchId`, `invoiceId`, `paymentId`, `creditNoteNumber`, `amountPaise`, `reason`, `issuedById`, `issuedAt` | `@@unique([orgId, branchId, creditNoteNumber])` |
| `AutopayMandate` | `id`, `orgId`, `branchId`, `memberId`, `membershipId`, `provider`, `mandateRef`, `status`, `maxAmountPaise`, `nextChargeDate` | `@@index([orgId, status])` |
| `DunningAttempt` | `id`, `orgId`, `branchId`, `invoiceId`, `attemptNo`, `scheduledAt`, `status`, `errorCode`, `executedAt` | `@@index([orgId, status])` |
| `CashReconciliation` | `id`, `orgId`, `branchId`, `date`, `openingCashPaise`, `collectedCashPaise`, `countedCashPaise`, `variancePaise`, `notes`, `closedById`, `closedAt` | `@@unique([orgId, branchId, date])` |
| `Expense` | `id`, `orgId`, `branchId`, `category`, `vendorName`, `description`, `amountPaise`, `gstPaise`, `incurredOn`, `receiptFileKey`, `createdById` | `@@index([orgId, branchId, incurredOn])` |
| `WebhookEvent` | `id`, `orgId`, `provider`, `externalEventId`, `signatureValid`, `payloadJson`, `status` (`RECEIVED\|PROCESSED\|DLQ`), `attempts`, `lastError`, `processedAt` | `@@unique([provider, externalEventId])` |
| `CheckIn` | `id`, `orgId`, `branchId`, `memberId`, `visitedAt`, `method` (`QR\|MANUAL\|PHONE\|TURNSTILE`), `result` (`ALLOWED\|BLOCKED_EXPIRED\|BLOCKED_FROZEN\|OVERRIDE_ALLOWED`), `overrideReason`, `checkedInById`, `deviceId` | `@@index([orgId, branchId, visitedAt])`, `@@index([memberId, visitedAt])` |
| `StaffTask` | `id`, `orgId`, `branchId`, `title`, `priority`, `dueDate`, `assignedToId`, `relatedMemberId`, `status` (`OPEN\|DONE`) | `@@index([orgId, branchId, status])` |
| `CommunicationLog` | `id`, `orgId`, `branchId`, `memberId`, `channel` (`WHATSAPP\|SMS\|EMAIL\|CALL\|NOTE`), `direction`, `templateCode`, `body`, `status` (`QUEUED\|MOCK_SENT\|SENT\|DELIVERED\|READ\|FAILED`), `providerMsgId`, `createdAt` | `@@index([orgId, memberId, createdAt])` |

### Phase 2–4 Planned Tables (Added per Phase)
- **Phase 2 (Growth Engine):** `Lead` (with pipeline stages `NEW|CONTACTED|TRIAL_BOOKED|TRIAL_DONE|NEGOTIATION|WON|LOST`, `source`, `score`, `ownerId`), `LeadTask`, `CampaignCost`, `MessageTemplate` (WhatsApp DLT/Meta approval state), `InboxThread`, `BroadcastCampaign`, `AutomationRule` (visual trigger/condition/action/delay + quiet hours + per-member cap + dry-run mode), `AutomationRun`, `ChurnRiskSnapshot`, `ReferralReward`, `LoyaltyPointsLedger`, `LoyaltyTier`.
- **Phase 3 (Operations):** `ClassType`, `ClassSession`, `ClassBooking` (capacity, waitlist, cutoff, no-show fee), `TrainerProfile`, `TrainerCommissionRule`, `PtSession`, `CommissionPayroll`, `WorkoutDietTemplate` (Indian veg/egg/non-veg/jain diet + workouts + FORGE `/app` API sync token), `MemberWorkoutAssignment`, `InventoryItem`, `Supplier`, `PurchaseOrder`, `PosSale`, `EquipmentAsset`, `EquipmentMaintenanceLog`, `StaffShift`, `StaffAttendanceLog`, `MemberFeedbackNps`.
- **Phase 4 (Intelligence & Admin):** `ScheduledReport`, `AiAssistantLog` (tool citations, token/org budget), `MigrationImportJob` (Gymdesk/Mindbody/Hevy/CSV dry-run), `ApiKey`, `WebhookSubscription`, `DataExportDeletionJob`.

---

## 4. Roles & Permissions Matrix (Server-Enforced RBAC + Branch Scoping)

Legend: **ALL** = All Org Branches · **OWN-B** = Assigned Branch(es) Only · **OWN-C** = Assigned Clients Only · **RO** = Read-Only · **SELF** = Own Member Account · **—** = Denied (`403 Forbidden`)

| Capability / Resource | OWNER | MANAGER | FRONTDESK | TRAINER | ACCOUNTANT | MEMBER |
| --- | --- | --- | --- | --- | --- | --- |
| Org Setup, Tax/GST Config, Holidays, RBAC | ALL | — | — | — | — | — |
| Branch Switcher Scope | ALL | OWN-B | OWN-B | OWN-B | ALL (RO) | Home Branch |
| Dashboard (`TODAY.`) Financial Tiles | ALL | OWN-B | Day Total | — (Blocked) | ALL (RO) | — |
| Dashboard (`TODAY.`) Ops & Check-ins | ALL | OWN-B | OWN-B | Own Clients | — | — |
| Members Directory & Create/Edit | ALL | OWN-B | OWN-B | OWN-C (RO bio + notes) | OWN-B (Name/Inv ref only) | — |
| Members Sensitive Health Notes / KYC | ALL | OWN-B (Audit logged) | Waiver upload | OWN-C (Health notes only) | — | SELF (Download/consent) |
| Freeze / Transfer / Merge Duplicates | ALL | OWN-B | Freeze Req | — | — | Freeze Req |
| Plans, Pricing & Promo Codes | ALL (Create/Edit) | RO (Apply only) | RO (Sell only) | — | RO | Browse public plans |
| Collect Payment (UPI/Card/Cash/Split) | ALL | OWN-B | OWN-B | — | — | Pay own dues |
| Issue Refund / Credit Note / Void Inv | ALL | OWN-B (Up to cap) | — | — | — | — |
| GST Invoices, P&L & Cash Reconciliation | ALL | OWN-B | Day-End Cash | — (**Never Finance**) | ALL (RO) | Own Invoices PDF |
| Expenses & Vendors | ALL | OWN-B | — | — | ALL (RO) | — |
| QR Check-In, Scanner & Override Expired | ALL | OWN-B | OWN-B | OWN-C | — | QR Pass + Self Scan |
| Leads Pipeline & Sales (Phase 2) | ALL | OWN-B | OWN-B | Assigned Trials | — | Public Enquiry |
| Broadcasts & Automations (Phase 2) | ALL | OWN-B | Template DM | — | — | Opt-in/out Prefs |
| Classes, PT Sessions & Commissions (Phase 3) | ALL | OWN-B | Book/Mark | Own Sessions + Read Own Comm | Own Branch Payroll (RO) | Book/Cancel Class |
| Workout / Diet Plans & Check-Ins (Phase 3) | ALL | OWN-B | — | OWN-C (Full CRUD) | — | View & Log |
| Reports CSV/PDF & AI Assistant (Phase 4) | ALL | OWN-B | Ops Lists | Own Client Adherence | Financial/GST Only | Data Export / Delete |
| Audit Log Viewer | ALL | OWN-B | — | — | Billing Audit Only | — |

**Server Enforcement Contract:**
- Every Server Action / Route Handler calls `const ctx = await requireAuthContext({ permission, branchId })`.
- A `TRAINER` requesting `/app/billing`, `/app/plans`, or any financial API receives `403 Forbidden` (no finance metrics hydrated in React Server Components).
- A `MANAGER` requesting another `branchId` receives `403 Forbidden`.
- All sensitive mutations (`REFUND`, `OVERRIDE_EXPIRED_CHECKIN`, `VIEW_HEALTH_NOTES`, `ROLE_CHANGE`, `FREEZE_APPROVAL`, `VOID_INVOICE`, `EXPORT_DATA`) append synchronously to `AuditLog`.

---

## 5. Complete Screen & Route Inventory

### Phase 1 Screens (Built in Phase 1)
| Route | Screen Name | Roles Allowed | Layout & Primary Workflows |
| --- | --- | --- | --- |
| `/login` | Sign In | Public | Bauhaus split grid: Email+Password, Phone OTP mock/adapter, Google OAuth, quick role switcher hint in demo mode |
| `/onboarding` | Org Setup Wizard | `OWNER` | 4-step wizard: Gym Name & GSTIN, Branch(es) + Working Hours + Holidays, Currency/Invoice Series/Tax Slabs, Staff Role Invites |
| `/app` | **TODAY.** Dashboard | Staff (`OWNER`..`ACCOUNTANT`) | 6 live `StatTile` KPIs (Check-ins now, Today's Revenue, New Leads, Expiring 7d, Overdue Dues, Trial Bookings), Revenue + Active Members SVG Chart (thick strokes, square points), Peak-Hours Day×Hour Heatmap, Top 5 Churn Risks, Staff Task Checklist, Owner Multi-Branch Comparison |
| `/app/members` | Members Directory | Staff (role-filtered) | Dense `DataTable`, sticky headers, status filter (`ACTIVE`/`EXPIRING`/`OVERDUE`/`FROZEN`), search, column chooser, saved filters, CSV export, `+ Add Member`, duplicate merger drawer |
| `/app/members/[id]` | Member 360° Profile | Staff + `TRAINER` (own) | 8 Bauhaus tabs: Overview (+ encrypted health consent), Membership (renew/upgrade/freeze/transfer/groups/referral), Payments & GST Invoices, Attendance Calendar, Body Measurements & Progress Photos, Workouts/Diet stub, Communication Timeline (WhatsApp/SMS/email/calls), Documents (Waiver e-sign & KYC) + Notes/Tags |
| `/app/plans` | Plans, Add-ons & Promos | `OWNER`, `MANAGER`, `FRONTDESK`, `ACCOUNTANT` | Tier matrix (Monthly/Quarterly/Half-Yearly/Annual/PT/Class Pack/Day Pass/Trial), Add-ons (`Locker`/`Towel`/`Steam`), Promo/Early-Bird/Referral codes, pro-rata calculator & freeze rule editor |
| `/app/billing` | Payments, GST & Ledger | `OWNER`, `MANAGER`, `FRONTDESK`, `ACCOUNTANT` | Collect Payment Drawer (UPI QR / Card / Cash / Bank / Split / Part-Pay), Dues Aging Ledger, Razorpay/Stripe adapter + Webhook Log & Retry/DLQ, Refunds & Credit Notes, Day-End Cash Reconciliation, Expenses Tracker |
| `/app/billing/invoices/[id]` | Tax Invoice (GST PDF/Print) | `OWNER`, `MANAGER`, `FRONTDESK`, `ACCOUNTANT` | Print-ready Swiss Bauhaus Tax Invoice: CGST/SGST (intra-state) vs IGST (inter-state), SAC `999723`, branch GSTIN, sequential invoice #, itemized breakup, WhatsApp/Email receipt send |
| `/app/checkin` | Attendance & Access Terminal | `OWNER`, `MANAGER`, `FRONTDESK`, `TRAINER` | Split front-desk scanner: Live QR Token Scan + Phone/Code Lookup, Expired/Frozen Gate Block modal requiring Staff Override Reason, Live Floor Count gauge, Turnstile Adapter status, Check-in History & Absentee list (`7d` / `14d` / `30d`) |

### Phase 2–4 Screens (Roadmap)
- **Phase 2 (Growth):** `/app/leads` (7-stage Kanban + table + ROI + QR Poster + public `/enquire/[orgSlug]` embed), `/app/inbox` (2-way WhatsApp inbox + templates + broadcasts + opt-in/out), `/app/automations` (visual trigger/condition/action builder + dry-run + quiet hours), `/app/retention` (churn scores + explainable factors + save-plan outreach + cohorts), `/app/loyalty` (referrals + points + tiers leaderboard).
- **Phase 3 (Operations):** `/app/classes` (schedule/waitlist/cutoffs), `/app/trainers` (availability/PT/commission slabs/payroll), `/app/training-plans` (workout + veg/non-veg/egg/jain diet + FORGE app API sync), `/app/inventory` (POS w/ GST/stock/equipment maintenance), `/app/staff` (shifts/attendance/handover), `/portal` (Member PWA with Phone OTP, QR pass, dues payment, freeze request, bookings, plans, streaks, invoices).
- **Phase 4 (Intelligence & Admin):** `/app/reports` (14 filterable CSV/PDF reports + GSTR sheets + daily 9pm WhatsApp summary), `/app/ai` (tool-grounded Org Data AI Assistant with human-approval drafts), `/app/settings` (RBAC matrix, branches, hours, holidays, gateways, message keys, CSV/Gymdesk/Mindbody/Hevy importer, audit viewer, API keys, backups, DPDP export/delete).

---

## 6. Pure Unit-Tested Business Modules & Demo Seed

- `src/lib/money.ts`: Integer paise formatters, percentage bps splits, pro-rata credits, reconciliation checks (+ property tests).
- `src/lib/gst.ts`: Intra-state (`CGST` + `SGST`) vs Inter-state (`IGST`) integer rounding preserving `subtotal - discount + tax = total` exactly.
- `src/lib/membership-math.ts`: Exact UTC/branch-TZ expiry extension, mid-cycle pro-rated upgrades, freeze extension day counts (`maxFreezeDays` + fee enforcement).
- `src/lib/dues-ledger.ts`: Part-payment allocation, remaining balance dues, credit note reversals.
- `src/lib/rbac.ts`: Declarative role × branch × resource matrix + fail-closed guards.
- `src/lib/checkin-gate.ts`: QR lookup, `ACTIVE` / `EXPIRING` / `OVERDUE` / `FROZEN` decisions, audited override gate.
- `src/lib/encryption.ts`: AES-256-GCM encrypt/decrypt helper for `healthNotesEnc` & `kycNumberEnc`.
- **Seed Script (`prisma/seed.ts`) + Settings "Load demo data":** `1` org (`Ironworks Athletics India`), `2` branches (`Indiranagar HQ — KA`, `Bandra West — MH`), `600` members across all statuses, `12` plans + add-ons + promos, `6` trainers, `18` months of invoices/payments/expenses, `40,000` realistic check-ins with morning/evening peak curve, `300` pipeline leads, classes, and inventory fixtures. Freshly registered orgs start completely empty with Bauhaus `EmptyState` guidance.

---

## 7. Verification Gates per Phase

Before ending Phase 1, the following MUST pass with screenshots and a "Needs your input" adapter key list:
- Zero TypeScript errors, zero ESLint/console warnings in Next.js or Playwright.
- Vitest pure unit + property test suite (all money/GST/date/RBAC/gate modules green).
- Playwright E2E across `390px`, `768px`, and `1440px` verifying: signup/onboarding wizard, adding a member, selling a plan with partial payment, generating a sequential CGST/SGST GST invoice, QR check-in, expired-member block + audited override, freeze & renew, CSV export, dark/light theme toggle, and strict role denial checks (Trainer denied finance; Branch Manager denied sibling branch).

---

## Needs Your Input (Optional Provider Credentials — Mock Adapters Active Until Configured)
- **PostgreSQL / Redis / S3**: Local `postgresql@16` + `redis` run locally without keys; for cloud deployment provide `DATABASE_URL`, `REDIS_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
- **Auth**: `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, SMS OTP sender key (`MSG91_AUTH_KEY` or `TWILIO_*`).
- **Payments**: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, optional `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`.
- **Messaging**: `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, SMTP / Resend API key (`RESEND_API_KEY`).
- **Hardware & Monitoring**: `SENTRY_DSN`, optional turnstile/biometric webhook token.
