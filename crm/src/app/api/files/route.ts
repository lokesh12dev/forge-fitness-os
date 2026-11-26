import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { verifySignedObjectUrl } from "@/lib/adapters/storage";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") ?? "";
  const exp = req.nextUrl.searchParams.get("exp") ?? "";
  const sig = req.nextUrl.searchParams.get("sig") ?? "";

  if (!key || !verifySignedObjectUrl(key, exp, sig)) {
    return NextResponse.json({ error: "Invalid or expired signed URL" }, { status: 403 });
  }

  const safePath = path.resolve("/tmp/forge-crm-uploads", key);
  if (!safePath.startsWith("/tmp/forge-crm-uploads/")) {
    return NextResponse.json({ error: "Forbidden path" }, { status: 403 });
  }

  try {
    const data = await fs.readFile(safePath);
    const ext = path.extname(safePath).toLowerCase();
    const contentType =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".png"
        ? "image/png"
        : ext === ".webp"
        ? "image/webp"
        : "image/jpeg";

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Object not found" }, { status: 404 });
  }
}
