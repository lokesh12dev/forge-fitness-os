"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  loginWithPasswordAction,
  requestPhoneOtpAction,
  verifyPhoneOtpLoginAction,
} from "@/app/actions/crm-actions";

const DEMO_ACCOUNTS = [
  { role: "OWNER (All Branches)", email: "owner@ironworks.in", phone: "+91 98450 10001" },
  { role: "MANAGER (BLR Only)", email: "manager.blr@ironworks.in", phone: "+91 98450 10002" },
  { role: "FRONTDESK (BLR)", email: "frontdesk.blr@ironworks.in", phone: "+91 98450 10003" },
  { role: "TRAINER (No Finance)", email: "trainer.blr@ironworks.in", phone: "+91 98450 10004" },
  { role: "ACCOUNTANT (RO Finance)", email: "accountant@ironworks.in", phone: "+91 98450 10005" },
  { role: "MEMBER (PWA Portal)", email: "member@ironworks.in", phone: "+91 98450 10006" },
];

export function LoginClient() {
  const router = useRouter();
  const [mode, setMode] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("owner@ironworks.in");
  const [password, setPassword] = useState("ForgeCrm@2026");
  const [phone, setPhone] = useState("+91 98450 10001");
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [oauthNotice, setOauthNotice] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    startTransition(async () => {
      const res = await loginWithPasswordAction({ email, password });
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
      router.push(res.role === "MEMBER" ? "/portal" : "/app");
      router.refresh();
    });
  };

  const handleRequestOtp = () => {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await requestPhoneOtpAction(phone);
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
      setOtpRequested(true);
      setOtpHint(res.mockOtpHint ?? "OTP dispatched via SMS.");
    });
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    startTransition(async () => {
      const res = await verifyPhoneOtpLoginAction({ phone, code: otpCode });
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
      router.push(res.role === "MEMBER" ? "/portal" : "/app");
      router.refresh();
    });
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[var(--bg-paper)]">
      {/* Left Bauhaus Poster Manifesto Panel */}
      <div className="lg:col-span-6 bg-[#151515] text-[#FFFFFF] p-8 md:p-12 flex flex-col justify-between border-b-[3px] lg:border-b-0 lg:border-r-[3px] border-[#151515]">
        <div>
          <p className="bauhaus-label text-[#EBC95B] mb-4">{`// MULTI-TENANT GYM OPERATIONS OS`}</p>
          <h1 className="font-headline text-[44px] md:text-[64px] text-[#FFFFFF]">
            FORGE
            <br />
            CRM.
          </h1>
          <p className="mt-6 max-w-md text-[16px] text-[#F6F1E4]">
            India-first club management built with integer-paise GST billing, branch-scoped RBAC, QR turnstile gating, and automated member retention.
          </p>
        </div>

        {/* Pure Bauhaus Geometric Composition */}
        <div className="my-10 grid grid-cols-3 border-2 border-[#FFFFFF] max-w-sm" aria-hidden="true">
          <div className="h-24 bg-[#C8372B] border-r-2 border-[#FFFFFF] flex items-center justify-center">
            <div className="size-10 bg-[#FFFFFF]" />
          </div>
          <div className="h-24 bg-[#2B4BCC] border-r-2 border-[#FFFFFF] flex items-center justify-center">
            <div className="size-10 bg-[#EBC95B]" style={{ borderRadius: "9999px" }} />
          </div>
          <div className="h-24 bg-[#EBC95B] flex items-center justify-center">
            <div className="w-0 h-0 border-l-[18px] border-l-transparent border-r-[18px] border-r-transparent border-b-[32px] border-b-[#151515]" />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-[#FFFFFF]/25 pt-6">
          <span className="text-[12px] font-bold uppercase tracking-[0.12em]">
            SAC 999723 · DPDP 2023 COMPLIANT
          </span>
          <Link
            href="/onboarding"
            className="bg-[#EBC95B] text-[#151515] border-2 border-[#FFFFFF] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.1em] hover:bg-[#C8372B] hover:text-[#FFFFFF]"
          >
            New Gym Setup Wizard →
          </Link>
        </div>
      </div>

      {/* Right Sign-In Form */}
      <div className="lg:col-span-6 p-6 md:p-12 flex flex-col justify-center max-w-xl w-full mx-auto">
        <div className="bauhaus-card p-6 md:p-8 space-y-6">
          <div>
            <p className="bauhaus-label text-[#2B4BCC] mb-1">{`// STAFF ACCESS`}</p>
            <h2 className="font-headline text-[32px]">SIGN IN TO CLUB</h2>
          </div>

          <div className="grid grid-cols-2 border-2 border-[var(--border-ink)]">
            <button
              type="button"
              onClick={() => { setMode("email"); setErrorMsg(null); }}
              className={`min-h-[48px] text-[13px] font-bold uppercase tracking-[0.08em] ${
                mode === "email" ? "bg-[#151515] text-[#FFFFFF]" : "bg-[var(--bg-surface)] text-[var(--fg-ink)]"
              }`}
            >
              Email + Password
            </button>
            <button
              type="button"
              onClick={() => { setMode("otp"); setErrorMsg(null); }}
              className={`min-h-[48px] text-[13px] font-bold uppercase tracking-[0.08em] border-l-2 border-[var(--border-ink)] ${
                mode === "otp" ? "bg-[#151515] text-[#FFFFFF]" : "bg-[var(--bg-surface)] text-[var(--fg-ink)]"
              }`}
            >
              Phone OTP
            </button>
          </div>

          {errorMsg && (
            <div className="border-2 border-[#151515] bg-[#C8372B] text-[#FFFFFF] p-3 text-[13px] font-bold" role="alert">
              {errorMsg}
            </div>
          )}

          {mode === "email" ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="bauhaus-label block mb-1.5" htmlFor="login-email">
                  {`// WORK EMAIL`}
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[48px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[14px] font-medium"
                />
              </div>

              <div>
                <label className="bauhaus-label block mb-1.5" htmlFor="login-password">
                  {`// PASSWORD`}
                </label>
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[48px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[14px] font-medium"
                />
              </div>

              <Button type="submit" variant="primary" density="hero" fullWidth disabled={isPending}>
                {isPending ? "Verifying Session..." : "Sign In to Dashboard"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="bauhaus-label block mb-1.5" htmlFor="login-phone">
                  {`// REGISTERED PHONE`}
                </label>
                <div className="flex gap-2">
                  <input
                    id="login-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="flex-1 min-h-[48px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[14px]"
                  />
                  <Button type="button" variant="secondary" onClick={handleRequestOtp} disabled={isPending}>
                    Send OTP
                  </Button>
                </div>
              </div>

              {otpHint && (
                <div className="border-2 border-[#151515] bg-[#EBC95B] text-[#151515] p-3 text-[13px] font-bold">
                  {otpHint}
                </div>
              )}

              {otpRequested && (
                <div>
                  <label className="bauhaus-label block mb-1.5" htmlFor="login-otp-code">
                    {`// 6-DIGIT OTP CODE`}
                  </label>
                  <input
                    id="login-otp-code"
                    type="text"
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="482910"
                    className="w-full min-h-[48px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[16px] font-tabular font-bold tracking-widest"
                  />
                  <div className="mt-4">
                    <Button type="submit" variant="primary" density="hero" fullWidth disabled={isPending}>
                      Verify OTP &amp; Enter
                    </Button>
                  </div>
                </div>
              )}
            </form>
          )}

          <div className="space-y-2 pt-2 border-t-2 border-[var(--border-ink)]">
            <Button
              type="button"
              variant="tertiary"
              fullWidth
              onClick={() => setOauthNotice((v) => !v)}
            >
              Continue with Google SSO
            </Button>
            {oauthNotice && (
              <p className="border-2 border-[#151515] bg-[var(--bg-muted)] p-3 text-[13px]">
                Google OAuth adapter ready. Configure <code className="font-bold">GOOGLE_CLIENT_ID</code> and <code className="font-bold">GOOGLE_CLIENT_SECRET</code> in environment variables for live SSO.
              </p>
            )}
          </div>

          {/* Seeded Role Switcher Quick-Fill */}
          <div className="pt-3 border-t-2 border-[var(--border-ink)]">
            <p className="bauhaus-label text-[var(--fg-grey)] mb-2">
              {`// SEEDED IRONWORKS DEMO ROLES (PASSWORD: ForgeCrm@2026)`}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword("ForgeCrm@2026");
                    setPhone(acc.phone);
                  }}
                  className="min-h-[44px] border border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 py-2 text-left hover:bg-[#EBC95B] hover:text-[#151515]"
                >
                  <span className="block text-[12px] font-bold uppercase">{acc.role}</span>
                  <span className="block text-[12px] text-[var(--fg-grey)] truncate">{acc.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
