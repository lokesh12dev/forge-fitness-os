"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  Barcode,
  Check,
  KeyRound,
  Minus,
  PackageCheck,
  Plus,
  ShoppingCart,
  Trash2,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { FilterBar, Modal, StatTile, Toast } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import {
  assignOrReleaseLockerAction,
  logEquipmentMaintenanceAction,
  receivePurchaseOrderAction,
} from "@/app/actions/phase34-actions";
import {
  createEquipmentAssetAction,
  createInventorySkuAction,
  multiCartPosCheckoutAction,
} from "@/app/actions/world-class-actions";

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
  branches,
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
  branches: Array<{ id: string; name: string }>;
  members: Array<{ id: string; fullName: string; memberCode: string }>;
  items: InventoryRow[];
  sales: SaleRow[];
  purchaseOrders: PoRow[];
  lockers: LockerRow[];
  assets: AssetRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"POS" | "PO" | "LOCKERS" | "EQUIPMENT">("POS");

  // Multi-SKU POS Basket State
  const [barcodeInput, setBarcodeInput] = useState("");
  const [cart, setCart] = useState<Array<{ itemId: string; quantity: number }>>(() =>
    items[0] ? [{ itemId: items[0].id, quantity: 1 }] : []
  );
  const [posBranchId, setPosBranchId] = useState(branches[0]?.id ?? items[0]?.branchId ?? "");
  const [posMemberId, setPosMemberId] = useState("");
  const [posMethod, setPosMethod] = useState<"UPI" | "CARD" | "CASH" | "SPLIT">("UPI");

  // Locker & Equipment Maintenance State
  const [lockerMemberId, setLockerMemberId] = useState(members[0]?.id ?? "");
  const [serviceAsset, setServiceAsset] = useState<AssetRow | null>(null);
  const [serviceStatus, setServiceStatus] = useState<"OPERATIONAL" | "NEEDS_SERVICE" | "OUT_OF_ORDER">("OPERATIONAL");
  const [serviceNotes, setServiceNotes] = useState("Belt tensioned, rollers lubricated & safety check passed.");

  // New SKU & Equipment Modals
  const [skuOpen, setSkuOpen] = useState(false);
  const [skuBranchId, setSkuBranchId] = useState(branches[0]?.id ?? "");
  const [skuCode, setSkuCode] = useState("PREWORKOUT-300G");
  const [skuName, setSkuName] = useState("Pre-Workout Ignition 300g");
  const [skuCategory, setSkuCategory] = useState<"SUPPLEMENTS" | "APPAREL" | "BEVERAGE" | "ACCESSORIES">("SUPPLEMENTS");
  const [skuPriceRupees, setSkuPriceRupees] = useState(1899);
  const [skuCostRupees, setSkuCostRupees] = useState(1100);
  const [skuStock, setSkuStock] = useState(15);
  const [skuReorder, setSkuReorder] = useState(5);
  const [skuSupplier, setSkuSupplier] = useState("MuscleBlaze Wholesale");

  const [eqOpen, setEqOpen] = useState(false);
  const [eqBranchId, setEqBranchId] = useState(branches[0]?.id ?? "");
  const [eqCode, setEqCode] = useState("EQ-SQUAT-09");
  const [eqName, setEqName] = useState("ATX Half-Rack + Jammer Arms");
  const [eqZone, setEqZone] = useState("Strength Zone B");
  const [eqBrand, setEqBrand] = useState("ATX Germany");

  const [toast, setToast] = useState<{ msg: string; tone: "ink" | "red" | "blue" | "yellow" } | null>(null);
  const [pending, startTransition] = useTransition();

  const stats = useMemo(() => {
    const lowStock = items.filter((i) => i.stockQty <= i.reorderLevel).length;
    const assignedLockers = lockers.filter((l) => l.status === "ASSIGNED").length;
    const faultyEquip = assets.filter((a) => a.status !== "OPERATIONAL").length;
    return { lowStock, assignedLockers, faultyEquip };
  }, [items, lockers, assets]);

  const branchSkus = useMemo(
    () => items.filter((i) => !posBranchId || i.branchId === posBranchId),
    [items, posBranchId]
  );

  const addToCart = (item: InventoryRow) => {
    if (item.branchId !== posBranchId) {
      setPosBranchId(item.branchId);
      setCart([{ itemId: item.id, quantity: 1 }]);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.itemId === item.id ? { ...c, quantity: Math.min(item.stockQty, c.quantity + 1) } : c
        );
      }
      return [...prev, { itemId: item.id, quantity: 1 }];
    });
  };

  const handleBarcodeAdd = () => {
    const q = barcodeInput.trim().toUpperCase();
    if (!q) return;
    const match = items.find((it) => it.sku.toUpperCase() === q || it.sku.toUpperCase().includes(q) || it.name.toUpperCase().includes(q));
    if (!match) {
      setToast({ msg: `No SKU matching "${barcodeInput}".`, tone: "red" });
      return;
    }
    addToCart(match);
    setBarcodeInput("");
    setToast({ msg: `Scanned ${match.name} (+1 to cart).`, tone: "blue" });
  };

  const cartSummary = useMemo(() => {
    const resolved = cart
      .map((line) => {
        const sku = items.find((i) => i.id === line.itemId);
        if (!sku) return null;
        const lineSub = sku.unitPricePaise * line.quantity;
        const lineGst = Math.round((lineSub * sku.gstRateBps) / 10_000);
        return { ...line, sku, lineSub, lineGst, lineTotal: lineSub + lineGst };
      })
      .filter(Boolean) as Array<{
        itemId: string;
        quantity: number;
        sku: InventoryRow;
        lineSub: number;
        lineGst: number;
        lineTotal: number;
      }>;
    const subtotal = resolved.reduce((acc, r) => acc + r.lineSub, 0);
    const gst = resolved.reduce((acc, r) => acc + r.lineGst, 0);
    return { lines: resolved, subtotal, gst, total: subtotal + gst };
  }, [cart, items]);

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
    ...(canPos
      ? [
          {
            key: "add",
            header: "Basket",
            render: (r: InventoryRow) => (
              <button
                type="button"
                disabled={r.stockQty <= 0}
                onClick={() => addToCart(r)}
                className="min-h-[34px] border border-[#151515] bg-[#151515] text-[#FFFFFF] px-2.5 py-1 text-[12px] font-bold uppercase hover:bg-[#2B4BCC] disabled:opacity-40"
              >
                + Add
              </button>
            ),
          },
        ]
      : []),
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
                  className="min-h-[34px] border border-[#151515] bg-[#151515] text-[#FFFFFF] px-2.5 py-1 text-[12px] font-bold uppercase hover:bg-[#2B4BCC]"
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
          <p className="bauhaus-label text-[#C8372B] mb-1">{"// MULTI-CART RETAIL POS, LOCKERS & FACILITY ASSETS"}</p>
          <h1 className="font-headline text-[36px] md:text-[48px]">INVENTORY &amp; OPS.</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {canPos && (
            <Button variant="primary" onClick={() => setSkuOpen(true)}>
              <Plus className="size-4" /> New Retail SKU
            </Button>
          )}
          {canEquip && (
            <Button variant="secondary" onClick={() => setEqOpen(true)}>
              <Plus className="size-4" /> New Equipment Asset
            </Button>
          )}
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
        <span className="bauhaus-label text-[var(--fg-grey)]">SAC 999723 GST INVOICE AUTO-LINKED FOR MEMBERS</span>
      </FilterBar>

      {tab === "POS" && (
        <div className="space-y-6">
          {canPos && items.length > 0 && (
            <div className="bauhaus-card p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="bauhaus-label text-[#2B4BCC]">{"// MULTI-SKU POS BASKET + BARCODE QUICK-SCAN"}</p>
                <select
                  aria-label="POS Branch"
                  className="bauhaus-input w-auto"
                  value={posBranchId}
                  onChange={(e) => {
                    setPosBranchId(e.target.value);
                    setCart([]);
                  }}
                >
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex gap-2">
                  <input
                    aria-label="Scan SKU or Barcode"
                    className="bauhaus-input flex-1 font-mono"
                    placeholder="Scan SKU (e.g. WHEY-ISO-1KG)..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleBarcodeAdd();
                      }
                    }}
                  />
                  <Button variant="secondary" density="dense" onClick={handleBarcodeAdd}>
                    <Barcode className="size-4" /> Scan
                  </Button>
                </div>

                <select aria-label="Quick add SKU" className="bauhaus-input" onChange={(e) => {
                  const found = branchSkus.find((x) => x.id === e.target.value);
                  if (found) addToCart(found);
                }} value="">
                  <option value="">+ Quick add branch SKU to basket...</option>
                  {branchSkus.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({formatMoney(it.unitPricePaise, { currency })} · {it.stockQty} left)
                    </option>
                  ))}
                </select>

                <select aria-label="Buyer Member" className="bauhaus-input" value={posMemberId} onChange={(e) => setPosMemberId(e.target.value)}>
                  <option value="">Walk-in Retail Guest (PosSale Only)</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.fullName} ({m.memberCode}) → Issue GST Invoice</option>
                  ))}
                </select>
              </div>

              {/* Cart Lines */}
              <div className="border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] divide-y divide-[var(--border-ink)]">
                {cartSummary.lines.length === 0 ? (
                  <p className="p-3 text-[12px] font-bold uppercase text-[var(--fg-grey)]">Basket empty — scan a SKU or click + Add below.</p>
                ) : (
                  cartSummary.lines.map((line) => (
                    <div key={line.itemId} className="p-3 flex flex-wrap items-center justify-between gap-3 text-[13px]">
                      <div>
                        <p className="font-bold">{line.sku.name}</p>
                        <p className="text-[12px] font-mono text-[var(--fg-grey)]">{line.sku.sku} · {formatMoney(line.sku.unitPricePaise, { currency })} + GST</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCart((p) => p.map((c) => c.itemId === line.itemId ? { ...c, quantity: Math.max(1, c.quantity - 1) } : c))}
                          className="min-h-[34px] min-w-[34px] border border-[var(--border-ink)] bg-[var(--bg-surface)] text-[var(--fg-ink)] flex items-center justify-center hover:bg-[#EBC95B] hover:text-[#151515]"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="font-tabular font-bold w-6 text-center">{line.quantity}</span>
                        <button
                          type="button"
                          onClick={() => setCart((p) => p.map((c) => c.itemId === line.itemId ? { ...c, quantity: Math.min(line.sku.stockQty, c.quantity + 1) } : c))}
                          className="min-h-[34px] min-w-[34px] border border-[var(--border-ink)] bg-[var(--bg-surface)] text-[var(--fg-ink)] flex items-center justify-center hover:bg-[#EBC95B] hover:text-[#151515]"
                          aria-label="Increase quantity"
                        >
                          <Plus className="size-3.5" />
                        </button>
                        <span className="font-tabular font-bold w-24 text-right">{formatMoney(line.lineTotal, { currency })}</span>
                        <button
                          type="button"
                          onClick={() => setCart((p) => p.filter((c) => c.itemId !== line.itemId))}
                          className="min-h-[34px] min-w-[34px] border border-[var(--border-ink)] text-[#C8372B] bg-[var(--bg-surface)] flex items-center justify-center hover:bg-[#C8372B] hover:text-[#FFFFFF]"
                          aria-label="Remove item"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <div className="flex flex-wrap items-center gap-4 text-[13px] font-tabular">
                  <span>SUBTOTAL: <strong>{formatMoney(cartSummary.subtotal, { currency })}</strong></span>
                  <span>GST: <strong>{formatMoney(cartSummary.gst, { currency })}</strong></span>
                  <span className="font-headline text-[20px] text-[#C8372B]">TOTAL: {formatMoney(cartSummary.total, { currency })}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select aria-label="POS Method" className="bauhaus-input w-32" value={posMethod} onChange={(e) => setPosMethod(e.target.value as "UPI" | "CARD" | "CASH" | "SPLIT")}>
                    <option value="UPI">UPI</option>
                    <option value="CARD">CARD</option>
                    <option value="CASH">CASH</option>
                    <option value="SPLIT">SPLIT</option>
                  </select>
                  <Button
                    variant="primary"
                    disabled={pending || cartSummary.lines.length === 0}
                    onClick={() => {
                      startTransition(async () => {
                        const res = await multiCartPosCheckoutAction({
                          branchId: posBranchId,
                          memberId: posMemberId || undefined,
                          items: cartSummary.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
                          method: posMethod,
                        });
                        if (!res.ok) {
                          setToast({ msg: res.error, tone: "red" });
                          return;
                        }
                        setCart([]);
                        setToast({
                          msg: posMemberId
                            ? `Sale ${res.invoiceNumber} (${formatMoney(res.totalPaise, { currency })}) + Member GST Invoice issued!`
                            : `POS Sale ${res.invoiceNumber} (${formatMoney(res.totalPaise, { currency })} incl GST).`,
                          tone: "blue",
                        });
                        router.refresh();
                      });
                    }}
                  >
                    <ShoppingCart className="size-4" /> Checkout Basket ({cartSummary.lines.length})
                  </Button>
                </div>
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
            <select aria-label="Locker Member" className="bauhaus-input w-auto" value={lockerMemberId} onChange={(e) => setLockerMemberId(e.target.value)}>
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
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {l.status === "AVAILABLE" && (
                    <Button
                      variant="primary"
                      density="dense"
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
                      density="dense"
                      disabled={pending}
                      onClick={() => startTransition(async () => {
                        await assignOrReleaseLockerAction({ lockerId: l.id, action: "RELEASE" });
                        router.refresh();
                      })}
                    >
                      Release
                    </Button>
                  )}
                  {l.status !== "MAINTENANCE" && (
                    <Button
                      variant="yellow"
                      density="dense"
                      disabled={pending}
                      onClick={() => startTransition(async () => {
                        await assignOrReleaseLockerAction({ lockerId: l.id, action: "MAINTENANCE" });
                        setToast({ msg: `Locker ${l.code} marked MAINTENANCE.`, tone: "yellow" });
                        router.refresh();
                      })}
                    >
                      Maint
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

      {/* Service Equipment Modal */}
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

      {/* New SKU Modal */}
      <Modal open={skuOpen} onClose={() => setSkuOpen(false)} eyebrow="RETAIL POS CATALOG" title="Add New Retail SKU">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sku-br" className="bauhaus-label block mb-1">{"// BRANCH"}</label>
              <select id="sku-br" className="bauhaus-input" value={skuBranchId} onChange={(e) => setSkuBranchId(e.target.value)}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="sku-cd" className="bauhaus-label block mb-1">{"// SKU CODE"}</label>
              <input id="sku-cd" className="bauhaus-input font-mono" value={skuCode} onChange={(e) => setSkuCode(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sku-nm" className="bauhaus-label block mb-1">{"// ITEM NAME"}</label>
              <input id="sku-nm" className="bauhaus-input" value={skuName} onChange={(e) => setSkuName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="sku-cat" className="bauhaus-label block mb-1">{"// CATEGORY"}</label>
              <select id="sku-cat" className="bauhaus-input" value={skuCategory} onChange={(e) => setSkuCategory(e.target.value as "SUPPLEMENTS" | "APPAREL" | "BEVERAGE" | "ACCESSORIES")}>
                <option value="SUPPLEMENTS">SUPPLEMENTS</option>
                <option value="APPAREL">APPAREL</option>
                <option value="BEVERAGE">BEVERAGE</option>
                <option value="ACCESSORIES">ACCESSORIES</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label htmlFor="sku-pr" className="bauhaus-label block mb-1">{"// MRP (₹)"}</label>
              <input id="sku-pr" type="number" className="bauhaus-input" value={skuPriceRupees} onChange={(e) => setSkuPriceRupees(Number(e.target.value) || 0)} />
            </div>
            <div>
              <label htmlFor="sku-co" className="bauhaus-label block mb-1">{"// COST (₹)"}</label>
              <input id="sku-co" type="number" className="bauhaus-input" value={skuCostRupees} onChange={(e) => setSkuCostRupees(Number(e.target.value) || 0)} />
            </div>
            <div>
              <label htmlFor="sku-qt" className="bauhaus-label block mb-1">{"// STOCK"}</label>
              <input id="sku-qt" type="number" className="bauhaus-input" value={skuStock} onChange={(e) => setSkuStock(Number(e.target.value) || 0)} />
            </div>
            <div>
              <label htmlFor="sku-re" className="bauhaus-label block mb-1">{"// REORDER"}</label>
              <input id="sku-re" type="number" className="bauhaus-input" value={skuReorder} onChange={(e) => setSkuReorder(Number(e.target.value) || 0)} />
            </div>
          </div>
          <div>
            <label htmlFor="sku-sp" className="bauhaus-label block mb-1">{"// SUPPLIER"}</label>
            <input id="sku-sp" className="bauhaus-input" value={skuSupplier} onChange={(e) => setSkuSupplier(e.target.value)} />
          </div>
          <Button
            variant="primary"
            density="hero"
            fullWidth
            disabled={pending}
            onClick={() => startTransition(async () => {
              await createInventorySkuAction({
                branchId: skuBranchId,
                sku: skuCode,
                name: skuName,
                category: skuCategory,
                unitPricePaise: skuPriceRupees * 100,
                costPaise: skuCostRupees * 100,
                stockQty: skuStock,
                reorderLevel: skuReorder,
                supplierName: skuSupplier,
              });
              setSkuOpen(false);
              setToast({ msg: `SKU ${skuCode} created!`, tone: "blue" });
              router.refresh();
            })}
          >
            SAVE RETAIL SKU
          </Button>
        </div>
      </Modal>

      {/* New Equipment Modal */}
      <Modal open={eqOpen} onClose={() => setEqOpen(false)} eyebrow="FACILITY ASSET REGISTRY" title="Register Equipment Asset">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-eq-br" className="bauhaus-label block mb-1">{"// BRANCH"}</label>
              <select id="new-eq-br" className="bauhaus-input" value={eqBranchId} onChange={(e) => setEqBranchId(e.target.value)}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="new-eq-cd" className="bauhaus-label block mb-1">{"// ASSET CODE"}</label>
              <input id="new-eq-cd" className="bauhaus-input font-mono" value={eqCode} onChange={(e) => setEqCode(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="new-eq-nm" className="bauhaus-label block mb-1">{"// MACHINE NAME"}</label>
            <input id="new-eq-nm" className="bauhaus-input" value={eqName} onChange={(e) => setEqName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-eq-zn" className="bauhaus-label block mb-1">{"// FLOOR ZONE"}</label>
              <input id="new-eq-zn" className="bauhaus-input" value={eqZone} onChange={(e) => setEqZone(e.target.value)} />
            </div>
            <div>
              <label htmlFor="new-eq-bn" className="bauhaus-label block mb-1">{"// BRAND"}</label>
              <input id="new-eq-bn" className="bauhaus-input" value={eqBrand} onChange={(e) => setEqBrand(e.target.value)} />
            </div>
          </div>
          <Button
            variant="primary"
            density="hero"
            fullWidth
            disabled={pending}
            onClick={() => startTransition(async () => {
              await createEquipmentAssetAction({
                branchId: eqBranchId,
                assetCode: eqCode,
                name: eqName,
                zone: eqZone,
                brand: eqBrand,
              });
              setEqOpen(false);
              setToast({ msg: `Equipment asset ${eqCode} registered!`, tone: "blue" });
              router.refresh();
            })}
          >
            REGISTER ASSET
          </Button>
        </div>
      </Modal>

      <Toast message={toast?.msg ?? null} tone={toast?.tone} onDismiss={() => setToast(null)} />
    </div>
  );
}
