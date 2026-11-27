import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      service: "forge-crm",
      db: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "degraded",
        service: "forge-crm",
        db: "error",
        error: err instanceof Error ? err.message : "Unknown DB error",
      },
      { status: 503 }
    );
  }
}
