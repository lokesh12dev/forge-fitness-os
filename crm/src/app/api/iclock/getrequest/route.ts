import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * eSSL / ZKTeco ADMS Hardware Command Polling & Result Receipt
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sn = searchParams.get("SN")?.trim() ?? "";
  if (!sn) {
    return new NextResponse("OK", { status: 200 });
  }

  const device = await prisma.accessDevice.findFirst({
    where: { serialNumber: sn },
  });
  if (!device) {
    return new NextResponse("OK", { status: 200 });
  }

  await prisma.accessDevice.update({
    where: { id: device.id },
    data: { lastHeartbeatAt: new Date(), status: "ONLINE" },
  });

  if (device.pendingCmdText) {
    const cmd = device.pendingCmdText;
    await prisma.accessDevice.update({
      where: { id: device.id },
      data: { pendingCmdText: null },
    });
    return new NextResponse(cmd, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new NextResponse("OK", { status: 200 });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const sn = searchParams.get("SN")?.trim() ?? "";
  if (sn) {
    await prisma.accessDevice.updateMany({
      where: { serialNumber: sn },
      data: { lastHeartbeatAt: new Date(), status: "ONLINE" },
    });
  }
  await request.text();
  return new NextResponse("OK", { status: 200 });
}
