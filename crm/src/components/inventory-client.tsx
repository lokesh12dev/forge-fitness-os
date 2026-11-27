"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Check, KeyRound, PackageCheck, ShoppingCart, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { FilterBar, Modal, StatTile, Toast } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import {
  assignOrReleaseLockerAction,
  logEquipmentMaintenanceAction,
  posCheckoutAction,
  receivePurchaseOrderAction,
} from "@/app/actions/phase34-actions";

interface InventoryRow {
  id: string;
  branchId: string;
  branchName: string;
  sku: string;
  name: string;
  category: string;
  unitPricePaise: number;
  costPaise: number;
  gstRateBps: number;
  stockQty: number;
  reorderLevel: number;
  supplierName: string;
}

interface SaleRow {
  id: string;
  invoiceNumber: string;
  branchName: string;
  memberName: string;
  totalPaise: number;
  gstPaise: number;
  method: string;
  soldAt: string;
}

interface PoRow {
  id: string;
  poNumber: string;
  branchName: string;
  supplierName: string;
  status: string;
  totalPaise: number;
  orderedAt: string;
}

interface LockerRow {
  id: string;
  code: string;
  branchName: string;
  size: string;
  status: string;
  memberName: string | null;
}

interface AssetRow {
  id: string;
  assetCode: string;
  name: string;
  branchName: string;
  zone: string;
  brand: string;
  status: string;
  nextServiceDue: string | null;
  maintenanceNotes: string | null;
}

export function InventoryClient({
  currency,
  canPos,
  canEquip,
  members,
  items,
  sales,
  purchaseOrders,
  lockers,
  assets,
}: {
  currency: string;
  canPos: boolean;
  canEquip: boolean;
  members: Array<{ id: string; fullName: string; memberCode: string }>;
  items: InventoryRow[];
  sales: SaleRow[];
  purchaseOrders: PoRow[];
  lockers: LockerRow[];
  assets: AssetRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"POS" | "PO" | "LOCKERS" | "EQUIPMENT">("POS");
  const [posItemId, setPosItemId] = useState(items[0]?.id ?? "");
  const [posMemberId, setPosMemberId] = useState("");
  const [posQty, setPosQty] = useState(1);
  const [posMethod, setPosMethod] = useState<"UPI" | "CARD" | "CASH">("UPI");
  const [lockerMemberId, setLockerMemberId] = useState(members[0]?.id ?? "");
  const [serviceAsset, setServiceAsset] = useState<AssetRow | null>(null);
  const [serviceStatus, setServiceStatus] = useState<"OPERATIONAL" | "NEEDS_SERVICE" | "OUT_OF_ORDER">("OPERATIONAL");
  const [serviceNotes, setServiceNotes] = useState("Belt tensioned, rollers lubricated & safety check passed.");
  const [toast, setToast] = useState<{ msg: string; tone: "ink" | "red" | "blue" | "yellow" } | null>(null);
  const [pending, startTransition] = useTransition();

  const stats = useMemo(() => {
    const lowStock = items.filter((i) => i.stockQty <= i.reorderLevel).length;
    const assignedLockers = lockers.filter((l) => l.status === "ASSIGNED").length;
    const faultyEquip = assets.filter((a) => a.status !== "OPERATIONAL").length;
    return { lowStock, assignedLockers, faultyEquip };
  }, [items, lockers, assets]);

  const skuCols: DataColumn<InventoryRow>[] = [
    { key: "name", header: "SKU Item", render: (r) => <div><p className="font-bold">{r.name}</p><p className="text-[12px] text-[var(--fg-grey)] font-mono">{r.sku} · {r.branchName}</p></div> },
    { key: "cat", header: "Category", render: (r) => <span className="border border-[#151515] px-1.5 py-0.5 text-[12px] font-bold">{r.category}</span> },
    { key: "price", header: "MRP (pre-GST)", align: "right", render: (r) => <span className="font-tabular font-bold">{formatMoney(r.unitPricePaise, { currency })}</span> },
    {
      key: "qty",
      header: "On Hand",
      align: "right",
      render: (r) => (
        <span className={clsx("font-headline text-[18px] font-tabular", r.stockQty <= r.reorderLevel ? "text-[#C8372B]" : "text-[#2B4BCC]")}>
          {r.stockQty} {r.stockQty <= r.reorderLevel ? "(LOW)" : ""}
        </span>
      ),
    },
  ];

  const poCols: DataColumn<PoRow>[] = [
    { key: "po", header: "PO #", render: (r) => <span className="font-mono font-bold">{r.poNumber}</span> },
    { key: "sup", header: "Supplier", render: (r) => <span className="font-bold">{r.supplierName}</span> },
    { key: "tot", header: "PO Cost", align: "right", render: (r) => <span className="font-tabular font-bold">{formatMoney(r.totalPaise, { currency })}</span> },
    {
      key: "st",
      header: "Status",
      render: (r) => <span className={clsx("border border-[#151515] px-2 py-0.5 text-[12px] font-bold", r.status === "RECEIVED" ? "bg-[#2B4BCC] text-[#FFFFFF]" : "bg-[#EBC95B] text-[#151515]")}>{r.status}</span>,
    },
    ...(canPos
      ? [
          {
            key: "act",
            header: "Action",
            render: (r: PoRow) =>
              r.status !== "RECEIVED" ? (
                <button
                  type="button"
                  onClick={() => startTransition(async () => {
                    await receivePurchaseOrderAction(r.id);
                    setToast({ msg: `${r.poNumber} received & stock updated.`, tone: "blue" });
                    router.refresh();
                  })}
                  className="border border-[#151515] bg-[#151515] text-[#FFFFFF] px-2.5 py-1 text-[12px] font-bold uppercase hover:bg-[#2B4BCC]"
                >
                  <PackageCheck className="size-3.5 inline mr-1" /> Receive Stock
                </button>
              ) : (
                <span className="text-[12px] text-[var(--fg-grey)]">STOCKED</span>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-[var(--border-ink)] pb-4">
        <div>
          <p className="bauhaus-label text-[#C8372B] mb-1">{"// RETAIL POS, LOCKERS & FACILITY ASSETS"}</p>
          <h1 className="font-headline text-[36px] md:text-[48px]">INVENTORY & OPS.</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="// RETAIL SKUS" value={items.length} subtext={`${stats.lowStock} below reorder threshold`} accent={stats.lowStock > 0 ? "red" : "blue"} />
        <StatTile label="// POS CHECKOUTS" value={sales.length} subtext="GST retail bills issued" accent="ink" />
        <StatTile label="// LOCKERS ASSIGNED" value={`${stats.assignedLockers}/${lockers.length}`} subtext="Active member storage bay allocation" accent="yellow" />
        <StatTile label="// EQUIPMENT ALERTS" value={stats.faultyEquip} subtext="Needs service or out-of-order" accent={stats.faultyEquip > 0 ? "red" : "blue"} />
      </div>

      <FilterBar>
        <div className="flex flex-wrap gap-2">
          {(["POS", "PO", "LOCKERS", "EQUIPMENT"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={clsx(
                "min-h-[42px] border-2 border-[var(--border-ink)] px-4 text-[12px] font-bold uppercase tracking-[0.08em]",
                tab === t ? "bg-[#151515] text-[#FFFFFF]" : "bg-[var(--bg-paper)] hover:bg-[#EBC95B]"
              )}
            >
              {t === "POS" ? "POS & STOCK" : t === "PO" ? "PURCHASE ORDERS" : t}
            </button>
          ))}
        </div>
        <span className="bauhaus-label text-[var(--fg-grey)]">18% GST INCLUDED AT POS CHECKOUT</span>
      </FilterBar>

      {tab === "POS" && (
        <div className="space-y-6">
          {canPos && items.length > 0 && (
            <div className="bauhaus-card p-5 space-y-4">
              <p className="bauhaus-label text-[#2B4BCC]">{"// FRONT-DESK RETAIL POS TERMINAL"}</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select aria-label="Retail SKU" className="bauhaus-input" value={posItemId} onChange={(e) => setPosItemId(e.target.value)}>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({formatMoney(it.unitPricePaise, { currency })} · {it.stockQty} left)
                    </option>
                  ))}
                </select>
                <select aria-label="Buyer Member" className="bauhaus-input" value={posMemberId} onChange={(e) => setPosMemberId(e.target.value)}>
                  <option value="">Walk-in Retail Guest</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.fullName} ({m.memberCode})</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input type="number" min={1} max={20} aria-label="POS Quantity" className="bauhaus-input w-24" value={posQty} onChange={(e) => setPosQty(Number(e.target.value))} />
                  <select aria-label="POS Method" className="bauhaus-input flex-1" value={posMethod} onChange={(e) => setPosMethod(e.target.value as "UPI" | "CARD" | "CASH")}>
                    <option value="UPI">UPI</option>
                    <option value="CARD">CARD</option>
                    <option value="CASH">CASH</option>
                  </select>
                </div>
                <Button
                  variant="primary"
                  disabled={pending}
                  onClick={() => {
                    const selected = items.find((i) => i.id === posItemId);
                    if (!selected) return;
                    startTransition(async () => {
                      const res = await posCheckoutAction({
                        branchId: selected.branchId,
                        memberId: posMemberId || undefined,
                        itemId: selected.id,
                        quantity: posQty,
                        method: posMethod,
                      });
                      if (!res.ok) {
                        setToast({ msg: res.error, tone: "red" });
                        return;
                      }
                      setToast({ msg: `Sale ${res.invoiceNumber} (${formatMoney(res.totalPaise, { currency })} incl GST).`, tone: "blue" });
                      router.refresh();
                    });
                  }}
                >
                  <ShoppingCart className="size-4" /> Checkout & Deduct Stock
                </Button>
              </div>
            </div>
          )}

          <DataTable title="BRANCH SKU INVENTORY" rows={items} columns={skuCols} rowKey={(r) => r.id} />
        </div>
      )}

      {tab === "PO" && (
        <DataTable title="SUPPLIER PURCHASE ORDERS" rows={purchaseOrders} columns={poCols} rowKey={(r) => r.id} />
      )}

      {tab === "LOCKERS" && (
        <div className="space-y-4">
          <div className="bauhaus-card p-4 flex flex-wrap items-center gap-3">
            <span className="bauhaus-label">{"// ASSIGN LOCKER TO MEMBER:"}</span>
            <select className="bauhaus-input w-auto" value={lockerMemberId} onChange={(e) => setLockerMemberId(e.target.value)}>
              {members.map((m) => <option key={m.id} value={m.id}>{m.fullName} ({m.memberCode})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {lockers.map((l) => (
              <div key={l.id} className="bauhaus-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-headline text-[20px]"><KeyRound className="size-4 inline mr-1" />{l.code}</span>
                  <span
                    className={clsx(
                      "px-2 py-0.5 border border-[#151515] text-[12px] font-bold uppercase",
                      l.status === "AVAILABLE" ? "bg-[#2B4BCC] text-[#FFFFFF]" : l.status === "ASSIGNED" ? "bg-[#EBC95B] text-[#151515]" : "bg-[#C8372B] text-[#FFFFFF]"
                    )}
                  >
                    {l.status}
                  </span>
                </div>
                <p className="text-[12px] font-bold text-[var(--fg-grey)]">{l.size} · {l.branchName}</p>
                <p className="text-[13px] min-h-[20px]">{l.memberName ?? "Unassigned"}</p>
                <div className="flex gap-2 pt-1">
                  {l.status === "AVAILABLE" && (
                    <Button
                      variant="primary"
                      disabled={pending}
                      onClick={() => startTransition(async () => {
                        await assignOrReleaseLockerAction({ lockerId: l.id, action: "ASSIGN", memberId: lockerMemberId });
                        router.refresh();
                      })}
                    >
                      Assign
                    </Button>
                  )}
                  {l.status !== "AVAILABLE" && (
                    <Button
                      variant="tertiary"
                      disabled={pending}
                      onClick={() => startTransition(async () => {
                        await assignOrReleaseLockerAction({ lockerId: l.id, action: "RELEASE" });
                        router.refresh();
                      })}
                    >
                      Release
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "EQUIPMENT" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assets.map((a) => (
            <div key={a.id} className="bauhaus-card p-5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="bauhaus-label text-[var(--fg-grey)]">{`// ${a.assetCode} · ${a.branchName} · ${a.zone}`}</span>
                  <h3 className="font-headline text-[20px] mt-1">{a.name}</h3>
                </div>
                <span
                  className={clsx(
                    "px-2 py-0.5 border border-[#151515] text-[12px] font-bold uppercase",
                    a.status === "OPERATIONAL" ? "bg-[#2B4BCC] text-[#FFFFFF]" : a.status === "NEEDS_SERVICE" ? "bg-[#EBC95B] text-[#151515]" : "bg-[#C8372B] text-[#FFFFFF]"
                  )}
                >
                  {a.status.replace("_", " ")}
                </span>
              </div>
              <p className="text-[13px] text-[var(--fg-grey)]">{a.maintenanceNotes ?? "Routine preventative care logged."}</p>
              <div className="flex items-center justify-between pt-2">
                <span className="text-[12px] font-tabular font-bold">NEXT SERVICE: {a.nextServiceDue ?? "TBD"}</span>
                {canEquip && (
                  <Button variant="secondary" onClick={() => setServiceAsset(a)}>
                    <Wrench className="size-4" /> Log Maintenance
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={Boolean(serviceAsset)} onClose={() => setServiceAsset(null)} eyebrow="PREVENTATIVE MAINTENANCE" title={serviceAsset?.name ?? "Service Asset"}>
        {serviceAsset && (
          <div className="space-y-4">
            <div>
              <label htmlFor="eq-st" className="bauhaus-label block mb-1.5">{"// ASSET STATUS"}</label>
              <select
                id="eq-st"
                className="bauhaus-input"
                value={serviceStatus}
                onChange={(e) => setServiceStatus(e.target.value as "OPERATIONAL" | "NEEDS_SERVICE" | "OUT_OF_ORDER")}
              >
                <option value="OPERATIONAL">OPERATIONAL (MARK SERVICED)</option>
                <option value="NEEDS_SERVICE">NEEDS SERVICE</option>
                <option value="OUT_OF_ORDER">OUT OF ORDER</option>
              </select>
            </div>
            <div>
              <label htmlFor="eq-nt" className="bauhaus-label block mb-1.5">{"// TECHNICIAN LOG"}</label>
              <textarea id="eq-nt" rows={3} className="bauhaus-input h-auto py-2" value={serviceNotes} onChange={(e) => setServiceNotes(e.target.value)} />
            </div>
            <Button
              variant="primary"
              density="hero"
              fullWidth
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  await logEquipmentMaintenanceAction({
                    assetId: serviceAsset.id,
                    status: serviceStatus,
                    notes: serviceNotes,
                  });
                  setServiceAsset(null);
                  setToast({ msg: "Equipment maintenance log updated.", tone: "blue" });
                  router.refresh();
                });
              }}
            >
              <Check className="size-4" /> SAVE SERVICE UPDATE
            </Button>
          </div>
        )}
      </Modal>

      <Toast message={toast?.msg ?? null} tone={toast?.tone} onDismiss={() => setToast(null)} />
    </div>
  );
}
