"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, Merge, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  EmptyState,
  FilterBar,
  Modal,
  StatusPill,
  Toast,
} from "@/components/ui/primitives";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import {
  createMemberAction,
  mergeDuplicateMembersAction,
} from "@/app/actions/crm-actions";
import {
  bulkMemberOperationAction,
  deleteSavedViewAction,
  saveSavedViewAction,
} from "@/app/actions/world-class-actions";
import { formatMoney } from "@/lib/money";
import { hasPermission, type CrmRole } from "@/lib/rbac";

interface MemberRow {
  id: string;
  memberCode: string;
  fullName: string;
  phone: string;
  email: string;
  branchName: string;
  branchCode: string;
  status: string;
  expiryDate: string | null;
  lastVisitedAt: string | null;
  planName: string;
  tags: string[];
  walletBalancePaise: number;
}

export function MembersDirectoryClient({
  role,
  activeBranchId,
  branches,
  totalCount,
  page,
  pageSize,
  initialQuery,
  initialStatus,
  initialTag,
  openNewOnMount,
  statusCounts,
  savedViews,
  customFields,
  trainers,
  rows,
}: {
  role: CrmRole;
  activeBranchId: string | null;
  branches: Array<{ id: string; name: string; code: string; stateCode: string }>;
  totalCount: number;
  page: number;
  pageSize: number;
  initialQuery: string;
  initialStatus: string;
  initialTag: string;
  openNewOnMount: boolean;
  statusCounts: Record<string, number>;
  savedViews: Array<{ id: string; name: string; filterJson: { status?: string; q?: string; tag?: string } }>;
  customFields: Array<{ id: string; fieldKey: string; label: string; fieldType: string; options: string[]; required: boolean }>;
  trainers: Array<{ id: string; name: string }>;
  rows: MemberRow[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState(initialQuery);
  const [tagFilter, setTagFilter] = useState(initialTag);
  const [newOpen, setNewOpen] = useState(openNewOnMount && hasPermission(role, "members:write"));
  const [mergeOpen, setMergeOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTag, setBulkTag] = useState("vip-priority");
  const [bulkTrainerId, setBulkTrainerId] = useState(trainers[0]?.id ?? "");
  const [bulkNudge, setBulkNudge] = useState("Hi {name}, quick check-in from your coach — see you on the floor this week!");
  const [survivorId, setSurvivorId] = useState(rows[0]?.id ?? "");
  const [duplicateId, setDuplicateId] = useState(rows[1]?.id ?? "");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const defaultBranchId = activeBranchId ?? branches[0]?.id ?? "";
  const defaultStateCode =
    branches.find((b) => b.id === defaultBranchId)?.stateCode ?? branches[0]?.stateCode ?? "KA";

  const [newMember, setNewMember] = useState({
    branchId: defaultBranchId,
    fullName: "",
    phone: "",
    email: "",
    stateCode: defaultStateCode,
    emergencyName: "",
    emergencyPhone: "",
    goals: "",
    healthNotes: "",
    healthConsent: true,
    whatsappConsent: true,
    waiverSigned: true,
    kycLast4: "",
  });

  const canWrite = hasPermission(role, "members:write");

  const applyFilter = (nextStatus: string, nextQ: string, nextPage = 1, nextTag = tagFilter) => {
    const params = new URLSearchParams();
    if (nextStatus !== "ALL") params.set("status", nextStatus);
    if (nextQ.trim()) params.set("q", nextQ.trim());
    if (nextTag.trim()) params.set("tag", nextTag.trim());
    if (nextPage > 1) params.set("page", String(nextPage));
    router.push(`/app/members${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createMemberAction({
        ...newMember,
        tags: ["new-joiner"],
      });
      if (!res.ok) {
        setToastMsg(res.error);
        return;
      }
      setNewOpen(false);
      setToastMsg(`Created member ${res.memberCode}! Opening profile...`);
      router.push(`/app/members/${res.memberId}`);
      router.refresh();
    });
  };

  const handleMerge = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await mergeDuplicateMembersAction({ survivorId, duplicateId });
      if (!res.ok) {
        setToastMsg(res.error);
        return;
      }
      setMergeOpen(false);
      setToastMsg("Merged duplicate member accounts cleanly.");
      router.refresh();
    });
  };

  const runBulk = (op: "ADD_TAG" | "ASSIGN_TRAINER" | "CREATE_FOLLOWUP_TASK" | "WHATSAPP_OUTREACH", value: string) => {
    startTransition(async () => {
      const res = await bulkMemberOperationAction({
        memberIds: selectedIds,
        operation: op,
        value,
      });
      if (!res.ok) {
        setToastMsg(res.error);
        return;
      }
      setSelectedIds([]);
      setToastMsg(`Bulk operation applied across ${res.updated} members.`);
      router.refresh();
    });
  };

  const columns: DataColumn<MemberRow>[] = [
    {
      key: "member",
      header: "Member",
      sortValue: (r) => r.fullName,
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.fullName} size={36} />
          <div>
            <Link href={`/app/members/${r.id}`} className="font-bold text-[15px] hover:text-[#C8372B] underline">
              {r.fullName}
            </Link>
            <p className="text-[12px] text-[var(--fg-grey)] font-tabular">
              {r.memberCode} · {r.phone}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      render: (r) => <StatusPill status={r.status} />,
    },
    {
      key: "plan",
      header: "Current Plan",
      sortValue: (r) => r.planName,
      render: (r) => <span className="font-bold text-[13px]">{r.planName}</span>,
    },
    {
      key: "expiry",
      header: "Expiry",
      sortValue: (r) => r.expiryDate ?? "9999-99-99",
      render: (r) => <span className="font-tabular text-[13px] font-bold">{r.expiryDate ?? "--"}</span>,
    },
    {
      key: "wallet",
      header: "Wallet",
      align: "right",
      defaultVisible: false,
      sortValue: (r) => r.walletBalancePaise,
      render: (r) => <span className="font-tabular text-[13px] font-bold">{formatMoney(r.walletBalancePaise)}</span>,
    },
    {
      key: "branch",
      header: "Branch",
      sortValue: (r) => r.branchCode,
      render: (r) => <span className="text-[13px] font-bold uppercase">{r.branchCode}</span>,
    },
    {
      key: "lastVisit",
      header: "Last Visit",
      defaultVisible: false,
      sortValue: (r) => r.lastVisitedAt ?? "",
      render: (r) => <span className="font-tabular text-[13px]">{r.lastVisitedAt ?? "Never"}</span>,
    },
    {
      key: "actions",
      header: "Action",
      align: "right",
      render: (r) => (
        <Link
          href={`/app/members/${r.id}`}
          className="inline-flex min-h-[36px] items-center border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[12px] font-bold uppercase hover:bg-[#151515] hover:text-[#FFFFFF]"
        >
          Open 360° →
        </Link>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const exportUrl = `/api/export/members${activeBranchId ? `?branchId=${encodeURIComponent(activeBranchId)}` : ""}`;

  return (
    <div className="space-y-6">
      <Toast message={toastMsg} onDismiss={() => setToastMsg(null)} />

      <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-[var(--border-ink)] pb-4">
        <div>
          <p className="bauhaus-label text-[#2B4BCC] mb-2">{`// ROSTER MANAGEMENT · SAVED VIEWS & BULK OPS`}</p>
          <h1 className="font-headline text-[36px] md:text-[48px]">MEMBERS ({totalCount})</h1>
        </div>

        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Button variant="tertiary" onClick={() => setSaveViewOpen(true)}>
              <Bookmark className="size-4" /> Save View
            </Button>
            {rows.length >= 2 && (
              <Button variant="tertiary" onClick={() => setMergeOpen(true)}>
                <Merge className="size-4" /> Merge Duplicates
              </Button>
            )}
            <Button variant="primary" onClick={() => setNewOpen(true)}>
              <Plus className="size-4" /> Add Member
            </Button>
          </div>
        )}
      </div>

      {/* Twenty-style Saved Workspace Views Bar */}
      {savedViews.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="bauhaus-label text-[var(--fg-grey)] mr-1">{"// SAVED VIEWS:"}</span>
          {savedViews.map((v) => (
            <div key={v.id} className="inline-flex items-center border-2 border-[var(--border-ink)] bg-[var(--bg-surface)]">
              <button
                type="button"
                onClick={() =>
                  applyFilter(v.filterJson.status ?? "ALL", v.filterJson.q ?? "", 1, v.filterJson.tag ?? "")
                }
                className="min-h-[34px] px-3 text-[12px] font-bold uppercase hover:bg-[#EBC95B] hover:text-[#151515]"
              >
                {v.name}
              </button>
              <button
                type="button"
                aria-label={`Delete view ${v.name}`}
                onClick={() =>
                  startTransition(async () => {
                    await deleteSavedViewAction(v.id);
                    router.refresh();
                  })
                }
                className="min-h-[34px] px-2 border-l border-[var(--border-ink)] hover:bg-[#C8372B] hover:text-[#FFFFFF]"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filter Chips & Search Bar */}
      <FilterBar>
        <div className="flex flex-wrap gap-2">
          {(["ALL", "ACTIVE", "EXPIRING", "OVERDUE", "FROZEN", "EXPIRED"] as const).map((st) => {
            const active = initialStatus === st;
            const count =
              st === "ALL"
                ? Object.values(statusCounts).reduce((a, b) => a + b, 0)
                : statusCounts[st] ?? 0;
            return (
              <button
                key={st}
                type="button"
                onClick={() => applyFilter(st, search, 1)}
                className={`min-h-[40px] border-2 border-[var(--border-ink)] px-3 text-[12px] font-bold uppercase tracking-[0.08em] ${
                  active
                    ? "bg-[#151515] text-[#FFFFFF]"
                    : "bg-[var(--bg-paper)] hover:bg-[#EBC95B] hover:text-[#151515]"
                }`}
              >
                {st} ({count})
              </button>
            );
          })}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyFilter(initialStatus, search, 1);
          }}
          className="flex flex-wrap items-center gap-2 w-full sm:w-auto"
        >
          <input
            type="text"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            placeholder="Tag filter..."
            className="min-h-[44px] w-32 border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[13px]"
          />
          <div className="relative flex-1 sm:w-64">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-grey)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, FM-1001, phone..."
              className="w-full min-h-[44px] border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] pl-9 pr-3 text-[14px]"
            />
          </div>
          <Button type="submit" variant="secondary">Filter</Button>
        </form>
      </FilterBar>

      <DataTable
        title={`MEMBERS PAGE ${page} OF ${totalPages}${customFields.length > 0 ? ` · ${customFields.length} CUSTOM FIELDS ACTIVE` : ""}`}
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        exportHref={role === "TRAINER" ? undefined : exportUrl}
        selectable={canWrite}
        selectedKeys={selectedIds}
        onSelectionChange={setSelectedIds}
        bulkBar={
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={bulkTag}
              onChange={(e) => setBulkTag(e.target.value)}
              className="border-2 border-[#151515] bg-[#FFFFFF] text-[#151515] px-2 py-1 text-[12px] w-28"
              placeholder="Tag..."
            />
            <Button density="dense" variant="secondary" disabled={isPending} onClick={() => runBulk("ADD_TAG", bulkTag)}>
              +Tag
            </Button>
            {trainers.length > 0 && (
              <>
                <select
                  value={bulkTrainerId}
                  onChange={(e) => setBulkTrainerId(e.target.value)}
                  className="border-2 border-[#151515] bg-[#FFFFFF] text-[#151515] px-2 py-1 text-[12px]"
                >
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <Button density="dense" variant="blue" disabled={isPending} onClick={() => runBulk("ASSIGN_TRAINER", bulkTrainerId)}>
                  Assign Coach
                </Button>
              </>
            )}
            <input
              aria-label="Bulk WhatsApp nudge text"
              value={bulkNudge}
              onChange={(e) => setBulkNudge(e.target.value)}
              className="border-2 border-[#151515] bg-[#FFFFFF] text-[#151515] px-2 py-1 text-[12px] w-44"
            />
            <Button density="dense" variant="primary" disabled={isPending} onClick={() => runBulk("WHATSAPP_OUTREACH", bulkNudge)}>
              WhatsApp Nudge
            </Button>
            <Button
              density="dense"
              variant="tertiary"
              disabled={isPending}
              onClick={() => runBulk("CREATE_FOLLOWUP_TASK", "Renewal/Check-in Call")}
            >
              +Follow-up Task
            </Button>
          </div>
        }
        emptyState={
          <EmptyState
            eyebrow="NO MEMBERS MATCHED"
            title="Zero matching member profiles"
            description="Adjust your status filter or register a new member on this branch."
            action={
              canWrite ? (
                <Button variant="primary" onClick={() => setNewOpen(true)}>
                  + Add Member
                </Button>
              ) : undefined
            }
          />
        }
      />

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-4 py-3">
          <span className="text-[13px] font-bold uppercase font-tabular">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount}
          </span>
          <div className="flex gap-2">
            <Button
              variant="tertiary"
              disabled={page <= 1}
              onClick={() => applyFilter(initialStatus, search, page - 1)}
            >
              ← Prev
            </Button>
            <Button
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => applyFilter(initialStatus, search, page + 1)}
            >
              Next →
            </Button>
          </div>
        </div>
      )}

      {/* Save View Modal */}
      <Modal open={saveViewOpen} onClose={() => setSaveViewOpen(false)} eyebrow="WORKSPACE PRESET" title="Save Filter View">
        <div className="space-y-4">
          <input
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            placeholder="e.g. Expiring BLR VIPs"
            className="w-full min-h-[44px] border-2 border-[var(--border-ink)] px-3 text-[14px]"
          />
          <p className="text-[12px] text-[var(--fg-grey)]">
            Saves status ({initialStatus}), search (&ldquo;{search || "none"}&rdquo;), and tag (&ldquo;{tagFilter || "none"}&rdquo;).
          </p>
          <Button
            variant="primary"
            fullWidth
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const res = await saveSavedViewAction({
                  entityType: "MEMBERS",
                  name: viewName,
                  filterJson: { status: initialStatus, q: search, tag: tagFilter },
                });
                if (!res.ok) {
                  setToastMsg(res.error);
                  return;
                }
                setSaveViewOpen(false);
                setViewName("");
                setToastMsg("Saved view added to workspace.");
                router.refresh();
              })
            }
          >
            Save Workspace View
          </Button>
        </div>
      </Modal>

      {/* Add Member Modal */}
      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        eyebrow="FRONT DESK REGISTRATION"
        title="Add New Member"
      >
        <form onSubmit={handleCreateMember} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="bauhaus-label block mb-1">Full Name *</label>
              <input
                required
                value={newMember.fullName}
                onChange={(e) => setNewMember({ ...newMember, fullName: e.target.value })}
                placeholder="e.g. Rohan Deshmukh"
                className="w-full min-h-[44px] border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-3 text-[14px]"
              />
            </div>
            <div>
              <label className="bauhaus-label block mb-1">Phone Number *</label>
              <input
                required
                value={newMember.phone}
                onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                placeholder="+91 98450 55443"
                className="w-full min-h-[44px] border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-3 text-[14px]"
              />
            </div>
            <div>
              <label className="bauhaus-label block mb-1">Email</label>
              <input
                type="email"
                value={newMember.email}
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                placeholder="rohan@example.in"
                className="w-full min-h-[44px] border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-3 text-[14px]"
              />
            </div>
            <div>
              <label className="bauhaus-label block mb-1">Home Branch</label>
              <select
                value={newMember.branchId}
                onChange={(e) => {
                  const chosen = branches.find((b) => b.id === e.target.value);
                  setNewMember({
                    ...newMember,
                    branchId: e.target.value,
                    stateCode: chosen?.stateCode ?? newMember.stateCode,
                  });
                }}
                className="w-full min-h-[44px] border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-3 text-[14px] font-bold"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.stateCode})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="bauhaus-label block mb-1">Emergency Contact Name</label>
              <input
                value={newMember.emergencyName}
                onChange={(e) => setNewMember({ ...newMember, emergencyName: e.target.value })}
                className="w-full min-h-[44px] border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-3 text-[14px]"
              />
            </div>
            <div>
              <label className="bauhaus-label block mb-1">KYC Last 4 (Aadhaar / PAN)</label>
              <input
                maxLength={12}
                value={newMember.kycLast4}
                onChange={(e) => setNewMember({ ...newMember, kycLast4: e.target.value })}
                placeholder="e.g. 9012"
                className="w-full min-h-[44px] border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-3 text-[14px]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="bauhaus-label block mb-1">Training Goal</label>
              <input
                value={newMember.goals}
                onChange={(e) => setNewMember({ ...newMember, goals: e.target.value })}
                placeholder="Hypertrophy, 5k conditioning, rehab..."
                className="w-full min-h-[44px] border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-3 text-[14px]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="bauhaus-label block mb-1">Encrypted Health Notes (AES-256-GCM)</label>
              <textarea
                rows={2}
                value={newMember.healthNotes}
                onChange={(e) => setNewMember({ ...newMember, healthNotes: e.target.value })}
                placeholder="Injuries, medications, physician guidance..."
                className="w-full border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] p-3 text-[14px]"
              />
            </div>
          </div>

          <div className="space-y-2 border-2 border-[var(--border-ink)] bg-[var(--bg-muted)] p-3 text-[13px]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newMember.healthConsent}
                onChange={(e) => setNewMember({ ...newMember, healthConsent: e.target.checked })}
                className="size-4 accent-[#C8372B]"
              />
              <span>DPDP 2023 Consent recorded for storing encrypted health declaration</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newMember.whatsappConsent}
                onChange={(e) => setNewMember({ ...newMember, whatsappConsent: e.target.checked })}
                className="size-4 accent-[#2B4BCC]"
              />
              <span>WhatsApp &amp; Billing receipt notifications opt-in</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newMember.waiverSigned}
                onChange={(e) => setNewMember({ ...newMember, waiverSigned: e.target.checked })}
                className="size-4 accent-[#151515]"
              />
              <span>Club Liability Waiver e-signed (records IP + UTC timestamp)</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="tertiary" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? "Creating..." : "Register Member"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Merge Duplicates Modal */}
      <Modal
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
        eyebrow="DEDUPLICATION"
        title="Merge Duplicate Members"
      >
        <form onSubmit={handleMerge} className="space-y-4">
          <p className="text-[14px]">
            Moves subscriptions, invoices, payments, check-ins, classes, PT, wallet, and notes onto the surviving member cleanly.
          </p>
          <div>
            <label className="bauhaus-label block mb-1">Surviving Member (Keep)</label>
            <select
              value={survivorId}
              onChange={(e) => setSurvivorId(e.target.value)}
              className="w-full min-h-[44px] border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-3 text-[14px]"
            >
              {rows.map((r) => (
                <option key={r.id} value={r.id}>{r.fullName} ({r.memberCode})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="bauhaus-label block mb-1">Duplicate Profile (Merge &amp; Archive)</label>
            <select
              value={duplicateId}
              onChange={(e) => setDuplicateId(e.target.value)}
              className="w-full min-h-[44px] border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-3 text-[14px]"
            >
              {rows.map((r) => (
                <option key={r.id} value={r.id}>{r.fullName} ({r.memberCode})</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="tertiary" onClick={() => setMergeOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={isPending}>Merge Profiles</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
