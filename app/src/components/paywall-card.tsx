"use client";

import { useState } from "react";
import { Check, CreditCard, Lock, ShieldCheck, Sparkles, X, Zap } from "lucide-react";
import { PLANS, mockRazorpayCheckout, mockStripeCheckout, type PlanTier } from "@/lib/plans";
import { cn } from "@/lib/utils";

interface PaywallCardProps {
  featureName: string;
  featureDescription: string;
  onUpgradeSuccess?: () => void;
  className?: string;
}

export function PaywallCard({
  featureName,
  featureDescription,
  onUpgradeSuccess,
  className,
}: PaywallCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [isProcessing, setIsProcessing] = useState(false);
  const [upgraded, setUpgraded] = useState(false);

  const proPlan = PLANS.pro;

  async function handleSimulatedCheckout(adapter: "razorpay" | "stripe") {
    setIsProcessing(true);
    if (adapter === "razorpay") {
      await mockRazorpayCheckout("pro");
    } else {
      await mockStripeCheckout("pro");
    }
    // Simulate payment latency
    setTimeout(() => {
      setIsProcessing(false);
      setUpgraded(true);
      if (onUpgradeSuccess) onUpgradeSuccess();
    }, 900);
  }

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border border-acid/25 bg-gradient-to-b from-acid/[0.08] to-panel p-6 shadow-xl",
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-xl bg-acid/20 text-acid">
            <Lock className="size-3.5" />
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-acid font-bold">
            Forge Pro Feature
          </span>
        </div>

        <h3 className="font-display text-xl font-bold tracking-tight text-chalk mt-2">
          Unlock {featureName}
        </h3>
        <p className="mt-1 text-[12px] text-mist max-w-md">
          {featureDescription}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="press inline-flex h-10 items-center gap-2 rounded-full bg-acid px-5 text-[12.5px] font-semibold text-ink shadow-[0_0_15px_rgba(201,247,58,0.25)]"
          >
            <Sparkles className="size-3.5" /> Upgrade to Pro
          </button>
          <span className="font-mono text-[10px] text-dim">
            ₹799/mo or $9.99/mo · Cancel anytime
          </span>
        </div>
      </div>

      {/* Checkout Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
          <button
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
            aria-label="Close"
          />
          <div className="animate-scale-in relative z-10 w-full max-w-lg overflow-hidden rounded-t-3xl border border-white/10 bg-panel p-6 shadow-2xl sm:rounded-3xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <span className="font-mono text-[8.5px] uppercase tracking-wider text-acid font-bold">
                  Instant Subscription (I4)
                </span>
                <h3 className="font-display text-2xl font-black tracking-tight text-chalk mt-0.5">
                  Upgrade to Forge Pro
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="grid size-8 place-items-center rounded-full border border-white/10 text-mist hover:text-chalk"
              >
                <X className="size-4" />
              </button>
            </div>

            {upgraded ? (
              <div className="animate-fade-up rounded-2xl border border-mint/30 bg-mint/[0.08] p-6 text-center">
                <div className="mx-auto grid size-12 place-items-center rounded-full bg-mint text-ink mb-3">
                  <Check className="size-6 stroke-[3]" />
                </div>
                <h4 className="font-display text-xl font-bold text-chalk">
                  Welcome to Forge Pro!
                </h4>
                <p className="mt-1 text-[12px] text-mist">
                  Your account has been upgraded with autonomous AI coaching and computer vision analysis.
                </p>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="press mt-4 rounded-full bg-mint px-6 py-2 text-[12px] font-bold text-ink"
                >
                  Continue Training
                </button>
              </div>
            ) : (
              <>
                {/* Currency Switcher */}
                <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-black/30 p-2 mb-4">
                  <span className="font-mono text-[9px] text-dim pl-2">Currency:</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrency("INR")}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors",
                        currency === "INR" ? "bg-acid text-ink" : "text-mist hover:text-chalk",
                      )}
                    >
                      INR (₹) India
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrency("USD")}
                      className={cn(
                        "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors",
                        currency === "USD" ? "bg-acid text-ink" : "text-mist hover:text-chalk",
                      )}
                    >
                      USD ($) Global
                    </button>
                  </div>
                </div>

                {/* Plan Pricing Card */}
                <div className="rounded-2xl border border-acid/30 bg-acid/[0.05] p-5">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <h4 className="font-display text-lg font-bold text-chalk">{proPlan.name}</h4>
                      <p className="text-[11px] text-mist">{proPlan.description}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-numeric text-2xl font-black text-acid">
                        {currency === "INR" ? `₹${proPlan.priceMonthlyInr}` : `$${proPlan.priceMonthlyUsd}`}
                      </span>
                      <span className="font-mono text-[9px] text-dim block">/month</span>
                    </div>
                  </div>

                  <ul className="mt-4 space-y-2 border-t border-acid/15 pt-3">
                    {proPlan.features.map((feat, i) => (
                      <li key={i} className="flex items-center gap-2 text-[11.5px] text-chalk">
                        <Check className="size-3.5 text-acid shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Payment Buttons */}
                <div className="mt-5 space-y-2.5">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleSimulatedCheckout("razorpay")}
                    className="press flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-acid font-semibold text-ink text-[13px] disabled:opacity-50"
                  >
                    <Zap className="size-4" />
                    {isProcessing ? "Processing..." : `Pay via Razorpay UPI / Cards (₹${proPlan.priceMonthlyInr})`}
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleSimulatedCheckout("stripe")}
                    className="press flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] text-[12px] font-medium text-mist hover:text-chalk"
                  >
                    <CreditCard className="size-3.5" />
                    Pay via Stripe / Apple Pay (${proPlan.priceMonthlyUsd})
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-center gap-1.5 font-mono text-[8.5px] text-dim">
                  <ShieldCheck className="size-3 text-mint" />
                  <span>256-bit encrypted · Mock test adapter · Instant unlock</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
