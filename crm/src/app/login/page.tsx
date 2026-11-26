import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { LoginClient } from "@/components/login-client";

export default async function LoginPage() {
  const ctx = await getSessionContext();
  if (ctx) {
    redirect("/app");
  }
  return <LoginClient />;
}
