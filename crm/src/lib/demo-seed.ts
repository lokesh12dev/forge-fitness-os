import { PrismaClient, type BillingModel, type MemberStatus, type Role } from "@prisma/client";
import { hashPassword } from "./auth";
import { aggregateGstInvoice } from "./gst";
import { encryptSensitiveField } from "./encryption";

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan",
  "Rohan", "Vikram", "Kabir", "Siddharth", "Karan", "Nikhil", "Pranav", "Varun", "Dev", "Harsh",
  "Ananya", "Diya", "Saanvi", "Aadhya", "Kiara", "Myra", "Pari", "Anvi", "Riya", "Ira",
  "Meera", "Kavya", "Priya", "Neha", "Sneha", "Pooja", "Shruti", "Nandini", "Tanvi", "Zoya",
];

const LAST_NAMES = [
  "Sharma", "Verma", "Patel", "Reddy", "Nair", "Iyer", "Rao", "Menon", "Kulkarni", "Deshmukh",
  "Joshi", "Malhotra", "Kapoor", "Mehta", "Gupta", "Bhat", "Hegde", "Chatterjee", "Sen", "Bose",
  "Agarwal", "Singhal", "Khan", "Sheikh", "D'Souza", "Fernandes", "Tiwari", "Pandey", "Mishra", "Saxena",
];

const LEAD_SOURCES = ["Walk-in", "Instagram", "Google", "Referral", "Website", "WhatsApp", "Justdial"] as const;
const LEAD_STAGES = ["NEW", "CONTACTED", "TRIAL_BOOKED", "TRIAL_DONE", "NEGOTIATION", "WON", "LOST"] as const;
const PAY_METHODS = ["UPI", "CARD", "CASH", "BANK_TRANSFER"] as const;
const HEALTH_SAMPLES = [
  "Mild left rotator cuff impingement during overhead press; substitute landmine press.",
  "Recovering from ACL reconstruction (9 months post-op); focus on unilateral quad symmetry.",
  "Mild hypertension (controlled); avoid prolonged Valsalva holds.",
  "Desk-worker lower back stiffness; emphasize hip flexor mobility and goblet squats.",
  "No contraindications. Cleared for high-intensity barbell progression.",
];

const PLANS_BLUEPRINT: Array<{
  name: string;
  code: string;
  billingModel: BillingModel;
  durationDays: number;
  sessionCredits: number | null;
  pricePaise: number;
  joiningFeePaise: number;
  maxFreezeDays: number;
  freezeFeePaise: number;
}> = [
  { name: "All-Access Monthly", code: "PLAN-MON", billingModel: "MONTHLY", durationDays: 30, sessionCredits: null, pricePaise: 299900, joiningFeePaise: 100000, maxFreezeDays: 7, freezeFeePaise: 29900 },
  { name: "Strength Quarterly", code: "PLAN-QTR", billingModel: "QUARTERLY", durationDays: 90, sessionCredits: null, pricePaise: 799900, joiningFeePaise: 100000, maxFreezeDays: 15, freezeFeePaise: 0 },
  { name: "Hypertrophy Half-Yearly", code: "PLAN-HALF", billingModel: "HALF_YEARLY", durationDays: 180, sessionCredits: null, pricePaise: 1449900, joiningFeePaise: 0, maxFreezeDays: 30, freezeFeePaise: 0 },
  { name: "Ironworks Annual Black", code: "PLAN-ANN", billingModel: "ANNUAL", durationDays: 365, sessionCredits: null, pricePaise: 2499900, joiningFeePaise: 0, maxFreezeDays: 45, freezeFeePaise: 0 },
  { name: "Personal Training 12-Pack", code: "PLAN-PT12", billingModel: "PT_PACK", durationDays: 60, sessionCredits: 12, pricePaise: 1800000, joiningFeePaise: 0, maxFreezeDays: 14, freezeFeePaise: 0 },
  { name: "Personal Training 24-Pack", code: "PLAN-PT24", billingModel: "PT_PACK", durationDays: 120, sessionCredits: 24, pricePaise: 3200000, joiningFeePaise: 0, maxFreezeDays: 21, freezeFeePaise: 0 },
  { name: "Group Conditioning 10-Pack", code: "PLAN-CLS10", billingModel: "CLASS_PACK", durationDays: 60, sessionCredits: 10, pricePaise: 450000, joiningFeePaise: 0, maxFreezeDays: 7, freezeFeePaise: 0 },
  { name: "Group Conditioning 20-Pack", code: "PLAN-CLS20", billingModel: "CLASS_PACK", durationDays: 90, sessionCredits: 20, pricePaise: 800000, joiningFeePaise: 0, maxFreezeDays: 14, freezeFeePaise: 0 },
  { name: "Single Floor Day Pass", code: "PLAN-DAY", billingModel: "DAY_PASS", durationDays: 1, sessionCredits: 1, pricePaise: 49900, joiningFeePaise: 0, maxFreezeDays: 0, freezeFeePaise: 0 },
  { name: "7-Day Transformation Trial", code: "PLAN-TRIAL7", billingModel: "TRIAL", durationDays: 7, sessionCredits: null, pricePaise: 99900, joiningFeePaise: 0, maxFreezeDays: 0, freezeFeePaise: 0 },
  { name: "Off-Peak Student Monthly", code: "PLAN-STU", billingModel: "MONTHLY", durationDays: 30, sessionCredits: null, pricePaise: 199900, joiningFeePaise: 50000, maxFreezeDays: 7, freezeFeePaise: 19900 },
  { name: "Corporate Wellness Annual", code: "PLAN-CORP", billingModel: "ANNUAL", durationDays: 365, sessionCredits: null, pricePaise: 1999900, joiningFeePaise: 0, maxFreezeDays: 30, freezeFeePaise: 0 },
];

export async function seedFullDemoWorkspace(prisma: PrismaClient, targetOrgId?: string): Promise<{ orgId: string; memberCount: number; checkInCount: number }> {
  const rand = mulberry32(20261126);
  const now = new Date();
  const demoPassHash = hashPassword("ForgeCrm@2026");

  // 1. Create or fetch Org & 2 Branches
  let org = targetOrgId
    ? await prisma.organization.findUnique({ where: { id: targetOrgId }, include: { branches: true } })
    : await prisma.organization.findUnique({ where: { slug: "ironworks-india" }, include: { branches: true } });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "Ironworks Athletics India",
        slug: "ironworks-india",
        currency: "INR",
        timezone: "Asia/Kolkata",
        gstin: "29AABCI4921M1Z4",
        legalStateCode: "KA",
        invoicePrefix: "IWA",
        defaultGstBps: 1800,
        demoLoaded: true,
        branches: {
          create: [
            {
              name: "Indiranagar HQ",
              code: "BLR-IND",
              address: "100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru 560038",
              stateCode: "KA",
              timezone: "Asia/Kolkata",
              invoiceSeriesPrefix: "IWA-BLR",
              nextInvoiceSeq: 801,
              hoursJson: { open: "05:30", close: "22:30", sundayClose: "20:00" },
            },
            {
              name: "Bandra West Club",
              code: "MUM-BND",
              address: "Linking Road, Bandra West, Mumbai 400050",
              stateCode: "MH",
              timezone: "Asia/Kolkata",
              invoiceSeriesPrefix: "IWA-MUM",
              nextInvoiceSeq: 651,
              hoursJson: { open: "06:00", close: "22:30", sundayClose: "20:00" },
            },
          ],
        },
      },
      include: { branches: true },
    });
  } else if (org.branches.length < 2) {
    if (org.branches.length === 0) {
      await prisma.branch.create({
        data: {
          orgId: org.id,
          name: "Indiranagar HQ",
          code: "BLR-IND",
          address: "100 Feet Road, Indiranagar, Bengaluru",
          stateCode: "KA",
          timezone: "Asia/Kolkata",
          invoiceSeriesPrefix: `${org.invoicePrefix}-BLR`,
          nextInvoiceSeq: 801,
          hoursJson: { open: "05:30", close: "22:30" },
        },
      });
    }
    await prisma.branch.create({
      data: {
        orgId: org.id,
        name: "Bandra West Club",
        code: "MUM-BND",
        address: "Linking Road, Bandra West, Mumbai",
        stateCode: "MH",
        timezone: "Asia/Kolkata",
        invoiceSeriesPrefix: `${org.invoicePrefix}-MUM`,
        nextInvoiceSeq: 651,
        hoursJson: { open: "06:00", close: "22:30" },
      },
    });
    org = await prisma.organization.findUniqueOrThrow({ where: { id: org.id }, include: { branches: true } });
  }

  const branchA = org.branches[0]!;
  const branchB = org.branches[1] ?? branchA;

  // Guard re-seeding an already populated org
  const existingMembersCount = await prisma.member.count({ where: { orgId: org.id } });
  if (existingMembersCount >= 600) {
    const existingCheckIns = await prisma.checkIn.count({ where: { orgId: org.id } });
    return { orgId: org.id, memberCount: existingMembersCount, checkInCount: existingCheckIns };
  }

  // 2. Seed Staff Accounts (all 6 roles + 6 Trainers total)
  const staffDefs: Array<{ email: string; phone: string; name: string; role: Role; branchIds: string[] }> = [
    { email: "owner@ironworks.in", phone: "+91 98450 10001", name: "Siddharth Menon (Owner)", role: "OWNER", branchIds: [branchA.id, branchB.id] },
    { email: "manager.blr@ironworks.in", phone: "+91 98450 10002", name: "Ritika Kapoor (BLR Mgr)", role: "MANAGER", branchIds: [branchA.id] },
    { email: "frontdesk.blr@ironworks.in", phone: "+91 98450 10003", name: "Nikhil Verma (Front Desk)", role: "FRONTDESK", branchIds: [branchA.id] },
    { email: "trainer.blr@ironworks.in", phone: "+91 98450 10004", name: "Vikram Rathore (Head Coach)", role: "TRAINER", branchIds: [branchA.id] },
    { email: "accountant@ironworks.in", phone: "+91 98450 10005", name: "Anjali Iyer (Accountant)", role: "ACCOUNTANT", branchIds: [branchA.id, branchB.id] },
    { email: "member@ironworks.in", phone: "+91 98450 10006", name: "Karan Sharma (Member)", role: "MEMBER", branchIds: [branchA.id] },
    { email: "coach.meera@ironworks.in", phone: "+91 98450 10007", name: "Meera Menon (Coach)", role: "TRAINER", branchIds: [branchA.id] },
    { email: "coach.rohan@ironworks.in", phone: "+91 98450 10008", name: "Rohan Kulkarni (Coach)", role: "TRAINER", branchIds: [branchA.id] },
    { email: "coach.kavya@ironworks.in", phone: "+91 98450 10009", name: "Kavya Nair (Coach)", role: "TRAINER", branchIds: [branchB.id] },
    { email: "coach.arjun@ironworks.in", phone: "+91 98450 10010", name: "Arjun Deshmukh (Coach)", role: "TRAINER", branchIds: [branchB.id] },
    { email: "coach.neha@ironworks.in", phone: "+91 98450 10011", name: "Neha Joshi (Coach)", role: "TRAINER", branchIds: [branchB.id] },
  ];

  const trainerUserIds: string[] = [];
  let ownerUserId = "";
  let frontDeskUserId = "";
  let managerUserId = "";

  for (const s of staffDefs) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: { name: s.name },
      create: {
        email: s.email,
        phone: s.phone,
        name: s.name,
        passwordHash: demoPassHash,
      },
    });
    await prisma.orgMembership.upsert({
      where: { orgId_userId: { orgId: org.id, userId: user.id } },
      update: { role: s.role, branchIds: s.branchIds, acceptedAt: now },
      create: {
        orgId: org.id,
        userId: user.id,
        role: s.role,
        branchIds: s.branchIds,
        acceptedAt: now,
      },
    });
    if (s.role === "OWNER" && !ownerUserId) ownerUserId = user.id;
    if (s.role === "FRONTDESK" && !frontDeskUserId) frontDeskUserId = user.id;
    if (s.role === "MANAGER" && !managerUserId) managerUserId = user.id;
    if (s.role === "TRAINER") trainerUserIds.push(user.id);
  }
  if (!frontDeskUserId) frontDeskUserId = ownerUserId;
  if (!managerUserId) managerUserId = ownerUserId;

  // Branch holidays
  await prisma.branchHoliday.createMany({
    data: [
      { orgId: org.id, branchId: branchA.id, date: new Date("2026-01-26T00:00:00Z"), title: "Republic Day" },
      { orgId: org.id, branchId: branchA.id, date: new Date("2026-10-20T00:00:00Z"), title: "Deepavali Half-Day" },
      { orgId: org.id, branchId: branchB.id, date: new Date("2026-05-01T00:00:00Z"), title: "Maharashtra Day" },
    ],
  });

  // 3. Seed 12 Plans, 4 Addons, 3 PromoCodes
  const plans = [];
  for (const p of PLANS_BLUEPRINT) {
    const created = await prisma.plan.upsert({
      where: { orgId_code: { orgId: org.id, code: p.code } },
      update: {},
      create: {
        orgId: org.id,
        name: p.name,
        code: p.code,
        billingModel: p.billingModel,
        durationDays: p.durationDays,
        sessionCredits: p.sessionCredits,
        pricePaise: p.pricePaise,
        joiningFeePaise: p.joiningFeePaise,
        maxFreezeDays: p.maxFreezeDays,
        freezeFeePaise: p.freezeFeePaise,
        autoRenewDefault: p.billingModel === "MONTHLY" || p.billingModel === "QUARTERLY",
      },
    });
    plans.push(created);
  }

  await prisma.planAddon.createMany({
    data: [
      { orgId: org.id, name: "Dedicated Steel Locker", kind: "LOCKER", pricePaise: 59900, durationDays: 30 },
      { orgId: org.id, name: "Fresh Turkish Towel Service", kind: "TOWEL", pricePaise: 39900, durationDays: 30 },
      { orgId: org.id, name: "Steam & Ice Plunge Access", kind: "STEAM", pricePaise: 99900, durationDays: 30 },
      { orgId: org.id, name: "Basement Valet Parking", kind: "PARKING", pricePaise: 79900, durationDays: 30 },
    ],
  });

  await prisma.promoCode.createMany({
    skipDuplicates: true,
    data: [
      { orgId: org.id, code: "EARLYBIRD15", discountType: "PERCENT_BPS", discountValue: 1500, scope: "EARLY_BIRD", validFrom: new Date("2026-01-01T00:00:00Z"), validUntil: new Date("2027-12-31T00:00:00Z") },
      { orgId: org.id, code: "REF500", discountType: "FIXED_PAISE", discountValue: 50000, scope: "REFERRAL", validFrom: new Date("2026-01-01T00:00:00Z"), validUntil: new Date("2027-12-31T00:00:00Z") },
      { orgId: org.id, code: "FOUNDERS20", discountType: "PERCENT_BPS", discountValue: 2000, scope: "PROMO", validFrom: new Date("2026-01-01T00:00:00Z"), validUntil: new Date("2027-12-31T00:00:00Z") },
    ],
  });

  // Member Groups (Family / Couple / Corporate)
  const familyGroup = await prisma.memberGroup.create({
    data: { orgId: org.id, branchId: branchA.id, type: "FAMILY", name: "Sharma Household" },
  });
  const corpGroup = await prisma.memberGroup.create({
    data: { orgId: org.id, branchId: branchB.id, type: "CORPORATE", name: "Zeta FinTech Corporate" },
  });

  // 4. Create 600 Members across all statuses
  const memberRowsData: Array<{
    id: string;
    orgId: string;
    branchId: string;
    memberCode: string;
    qrToken: string;
    fullName: string;
    phone: string;
    email: string;
    stateCode: string;
    emergencyName: string;
    emergencyPhone: string;
    goals: string;
    healthNotesEnc: string;
    healthConsentAt: Date;
    status: MemberStatus;
    expiryDate: Date;
    lastVisitedAt: Date;
    dob: Date;
    createdAt: Date;
    groupId: string | null;
    assignedTrainerId: string;
    referralCode: string;
    tags: string[];
  }> = [];

  const memberIds: string[] = [];
  const memberBranchMap = new Map<string, { branchId: string; stateCode: string; status: MemberStatus }>();

  for (let i = 0; i < 600; i++) {
    const id = `mem_${org.id.slice(-6)}_${String(i + 1).padStart(4, "0")}`;
    memberIds.push(id);
    const isBranchA = i % 5 < 3; // 60% Indiranagar HQ, 40% Bandra West evenly across all statuses
    const branch = isBranchA ? branchA : branchB;
    const fn = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)]!;
    const ln = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)]!;
    const fullName = i === 0 ? "Aarav Sharma" : i === 1 ? "Rhea Kapoor" : `${fn} ${ln}`;

    let status: MemberStatus;
    let expiryOffsetDays: number;
    let lastVisitOffsetDays: number;

    if (i < 395) {
      status = "ACTIVE";
      expiryOffsetDays = 12 + Math.floor(rand() * 260);
      lastVisitOffsetDays = Math.floor(rand() * 6);
    } else if (i < 455) {
      status = "EXPIRING";
      expiryOffsetDays = 1 + Math.floor(rand() * 6); // Next 7 days!
      lastVisitOffsetDays = Math.floor(rand() * 10);
    } else if (i < 510) {
      status = "OVERDUE";
      expiryOffsetDays = 5 + Math.floor(rand() * 45);
      lastVisitOffsetDays = 8 + Math.floor(rand() * 18);
    } else if (i < 545) {
      status = "FROZEN";
      expiryOffsetDays = 35 + Math.floor(rand() * 90);
      lastVisitOffsetDays = 12 + Math.floor(rand() * 20);
    } else {
      status = "EXPIRED";
      expiryOffsetDays = -(1 + Math.floor(rand() * 50));
      lastVisitOffsetDays = 14 + Math.floor(rand() * 35);
    }

    const expiryDate = new Date(now.getTime() + expiryOffsetDays * 86_400_000);
    const lastVisitedAt = new Date(now.getTime() - lastVisitOffsetDays * 86_400_000);
    const joinMonthsAgo = i % 6;
    const joinedAt =
      i >= 585
        ? new Date(now.getTime() - (1 + (i % 10)) * 86_400_000) // recent NEW_JOINERS
        : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - joinMonthsAgo, 3 + (i % 20)));
    const dobYear = 1986 + (i % 16);
    const dob =
      i < 4
        ? new Date(Date.UTC(dobYear, now.getUTCMonth(), now.getUTCDate())) // today's birthdays
        : new Date(Date.UTC(dobYear, i % 12, 1 + (i % 28)));
    const trainerId = trainerUserIds[i % Math.max(1, trainerUserIds.length)] ?? ownerUserId;
    const tagPool =
      status === "EXPIRING"
        ? ["renewal-priority", "whatsapp-ok"]
        : status === "OVERDUE"
        ? ["dues-follow-up"]
        : i % 5 === 0
        ? ["pt-prospect", "hypertrophy"]
        : ["general-fitness"];

    memberBranchMap.set(id, { branchId: branch.id, stateCode: branch.stateCode, status });

    memberRowsData.push({
      id,
      orgId: org.id,
      branchId: branch.id,
      memberCode: `FM-${String(1001 + i)}`,
      qrToken: `FORGEQR-${org.slug.slice(0, 3).toUpperCase()}-${String(1001 + i)}`,
      fullName,
      phone: `+91 9${String(100000000 + i * 1497).slice(0, 9)}`,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}.${i + 1}@example.in`,
      stateCode: branch.stateCode,
      emergencyName: `Family Contact (${ln})`,
      emergencyPhone: `+91 98${String(10000000 + i * 733).slice(0, 8)}`,
      goals: i % 3 === 0 ? "Lean muscle mass (+4kg) & 120kg bench press" : i % 3 === 1 ? "Fat loss (-8kg) & 5k stamina" : "Joint mobility & athletic conditioning",
      healthNotesEnc: encryptSensitiveField(HEALTH_SAMPLES[i % HEALTH_SAMPLES.length]!),
      healthConsentAt: now,
      status,
      expiryDate,
      lastVisitedAt,
      dob,
      createdAt: joinedAt,
      groupId: i < 4 ? familyGroup.id : i % 80 === 10 ? corpGroup.id : null,
      assignedTrainerId: trainerId,
      referralCode: `REF${String(2000 + i)}`,
      tags: tagPool,
    });
  }

  await prisma.member.createMany({ data: memberRowsData });

  // Detailed records for first 45 members (consents, measurements, waivers, notes, comms)
  const consentRows = [];
  const measurementRows = [];
  const documentRows = [];
  const noteRows = [];
  const commRows = [];

  for (let i = 0; i < memberRowsData.length; i++) {
    const m = memberRowsData[i]!;
    consentRows.push({
      orgId: org.id,
      branchId: m.branchId,
      memberId: m.id,
      channel: "WHATSAPP" as const,
      granted: i % 8 !== 7, // ~87.5% opted in, 12.5% opted out for realistic broadcast filtering
      source: i % 8 === 7 ? "Member STOP opt-out" : "Front-desk signup",
    });
    if (i < 60) {
      consentRows.push({
        orgId: org.id,
        branchId: m.branchId,
        memberId: m.id,
        channel: "HEALTH_DATA" as const,
        granted: true,
        source: "DPDP Health Consent",
      });
    }
    if (i >= 60) continue;
    measurementRows.push(
      {
        orgId: org.id,
        branchId: m.branchId,
        memberId: m.id,
        recordedAt: new Date(now.getTime() - 35 * 86_400_000),
        weightGrams: 74500 + (i % 15) * 800,
        bodyFatBps: 1950 + (i % 6) * 100,
        waistMm: 830 + (i % 5) * 10,
      },
      {
        orgId: org.id,
        branchId: m.branchId,
        memberId: m.id,
        recordedAt: new Date(now.getTime() - 3 * 86_400_000),
        weightGrams: 72800 + (i % 15) * 750,
        bodyFatBps: 1780 + (i % 6) * 90,
        waistMm: 805 + (i % 5) * 10,
      }
    );
    documentRows.push({
      orgId: org.id,
      branchId: m.branchId,
      memberId: m.id,
      kind: "WAIVER" as const,
      title: "Gym Liability Waiver & PAR-Q",
      signedAt: new Date(now.getTime() - 40 * 86_400_000),
      signedIp: "103.21.58.12",
      signerName: m.fullName,
    });
    noteRows.push({
      orgId: org.id,
      branchId: m.branchId,
      memberId: m.id,
      authorUserId: m.assignedTrainerId,
      kind: "NOTE" as const,
      body: "Completed baseline squat & hinge movement screening cleanly.",
      pinned: true,
    });
    commRows.push({
      orgId: org.id,
      branchId: m.branchId,
      memberId: m.id,
      channel: "WHATSAPP" as const,
      direction: "OUTBOUND",
      templateCode: "WELCOME_CHECKLIST",
      body: `Welcome to Ironworks ${m.fullName.split(" ")[0]}! Your QR pass ${m.memberCode} is active.`,
      status: "DELIVERED" as const,
    });
  }
  await prisma.consentRecord.createMany({ data: consentRows });
  await prisma.memberMeasurement.createMany({ data: measurementRows });
  await prisma.memberDocument.createMany({ data: documentRows });
  await prisma.memberNote.createMany({ data: noteRows });
  await prisma.communicationLog.createMany({ data: commRows });

  // 5. Subscriptions & 18 Months of GST Invoices & Payments
  const membershipData = [];
  const invoiceData = [];
  const lineItemData = [];
  const paymentData = [];
  let invSeqA = 1;
  let invSeqB = 1;

  for (let i = 0; i < memberRowsData.length; i++) {
    const m = memberRowsData[i]!;
    const plan = plans[i % 8]!;
    const subId = `sub_${org.id.slice(-6)}_${String(i + 1).padStart(4, "0")}`;
    const endDate = m.expiryDate;
    const startDate = new Date(endDate.getTime() - plan.durationDays * 86_400_000);

    membershipData.push({
      id: subId,
      orgId: org.id,
      branchId: m.branchId,
      memberId: m.id,
      planId: plan.id,
      status: m.status,
      startDate,
      endDate,
      basePricePaise: plan.pricePaise,
      discountPaise: i % 6 === 0 ? 50000 : 0,
      joiningFeePaise: plan.joiningFeePaise,
      sessionsTotal: plan.sessionCredits,
      sessionsRemaining: plan.sessionCredits ? Math.max(1, Math.floor(plan.sessionCredits / 2)) : null,
      autoRenew: plan.autoRenewDefault,
      freezeDaysUsed: m.status === "FROZEN" ? 12 : 0,
    });

    // Generate 2 historical/current invoices per member evenly across 18 months & past 30 days
    for (let cycle = 0; cycle < 2; cycle++) {
      let issueDate: Date;
      if (cycle === 0) {
        const monthsAgo = 2 + (i % 16);
        issueDate = new Date(now.getTime() - (monthsAgo * 30 + (i % 25)) * 86_400_000);
      } else {
        const daysAgo =
          i % 45 === 0
            ? 0
            : i % 4 === 0
            ? 1 + (i % 28)
            : 30 + (i % 120);
        issueDate = new Date(now.getTime() - daysAgo * 86_400_000 - (i % 6) * 3600_000);
      }

      const isBranchA = m.branchId === branchA.id;
      const invSeq = isBranchA ? invSeqA++ : invSeqB++;
      const invNo = `${isBranchA ? branchA.invoiceSeriesPrefix : branchB.invoiceSeriesPrefix}-${String(invSeq).padStart(5, "0")}`;
      const supplyState = i % 25 === 0 ? (isBranchA ? "MH" : "KA") : m.stateCode;
      const gst = aggregateGstInvoice(
        [
          {
            description: `${plan.name} (${plan.durationDays}d)`,
            unitPricePaise: plan.pricePaise,
            quantity: 1,
            discountPaise: i % 6 === 0 ? 50000 : 0,
            gstRateBps: 1800,
          },
        ],
        supplyState,
        m.stateCode
      );

      const isOverduePartial = cycle === 1 && m.status === "OVERDUE";
      const paidPaise = isOverduePartial ? Math.round(gst.totalPaise * 0.45) : gst.totalPaise;
      const balanceDuePaise = gst.totalPaise - paidPaise;
      const status =
        balanceDuePaise === 0 ? ("PAID" as const) : ("PARTIALLY_PAID" as const);
      const invId = `inv_${org.id.slice(-6)}_${isBranchA ? "a" : "b"}_${invSeq}`;

      invoiceData.push({
        id: invId,
        orgId: org.id,
        branchId: m.branchId,
        memberId: m.id,
        membershipId: subId,
        invoiceNumber: invNo,
        issueDate,
        dueDate: isOverduePartial ? new Date(now.getTime() - (6 + (i % 45)) * 86_400_000) : issueDate,
        status,
        currency: org.currency,
        sacCode: "999723",
        placeOfSupplyState: supplyState,
        branchStateCode: m.stateCode,
        subtotalPaise: gst.subtotalPaise,
        discountPaise: gst.discountPaise,
        taxablePaise: gst.taxablePaise,
        cgstPaise: gst.cgstPaise,
        sgstPaise: gst.sgstPaise,
        igstPaise: gst.igstPaise,
        totalPaise: gst.totalPaise,
        paidPaise,
        balanceDuePaise,
      });

      const line = gst.lines[0]!;
      lineItemData.push({
        orgId: org.id,
        branchId: m.branchId,
        invoiceId: invId,
        description: line.description,
        quantity: 1,
        unitPricePaise: line.unitPricePaise,
        discountPaise: line.discountPaise,
        gstRateBps: line.gstRateBps,
        cgstPaise: line.cgstPaise,
        sgstPaise: line.sgstPaise,
        igstPaise: line.igstPaise,
        totalPaise: line.totalPaise,
      });

      if (paidPaise > 0) {
        const method = PAY_METHODS[(i + cycle) % PAY_METHODS.length]!;
        paymentData.push({
          orgId: org.id,
          branchId: m.branchId,
          memberId: m.id,
          invoiceId: invId,
          amountPaise: paidPaise,
          method,
          provider: method === "UPI" || method === "CARD" ? ("RAZORPAY" as const) : ("MANUAL" as const),
          providerPaymentId: method === "UPI" || method === "CARD" ? `pay_mock_${invSeq}_${cycle}` : null,
          idempotencyKey: `seed_pay_${invId}`,
          status: "CAPTURED" as const,
          paidAt: issueDate,
          collectedById: ownerUserId,
        });
      }
    }
  }

  await prisma.membership.createMany({ data: membershipData });
  await prisma.invoice.createMany({ data: invoiceData });
  await prisma.invoiceLineItem.createMany({ data: lineItemData });
  await prisma.payment.createMany({ data: paymentData });

  // Sample expenses & freeze record
  const freezeTarget = membershipData.find((s) => s.status === "FROZEN");
  if (freezeTarget) {
    await prisma.membershipFreeze.create({
      data: {
        orgId: org.id,
        branchId: freezeTarget.branchId,
        membershipId: freezeTarget.id,
        memberId: freezeTarget.memberId,
        startDate: new Date(now.getTime() - 12 * 86_400_000),
        endDate: new Date(now.getTime() + 2 * 86_400_000),
        daysCount: 14,
        feePaise: 29900,
        reason: "Business travel abroad",
        approvedById: ownerUserId,
      },
    });
  }

  const expenseData = [];
  const expenseCategories = [
    ["Facility Rent", "Brigade Realty LLP", 18500000],
    ["Electricity & DG", "BESCOM Commercial", 4250000],
    ["Equipment AMC", "Technogym India Service", 2800000],
    ["Supplement Inventory", "MuscleBlaze Wholesale", 3400000],
    ["Housekeeping & Towels", "CleanPro Facility Services", 1950000],
  ] as const;

  for (let m = 0; m < 18; m++) {
    for (const [cat, vendor, amt] of expenseCategories) {
      expenseData.push({
        orgId: org.id,
        branchId: m % 2 === 0 ? branchA.id : branchB.id,
        category: cat,
        vendorName: vendor,
        description: `${cat} — month -${m}`,
        amountPaise: amt,
        gstPaise: Math.round((amt * 1800) / 10_000),
        incurredOn: new Date(now.getTime() - m * 30 * 86_400_000),
        createdById: ownerUserId,
      });
    }
  }
  await prisma.expense.createMany({ data: expenseData });

  // 6. Seed 40,000 Check-ins across 540 days in 5,000-row batches (realistic IST morning/evening curves)
  // Peak hours in IST: 6-10 AM and 5-9 PM
  const hourDistribution = [
    6, 6, 7, 7, 7, 8, 8, 8, 9, 10, 11, 14, 16, 17, 17, 18, 18, 18, 19, 19, 19, 20, 20, 21,
  ];
  const BATCH_SIZE = 5000;
  const TOTAL_CHECKINS = 40_000;
  const istTodayBase = new Date(now.getTime());

  for (let offset = 0; offset < TOTAL_CHECKINS; offset += BATCH_SIZE) {
    const batch = [];
    for (let j = 0; j < BATCH_SIZE; j++) {
      const idx = offset + j;
      const m = memberRowsData[idx % 545]!; // active/expiring/overdue attend regularly
      // Recent today check-ins (first 110 rows placed inside today for "CHECK-INS NOW" tile!)
      const isToday = idx < 110;
      const daysAgo = isToday ? 0 : Math.floor(rand() * 365);
      const istHour = hourDistribution[Math.floor(rand() * hourDistribution.length)]!;
      const minute = Math.floor(rand() * 60);

      let visitedAt: Date;
      if (isToday) {
        visitedAt = new Date(istTodayBase.getTime() - Math.floor(rand() * 6 * 3600_000));
      } else {
        // Store UTC equivalent of IST hour (UTC = IST - 5h30m)
        const baseDay = new Date(now.getTime() - daysAgo * 86_400_000);
        baseDay.setUTCHours(istHour - 5, minute, 0, 0);
        visitedAt = baseDay;
      }

      batch.push({
        orgId: org.id,
        branchId: m.branchId,
        memberId: m.id,
        visitedAt,
        method: idx % 9 === 0 ? ("MANUAL" as const) : ("QR" as const),
        result: idx % 140 === 139 ? ("BLOCKED_EXPIRED" as const) : ("ALLOWED" as const),
        checkedInById: ownerUserId,
      });
    }
    await prisma.checkIn.createMany({ data: batch });
  }

  // 7. Seed 300 Leads across all 7 stages + Tasks + Source Ad Spend + Phase 2 Growth Engine
  const lostReasons = [
    "Price / budget mismatch",
    "Joined competitor closer to home",
    "Schedule conflict — morning slots full",
    "Travelling for 6 weeks",
  ];
  const leadData = [];
  const leadTaskData = [];
  for (let i = 0; i < 300; i++) {
    const id = `lead_${org.id.slice(-6)}_${String(i + 1).padStart(4, "0")}`;
    const branch = i % 2 === 0 ? branchA : branchB;
    const fn = FIRST_NAMES[(i * 7) % FIRST_NAMES.length]!;
    const ln = LAST_NAMES[(i * 3) % LAST_NAMES.length]!;
    const stage = LEAD_STAGES[i % LEAD_STAGES.length]!;
    const daysAgo = Math.floor(rand() * 60);
    const createdAt = i < 14 ? new Date(now.getTime() - i * 3600_000) : new Date(now.getTime() - daysAgo * 86_400_000);
    const convertedMember = stage === "WON" ? memberRowsData[(i * 7) % 395] : undefined;

    leadData.push({
      id,
      orgId: org.id,
      branchId: branch.id,
      fullName: `${fn} ${ln}`,
      phone: `+91 97${String(10000000 + i * 911).slice(0, 8)}`,
      email: `lead.${fn.toLowerCase()}.${i}@mail.in`,
      source: LEAD_SOURCES[i % LEAD_SOURCES.length]!,
      stage,
      score: stage === "LOST" ? 10 : Math.min(98, 42 + (i % 55)),
      trialAt:
        stage === "TRIAL_BOOKED"
          ? new Date(now.getTime() + (2 + (i % 48)) * 3600_000)
          : stage === "TRIAL_DONE"
          ? new Date(now.getTime() - (1 + (i % 5)) * 86_400_000)
          : null,
      lostReason: stage === "LOST" ? lostReasons[i % lostReasons.length]! : null,
      ownerId: i % 3 === 0 ? frontDeskUserId : i % 3 === 1 ? managerUserId : ownerUserId,
      convertedMemberId: convertedMember?.id ?? null,
      notes: stage === "NEGOTIATION" ? "Asked for 2-installment UPI option on Strength Quarterly." : null,
      createdAt,
    });

    if (i < 24 && stage !== "WON" && stage !== "LOST") {
      leadTaskData.push({
        orgId: org.id,
        branchId: branch.id,
        leadId: id,
        title:
          stage === "TRIAL_BOOKED"
            ? "Confirm trial mat & coach slot 2h prior"
            : stage === "NEGOTIATION"
            ? "Send EARLYBIRD15 + UPI split quote"
            : "Intro call & book tour walkthrough",
        dueAt: new Date(now.getTime() + (i % 6) * 3600_000),
        status: i < 4 ? ("DONE" as const) : ("OPEN" as const),
        assignedToId: i % 2 === 0 ? frontDeskUserId : ownerUserId,
      });
    }
  }
  await prisma.lead.createMany({ data: leadData });
  await prisma.leadTask.createMany({ data: leadTaskData });

  // Source Ad Spend Campaigns (for Source ROI report)
  const monthYm = now.toISOString().slice(0, 7);
  await prisma.adSpendCampaign.createMany({
    data: [
      { orgId: org.id, branchId: branchA.id, source: "Instagram", monthYm, spendPaise: 3200000, note: "Meta Reels transformation ads BLR+MUM" },
      { orgId: org.id, branchId: branchA.id, source: "Google", monthYm, spendPaise: 2800000, note: "Local high-intent gym keywords" },
      { orgId: org.id, branchId: branchA.id, source: "Justdial", monthYm, spendPaise: 1500000, note: "Justdial verified platinum listing" },
      { orgId: org.id, branchId: branchA.id, source: "Website", monthYm, spendPaise: 600000, note: "SEO & landing embed" },
      { orgId: org.id, branchId: branchA.id, source: "WhatsApp", monthYm, spendPaise: 350000, note: "Click-to-WhatsApp enquiry bot" },
      { orgId: org.id, branchId: branchA.id, source: "Referral", monthYm, spendPaise: 850000, note: "REF500 friend-credit vouchers" },
      { orgId: org.id, branchId: branchA.id, source: "Walk-in", monthYm, spendPaise: 200000, note: "Street facade signage & QR standee" },
    ],
  });

  // Communication Center: Templates, 2-Way Inbox Threads, Broadcast Campaigns
  await prisma.messageTemplate.createMany({
    data: [
      {
        orgId: org.id,
        code: "WELCOME_CHECKLIST",
        name: "Day-1 Welcome & QR Check-In",
        channel: "WHATSAPP",
        body: "Welcome to {branch}, {name}! Your {plan} pass is active until {expiry}. Show your FORGE QR at reception.",
        variables: ["{name}", "{plan}", "{expiry}", "{branch}"],
        approvalStatus: "APPROVED",
      },
      {
        orgId: org.id,
        code: "EXPIRY_REMINDER_7D",
        name: "T-7 Plan Renewal Nudge",
        channel: "WHATSAPP",
        body: "Hi {name}, your {plan} expires on {expiry}. Renew now at {branch} desk to keep your streak unbroken.",
        variables: ["{name}", "{plan}", "{expiry}", "{branch}"],
        approvalStatus: "APPROVED",
      },
      {
        orgId: org.id,
        code: "DUES_PAYMENT_LINK",
        name: "Pending Balance UPI Reminder",
        channel: "WHATSAPP",
        body: "Hi {name}, pending balance of {due_amount} is open on your {plan} invoice. Reply LINK for instant UPI checkout.",
        variables: ["{name}", "{plan}", "{due_amount}"],
        approvalStatus: "APPROVED",
      },
      {
        orgId: org.id,
        code: "BIRTHDAY_PERK",
        name: "Member Birthday Complimentary Guest Pass",
        channel: "WHATSAPP",
        body: "Happy Birthday {name}! Enjoy 2 complimentary guest passes + coach Mobility Reset session this week at {branch}.",
        variables: ["{name}", "{branch}"],
        approvalStatus: "APPROVED",
      },
      {
        orgId: org.id,
        code: "WINBACK_COME_BACK",
        name: "30-Day Win-Back Restart Offer",
        channel: "WHATSAPP",
        body: "Hey {name}, we miss you at {branch}! Restart your {plan} this month with ₹500 loyalty credit.",
        variables: ["{name}", "{plan}", "{branch}"],
        approvalStatus: "PENDING_META",
      },
      {
        orgId: org.id,
        code: "SMS_PAYMENT_RECEIPT",
        name: "GST Invoice Confirmation SMS",
        channel: "SMS",
        body: "FORGE CRM: Receipt confirmed for {name} ({plan}). Pending balance: {due_amount}.",
        variables: ["{name}", "{plan}", "{due_amount}"],
        approvalStatus: "APPROVED",
      },
    ],
  });

  const inboxTargets = [
    { idx: 0, unread: 1, msgIn: "Hi team, can I freeze my membership for 5 days next week for travel?", msgOut: "Hi Aarav! Yes, Strength Quarterly includes 15 freeze days with ₹0 fee." },
    { idx: 1, unread: 2, msgIn: "Can I book my 6 PM assessment slot with Coach Vikram tomorrow?", msgOut: "Confirmed for 6:00 PM at Indiranagar HQ!" },
    { idx: 396, unread: 1, msgIn: "Saw my T-7 renewal alert. Does REF500 apply on Quarterly?", msgOut: "Yes! REF500 knocks ₹500 off Quarterly and Annual renewals." },
    { idx: 456, unread: 1, msgIn: "Please resend my UPI split link for the pending balance.", msgOut: "Sending your ₹1,999 UPI payment link right away." },
    { idx: 2, unread: 0, msgIn: "Thanks, receipt downloaded cleanly!", msgOut: "Happy to help. See you on the barbell floor!" },
    { idx: 5, unread: 0, msgIn: "What time does Bandra West Club open on Sundays?", msgOut: "Bandra West Club opens 06:00 AM to 10:30 PM on Sundays." },
    { idx: 12, unread: 1, msgIn: "I referred my colleague Siddharth — how do I check my bonus days?", msgOut: "Your code REF2012 is active — 7 free days credit immediately on his signup!" },
    { idx: 18, unread: 0, msgIn: "Got the workout tracker PDF, thank you coach!", msgOut: "Keep pushing!" },
  ];

  for (let t = 0; t < inboxTargets.length; t++) {
    const spec = inboxTargets[t]!;
    const mem = memberRowsData[spec.idx]!;
    const thread = await prisma.inboxThread.create({
      data: {
        orgId: org.id,
        branchId: mem.branchId,
        memberId: mem.id,
        contactName: mem.fullName,
        contactPhone: mem.phone,
        channel: "WHATSAPP",
        assignedToId: t % 2 === 0 ? frontDeskUserId : managerUserId,
        unreadCount: spec.unread,
        status: "OPEN",
        lastPreview: spec.unread > 0 ? spec.msgIn : spec.msgOut,
        lastMessageAt: new Date(now.getTime() - (t * 45 + 10) * 60_000),
      },
    });
    await prisma.inboxMessage.createMany({
      data: [
        {
          orgId: org.id,
          threadId: thread.id,
          direction: "OUTBOUND",
          body: `Hi ${mem.fullName.split(" ")[0]}, welcome to Ironworks Athletics WhatsApp Desk!`,
          status: "READ",
          senderName: "Nikhil Verma (Front Desk)",
          createdAt: new Date(now.getTime() - (t + 2) * 3600_000),
        },
        {
          orgId: org.id,
          threadId: thread.id,
          direction: "INBOUND",
          body: spec.msgIn,
          status: "DELIVERED",
          senderName: mem.fullName,
          createdAt: new Date(now.getTime() - (t * 50 + 25) * 60_000),
        },
        ...(spec.unread === 0
          ? [
              {
                orgId: org.id,
                threadId: thread.id,
                direction: "OUTBOUND",
                body: spec.msgOut,
                status: "READ",
                senderName: "Siddharth Menon (Owner)",
                createdAt: new Date(now.getTime() - (t * 45 + 10) * 60_000),
              },
            ]
          : []),
      ],
    });
  }

  await prisma.broadcastCampaign.createMany({
    data: [
      {
        orgId: org.id,
        branchId: branchA.id,
        name: "November Renewal Blitz (7d Expiring)",
        segmentKey: "EXPIRING",
        channel: "WHATSAPP",
        templateCode: "EXPIRY_REMINDER_7D",
        bodyPreview: "Hi {name}, your {plan} expires on {expiry}. Renew at Indiranagar HQ for ₹500 credit.",
        scheduledAt: new Date(now.getTime() - 2 * 86_400_000),
        throttlePerMin: 45,
        status: "DISPATCHED",
        targetCount: 60,
        sentCount: 52,
        deliveredCount: 50,
        readCount: 41,
        repliedCount: 14,
        blockedOptOutCount: 8,
      },
      {
        orgId: org.id,
        branchId: branchB.id,
        name: "14-Day Absentee Reactivation Nudge",
        segmentKey: "INACTIVE",
        channel: "WHATSAPP",
        templateCode: "WINBACK_COME_BACK",
        bodyPreview: "Haven't seen you on the floor in 14d — claim a free 25-min mobility reset session!",
        scheduledAt: new Date(now.getTime() - 4 * 86_400_000),
        throttlePerMin: 30,
        status: "DISPATCHED",
        targetCount: 48,
        sentCount: 41,
        deliveredCount: 39,
        readCount: 28,
        repliedCount: 9,
        blockedOptOutCount: 7,
      },
      {
        orgId: org.id,
        branchId: null,
        name: "PT Pack Priority Bench Assessment",
        segmentKey: "PT_CLIENTS",
        channel: "WHATSAPP",
        templateCode: "WELCOME_CHECKLIST",
        bodyPreview: "Monthly DEXA & barbell strength re-test slots open this weekend.",
        scheduledAt: new Date(now.getTime() - 6 * 86_400_000),
        throttlePerMin: 60,
        status: "DISPATCHED",
        targetCount: 120,
        sentCount: 105,
        deliveredCount: 101,
        readCount: 84,
        repliedCount: 22,
        blockedOptOutCount: 15,
      },
      {
        orgId: org.id,
        branchId: null,
        name: "Pending Dues Gentle Reminder",
        segmentKey: "UNPAID",
        channel: "WHATSAPP",
        templateCode: "DUES_PAYMENT_LINK",
        bodyPreview: "Friendly reminder on open club balance — reply LINK to settle via UPI.",
        scheduledAt: new Date(now.getTime() - 86_400_000),
        throttlePerMin: 40,
        status: "DISPATCHED",
        targetCount: 55,
        sentCount: 48,
        deliveredCount: 47,
        readCount: 36,
        repliedCount: 11,
        blockedOptOutCount: 7,
      },
    ],
  });

  // Automations (all 9+ workflow recipes with cap & quiet hours)
  const ruleDefs = [
    { name: "Day-1 Welcome Series", triggerKey: "WELCOME_SERIES", conditionLabel: "Joined <= 2 days ago", delayMinutes: 30, msg: "Welcome to {branch}, {name}! Your {plan} onboarding & trainer intro awaits." },
    { name: "Expiry Reminder T-7", triggerKey: "EXPIRY_T7", conditionLabel: "Expires in 7 days", delayMinutes: 0, msg: "Hi {name}, 7 days left on {plan} ({expiry}). Renew early to lock bonus days." },
    { name: "Expiry Reminder T-3", triggerKey: "EXPIRY_T3", conditionLabel: "Expires in 3 days", delayMinutes: 0, msg: "{name}, 3 days remaining on {plan}. Reply RENEW for instant UPI checkout." },
    { name: "Expiry Alert T-0", triggerKey: "EXPIRY_T0", conditionLabel: "Expires today", delayMinutes: 0, msg: "Heads up {name} — your {plan} ends today at {branch}. Don't lose your streak!" },
    { name: "Grace Follow-up T+3", triggerKey: "EXPIRY_T_PLUS_3", conditionLabel: "Expired 3 days ago", delayMinutes: 60, msg: "Hi {name}, your gate pass paused 3d ago. Restart today with waived joining fee." },
    { name: "Payment Due & Failed Auto-Dunning", triggerKey: "PAYMENT_DUE", conditionLabel: "Overdue invoice > ₹0", delayMinutes: 120, msg: "Hi {name}, pending {due_amount} on your {plan} cycle. Tap LINK to clear via UPI." },
    { name: "Missed Workout Nudge (7+ Days)", triggerKey: "MISSED_WORKOUT", conditionLabel: "No visit >= 7 days", delayMinutes: 0, msg: "Missed you at {branch}, {name}! Want Coach Vikram to prep an express 35-min session?" },
    { name: "Birthday Gift Perk", triggerKey: "BIRTHDAY", conditionLabel: "DOB matches today", delayMinutes: 0, msg: "Happy Birthday {name}! Show this message at desk for 2 complimentary guest passes." },
    { name: "Win-Back After 30 Days", triggerKey: "WINBACK_30D", conditionLabel: "Expired >= 30 days", delayMinutes: 0, msg: "Hey {name}, come back to {branch}! Enjoy 15% off with EARLYBIRD15 this week." },
    { name: "5th Visit Milestone Feedback", triggerKey: "FEEDBACK_5TH_VISIT", conditionLabel: "Total visits >= 5", delayMinutes: 180, msg: "High-five on check-in #5, {name}! Rate your {branch} floor experience 1-5." },
    { name: "Referral Thank-You Credit", triggerKey: "REFERRAL_THANKYOU", conditionLabel: "Referred friend joined", delayMinutes: 15, msg: "Thanks for growing the pack, {name}! 7 free days added to your {plan}." },
  ];

  for (let r = 0; r < ruleDefs.length; r++) {
    const rd = ruleDefs[r]!;
    const rule = await prisma.automationRule.create({
      data: {
        orgId: org.id,
        branchId: null,
        name: rd.name,
        triggerKey: rd.triggerKey,
        conditionLabel: rd.conditionLabel,
        actionChannel: "WHATSAPP",
        messageTemplate: rd.msg,
        delayMinutes: rd.delayMinutes,
        maxPerMemberDays: 7,
        quietStartHour: 21,
        quietEndHour: 8,
        isActive: true,
      },
    });
    if (r < 6) {
      await prisma.automationRun.create({
        data: {
          orgId: org.id,
          branchId: branchA.id,
          ruleId: rule.id,
          mode: "LIVE",
          matchedCount: 18 + r * 4,
          dispatchedCount: 15 + r * 3,
          skippedOptOutCount: 2,
          skippedCapCount: 1,
          skippedQuietHours: false,
          previewSummaryJson: { sample: "Delivered via Mock WhatsApp Cloud Adapter" },
          executedAt: new Date(now.getTime() - (r + 1) * 12 * 3600_000),
        },
      });
    }
  }

  // Referrals & Loyalty Points Leaderboard
  const loyaltyAccountsData = [];
  const loyaltyLedgerData = [];
  const tierMap = ["GOLD", "SILVER", "BRONZE", "IRON"] as const;
  for (let i = 0; i < 45; i++) {
    const m = memberRowsData[i]!;
    const lifetime =
      i < 8
        ? 3200 + (8 - i) * 350 // GOLD
        : i < 20
        ? 1650 + (20 - i) * 80 // SILVER
        : i < 34
        ? 600 + (34 - i) * 55 // BRONZE
        : 125 + i * 10; // IRON
    const tier =
      lifetime >= 3000
        ? tierMap[0]
        : lifetime >= 1500
        ? tierMap[1]
        : lifetime >= 500
        ? tierMap[2]
        : tierMap[3];
    loyaltyAccountsData.push({
      orgId: org.id,
      branchId: m.branchId,
      memberId: m.id,
      pointsBalance: Math.max(50, lifetime - 150),
      lifetimePoints: lifetime,
      tier,
    });
    loyaltyLedgerData.push({
      orgId: org.id,
      branchId: m.branchId,
      memberId: m.id,
      pointsDelta: lifetime,
      reason: "Cumulative check-in streaks & on-time renewals",
      refId: m.memberCode,
      createdAt: new Date(now.getTime() - i * 86_400_000),
    });
  }
  await prisma.loyaltyAccount.createMany({ data: loyaltyAccountsData });
  await prisma.loyaltyLedger.createMany({ data: loyaltyLedgerData });

  const referralRewardsData = [];
  for (let i = 0; i < 12; i++) {
    const referrer = memberRowsData[i]!;
    const referred = memberRowsData[100 + i]!;
    referralRewardsData.push({
      orgId: org.id,
      branchId: referrer.branchId,
      referrerMemberId: referrer.id,
      referredMemberId: referred.id,
      freeDaysGranted: 7,
      discountPaiseGranted: 50000,
      status: "CREDITED",
      createdAt: new Date(now.getTime() - (i + 1) * 3 * 86_400_000),
    });
  }
  await prisma.referralReward.createMany({ data: referralRewardsData });

  await prisma.staffTask.createMany({
    data: [
      { orgId: org.id, branchId: branchA.id, title: "Call 5 members expiring in next 48h", priority: "HIGH", dueDate: now, assignedToId: ownerUserId, status: "OPEN" },
      { orgId: org.id, branchId: branchA.id, title: "Reconcile front-desk cash register before 9 PM", priority: "HIGH", dueDate: now, assignedToId: ownerUserId, status: "OPEN" },
      { orgId: org.id, branchId: branchA.id, title: "Confirm 6 PM Strength Quarterly trial walkthrough", priority: "MEDIUM", dueDate: now, assignedToId: ownerUserId, status: "OPEN" },
      { orgId: org.id, branchId: branchB.id, title: "Verify GSTIN details for Corporate Batch #4", priority: "MEDIUM", dueDate: now, assignedToId: ownerUserId, status: "OPEN" },
    ],
  });

  await prisma.organization.update({
    where: { id: org.id },
    data: { demoLoaded: true },
  });

  return {
    orgId: org.id,
    memberCount: memberRowsData.length,
    checkInCount: TOTAL_CHECKINS,
  };
}
