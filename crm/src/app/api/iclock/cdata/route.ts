import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluateCheckInAccess } from "@/lib/checkin-gate";

/**
 * eSSL / ZKTeco ADMS Cloud Push Protocol Receiver
 * Handles:
 * - GET /api/iclock/cdata?SN=SERIAL&options=all  -> Device handshake & configuration push
 * - POST /api/iclock/cdata?SN=SERIAL&table=ATTLOG -> Parses tab-separated biometric attendance punches
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sn = searchParams.get("SN")?.trim();
  if (sn) {
    await prisma.accessDevice.updateMany({
      where: { serialNumber: sn },
      data: { lastHeartbeatAt: new Date(), status: "ONLINE" },
    });
  }
  const handshake = [
    `GET OPTION FROM: ${sn ?? "FORGE-ADMS"}`,
    "Stamp=9999",
    "OpStamp=9999",
    "PhotoStamp=9999",
    "ErrorDelay=30",
    "Delay=10",
    "TransTimes=00:00;14:05",
    "TransInterval=1",
    "TransFlag=1111000000",
    "Realtime=1",
    "Encrypt=0",
  ].join("\r\n");

  return new NextResponse(handshake, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const sn = searchParams.get("SN")?.trim() ?? "";
  const table = (searchParams.get("table") ?? "ATTLOG").toUpperCase();
  const rawBody = await request.text();

  const device = await prisma.accessDevice.findFirst({
    where: { serialNumber: sn },
    include: { branch: true },
  });

  if (!device) {
    return new NextResponse("ERROR: UNKNOWN_DEVICE", { status: 404 });
  }

  await prisma.accessDevice.update({
    where: { id: device.id },
    data: { lastHeartbeatAt: new Date(), status: "ONLINE" },
  });

  if (table !== "ATTLOG") {
    return new NextResponse("OK: 0", { status: 200 });
  }

  const lines = rawBody
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let processed = 0;
  for (const line of lines) {
    const cols = line.split("\t").map((c) => c.trim());
    const pin = cols[0];
    const tsStr = cols[1];
    if (!pin) continue;

    const member = await prisma.member.findFirst({
      where: {
        orgId: device.orgId,
        deletedAt: null,
        OR: [
          { memberCode: { equals: pin, mode: "insensitive" } },
          { memberCode: { equals: `FM-${pin}`, mode: "insensitive" } },
          { phone: { endsWith: pin.slice(-10) } },
        ],
      },
      include: { subscriptions: { orderBy: { endDate: "desc" }, take: 1 } },
    });

    if (!member) continue;
    const latestSub = member.subscriptions[0];
    const decision = evaluateCheckInAccess({
      status: member.status,
      expiryDate: member.expiryDate,
      sessionsRemaining: latestSub?.sessionsRemaining ?? null,
      timeZone: device.branch.timezone,
    });

    const visitedAt = tsStr && !Number.isNaN(new Date(tsStr).getTime()) ? new Date(tsStr) : new Date();
    await prisma.checkIn.create({
      data: {
        orgId: device.orgId,
        branchId: device.branchId,
        memberId: member.id,
        visitedAt,
        method: "TURNSTILE",
        result: decision.result,
        deviceId: `${device.vendor}:${device.serialNumber}`,
      },
    });

    if (decision.allowed) {
      await prisma.member.update({
        where: { id: member.id },
        data: { lastVisitedAt: visitedAt },
      });
    }
    processed++;
  }

  return new NextResponse(`OK: ${processed}`, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
