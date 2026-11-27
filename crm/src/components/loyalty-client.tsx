"use client";

import React, { useMemo, useState, useTransition } from "react";
import { clsx } from "clsx";
import { Award, Gift, Plus, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { FilterBar, Modal, StatTile, Toast } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import {
  awardOrRedeemLoyaltyAction,
  grantReferralRewardDaysAction,
} from "@/app/actions/phase2-actions";

interface AccountRow {
  id: string;
  memberId: string;
  memberName: string;
  memberCode: string;
  referralCode: string;
  branchName: string;
  pointsBalance: number;
  lifetimePoints: number;
  tier: string;
}

interface ReferralRow {
  id: string;
  referrerName: string;
  referralCode: string;
  referredName: string;
  referredCode: string;
  freeDaysGranted: number;
  discountPaiseGranted: number;
  status: string;
  createdAt: string;
}

interface LedgerRow {
  id: string;
  memberName: string;
  memberCode: string;
  pointsDelta: number;
  reason: string;
  createdAt: string;
}

export function LoyaltyClient({
  currency,
  canManage,
  members,
  accounts,
  referrals,
  ledger,
}: {
  currency: string;
  canManage: boolean;
  members: Array<{ id: string; fullName: string; memberCode: string; referralCode: string }>;
  accounts: AccountRow[];
  referrals: ReferralRow[];
  ledger: LedgerRow[];
}) {
  const [tab, setTab] = useState<"LEADERBOARD" | "REFERRALS" | "LEDGER">("LEADERBOARD");
  const [pointsModalOpen, setPointsModalOpen] = useState(false);
  const [refModalOpen, setRefModalOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: "ink" | "red" | "blue" | "yellow" } | null>(null);
  const [pending, startTransition] = useTransition();

  // Points modal
  const [ptsMemberId, setPtsMemberId] = useState(members[0]?.id ?? "");
  const [ptsMode, setPtsMode] = useState<"AWARD_EVENT" | "REDEEM">("AWARD_EVENT");
  const [ptsEvent, setPtsEvent] = useState<"CHECKIN" | "STREAK_5" | "ONTIME_RENEWAL" | "REFERRAL_CONVERTED">("STREAK_5");
  const [redeemPoints, setRedeemPoints] = useState(250);

  // Referral modal
  const [referrerId, setReferrerId] = useState(members[0]?.id ?? "");
  const [referredId, setReferredId] = useState(members[1]?.id ?? members[0]?.id ?? "");
  const [freeDays, setFreeDays] = useState(7);
  const [discountRupees, setDiscountRupees] = useState(500);

  const summary = useMemo(() => {
    const gold = accounts.filter((a) => a.tier === "GOLD").length;
    const pool = accounts.reduce((s, a) => s + a.pointsBalance, 0);
    const totalDays = referrals.reduce((s, r) => s + r.freeDaysGranted, 0);
    return { gold, pool, referralCount: referrals.length, totalDays };
  }, [accounts, referrals]);

  const tierStyle = (tier: string) => {
    if (tier === "GOLD") return "bg-[#EBC95B] text-[#151515]";
    if (tier === "SILVER") return "bg-[#2B4BCC] text-[#FFFFFF]";
    if (tier === "BRONZE") return "bg-[#C8372B] text-[#FFFFFF]";
    return "bg-[#151515] text-[#FFFFFF]";
  };

  const accountColumns: DataColumn<AccountRow>[] = [
    { key: "member", header: "Member", render: (r) => <div><p className="font-bold">{r.memberName}</p><p className="text-[12px] text-[var(--fg-grey)] font-tabular">{r.memberCode}</p></div> },
    { key: "code", header: "Ref Code", render: (r) => <span className="font-mono font-bold text-[13px]">{r.referralCode}</span> },
    { key: "tier", header: "Tier", render: (r) => <span className={clsx("border border-[#151515] px-2 py-0.5 text-[12px] font-bold uppercase", tierStyle(r.tier))}>{r.tier}</span> },
    { key: "bal", header: "Balance Pts", align: "right", render: (r) => <span className="font-headline text-[18px] font-tabular">{r.pointsBalance.toLocaleString("en-IN")}</span> },
    { key: "life", header: "Lifetime Pts", align: "right", render: (r) => <span className="font-tabular font-bold">{r.lifetimePoints.toLocaleString("en-IN")}</span> },
    { key: "branch", header: "Branch", render: (r) => <span>{r.branchName}</span> },
  ];

  const referralColumns: DataColumn<ReferralRow>[] = [
    { key: "referrer", header: "Referrer", render: (r) => <div><p className="font-bold">{r.referrerName}</p><p className="text-[12px] font-mono">{r.referralCode}</p></div> },
    { key: "referred", header: "Joined Friend", render: (r) => <div><p className="font-bold">{r.referredName}</p><p className="text-[12px] font-tabular">{r.referredCode}</p></div> },
    { key: "days", header: "Free Days Extended", align: "right", render: (r) => <span className="font-headline text-[18px] font-tabular text-[#2B4BCC]">+{r.freeDaysGranted}d</span> },
    { key: "disc", header: "Credit Granted", align: "right", render: (r) => <span className="font-tabular font-bold">{formatMoney(r.discountPaiseGranted, { currency })}</span> },
    { key: "st", header: "Status", render: (r) => <span className="border border-[#151515] bg-[#EBC95B] text-[#151515] px-2 py-0.5 text-[12px] font-bold uppercase">{r.status}</span> },
  ];

  const ledgerColumns: DataColumn<LedgerRow>[] = [
    { key: "member", header: "Member", render: (r) => <span className="font-bold">{r.memberName} ({r.memberCode})</span> },
    {
      key: "delta",
      header: "Points",
      align: "right",
      render: (r) => (
        <span className={clsx("font-headline text-[18px] font-tabular", r.pointsDelta >= 0 ? "text-[#2B4BCC]" : "text-[#C8372B]")}>
          {r.pointsDelta >= 0 ? `+${r.pointsDelta}` : r.pointsDelta}
        </span>
      ),
    },
    { key: "reason", header: "Reason", render: (r) => <span>{r.reason}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-[var(--border-ink)] pb-4">
        <div>
          <p className="bauhaus-label text-[#2B4BCC] mb-1">{"// REFERRALS, TIERS & REWARDS ENGINE"}</p>
          <h1 className="font-headline text-[36px] md:text-[48px]">LOYALTY & REFERRALS.</h1>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="yellow" onClick={() => setPointsModalOpen(true)}>
              <Plus className="size-4" /> Award / Redeem Pts
            </Button>
            <Button variant="primary" onClick={() => setRefModalOpen(true)}>
              <Gift className="size-4" /> Credit Referral Reward
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="// GOLD TIER ATHLETES" value={summary.gold} subtext="3,000+ lifetime points" accent="yellow" />
        <StatTile label="// ACTIVE POINTS POOL" value={summary.pool.toLocaleString("en-IN")} subtext="Redeemable across PT & merch" accent="blue" />
        <StatTile label="// REFERRALS CREDITED" value={summary.referralCount} subtext="Converted friend referrals" accent="ink" />
        <StatTile label="// FREE DAYS EXTENDED" value={`${summary.totalDays}D`} subtext="Auto-added to referrer expiry" accent="red" />
      </div>

      {/* Tier Thresholds Strip */}
      <div className="bauhaus-card p-4 flex flex-wrap items-center justify-between gap-3">
        <span className="bauhaus-label">{"// MEMBERSHIP LOYALTY TIERS:"}</span>
        <div className="flex flex-wrap gap-2 text-[12px] font-bold uppercase">
          <span className="border border-[#151515] bg-[#151515] text-[#FFFFFF] px-3 py-1">IRON: 0–499 PTS</span>
          <span className="border border-[#151515] bg-[#C8372B] text-[#FFFFFF] px-3 py-1">BRONZE: 500+ PTS</span>
          <span className="border border-[#151515] bg-[#2B4BCC] text-[#FFFFFF] px-3 py-1">SILVER: 1,500+ PTS</span>
          <span className="border border-[#151515] bg-[#EBC95B] text-[#151515] px-3 py-1"><Trophy className="size-3.5 inline mr-1" />GOLD: 3,000+ PTS</span>
        </div>
      </div>

      <FilterBar>
        <div className="flex flex-wrap gap-2">
          {(["LEADERBOARD", "REFERRALS", "LEDGER"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={clsx(
                "min-h-[42px] border-2 border-[var(--border-ink)] px-4 text-[12px] font-bold uppercase tracking-[0.08em]",
                tab === t ? "bg-[#151515] text-[#FFFFFF]" : "bg-[var(--bg-paper)] hover:bg-[#EBC95B]"
              )}
            >
              {t === "LEADERBOARD" ? "TIER LEADERBOARD" : t === "REFERRALS" ? "REFERRAL REWARDS" : "POINTS LEDGER"}
            </button>
          ))}
        </div>
        <span className="bauhaus-label text-[var(--fg-grey)]">RULE: CHECK-IN +25 · STREAK +100 · RENEWAL +250 · REFERRAL +500</span>
      </FilterBar>

      {tab === "LEADERBOARD" && (
        <DataTable title="TOP LOYALTY MEMBERS" rows={accounts} columns={accountColumns} rowKey={(r) => r.id} />
      )}
      {tab === "REFERRALS" && (
        <DataTable title="REFERRAL FREE-DAY & DISCOUNT GRANTS" rows={referrals} columns={referralColumns} rowKey={(r) => r.id} />
      )}
      {tab === "LEDGER" && (
        <DataTable title="RECENT POINTS ACTIVITY" rows={ledger} columns={ledgerColumns} rowKey={(r) => r.id} />
      )}

      {/* Award/Redeem Modal */}
      <Modal open={pointsModalOpen} onClose={() => setPointsModalOpen(false)} eyebrow="POINTS ENGINE" title="Award or Redeem Loyalty Points">
        <div className="space-y-4">
          <div>
            <label htmlFor="lp-mem" className="bauhaus-label block mb-1.5">{"// SELECT MEMBER"}</label>
            <select id="lp-mem" className="bauhaus-input" value={ptsMemberId} onChange={(e) => setPtsMemberId(e.target.value)}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.fullName} ({m.memberCode})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["AWARD_EVENT", "REDEEM"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPtsMode(m)}
                className={clsx(
                  "min-h-[44px] border-2 border-[#151515] text-[12px] font-bold uppercase",
                  ptsMode === m ? "bg-[#151515] text-[#FFFFFF]" : "bg-[var(--bg-surface)]"
                )}
              >
                {m === "AWARD_EVENT" ? "Award Points" : "Redeem Perk"}
              </button>
            ))}
          </div>
          {ptsMode === "AWARD_EVENT" ? (
            <div>
              <label htmlFor="lp-ev" className="bauhaus-label block mb-1.5">{"// MILESTONE EVENT"}</label>
              <select
                id="lp-ev"
                className="bauhaus-input"
                value={ptsEvent}
                onChange={(e) => setPtsEvent(e.target.value as "CHECKIN" | "STREAK_5" | "ONTIME_RENEWAL" | "REFERRAL_CONVERTED")}
              >
                <option value="CHECKIN">Floor Check-In (+25 pts)</option>
                <option value="STREAK_5">5-Visit Weekly Streak (+100 pts)</option>
                <option value="ONTIME_RENEWAL">On-Time Renewal (+250 pts)</option>
                <option value="REFERRAL_CONVERTED">Referral Converted (+500 pts)</option>
              </select>
            </div>
          ) : (
            <div>
              <label htmlFor="lp-red" className="bauhaus-label block mb-1.5">{"// POINTS TO REDEEM"}</label>
              <input id="lp-red" type="number" min={50} className="bauhaus-input" value={redeemPoints} onChange={(e) => setRedeemPoints(Number(e.target.value))} />
            </div>
          )}
          <Button
            variant="primary"
            density="hero"
            fullWidth
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const res = await awardOrRedeemLoyaltyAction({
                  memberId: ptsMemberId,
                  mode: ptsMode,
                  event: ptsEvent,
                  redeemPoints,
                });
                if (!res.ok) {
                  setToast({ msg: res.error, tone: "red" });
                  return;
                }
                setPointsModalOpen(false);
                setToast({ msg: `Points updated! Balance: ${res.nextBalance} (${res.nextTier}).`, tone: "blue" });
              });
            }}
          >
            <Award className="size-4" /> APPLY POINTS TRANSACTION
          </Button>
        </div>
      </Modal>

      {/* Referral Grant Modal */}
      <Modal open={refModalOpen} onClose={() => setRefModalOpen(false)} eyebrow="REFERRAL ENGINE" title="Credit Referral Reward Days">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rf-ref" className="bauhaus-label block mb-1.5">{"// REFERRER MEMBER"}</label>
              <select id="rf-ref" className="bauhaus-input" value={referrerId} onChange={(e) => setReferrerId(e.target.value)}>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.fullName} ({m.referralCode})</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rf-new" className="bauhaus-label block mb-1.5">{"// REFERRED JOINER"}</label>
              <select id="rf-new" className="bauhaus-input" value={referredId} onChange={(e) => setReferredId(e.target.value)}>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.fullName} ({m.memberCode})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="rf-days" className="bauhaus-label block mb-1.5">{"// FREE DAYS TO EXTEND"}</label>
              <input id="rf-days" type="number" min={1} max={90} className="bauhaus-input" value={freeDays} onChange={(e) => setFreeDays(Number(e.target.value))} />
            </div>
            <div>
              <label htmlFor="rf-disc" className="bauhaus-label block mb-1.5">{"// DISCOUNT CREDIT (₹)"}</label>
              <input id="rf-disc" type="number" min={0} className="bauhaus-input" value={discountRupees} onChange={(e) => setDiscountRupees(Number(e.target.value))} />
            </div>
          </div>
          <Button
            variant="primary"
            density="hero"
            fullWidth
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const res = await grantReferralRewardDaysAction({
                  referrerMemberId: referrerId,
                  referredMemberId: referredId,
                  freeDays,
                  discountPaise: discountRupees * 100,
                });
                if (!res.ok) {
                  setToast({ msg: res.error, tone: "red" });
                  return;
                }
                setRefModalOpen(false);
                setToast({ msg: `Referral credited (+${freeDays}d + 500 loyalty pts).`, tone: "blue" });
              });
            }}
          >
            EXTEND EXPIRY & CREDIT BONUS
          </Button>
        </div>
      </Modal>

      <Toast message={toast?.msg ?? null} tone={toast?.tone} onDismiss={() => setToast(null)} />
    </div>
  );
}
