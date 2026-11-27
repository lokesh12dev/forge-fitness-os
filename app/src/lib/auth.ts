import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { db, schema } from "@/db";

export const SESSION_COOKIE = "forge_uid";
export const DEMO_USER_ID = "u-alex";

export const getCurrentUser = cache(async () => {
  const store = await cookies();
  const uid = store.get(SESSION_COOKIE)?.value ?? DEMO_USER_ID;
  const rows = await db.select().from(schema.users).where(eq(schema.users.id, uid)).limit(1);
  if (rows[0]) return rows[0];
  const fallback = await db.select().from(schema.users).where(eq(schema.users.id, DEMO_USER_ID)).limit(1);
  return fallback[0] ?? null;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("No user found. Run `npm run db:seed`.");
  return user;
}
