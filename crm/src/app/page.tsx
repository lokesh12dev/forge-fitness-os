import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";

export default async function HomePage() {
  const ctx = await getSessionContext();
  if (ctx) {
    redirect("/app");
  }
  redirect("/login");
}
