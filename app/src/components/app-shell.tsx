"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3, Bell, BookOpen, ChevronRight, Dumbbell, Flame, LayoutDashboard,
  Layers, LogOut, Menu, Search, Settings, Sparkles, Users, Utensils, X, ScanFace, Zap,
} from "lucide-react";
import { Avatar, Logo } from "@/components/ui";
import { cn } from "@/lib/utils";
import { computeLevelProgress } from "@/lib/engine";
import { signOut } from "@/app/actions";

type ShellUser = {
  id: string;
  name: string;
  initials: string;
  accent: string;
  level: number;
  streak: number;
  xp: number;
  goal: string;
};

const NAV = [
  {
    group: "Train",
    items: [
      { href: "/app", label: "Dashboard", icon: LayoutDashboard },
      { href: "/app/train", label: "Workout", icon: Dumbbell },
      { href: "/app/exercises", label: "Exercises", icon: BookOpen },
      { href: "/app/programs", label: "Programs", icon: Layers },
    ],
  },
  {
    group: "Fuel & recovery",
    items: [
      { href: "/app/nutrition", label: "Nutrition", icon: Utensils },
      { href: "/app/progress", label: "Progress", icon: BarChart3 },
      { href: "/app/form-check", label: "Form check", icon: ScanFace },
    ],
  },
  {
    group: "Community",
    items: [
      { href: "/app/social", label: "Social", icon: Users },
      { href: "/app/coach", label: "AI Coach", icon: Sparkles, badge: "AI" },
    ],
  },
];

const TITLES: Record<string, string> = {
  "/app": "Dashboard",
  "/app/train": "Workout",
  "/app/exercises": "Exercise library",
  "/app/programs": "Programs",
  "/app/nutrition": "Nutrition",
  "/app/progress": "Progress",
  "/app/social": "Community",
  "/app/coach": "AI Coach",
  "/app/form-check": "Form check",
  "/app/settings": "Settings",
};

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const active = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));
  const title = Object.entries(TITLES).sort((a, b) => b[0].length - a[0].length).find(([k]) => pathname.startsWith(k))?.[1] ?? "FORGE";
  const { level, progress } = computeLevelProgress(user.xp);

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4 no-scrollbar">
      {NAV.map((group) => (
        <div key={group.group}>
          <p className="mb-2 px-3 font-mono text-[9px] uppercase tracking-[0.2em] text-dim">{group.group}</p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = active(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors",
                    isActive ? "bg-white/[0.07] text-chalk" : "text-mist hover:bg-white/[0.04] hover:text-chalk",
                  )}
                >
                  {isActive && <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-acid" />}
                  <Icon className={cn("size-[17px] shrink-0", isActive ? "text-acid" : "text-dim group-hover:text-mist")} strokeWidth={1.8} />
                  <span className="flex-1">{item.label}</span>
                  {"badge" in item && item.badge && (
                    <span className="rounded-full bg-acid/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-acid">{item.badge}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-ink">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-white/[0.06] bg-ink-2 md:flex">
        <div className="flex h-16 items-center justify-between px-5">
          <Logo />
          <span className="rounded-full border border-acid/20 bg-acid/[0.07] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-acid">beta</span>
        </div>
        <NavLinks />
        <div className="border-t border-white/[0.06] p-3">
          <div className="relative">
            {profileOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border border-white/10 bg-panel-3 shadow-2xl">
                <Link
                  href="/app/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-[12px] text-mist transition-colors hover:bg-white/[0.05] hover:text-chalk"
                >
                  <Settings className="size-3.5" /> Settings
                </Link>
                <form action={signOut}>
                  <button className="flex w-full items-center gap-2.5 border-t border-white/[0.06] px-3 py-2.5 text-left text-[12px] text-mist transition-colors hover:bg-white/[0.05] hover:text-chalk">
                    <LogOut className="size-3.5" /> Sign out
                  </button>
                </form>
              </div>
            )}
            <button
              onClick={() => setProfileOpen((v) => !v)}
              aria-expanded={profileOpen}
              className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left transition-colors hover:bg-white/[0.03]"
            >
              <Avatar initials={user.initials} accent={user.accent} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-chalk">{user.name}</p>
                <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-dim">Level {level} · {user.goal}</p>
              </div>
              <ChevronRight className={cn("size-4 text-dim transition-transform", profileOpen && "-rotate-90")} />
            </button>
            <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full rounded-full bg-acid/70" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[8.5px] uppercase tracking-wider text-dim">
              <span>{user.xp.toLocaleString()} xp</span>
              <span>{progress}% to L{level + 1}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-label="Close menu" />
          <div className="animate-scale-in absolute inset-y-0 left-0 flex w-[280px] flex-col border-r border-white/10 bg-ink-2">
            <div className="flex h-16 items-center justify-between px-4">
              <Logo />
              <button onClick={() => setMobileOpen(false)} className="grid size-8 place-items-center rounded-full bg-white/5 text-mist"><X className="size-4" /></button>
            </div>
            <NavLinks onNavigate={() => setMobileOpen(false)} />
            <div className="border-t border-white/8 p-4">
              <Link href="/app/settings" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <Avatar initials={user.initials} accent={user.accent} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-dim">Level {level} · {user.streak} day streak</p>
                </div>
                <ChevronRight className="size-4 text-dim" />
              </Link>
              <form action={signOut}>
                <button className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12px] text-mist transition-colors hover:bg-white/[0.04] hover:text-chalk">
                  <LogOut className="size-3.5" /> Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="md:pl-[248px]">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-ink/85 backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between gap-3 px-4 md:h-16 md:px-8">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileOpen(true)} className="grid size-8 place-items-center rounded-lg border border-white/10 text-mist md:hidden" aria-label="Menu">
                <Menu className="size-4" />
              </button>
              <div className="md:hidden"><Logo size="sm" showWord /></div>
              <div className="hidden items-center gap-2 md:flex">
                <span className="label-mono text-dim">Forge OS</span>
                <ChevronRight className="size-3 text-dim" />
                <span className="text-[12.5px] font-medium text-chalk">{title}</span>
              </div>
            </div>

            <Link
              href="/app/exercises"
              className="hidden h-9 w-[280px] items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 text-[12px] text-dim transition-colors hover:border-white/15 hover:text-mist lg:flex"
            >
              <Search className="size-3.5" />
              <span className="flex-1">Search exercises, programs…</span>
              <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9px]">⌘K</kbd>
            </Link>

            <div className="flex items-center gap-2 md:gap-3">
              <Link href="/app/social" className="hidden items-center gap-1.5 rounded-full border border-flame/20 bg-flame/[0.07] px-3 py-1.5 sm:flex">
                <Flame className="size-3.5 text-flame" />
                <span className="font-numeric text-[12px] font-semibold text-flame">{user.streak}</span>
                <span className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-flame/70">streak</span>
              </Link>
              <Link href="/app/social" className="relative grid size-9 place-items-center rounded-full border border-white/[0.08] text-mist hover:text-chalk" aria-label="Notifications">
                <Bell className="size-4" />
                <span className="absolute right-2 top-2 size-1.5 rounded-full bg-acid" />
              </Link>
              <Link href="/app/settings" aria-label="Profile">
                <Avatar initials={user.initials} accent={user.accent} size={32} />
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-4 md:px-8 md:pb-14 md:pt-7">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.07] bg-ink/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden">
        <div className="grid grid-cols-5">
          {[
            { href: "/app", label: "Home", icon: LayoutDashboard },
            { href: "/app/train", label: "Train", icon: Dumbbell },
            { href: "/app/nutrition", label: "Fuel", icon: Utensils },
            { href: "/app/progress", label: "Progress", icon: BarChart3 },
            { href: "/app/social", label: "Social", icon: Users },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = active(item.href);
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 py-2.5">
                <Icon className={cn("size-[19px]", isActive ? "text-acid" : "text-dim")} strokeWidth={isActive ? 2.2 : 1.7} />
                <span className={cn("font-mono text-[8.5px] uppercase tracking-[0.08em]", isActive ? "text-chalk" : "text-dim")}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <Link
        href="/app/coach"
        className="fixed bottom-24 right-4 z-50 grid size-12 place-items-center rounded-full bg-acid text-ink shadow-[0_10px_35px_-8px_rgba(201,247,58,0.6)] md:hidden"
        aria-label="AI Coach"
      >
        <Sparkles className="size-5" />
      </Link>
    </div>
  );
}
