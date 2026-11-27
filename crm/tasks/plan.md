# FORGE CRM — World-Class Enterprise & India-First Master Upgrade Plan

## Benchmark Synthesis
Combining architecture patterns from:
- **Open-Source CRMs:** Twenty CRM (custom fields metadata, saved views, Kanban, granular RBAC), EspoCRM (BPM automations, dynamic logic), Erxes (unified omni-channel inbox & properties), Krayin/Atomic CRM (developer-clean TypeScript + PostgreSQL actions).
- **Global & India Fitness Leaders:** ABC Ignite (dunning cascades, family/corporate billing, gift cards, multi-branch finance), Mindbody (digital waivers, contracts, gift vouchers, retail POS), Mariana Tek (interactive studio spot/bike picker, waitlist credit protection), Gymdesk/PushPress (90-day onboarding, streak triggers, touch kiosk, recurring schedules), FitnessForce / advice.fit / gymsmart.in (eSSL & ZKTeco ADMS cloud push hardware integration, GPS geofencing, manager OTP discount approvals, late-minute shift payroll deductions, phone masking, native CGST/SGST/IGST & GSTR-1/GSTR-3B compliance).

## Architecture Slices
### Slice A: Schema, Security, Real Analytics & Reports Engine
1. Extend `prisma/schema.prisma` with `CustomFieldDefinition`, `SavedView`, `GiftCardVoucher`, `AccessDevice`, `OutboundWebhookDelivery`, `WaiverTemplate`, Branch GPS geofence coords, `Org.upiVpa`, `Member.walletBalancePaise` & `customFieldsJson`, `MemberGroup` corporate GSTIN & seat limit, `Lead.customFieldsJson` & `stageChangedAt`, `CheckIn.checkedOutAt` & GPS coords, `ClassType` grid dimensions & `ClassBooking.spotCode`, `StaffShift` lateMinutes/advance/geofence.
2. Fix security & correctness: `/app/layout.tsx` & `/login` `MEMBER -> /portal`; `/api/v1/member-app-sync` scoped `ApiKey` auth + non-PII token scoping; `/api/export/members` & `/api/export/invoices` CSV injection neutralization + role phone masking; `/api/export/reports` genuine queries across all 14 reports + GSTR-1/GSTR-3B JSON export; IST midnight alignment; `TodayDashboardPage` real SQL monthly active member curve & `evaluateMemberChurnRisk` queue; `RetentionPage` real historical cohort table; `upgradeMemberPlanProratedAction` + `mergeDuplicateMembersAction` + `performCheckInAction` override RBAC + `DPDP_ERASURE` deep scrub.

### Slice B: Twenty CRM Superpowers, Pipeline Drag-Drop, Member 360 & Automation Execution
1. Custom Fields & Saved Views engine + `DataTable` sorting & bulk selection actions.
2. Interactive HTML5 Drag-and-Drop Leads Kanban, SLA breach badges, round-robin auto-assign, inline AdSpendCampaign CRUD.
3. Member 360° profile overhaul: real Workouts tab wired to `MemberPlanAssignment`, E-Signature HTML5 canvas waiver signing + `/api/files` KYC document upload, editable fields, custom fields, consents toggles, real calendar attendance.
4. Automation trigger differentiation (`EXPIRY_T7/T3/T0/T+3`, `WINBACK_30D`, `BIRTHDAY`, `MISSED_7D`, `FEEDBACK_5TH_VISIT`, `REFERRAL`, `CHURN_HIGH_RISK`, `LEAD_SLA_BREACH`), `POST /api/webhooks/whatsapp` inbound handler, and real runnable job processor (BullMQ + UI cron pulse).

### Slice C: Billing Powerhouse, Access Hardware ADMS, Studio Spot Grid, Staff Payroll & Multi-Cart POS
1. Full Plans/Addons/Promos CRUD + validity dates; Split-Tender payment modal (`splitMetaJson`); Gift Card & Member Wallet credit issuance/redemption; Corporate B2B GSTIN consolidated invoicing; Autopay Mandates & Dunning Retries UI; Webhook DLQ Replay; Cash Drawer refunds + cash POS reconciliation; configurable Org UPI VPA.
2. Hardware biometric ADMS (`/api/iclock/cdata`, `/api/iclock/getrequest`), `AccessDevice` manager, live Floor Check-Out occupancy (`checkedOutAt IS NULL`), Kiosk Mode, GPS Geofence check-in verification (`geofence.ts`).
3. Classes Studio Seat/Bike Grid picker, Recurring class series generator, waitlist re-indexing + WhatsApp promotion alert + automated No-Show penalty invoicing.
4. Trainers monthly period payroll + Trainer CRUD + PT Pack credit deduction + Staff Shift scheduling + late-minute/advance payroll calculation (`staff-payroll.ts`) + GPS shift clock-in (`geofence.ts`).
5. Multi-cart Retail POS + barcode lookup + split tender + GST `Invoice` creation + Inventory/PO/Locker/Equipment CRUD; Structured Multi-Day Workout & Indian Diet Builder.

### Slice D: Settings Admin, Mobile Member PWA v2, Grounded AI Copilot, Seeding & Full E2E
1. Full Settings Org/Branch/Holiday/Staff management + Outbound Signed Webhook Tester & Delivery logs + Custom Field Builder.
2. Member PWA `/portal`: 60s rotating HMAC QR pass, 1-click Invoice UPI/Card checkout, interactive studio spot picker, GPS geofence self-check-in, E-Signature Waiver modal, Consent toggles, PT sessions view.
3. Enhanced AI Copilot with multi-domain operational intelligence + Approve/Dismiss actions.
4. Reseed DB cleanly (`npx prisma db push && npm run db:seed`), run all Vitest suites, ESLint, `tsc --noEmit`, `next build`, restart `:3001`, and run full Playwright verification + screenshot inspection across `1440px`, `768px`, and `390px`.
