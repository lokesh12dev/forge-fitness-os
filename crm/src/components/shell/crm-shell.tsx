"use client";

import React, { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  Award,
  Building2,
  CreditCard,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Plus,
  QrCode,
  Search,
  Settings,
  Sun,
  Tag,
  Target,
  TrendingDown,
  Users,
  Workflow,
  X,
} from "lucide-react";
import { signOutAction, switchActiveBranchAction } from "@/app/actions/crm-actions";
import { canAccessFinance, hasPermission, type CrmRole } from "@/lib/rbac";

interface ShellProps {
  orgName: string;
  userName: string;
  role: CrmRole;
  branches: Array<{ id: string; name: string; code: string }>;
  activeBranchId: string | null;
  children: React.ReactNode;
}

const THEME_KEY = "forge_crm_theme";

function subscribeTheme(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("forge-theme-change", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("forge-theme-change", cb);
  };
}

function getThemeSnapshot(): "light" | "dark" {
  const saved = localStorage.getItem(THEME_KEY);
  return saved === "dark" ? "dark" : "light";
}

function getServerThemeSnapshot(): "light" | "dark" {
  return "light";
}

export function CrmShell({
  orgName,
  userName,
  role,
  branches,
  activeBranchId,
  children,
}: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{
    members: Array<{ id: string; memberCode: string; fullName: string; phone: string; status: string; branch: { name: string } }>;
    invoices: Array<{ id: string; invoiceNumber: string; totalPaise: number; status: string; member: { fullName: string } }>;
  }>({ members: [], invoices: [] });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    localStorage.setItem(THEME_KEY, next);
    document.documentElement.setAttribute("data-theme", next);
    window.dispatchEvent(new Event("forge-theme-change"));
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setQuickAddOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!searchOpen || query.trim().length < 2) {
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}&branchId=${encodeURIComponent(activeBranchId ?? "ALL")}`)
        .then((r) => (r.ok ? r.json() : { members: [], invoices: [] }))
        .then((data) => setResults(data))
        .catch(() => {});
    }, 180);
    return () => clearTimeout(timer);
  }, [query, searchOpen, activeBranchId]);

  const visibleResults =
    searchOpen && query.trim().length >= 2
      ? results
      : { members: [], invoices: [] };

  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const navItems = [
    { href: "/app", label: "TODAY.", icon: LayoutGrid, show: true },
    { href: "/app/members", label: "MEMBERS", icon: Users, show: hasPermission(role, "members:read") },
    { href: "/app/leads", label: "LEADS", icon: Target, show: hasPermission(role, "leads:read") || hasPermission(role, "leads:roi") },
    { href: "/app/inbox", label: "INBOX", icon: MessageSquare, show: hasPermission(role, "inbox:read") || hasPermission(role, "campaigns:broadcast") },
    { href: "/app/automations", label: "AUTOMATE", icon: Workflow, show: hasPermission(role, "automations:manage") },
    { href: "/app/retention", label: "RETENTION", icon: TrendingDown, show: hasPermission(role, "retention:read") },
    { href: "/app/loyalty", label: "LOYALTY", icon: Award, show: hasPermission(role, "loyalty:read") },
    { href: "/app/plans", label: "PLANS", icon: Tag, show: hasPermission(role, "plans:read") },
    { href: "/app/billing", label: "BILLING", icon: CreditCard, show: canAccessFinance(role) },
    { href: "/app/checkin", label: "CHECK-IN", icon: QrCode, show: hasPermission(role, "checkin:operate") },
    { href: "/onboarding", label: "SETUP", icon: Settings, show: role === "OWNER" },
  ].filter((item) => item.show);

  const handleBranchChange = (nextId: string) => {
    startTransition(async () => {
      await switchActiveBranchAction(nextId);
      router.refresh();
    });
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[var(--bg-paper)] text-[var(--fg-ink)]">
      {/* Desktop & Tablet Black Bauhaus Sidebar */}
      <aside className="no-print hidden md:flex md:w-[220px] lg:w-[240px] shrink-0 flex-col justify-between bg-[#151515] text-[#FFFFFF] border-r-[3px] border-[#151515]">
        <div>
          <Link href="/app" className="block border-b-2 border-[#FFFFFF]/20 p-5 hover:bg-[#C8372B]">
            <div className="flex items-center gap-2.5">
              <div className="size-7 bg-[#EBC95B] border-2 border-[#FFFFFF] flex items-center justify-center text-[#151515] font-headline text-[16px]">
                F
              </div>
              <div>
                <p className="font-headline text-[20px] tracking-tight text-[#FFFFFF]">FORGE CRM</p>
                <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#EBC95B]">
                  {orgName}
                </p>
              </div>
            </div>
          </Link>

          <nav className="p-3 space-y-2" aria-label="Primary CRM Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/app"
                  ? pathname === "/app"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "min-h-[48px] flex items-center gap-3 px-3.5 border-2 font-bold text-[13px] uppercase tracking-[0.1em]",
                    isActive
                      ? "bg-[#C8372B] text-[#FFFFFF] border-[#FFFFFF]"
                      : "bg-[#222222] text-[#FFFFFF] border-[#FFFFFF]/20 hover:bg-[#2B4BCC] hover:border-[#FFFFFF]"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t-2 border-[#FFFFFF]/20 p-4 space-y-3">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#EBC95B]">
              {`// ${role}`}
            </p>
            <p className="text-[14px] font-bold truncate mt-0.5">{userName}</p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full min-h-[40px] border-2 border-[#FFFFFF]/30 bg-[#222222] px-3 flex items-center justify-center gap-2 text-[12px] font-bold uppercase tracking-[0.1em] hover:bg-[#C8372B] hover:border-[#FFFFFF]"
            >
              <LogOut className="size-4" /> Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col pb-20 md:pb-0">
        {/* Top Utility Bar */}
        <header className="no-print sticky top-0 z-40 min-h-[64px] border-b-[3px] border-[var(--border-ink)] bg-[var(--bg-surface)] px-4 md:px-6 py-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/app" className="md:hidden font-headline text-[20px]">
              FORGE
            </Link>

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="min-h-[44px] inline-flex items-center gap-2 border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-3 text-[13px] font-bold uppercase tracking-[0.06em] hover:bg-[#EBC95B] hover:text-[#151515]"
              aria-label="Open global search"
            >
              <Search className="size-4" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="border border-current px-1.5 py-0.5 text-[12px]">⌘K</kbd>
            </button>

            <div className="flex items-center gap-1.5 border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] px-2 min-h-[44px]">
              <Building2 className="size-4 shrink-0" />
              <select
                aria-label="Active Branch Switcher"
                value={activeBranchId ?? "ALL"}
                disabled={isPending || (branches.length <= 1 && role !== "OWNER" && role !== "ACCOUNTANT")}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="bg-transparent text-[13px] font-bold uppercase tracking-[0.06em] focus:outline-none py-1 pr-2 max-w-[132px] sm:max-w-[240px] truncate"
              >
                {(role === "OWNER" || role === "ACCOUNTANT") && branches.length > 1 && (
                  <option value="ALL">ALL BRANCHES ({branches.length})</option>
                )}
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setQuickAddOpen((v) => !v)}
                className="min-h-[44px] bg-[#C8372B] text-[#FFFFFF] border-2 border-[#151515] px-3.5 inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.08em] hover:bg-[#151515]"
              >
                <Plus className="size-4" /> Quick Add
              </button>
              {quickAddOpen && (
                <div className="absolute right-0 top-12 z-50 w-56 border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] divide-y-2 divide-[var(--border-ink)]">
                  {hasPermission(role, "members:write") && (
                    <Link
                      href="/app/members?action=new"
                      onClick={() => setQuickAddOpen(false)}
                      className="block px-4 py-3 text-[13px] font-bold uppercase hover:bg-[#EBC95B] hover:text-[#151515]"
                    >
                      + Add Member
                    </Link>
                  )}
                  {hasPermission(role, "billing:collect") && (
                    <Link
                      href="/app/billing?action=sell"
                      onClick={() => setQuickAddOpen(false)}
                      className="block px-4 py-3 text-[13px] font-bold uppercase hover:bg-[#EBC95B] hover:text-[#151515]"
                    >
                      + Sell Plan / Invoice
                    </Link>
                  )}
                  {hasPermission(role, "checkin:operate") && (
                    <Link
                      href="/app/checkin"
                      onClick={() => setQuickAddOpen(false)}
                      className="block px-4 py-3 text-[13px] font-bold uppercase hover:bg-[#EBC95B] hover:text-[#151515]"
                    >
                      + QR Check-In Desk
                    </Link>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle light/dark theme"
              className="min-w-[44px] min-h-[44px] grid place-items-center border-2 border-[var(--border-ink)] bg-[var(--bg-paper)] hover:bg-[#2B4BCC] hover:text-[#FFFFFF]"
            >
              {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar (390px, >= 48px touch targets) */}
      <nav
        className="no-print md:hidden fixed bottom-0 inset-x-0 z-50 bg-[#151515] text-[#FFFFFF] border-t-[3px] border-[#151515] grid"
        style={{
          gridTemplateColumns: `repeat(${Math.min(4, navItems.length) + (navItems.length > 4 ? 1 : 0)}, minmax(0, 1fr))`,
        }}
        aria-label="Mobile Navigation"
      >
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMoreOpen(false)}
              className={clsx(
                "min-h-[54px] flex flex-col items-center justify-center gap-1 border-r border-[#FFFFFF]/15 px-1 text-[12px] font-bold uppercase",
                isActive ? "bg-[#C8372B] text-[#FFFFFF]" : "text-[#FFFFFF]"
              )}
            >
              <Icon className="size-4" />
              <span className="truncate max-w-full">{item.label.replace(".", "")}</span>
            </Link>
          );
        })}
        {navItems.length > 4 && (
          <button
            type="button"
            onClick={() => setMobileMoreOpen((v) => !v)}
            className={clsx(
              "min-h-[54px] flex flex-col items-center justify-center gap-1 px-1 text-[12px] font-bold uppercase",
              mobileMoreOpen ? "bg-[#2B4BCC] text-[#FFFFFF]" : "text-[#EBC95B]"
            )}
            aria-expanded={mobileMoreOpen}
            aria-label="More navigation routes"
          >
            <Menu className="size-4" />
            <span>MORE</span>
          </button>
        )}
      </nav>

      {/* Mobile Overflow Route Grid Sheet */}
      {mobileMoreOpen && (
        <div
          className="no-print md:hidden fixed inset-0 z-[48] bg-[#151515]/75 flex items-end pb-[57px]"
          onClick={() => setMobileMoreOpen(false)}
        >
          <div
            className="w-full bg-[var(--bg-paper)] text-[var(--fg-ink)] border-t-[3px] border-[var(--border-ink)] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="bauhaus-label text-[#C8372B]">{"// ALL MODULES"}</span>
              <button
                type="button"
                onClick={() => setMobileMoreOpen(false)}
                className="min-w-[40px] min-h-[40px] grid place-items-center border-2 border-[var(--border-ink)]"
                aria-label="Close mobile menu"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMoreOpen(false)}
                    className={clsx(
                      "min-h-[48px] flex items-center gap-2 border-2 border-[var(--border-ink)] px-3 text-[12px] font-bold uppercase",
                      isActive ? "bg-[#C8372B] text-[#FFFFFF]" : "bg-[var(--bg-surface)]"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Global Search Palette Modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-[90] bg-[#151515]/80 flex items-start justify-center p-4 pt-16"
          role="dialog"
          aria-modal="true"
          aria-label="Global CRM Search"
        >
          <div className="w-full max-w-2xl bg-[var(--bg-paper)] border-[3px] border-[var(--border-ink)]">
            <div className="flex items-center gap-3 border-b-2 border-[var(--border-ink)] bg-[var(--bg-surface)] p-3">
              <Search className="size-5 shrink-0" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search members by name, phone, FM-1001 or invoice..."
                className="flex-1 bg-transparent text-[16px] font-medium focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label="Close global search"
                className="min-w-[44px] min-h-[44px] grid place-items-center border-2 border-[var(--border-ink)]"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto divide-y-2 divide-[var(--border-ink)]">
              {visibleResults.members.map((m) => (
                <Link
                  key={m.id}
                  href={`/app/members/${m.id}`}
                  onClick={() => setSearchOpen(false)}
                  className="flex items-center justify-between p-4 bg-[var(--bg-surface)] hover:bg-[#EBC95B] hover:text-[#151515]"
                >
                  <div>
                    <p className="font-bold text-[15px]">{m.fullName}</p>
                    <p className="text-[12px] uppercase tracking-[0.08em] text-[var(--fg-grey)]">
                      {m.memberCode} · {m.phone} · {m.branch.name}
                    </p>
                  </div>
                  <span className="border border-[#151515] px-2 py-0.5 text-[12px] font-bold uppercase">
                    {m.status}
                  </span>
                </Link>
              ))}
              {visibleResults.invoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/app/billing/invoices/${inv.id}`}
                  onClick={() => setSearchOpen(false)}
                  className="flex items-center justify-between p-4 bg-[var(--bg-surface)] hover:bg-[#EBC95B] hover:text-[#151515]"
                >
                  <div>
                    <p className="font-bold text-[15px]">{inv.invoiceNumber}</p>
                    <p className="text-[12px] uppercase text-[var(--fg-grey)]">{inv.member.fullName}</p>
                  </div>
                  <span className="font-tabular font-bold text-[14px]">
                    ₹{(inv.totalPaise / 100).toLocaleString("en-IN")}
                  </span>
                </Link>
              ))}
              {query.trim().length >= 2 &&
                visibleResults.members.length === 0 &&
                visibleResults.invoices.length === 0 && (
                  <p className="p-6 text-[14px] text-[var(--fg-grey)]">No matching records in scoped branch.</p>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
