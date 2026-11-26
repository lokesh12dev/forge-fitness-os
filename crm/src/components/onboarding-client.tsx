"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createOrgFromWizardAction } from "@/app/actions/crm-actions";

export function OnboardingClient() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    orgName: "",
    ownerName: "",
    ownerEmail: "",
    ownerPassword: "",
    gstin: "29AAKCF1234L1Z9",
    currency: "INR" as "INR" | "USD",
    invoicePrefix: "APEX",
    defaultGstBps: 1800,
    branchName: "Koramangala Flagship",
    branchCode: "BLR-KRM",
    branchAddress: "80 Feet Road, Koramangala 4th Block, Bengaluru",
    branchStateCode: "KA",
    openHour: "05:30",
    closeHour: "22:30",
    holidayTitle: "Republic Day",
    holidayDate: "2027-01-26",
    inviteEmail: "",
    inviteRole: "MANAGER" as "MANAGER" | "FRONTDESK" | "TRAINER" | "ACCOUNTANT",
  });

  const handleFinish = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    startTransition(async () => {
      const res = await createOrgFromWizardAction(form);
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
      router.push("/app");
      router.refresh();
    });
  };

  return (
    <div className="min-h-screen bg-[var(--bg-paper)] p-4 md:p-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b-[3px] border-[var(--border-ink)] pb-4">
          <div>
            <p className="bauhaus-label text-[#C8372B]">{`// FORGE CRM SETUP WIZARD`}</p>
            <h1 className="font-headline text-[32px] md:text-[44px] mt-1">
              LAUNCH YOUR CLUB OS
            </h1>
          </div>
          <Link
            href="/login"
            className="min-h-[44px] inline-flex items-center border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-4 text-[12px] font-bold uppercase tracking-[0.08em] hover:bg-[#EBC95B]"
          >
            Back to Sign In
          </Link>
        </div>

        {/* 4-Step Bauhaus Progress */}
        <div className="grid grid-cols-4 border-2 border-[var(--border-ink)]">
          {[
            { n: 1, label: "1. Org & GST" },
            { n: 2, label: "2. Branch & Hrs" },
            { n: 3, label: "3. Staff Invite" },
            { n: 4, label: "4. Launch" },
          ].map((s) => (
            <button
              key={s.n}
              type="button"
              onClick={() => setStep(s.n as 1 | 2 | 3 | 4)}
              className={`min-h-[48px] px-2 text-[12px] font-bold uppercase tracking-[0.08em] border-r-2 last:border-r-0 border-[var(--border-ink)] ${
                step === s.n
                  ? "bg-[#2B4BCC] text-[#FFFFFF]"
                  : step > s.n
                  ? "bg-[#EBC95B] text-[#151515]"
                  : "bg-[var(--bg-surface)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {errorMsg && (
          <div className="border-2 border-[#151515] bg-[#C8372B] text-[#FFFFFF] p-4 text-[14px] font-bold" role="alert">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleFinish} className="bauhaus-card p-6 md:p-8 space-y-5">
          {step === 1 && (
            <div className="space-y-4">
              <p className="bauhaus-label text-[#2B4BCC]">{`// STEP 01 · ORGANIZATION, TAX & SERIES`}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="bauhaus-label block mb-1.5">Gym / Brand Name</label>
                  <input
                    required
                    value={form.orgName}
                    onChange={(e) => setForm({ ...form, orgName: e.target.value })}
                    placeholder="Apex Barbell Club"
                    className="w-full min-h-[48px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[14px]"
                  />
                </div>
                <div>
                  <label className="bauhaus-label block mb-1.5">Owner Full Name</label>
                  <input
                    required
                    value={form.ownerName}
                    onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                    placeholder="Raghav Rao"
                    className="w-full min-h-[48px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[14px]"
                  />
                </div>
                <div>
                  <label className="bauhaus-label block mb-1.5">Owner Work Email</label>
                  <input
                    type="email"
                    required
                    value={form.ownerEmail}
                    onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
                    placeholder="owner@apexbarbell.in"
                    className="w-full min-h-[48px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[14px]"
                  />
                </div>
                <div>
                  <label className="bauhaus-label block mb-1.5">Password (Min 6 chars)</label>
                  <input
                    type="password"
                    required
                    value={form.ownerPassword}
                    onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
                    placeholder="••••••••"
                    className="w-full min-h-[48px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[14px]"
                  />
                </div>
                <div>
                  <label className="bauhaus-label block mb-1.5">GSTIN (Optional)</label>
                  <input
                    value={form.gstin}
                    onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                    className="w-full min-h-[48px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[14px] uppercase"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="bauhaus-label block mb-1.5">Currency</label>
                    <select
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value as "INR" | "USD" })}
                      className="w-full min-h-[48px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[14px] font-bold"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                  <div>
                    <label className="bauhaus-label block mb-1.5">Invoice Prefix</label>
                    <input
                      value={form.invoicePrefix}
                      onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value.toUpperCase() })}
                      className="w-full min-h-[48px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[14px] uppercase font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="bauhaus-label text-[#2B4BCC]">{`// STEP 02 · FIRST BRANCH, HOURS & HOLIDAYS`}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="bauhaus-label block mb-1.5">Branch Name</label>
                  <input
                    required
                    value={form.branchName}
                    onChange={(e) => setForm({ ...form, branchName: e.target.value })}
                    className="w-full min-h-[48px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[14px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="bauhaus-label block mb-1.5">Branch Code</label>
                    <input
                      required
                      value={form.branchCode}
                      onChange={(e) => setForm({ ...form, branchCode: e.target.value.toUpperCase() })}
                      className="w-full min-h-[48px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[14px] uppercase"
                    />
                  </div>
                  <div>
                    <label className="bauhaus-label block mb-1.5">State Code</label>
                    <input
                      required
                      value={form.branchStateCode}
                      onChange={(e) => setForm({ ...form, branchStateCode: e.target.value.toUpperCase() })}
                      className="w-full min-h-[48px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[14px] uppercase"
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="bauhaus-label block mb-1.5">Branch Address</label>
                  <input
                    required
                    value={form.branchAddress}
                    onChange={(e) => setForm({ ...form, branchAddress: e.target.value })}
                    className="w-full min-h-[48px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[14px]"
                  />
                </div>
                <div>
                  <label className="bauhaus-label block mb-1.5">Opens (IST)</label>
                  <input
                    type="time"
                    value={form.openHour}
                    onChange={(e) => setForm({ ...form, openHour: e.target.value })}
                    className="w-full min-h-[48px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[14px]"
                  />
                </div>
                <div>
                  <label className="bauhaus-label block mb-1.5">Closes (IST)</label>
                  <input
                    type="time"
                    value={form.closeHour}
                    onChange={(e) => setForm({ ...form, closeHour: e.target.value })}
                    className="w-full min-h-[48px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[14px]"
                  />
                </div>
                <div>
                  <label className="bauhaus-label block mb-1.5">Holiday Name</label>
                  <input
                    value={form.holidayTitle}
                    onChange={(e) => setForm({ ...form, holidayTitle: e.target.value })}
                    className="w-full min-h-[48px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[14px]"
                  />
                </div>
                <div>
                  <label className="bauhaus-label block mb-1.5">Holiday Date</label>
                  <input
                    type="date"
                    value={form.holidayDate}
                    onChange={(e) => setForm({ ...form, holidayDate: e.target.value })}
                    className="w-full min-h-[48px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[14px]"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="bauhaus-label text-[#2B4BCC]">{`// STEP 03 · STAFF ROLE INVITE`}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="bauhaus-label block mb-1.5">Staff Email (Optional)</label>
                  <input
                    type="email"
                    value={form.inviteEmail}
                    onChange={(e) => setForm({ ...form, inviteEmail: e.target.value })}
                    placeholder="manager@apexbarbell.in"
                    className="w-full min-h-[48px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[14px]"
                  />
                </div>
                <div>
                  <label className="bauhaus-label block mb-1.5">Assigned Role</label>
                  <select
                    value={form.inviteRole}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        inviteRole: e.target.value as "MANAGER" | "FRONTDESK" | "TRAINER" | "ACCOUNTANT",
                      })
                    }
                    className="w-full min-h-[48px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[14px] font-bold"
                  >
                    <option value="MANAGER">MANAGER (Single Branch)</option>
                    <option value="FRONTDESK">FRONTDESK (Check-in &amp; Sales)</option>
                    <option value="TRAINER">TRAINER (Clients Only)</option>
                    <option value="ACCOUNTANT">ACCOUNTANT (Read-Only Finance)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="bauhaus-label text-[#C8372B]">{`// STEP 04 · VERIFY & CREATE WORKSPACE`}</p>
              <div className="border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] p-4 space-y-2 text-[14px]">
                <p><strong>Organization:</strong> {form.orgName || "--"} ({form.currency})</p>
                <p><strong>Branch:</strong> {form.branchName} [{form.branchCode} · State {form.branchStateCode}]</p>
                <p><strong>Invoice Series:</strong> {form.invoicePrefix}-{form.branchCode}-00001 (GST {(form.defaultGstBps / 100).toFixed(0)}%)</p>
                <p><strong>Initial State:</strong> Starts cleanly empty with designed empty states. You can load the 600-member demo dataset anytime from Dashboard.</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t-2 border-[var(--border-ink)]">
            {step > 1 ? (
              <Button type="button" variant="tertiary" onClick={() => setStep((step - 1) as 1 | 2 | 3)}>
                ← Previous
              </Button>
            ) : (
              <span />
            )}

            {step < 4 ? (
              <Button
                key="next-step-btn"
                type="button"
                variant="secondary"
                onClick={() => setStep((s) => Math.min(4, s + 1) as 1 | 2 | 3 | 4)}
              >
                Next Step →
              </Button>
            ) : (
              <Button
                key="submit-org-btn"
                type="submit"
                variant="primary"
                density="hero"
                disabled={isPending}
              >
                {isPending ? "Creating Organization..." : "Create Gym Organization →"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
