import { NextResponse } from "next/server";
import { DEMO_USER_ID, SESSION_COOKIE } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawNext = searchParams.get("next") ?? "/app";
  const safeNext =
    rawNext.startsWith("/app") &&
    !rawNext.startsWith("/app/gym") &&
    !rawNext.startsWith("/app/trainer")
      ? rawNext
      : "/app";

  const res = NextResponse.redirect(new URL(safeNext, request.url));
  res.cookies.set(SESSION_COOKIE, DEMO_USER_ID, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
