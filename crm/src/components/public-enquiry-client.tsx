"use client";

import React, { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createPublicEnquiryAction } from "@/app/actions/phase2-actions";

interface BranchItem {
  id: string;
  name: string;
  code: string;
  address: string;
}

export function PublicEnquiryClient({
  orgSlug,
  orgName,
  branches,
  defaultBranchId,
  embed,
}: {
  orgSlug: string;
  orgName: string;
  branches: BranchItem[];
  defaultBranchId: string;
  embed: boolean;
}) {
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [goal, setGoal] = useState("Strength & Fat Loss");
  const [preferredTrialDate, setPreferredTrialDate] = useState("");
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg(null);
    startTransition(async () => {
      const res = await createPublicEnquiryAction({
        orgSlug,
        branchId,
        fullName,
        phone,
        email,
        goal,
        preferredTrialDate: preferredTrialDate || undefined,
        source: embed ? "Website" : "Walk-in",
      });
      if (!res.ok) {
        setErrMsg(res.error);
        return;
      }
      setDoneMsg(`BOOKED AT ${res.branchName.toUpperCase()}. OUR FLOOR COACH WILL CALL IN 15 MINS.`);
      setFullName("");
      setPhone("");
      setEmail("");
      setPreferredTrialDate("");
    });
  };

  return (
    <main className={embed ? "bg-[var(--bg-paper)] p-3" : "min-h-screen bg-[var(--bg-paper)] p-4 md:p-10"}>
      <div className="mx-auto max-w-xl bg-[var(--bg-surface)] border-[3px] border-[#151515]">
        <div className="bg-[#151515] text-[#FFFFFF] p-5 border-b-[3px] border-[#151515]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#EBC95B]">
              {"// BOOK YOUR TRIAL PASS"}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="size-3 bg-[#C8372B] border border-[#FFFFFF]" />
              <span className="size-3 bg-[#2B4BCC] border border-[#FFFFFF]" />
              <span className="size-3 bg-[#EBC95B] border border-[#FFFFFF]" />
            </div>
          </div>
          <h1 className="font-headline text-[32px] mt-2 text-[#FFFFFF]">{orgName}</h1>
          <p className="text-[14px] text-[#FFFFFF]/80 mt-1">
            Walkthrough, movement screen, and 1-day floor access. Zero pressure.
          </p>
        </div>

        <form onSubmit={submitForm} className="p-5 md:p-6 space-y-4">
          {doneMsg && (
            <div className="border-2 border-[#151515] bg-[#EBC95B] text-[#151515] p-4 text-[14px] font-bold">
              {doneMsg}
            </div>
          )}
          {errMsg && (
            <div className="border-2 border-[#151515] bg-[#C8372B] text-[#FFFFFF] p-3 text-[13px] font-bold">
              {errMsg}
            </div>
          )}

          {branches.length > 0 && (
            <div>
              <label htmlFor="pub-branch" className="bauhaus-label block mb-1.5">
                {"// SELECT CLUB BRANCH"}
              </label>
              <select
                id="pub-branch"
                className="bauhaus-input"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pub-name" className="bauhaus-label block mb-1.5">
                {"// FULL NAME"}
              </label>
              <input
                id="pub-name"
                className="bauhaus-input"
                required
                placeholder="e.g. Kabir Deshmukh"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="pub-phone" className="bauhaus-label block mb-1.5">
                {"// WHATSAPP / PHONE"}
              </label>
              <input
                id="pub-phone"
                className="bauhaus-input"
                required
                placeholder="+91 98450 00000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pub-email" className="bauhaus-label block mb-1.5">
                {"// EMAIL (OPTIONAL)"}
              </label>
              <input
                id="pub-email"
                type="email"
                className="bauhaus-input"
                placeholder="name@domain.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="pub-trial" className="bauhaus-label block mb-1.5">
                {"// PREFERRED TRIAL SLOT"}
              </label>
              <input
                id="pub-trial"
                type="datetime-local"
                className="bauhaus-input"
                value={preferredTrialDate}
                onChange={(e) => setPreferredTrialDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="pub-goal" className="bauhaus-label block mb-1.5">
              {"// PRIMARY TRAINING GOAL"}
            </label>
            <input
              id="pub-goal"
              className="bauhaus-input"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>

          <Button type="submit" variant="primary" density="hero" fullWidth disabled={pending}>
            {pending ? "SUBMITTING..." : "CLAIM TRIAL WALKTHROUGH"}
          </Button>
        </form>
      </div>
    </main>
  );
}
