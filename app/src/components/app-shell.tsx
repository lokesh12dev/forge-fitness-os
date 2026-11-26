"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3, Bell, BookOpen, Building2, Calendar, ChevronRight, Dumbbell, Flame, Home,
  Layers, LogOut, Menu, Play, Search, Settings, Sparkles, UserCheck, Users, Utensils, X, ScanFace,
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

type ActiveWorkoutRef = {
  id: string;
  name: string;
  startedAt: string;
} | null;

const NAV = [
  {
    group: "Core",
    items: [
      { href: "/app", label: "Home", icon: Home },
      { href: "/app/programs", label: "Plan & Schedule", icon: Calendar },
      { href: "/app/train", label: "Workout", icon: Dumbbell },
      { href: "/app/exercises", label: "Exercises", icon: BookOpen },
      { href: "/app/progress", label: "Stats & Body", icon: BarChart3 },
    ],
  },
  {
    group: "Fuel & Form",
    items: [
      { href: "/app/nutrition", label: "Nutrition", icon: Utensils },
      { href: "/app/form-check", label: "Form check", icon: ScanFace },
    ],
  },
  {
    group: "Coaching & Social",
    items: [
      { href: "/app/coach", label: "AI Coach", icon: Sparkles, badge: "AI" },
      { href: "/app/social", label: "Social", icon: Users },
    ],
  },
  {
    group: "Gym & Trainer Ops",
    items: [
      { href: "/app/trainer", label: "Trainer portal", icon: UserCheck, badge: "B2B" },
      { href: "/app/gym", label: "Gym owner", icon: Building2, badge: "B2B" },
    ],
  },
];

const TITLES: Record<string, string> = {
  "/app": "Home",
  "/app/train": "Workout",
  "/app/exercises": "Exercises",
  "/app/programs": "Plan",
  "/app/nutrition": "Nutrition",
  "/app/progress": "Stats",
  "/app/social": "Social",
  "/app/coach": "AI Coach",
  "/app/form-check": "Form check",
  "/app/trainer": "Trainer portal",
  "/app/gym": "Gym floor ops",
  "/app/settings": "Settings",
};

function useActiveElapsed(startedAt: string | null) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!startedAt) {
      setSec(0);
      return;
    }
    const tick = () => {
      setSec(Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${mins}:${String(rem).padStart(2, "0")}`;
}

export function AppShell({
  user,
  activeWorkout = null,
  children,
}: {
  user: ShellUser;
  activeWorkout?: ActiveWorkoutRef;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const elapsedLabel = useActiveElapsed(activeWorkout?.startedAt ?? null);

  const active = (href: string) =>
    href === "/app"
      ? pathname === "/app"
      : pathname === href || pathname.startsWith(`${href}/`);
  const title = Object.entries(TITLES).sort((a, b) => b[0].length - a[0].length).find(([k]) => pathname.startsWith(k))?.[1] ?? "FORGE";
  const { level, progress } = computeLevelProgress(user.xp);
  const playHref = activeWorkout ? `/app/train/${activeWorkout.id}` : "/app/train";

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4 no-scrollbar">
      {NAV.map((group) => (
        <div key={group.group}>
          <p className="mb-1.5 px-3 text-[11px] font-medium text-dim">{group.group}</p>
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
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium transition-colors",
                    isActive ? "bg-panel-2 text-chalk" : "text-mist hover:bg-white/[0.04] hover:text-chalk",
                  )}
                >
                  {isActive && <span className="absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-full bg-acid" />}
                  <Icon className={cn("size-[17px] shrink-0", isActive ? "text-acid" : "text-dim group-hover:text-mist")} strokeWidth={1.85} />
                  <span className="flex-1">{item.label}</span>
                  {"badge" in item && item.badge && (
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-mist">{item.badge}</span>
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
      {/* Desktop sidebar — clean Apple OLED rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-white/[0.08] bg-ink-2 md:flex">
        <div className="flex h-16 items-center justify-between px-5">
          <Logo />
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-mist">OS</span>
        </div>

        {activeWorkout && (
          <div className="px-3 pb-1">
            <Link
              href={`/app/train/${activeWorkout.id}`}
              className="flex items-center gap-2.5 rounded-2xl border border-flame/35 bg-flame/12 px-3 py-2.5 transition-colors hover:bg-flame/18"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-flame text-ink">
                <Play className="ml-0.5 size-3.5 fill-current" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-chalk">{activeWorkout.name}</p>
                <p className="font-numeric text-[11px] font-medium text-flame" suppressHydrationWarning>
                  Live · {elapsedLabel}
                </p>
              </div>
            </Link>
          </div>
        )}

        <NavLinks />

        <div className="border-t border-white/[0.07] p-3">
          <div className="relative">
            {profileOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-2xl border border-white/10 bg-panel-3 shadow-2xl">
                <Link
                  href="/app/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-[12.5px] text-mist transition-colors hover:bg-white/[0.05] hover:text-chalk"
                >
                  <Settings className="size-3.5" /> Settings
                </Link>
                <form action={signOut}>
                  <button className="flex w-full items-center gap-2.5 border-t border-white/[0.06] px-3.5 py-2.5 text-left text-[12.5px] text-mist transition-colors hover:bg-white/[0.05] hover:text-chalk">
                    <LogOut className="size-3.5" /> Sign out
                  </button>
                </form>
              </div>
            )}
            <button
              onClick={() => setProfileOpen((v) => !v)}
              aria-expanded={profileOpen}
              className="flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
            >
              <Avatar initials={user.initials} accent={user.accent} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-chalk">{user.name}</p>
                <p className="text-[11px] text-mist">Level {level} · {user.goal}</p>
              </div>
              <ChevronRight className={cn("size-4 text-dim transition-transform", profileOpen && "-rotate-90")} />
            </button>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full rounded-full bg-acid/80" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-[10.5px] text-dim">
              <span>{user.xp.toLocaleString()} XP</span>
              <span>{progress}% to L{level + 1}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile full module drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[70] md:hidden">
          <button className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-label="Close menu" />
          <div className="animate-scale-in absolute inset-y-0 left-0 flex w-[285px] flex-col border-r border-white/10 bg-ink-2">
            <div className="flex h-16 items-center justify-between px-4">
              <Logo />
              <button onClick={() => setMobileOpen(false)} className="grid size-8 place-items-center rounded-full bg-white/8 text-mist"><X className="size-4" /></button>
            </div>
            <NavLinks onNavigate={() => setMobileOpen(false)} />
            <div className="border-t border-white/8 p-4">
              <Link href="/app/settings" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <Avatar initials={user.initials} accent={user.accent} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="text-[11px] text-mist">Level {level} · {user.streak} streak</p>
                </div>
                <ChevronRight className="size-4 text-dim" />
              </Link>
              <form action={signOut}>
                <button className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12.5px] text-mist transition-colors hover:bg-white/[0.05] hover:text-chalk">
                  <LogOut className="size-3.5" /> Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="md:pl-[248px]">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-ink/85 backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between gap-3 px-4 md:h-16 md:px-8">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileOpen(true)} className="grid size-8 place-items-center rounded-full border border-white/10 bg-panel-2 text-mist md:hidden" aria-label="Menu">
                <Menu className="size-4" />
              </button>
              <div className="md:hidden"><Logo size="sm" showWord /></div>
              <div className="hidden items-center gap-2 md:flex">
                <span className="text-[12px] font-medium text-dim">FORGE</span>
                <ChevronRight className="size-3 text-dim" />
                <span className="text-[13px] font-semibold text-chalk">{title}</span>
              </div>
            </div>

            <Link
              href="/app/exercises"
              className="hidden h-9 w-[290px] items-center gap-2.5 rounded-full border border-white/[0.09] bg-panel px-3.5 text-[12.5px] text-mist transition-colors hover:border-white/20 hover:text-chalk lg:flex"
            >
              <Search className="size-3.5 text-dim" />
              <span className="flex-1">Search 1,300+ exercises, plans…</span>
              <kbd className="rounded bg-panel-2 px-1.5 py-0.5 text-[10px] text-dim">⌘K</kbd>
            </Link>

            <div className="flex items-center gap-2 md:gap-2.5">
              <Link
                href="/app/coach"
                className="grid size-8 place-items-center rounded-full bg-acid text-ink shadow-sm md:hidden"
                aria-label="AI Coach"
                title="AI Coach"
              >
                <Sparkles className="size-4" />
              </Link>
              <Link href="/app/nutrition" className="hidden items-center gap-1.5 rounded-full border border-white/[0.09] bg-panel px-3 py-1.5 text-[12px] font-medium text-mist hover:text-chalk sm:flex">
                <Utensils className="size-3.5 text-acid" />
                <span>Fuel</span>
              </Link>
              <Link href="/app/social" className="hidden items-center gap-1.5 rounded-full border border-flame/25 bg-flame/10 px-3 py-1.5 sm:flex">
                <Flame className="size-3.5 text-flame" />
                <span className="font-numeric text-[12px] font-semibold text-flame">{user.streak}</span>
              </Link>
              <Link href="/app/settings" className="grid size-8 place-items-center rounded-full border border-white/[0.08] bg-panel text-mist hover:text-chalk" aria-label="Settings">
                <Settings className="size-3.5" />
              </Link>
              <Link href="/app/settings" aria-label="Profile" className="hidden sm:block">
                <Avatar initials={user.initials} accent={user.accent} size={32} />
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1380px] px-4 pb-28 pt-4 md:px-8 md:pb-14 md:pt-7">{children}</main>
      </div>

      {/* Signature openGym Frosted Floating 5-Slot Mobile Dock */}
      <nav className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-3 pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="pointer-events-auto grid w-full max-w-[390px] grid-cols-5 items-center rounded-[28px] border border-white/12 bg-[#161618]/88 px-2 py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
          {[
            { href: "/app", label: "Home", icon: Home },
            { href: "/app/programs", label: "Plan", icon: Calendar },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = active(item.href);
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5 py-1">
                <Icon className={cn("size-[19px]", isActive ? "text-acid" : "text-mist")} strokeWidth={isActive ? 2.2 : 1.8} />
                <span className={cn("text-[10px] font-medium", isActive ? "text-acid" : "text-mist")}>{item.label}</span>
              </Link>
            );
          })}

          {/* Centered Glowing Play / Live Session Timer Orb */}
          <Link href={playHref} className="-mt-5 flex flex-col items-center justify-center" aria-label={activeWorkout ? "Resume workout" : "Start workout"}>
            <span
              className={cn(
                "grid size-13 place-items-center rounded-full text-ink shadow-xl transition-transform active:scale-95",
                activeWorkout
                  ? "bg-flame ring-4 ring-flame/25 shadow-[0_0_24px_rgba(255,159,10,0.45)]"
                  : "bg-acid ring-4 ring-acid/20 shadow-[0_0_24px_rgba(201,247,58,0.4)]",
              )}
            >
              <Play className="ml-0.5 size-6 fill-current" />
            </span>
            <span
              className={cn(
                "mt-0.5 font-numeric text-[10px] font-semibold",
                activeWorkout ? "text-flame" : "text-acid",
              )}
              suppressHydrationWarning
            >
              {activeWorkout ? elapsedLabel : "Start"}
            </span>
          </Link>

          {[
            { href: "/app/progress", label: "Stats", icon: BarChart3 },
            { href: "/app/exercises", label: "Exercises", icon: Dumbbell },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = active(item.href);
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5 py-1">
                <Icon className={cn("size-[19px]", isActive ? "text-acid" : "text-mist")} strokeWidth={isActive ? 2.2 : 1.8} />
                <span className={cn("text-[10px] font-medium", isActive ? "text-acid" : "text-mist")}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
