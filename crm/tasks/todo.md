# FORGE CRM — World-Class Upgrade Checklist

## Slice A: Schema, Security, Real Analytics & Reports
- [x] Extend `prisma/schema.prisma` with custom fields, saved views, gift cards, access devices, outbound webhook deliveries, waiver templates, corporate group GSTIN, spot booking, check-out timestamps, branch GPS, and staff payroll fields
- [x] Run `npx prisma db push && npx prisma generate` cleanly
- [x] Fix `/app/layout.tsx`, `/login/page.tsx`, `/api/v1/member-app-sync` auth, `/api/export/*` CSV sanitization, `upgradeMemberPlanProratedAction`, `mergeDuplicateMembersAction`, `performCheckInAction`, `DPDP_ERASURE`
- [x] Replace synthetic dashboard/cohort data in `TodayDashboardPage` (`src/app/app/page.tsx`) & `RetentionPage` (`src/app/app/retention/page.tsx`) with real PostgreSQL queries & IST date boundaries
- [x] Implement real query-backed CSV for all 14+ reports + GSTR-1 / GSTR-3B JSON export in `/api/export/reports`
- [x] Wire `maskPhoneForRole`, `requiresManagerOtpForDiscount`, `evaluateGeofenceCheckIn`, `calculateStaffNetPayroll`

## Slice B: Twenty CRM Powers, Leads Kanban, Member 360 & Automations
- [x] Custom Fields & Saved Views engine + `DataTable` sorting & bulk selection actions
- [x] Interactive Drag-and-Drop Leads Kanban + SLA aging + Round-Robin auto-assign + AdSpend CRUD
- [x] Member 360° real Workouts tab + E-Signature Waiver canvas + Document upload + Consent toggles
- [x] Differentiate 11 Automation triggers (`runAllActiveAutomationsCronPulseAction`) + inbound `/api/webhooks/whatsapp` + runnable worker handlers

## Slice C: Billing, Access Hardware ADMS, Spot Grid, Payroll & Multi-Cart POS
- [x] Plans/Addons/Promos CRUD + Split-Tender + Gift Cards + Member Wallet + Corporate B2B GSTIN + Autopay Mandates + Dunning Queue + Webhook Replay + Cash Drawer fix
- [x] Biometric `/api/iclock/cdata` + `/api/iclock/getrequest` + `AccessDevice` hub + Live Check-Out Occupancy + Touch Kiosk + Geofence check-in
- [x] Classes Spot/Bike Picker + Recurring series + Waitlist re-index/notify + No-Show billing
- [x] Trainers period payroll + PT Pack credits + Staff Shift scheduling + `staff-payroll.ts` ledger + Multi-Cart POS + Linked Invoice

## Slice D: Org Admin, Member PWA v2, AI Copilot & Verification
- [x] Full Settings Admin CRUD (Org/Branches/Staff/Webhooks/CustomFields)
- [x] Member PWA `/portal` rotating FQR2 QR, instant invoice checkout, spot booking, geofence check-in, E-sign waiver
- [x] Enhanced AI Copilot + Dismiss/Approve actions + Updated `demo-seed.ts` & reseeded database
- [x] Pass `tsc --noEmit`, `eslint src`, `vitest run`, `next build`, restart `:3001`, Playwright E2E + visual review at 1440px/768px/390px
