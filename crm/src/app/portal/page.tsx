import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionContext } from "@/lib/auth";
import { generateRotatingQrToken } from "@/lib/dynamic-qr";
import { PortalClient } from "@/components/portal-client";

export default async function MemberPortalPage() {
  const ctx = await getSessionContext();
  if (!ctx) {
    redirect("/login");
  }

  const member = await prisma.member.findFirst({
    where: {
      orgId: ctx.org.id,
      deletedAt: null,
      OR: [
        { email: ctx.user.email },
        ...(ctx.user.phone ? [{ phone: ctx.user.phone }] : []),
      ],
    },
    include: {
      branch: {
        select: { name: true, code: true, address: true, latitude: true, longitude: true, geofenceRadiusM: true },
      },
      loyaltyAccount: true,
      documents: { where: { kind: "WAIVER" }, take: 1, select: { id: true, signedAt: true } },
      subscriptions: {
        orderBy: { endDate: "desc" },
        take: 1,
        include: { plan: { select: { name: true, billingModel: true } } },
      },
      invoices: {
        orderBy: { issueDate: "desc" },
        take: 8,
        select: {
          id: true,
          invoiceNumber: true,
          issueDate: true,
          totalPaise: true,
          balanceDuePaise: true,
          status: true,
        },
      },
      checkIns: {
        orderBy: { visitedAt: "desc" },
        take: 10,
        select: { id: true, visitedAt: true, method: true, result: true },
      },
      planAssignments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          template: true,
          trainer: { select: { name: true } },
        },
      },
      classBookings: {
        where: { status: { not: "CANCELLED" } },
        select: { sessionId: true, status: true, waitlistPos: true, spotCode: true },
      },
    },
  });

  if (!member) {
    return (
      <main className="min-h-screen bg-[var(--bg-paper)] p-6">
        <div className="mx-auto max-w-lg bauhaus-card p-6 space-y-4">
          <p className="bauhaus-label text-[#C8372B]">{"// MEMBER PORTAL"}</p>
          <h1 className="font-headline text-[28px]">No Linked Member Profile</h1>
          <p className="text-[14px] text-[var(--fg-grey)]">
            Sign in with member account <code className="font-bold">member@ironworks.in</code> or OTP phone <code className="font-bold">+91 98450 10006</code> to preview the Member PWA.
          </p>
          <Link href="/app" className="inline-block border-2 border-[#151515] bg-[#151515] text-[#FFFFFF] px-4 py-2 text-[13px] font-bold uppercase">
            Return to Staff CRM
          </Link>
        </div>
      </main>
    );
  }

  const upcomingClasses = await prisma.classSession.findMany({
    where: { orgId: ctx.org.id, branchId: member.branchId },
    orderBy: { startsAt: "asc" },
    take: 6,
    include: {
      classType: { select: { layoutRows: true, layoutCols: true, layoutPrefix: true } },
      trainer: { select: { name: true } },
      bookings: { where: { status: { not: "CANCELLED" } }, select: { status: true, spotCode: true } },
    },
  });

  const bookingMap = new Map(
    member.classBookings.map((b) => [
      b.sessionId,
      { status: b.status, waitlistPos: b.waitlistPos, spotCode: b.spotCode },
    ])
  );

  const assignment = member.planAssignments[0];
  const rotatingQr = generateRotatingQrToken(member.memberCode);

  return (
    <PortalClient
      orgName={ctx.org.name}
      currency={ctx.org.currency}
      rotatingPass={rotatingQr}
      branchGeo={{
        latitude: member.branch.latitude ?? 12.9716,
        longitude: member.branch.longitude ?? 77.6412,
        geofenceRadiusM: member.branch.geofenceRadiusM,
      }}
      member={{
        id: member.id,
        fullName: member.fullName,
        memberCode: member.memberCode,
        qrToken: member.qrToken,
        status: member.status,
        expiryDate: member.expiryDate ? member.expiryDate.toISOString() : null,
        branchName: member.branch.name,
        referralCode: member.referralCode,
        planName: member.subscriptions[0]?.plan.name ?? "Club Membership",
        loyaltyPoints: member.loyaltyAccount?.pointsBalance ?? 0,
        loyaltyTier: member.loyaltyAccount?.tier ?? "IRON",
        waiverSigned: Boolean(member.healthConsentAt || member.documents[0]),
      }}
      invoices={member.invoices.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        issueDate: i.issueDate.toISOString().slice(0, 10),
        totalPaise: i.totalPaise,
        balanceDuePaise: i.balanceDuePaise,
        status: i.status,
      }))}
      checkIns={member.checkIns.map((c) => ({
        id: c.id,
        visitedAt: c.visitedAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        method: c.method,
        result: c.result,
      }))}
      trainingPlan={
        assignment
          ? {
              syncToken: assignment.syncToken,
              coachName: assignment.trainer.name,
              name: assignment.template.name,
              dietType: assignment.template.dietType,
              caloriesTarget: assignment.template.caloriesTarget,
              proteinGrams: assignment.template.proteinGrams,
              workouts: (assignment.template.workoutsJson as Array<{ day: string; exercises: string[] }>) ?? [],
              meals: (assignment.template.mealsJson as Array<{ slot: string; items: string; macros: string }>) ?? [],
            }
          : null
      }
      classes={upcomingClasses.map((s) => {
        const myBooking = bookingMap.get(s.id);
        return {
          id: s.id,
          title: s.title,
          trainerName: s.trainer.name,
          studioRoom: s.studioRoom,
          startsAt: s.startsAt.toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Kolkata",
          }),
          bookedCount: s.bookings.filter((b) => b.status === "BOOKED" || b.status === "CHECKED_IN").length,
          capacity: s.capacity,
          layoutRows: s.classType.layoutRows,
          layoutCols: s.classType.layoutCols,
          layoutPrefix: s.classType.layoutPrefix,
          takenSpots: s.bookings.map((b) => b.spotCode).filter((x): x is string => Boolean(x)),
          myStatus: myBooking?.status ?? null,
          myWaitlistPos: myBooking?.waitlistPos ?? null,
          mySpotCode: myBooking?.spotCode ?? null,
        };
      })}
    />
  );
}
