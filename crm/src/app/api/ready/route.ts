import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ready: true,
      postgres: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ready: false, error: (err as Error).message },
      { status: 503 }
    );
  }
}
