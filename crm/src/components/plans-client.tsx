"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, StatusPill, Toast } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { createPlanAction } from "@/app/actions/crm-actions";
import {
  togglePlanActiveAction,
  upsertPlanAddonAction,
  upsertPromoCodeAction,
} from "@/app/actions/world-class-actions";
import { hasPermission, type CrmRole } from "@/lib/rbac";

export function PlansCatalogClient(props: {
  role: CrmRole;
  currency: string;
  plans: Array<{
    id: string;
    name: string;
    code: string;
    billingModel: string;
    durationDays: number;
    sessionCredits: number | null;
    pricePaise: number;
    joiningFeePaise: number;
    gstRateBps: number;
    sacCode: string;
    maxFreezeDays: number;
    freezeFeePaise: number;
    autoRenewDefault: boolean;
    isActive: boolean;
  }>;
  addons: Array<{ id: string; name: string; kind: string; pricePaise: number; durationDays: number }>;
  promos: Array<{
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
    scope: string;
    redeemedCount: number;
    maxRedemptions: number;
    validUntil: string;
  }>;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [addonModalOpen, setAddonModalOpen] = useState(false);
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    name: "",
    code: "",
    billingModel: "QUARTERLY" as "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ANNUAL" | "PT_PACK" | "CLASS_PACK" | "DAY_PASS" | "TRIAL",
    durationDays: 90,
    sessionCredits: "",
    priceRupees: "8999",
    joiningFeeRupees: "500",
    maxFreezeDays: 14,
    freezeFeeRupees: "0",
  });

  const [addonForm, setAddonForm] = useState({
    name: "Dedicated Steel Locker",
    kind: "LOCKER" as "LOCKER" | "TOWEL" | "STEAM" | "PARKING",
    priceRupees: "799",
    durationDays: 30,
  });

  const [promoForm, setPromoForm] = useState({
    code: "MONSOON15",
    discountType: "PERCENT_BPS" as "PERCENT_BPS" | "FIXED_PAISE",
    discountValueInput: "15",
    scope: "PROMO" as "PROMO" | "EARLY_BIRD" | "REFERRAL",
    maxRedemptions: 100,
    validDays: 45,
  });

  const canCreate = hasPermission(props.role, "plans:write");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await createPlanAction({
        name: form.name,
        code: form.code,
        billingModel: form.billingModel,
        durationDays: form.durationDays,
        sessionCredits: form.sessionCredits ? Number(form.sessionCredits) : null,
        pricePaise: Math.round(Number(form.priceRupees || 0) * 100),
        joiningFeePaise: Math.round(Number(form.joiningFeeRupees || 0) * 100),
        maxFreezeDays: form.maxFreezeDays,
        freezeFeePaise: Math.round(Number(form.freezeFeeRupees || 0) * 100),
      });
      setModalOpen(false);
      setToastMsg(`Created plan "${form.name}".`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} />

      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-[var(--border-ink)] pb-4">
        <div>
          <p className="bauhaus-label text-[#2B4BCC] mb-2">{`// CATALOG, ADD-ONS, PROMOS & FREEZE RULES`}</p>
          <h1 className="font-headline text-[36px] md:text-[48px]">PLANS &amp; PRICING</h1>
        </div>
        {canCreate && (
          <div className="flex flex-wrap gap-2">
            <Button variant="tertiary" onClick={() => setAddonModalOpen(true)}>
              <Plus className="size-4" /> New Add-On
            </Button>
            <Button variant="yellow" onClick={() => setPromoModalOpen(true)}>
              <Plus className="size-4" /> New Promo Code
            </Button>
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              <Plus className="size-4" /> Create Plan
            </Button>
          </div>
        )}
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {props.plans.map((p) => (
          <div key={p.id} className={`bauhaus-card p-5 flex flex-col justify-between gap-4 ${!p.isActive ? "opacity-65" : ""}`}>
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="bg-[#151515] text-[#FFFFFF] px-2 py-0.5 text-[12px] font-bold uppercase">
                  {p.billingModel.replace("_", " ")}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold uppercase text-[var(--fg-grey)]">{p.code}</span>
                  <StatusPill status={p.isActive ? "ACTIVE" : "FROZEN"} />
                </div>
              </div>
              <h3 className="font-headline text-[22px] mt-3">{p.name}</h3>
              <p className="font-headline tabular-nums text-[32px] text-[#C8372B] mt-2">
                {formatMoney(p.pricePaise, { currency: props.currency })}
              </p>
              <p className="text-[12px] uppercase font-bold text-[var(--fg-grey)]">
                + {(p.gstRateBps / 100).toFixed(0)}% GST (SAC {p.sacCode}) · {p.durationDays} DAYS
                {p.sessionCredits ? ` · ${p.sessionCredits} SESSIONS` : ""}
              </p>
            </div>

            <div className="border-t-2 border-[var(--border-ink)] pt-3 text-[13px] space-y-1">
              <p>Joining Fee: <strong>{formatMoney(p.joiningFeePaise, { currency: props.currency })}</strong></p>
              <p>Freeze Allowance: <strong>{p.maxFreezeDays}d</strong> (Fee {formatMoney(p.freezeFeePaise, { currency: props.currency })})</p>
              <div className="flex items-center justify-between pt-2">
                <span>Auto-Renew: <strong>{p.autoRenewDefault ? "ENABLED" : "MANUAL"}</strong></span>
                {canCreate && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        await togglePlanActiveAction(p.id);
                        setToastMsg(`Plan ${p.code} ${p.isActive ? "archived" : "activated"}.`);
                        router.refresh();
                      })
                    }
                    className="border border-[var(--border-ink)] px-2.5 py-1 text-[12px] font-bold uppercase hover:bg-[#EBC95B] hover:text-[#151515]"
                  >
                    {p.isActive ? "Pause" : "Activate"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add-ons & Promos Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bauhaus-card">
          <div className="border-b-2 border-[var(--border-ink)] bg-[var(--bg-muted)] p-4 flex items-center justify-between">
            <p className="bauhaus-label">{`// ADD-ONS (LOCKER / TOWEL / STEAM / PARKING)`}</p>
            {canCreate && (
              <Button density="dense" variant="secondary" onClick={() => setAddonModalOpen(true)}>+ Add</Button>
            )}
          </div>
          <div className="divide-y-2 divide-[var(--border-ink)]">
            {props.addons.map((a) => (
              <div key={a.id} className="p-4 flex items-center justify-between text-[14px]">
                <div>
                  <p className="font-bold">{a.name}</p>
                  <p className="text-[12px] uppercase text-[var(--fg-grey)]">{a.kind} · {a.durationDays}d</p>
                </div>
                <span className="font-tabular font-bold">{formatMoney(a.pricePaise, { currency: props.currency })}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bauhaus-card">
          <div className="border-b-2 border-[var(--border-ink)] bg-[#EBC95B] text-[#151515] p-4 flex items-center justify-between">
            <p className="bauhaus-label">{`// PROMO, EARLY-BIRD & REFERRAL CODES`}</p>
            {canCreate && (
              <Button density="dense" variant="primary" onClick={() => setPromoModalOpen(true)}>+ Promo</Button>
            )}
          </div>
          <div className="divide-y-2 divide-[var(--border-ink)]">
            {props.promos.map((pr) => (
              <div key={pr.id} className="p-4 flex items-center justify-between text-[14px]">
                <div>
                  <p className="font-bold">{pr.code}</p>
                  <p className="text-[12px] uppercase text-[var(--fg-grey)]">
                    {pr.scope} · {pr.redeemedCount}/{pr.maxRedemptions} used · Exp {pr.validUntil}
                  </p>
                </div>
                <span className="bg-[#151515] text-[#FFFFFF] px-2.5 py-1 text-[12px] font-bold font-tabular">
                  {pr.discountType === "PERCENT_BPS"
                    ? `${(pr.discountValue / 100).toFixed(0)}% OFF`
                    : `${formatMoney(pr.discountValue, { currency: props.currency })} OFF`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Plan Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} eyebrow="PLAN BUILDER" title="Create New Plan">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="bauhaus-label block mb-1">Plan Name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full min-h-[44px] border-2 border-[var(--border-ink)] px-3 text-[14px]" />
            </div>
            <div>
              <label className="bauhaus-label block mb-1">Code *</label>
              <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="PLAN-PRO" className="w-full min-h-[44px] border-2 border-[var(--border-ink)] px-3 text-[14px] uppercase" />
            </div>
            <div>
              <label className="bauhaus-label block mb-1">Billing Model</label>
              <select value={form.billingModel} onChange={(e) => setForm({ ...form, billingModel: e.target.value as typeof form.billingModel })} className="w-full min-h-[44px] border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-3 text-[14px] font-bold">
                <option value="MONTHLY">MONTHLY</option>
                <option value="QUARTERLY">QUARTERLY</option>
                <option value="HALF_YEARLY">HALF_YEARLY</option>
                <option value="ANNUAL">ANNUAL</option>
                <option value="PT_PACK">PT_PACK</option>
                <option value="CLASS_PACK">CLASS_PACK</option>
                <option value="DAY_PASS">DAY_PASS</option>
                <option value="TRIAL">TRIAL</option>
              </select>
            </div>
            <div>
              <label className="bauhaus-label block mb-1">Base Price (INR)</label>
              <input type="number" required value={form.priceRupees} onChange={(e) => setForm({ ...form, priceRupees: e.target.value })} className="w-full min-h-[44px] border-2 border-[var(--border-ink)] px-3 text-[14px]" />
            </div>
            <div>
              <label className="bauhaus-label block mb-1">Duration (Days)</label>
              <input type="number" required value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: Number(e.target.value) })} className="w-full min-h-[44px] border-2 border-[var(--border-ink)] px-3 text-[14px]" />
            </div>
            <div>
              <label className="bauhaus-label block mb-1">Session Credits (PT / Class Pack)</label>
              <input type="number" placeholder="Optional" value={form.sessionCredits} onChange={(e) => setForm({ ...form, sessionCredits: e.target.value })} className="w-full min-h-[44px] border-2 border-[var(--border-ink)] px-3 text-[14px]" />
            </div>
            <div>
              <label className="bauhaus-label block mb-1">Joining Fee (INR)</label>
              <input type="number" value={form.joiningFeeRupees} onChange={(e) => setForm({ ...form, joiningFeeRupees: e.target.value })} className="w-full min-h-[44px] border-2 border-[var(--border-ink)] px-3 text-[14px]" />
            </div>
            <div>
              <label className="bauhaus-label block mb-1">Max Freeze Days</label>
              <input type="number" value={form.maxFreezeDays} onChange={(e) => setForm({ ...form, maxFreezeDays: Number(e.target.value) })} className="w-full min-h-[44px] border-2 border-[var(--border-ink)] px-3 text-[14px]" />
            </div>
          </div>
          <Button type="submit" variant="primary" fullWidth disabled={isPending}>Save Plan</Button>
        </form>
      </Modal>

      {/* Add-on Modal */}
      <Modal open={addonModalOpen} onClose={() => setAddonModalOpen(false)} eyebrow="AMENITY ADD-ON" title="Create Plan Add-On">
        <div className="space-y-4">
          <input value={addonForm.name} onChange={(e) => setAddonForm({ ...addonForm, name: e.target.value })} placeholder="Add-on name" className="bauhaus-input" />
          <div className="grid grid-cols-3 gap-2">
            <select value={addonForm.kind} onChange={(e) => setAddonForm({ ...addonForm, kind: e.target.value as typeof addonForm.kind })} className="bauhaus-input">
              <option value="LOCKER">LOCKER</option>
              <option value="TOWEL">TOWEL</option>
              <option value="STEAM">STEAM</option>
              <option value="PARKING">PARKING</option>
            </select>
            <input type="number" value={addonForm.priceRupees} onChange={(e) => setAddonForm({ ...addonForm, priceRupees: e.target.value })} placeholder="INR" className="bauhaus-input" />
            <input type="number" value={addonForm.durationDays} onChange={(e) => setAddonForm({ ...addonForm, durationDays: Number(e.target.value) })} placeholder="Days" className="bauhaus-input" />
          </div>
          <Button
            variant="primary"
            fullWidth
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await upsertPlanAddonAction({
                  name: addonForm.name,
                  kind: addonForm.kind,
                  pricePaise: Math.round((Number(addonForm.priceRupees) || 0) * 100),
                  durationDays: addonForm.durationDays,
                });
                setAddonModalOpen(false);
                setToastMsg(`Created add-on "${addonForm.name}".`);
                router.refresh();
              })
            }
          >
            Save Add-On
          </Button>
        </div>
      </Modal>

      {/* Promo Modal */}
      <Modal open={promoModalOpen} onClose={() => setPromoModalOpen(false)} eyebrow="CAMPAIGN DISCOUNT" title="Create Promo Code">
        <div className="space-y-4">
          <input value={promoForm.code} onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })} placeholder="SUMMER20" className="bauhaus-input uppercase font-mono font-bold" />
          <div className="grid grid-cols-2 gap-2">
            <select value={promoForm.discountType} onChange={(e) => setPromoForm({ ...promoForm, discountType: e.target.value as typeof promoForm.discountType })} className="bauhaus-input">
              <option value="PERCENT_BPS">% Percent Off</option>
              <option value="FIXED_PAISE">Flat INR Off</option>
            </select>
            <input
              type="number"
              value={promoForm.discountValueInput}
              onChange={(e) => setPromoForm({ ...promoForm, discountValueInput: e.target.value })}
              placeholder={promoForm.discountType === "PERCENT_BPS" ? "e.g. 15" : "e.g. 500"}
              className="bauhaus-input font-tabular font-bold"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select value={promoForm.scope} onChange={(e) => setPromoForm({ ...promoForm, scope: e.target.value as typeof promoForm.scope })} className="bauhaus-input">
              <option value="PROMO">PROMO</option>
              <option value="EARLY_BIRD">EARLY BIRD</option>
              <option value="REFERRAL">REFERRAL</option>
            </select>
            <input type="number" value={promoForm.maxRedemptions} onChange={(e) => setPromoForm({ ...promoForm, maxRedemptions: Number(e.target.value) })} placeholder="Max uses" className="bauhaus-input" />
            <input type="number" value={promoForm.validDays} onChange={(e) => setPromoForm({ ...promoForm, validDays: Number(e.target.value) })} placeholder="Valid days" className="bauhaus-input" />
          </div>
          <Button
            variant="primary"
            fullWidth
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const rawVal = Number(promoForm.discountValueInput) || 10;
                const valueEncoded = promoForm.discountType === "PERCENT_BPS" ? rawVal * 100 : rawVal * 100;
                await upsertPromoCodeAction({
                  code: promoForm.code,
                  discountType: promoForm.discountType,
                  discountValue: valueEncoded,
                  scope: promoForm.scope,
                  maxRedemptions: promoForm.maxRedemptions,
                  validDays: promoForm.validDays,
                });
                setPromoModalOpen(false);
                setToastMsg(`Saved promo code ${promoForm.code}.`);
                router.refresh();
              })
            }
          >
            Save Promo Code
          </Button>
        </div>
      </Modal>
    </div>
  );
}
