import Link from "next/link";
import {
  ArrowUpRight, CalendarDays, Crown, Flame, MapPin, Medal, Radio, Sparkles,
  Target, Trophy, Users, Zap,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getWorkspace, activeChallenge, leaderboard } from "@/lib/queries";
import { joinChallenge } from "@/app/actions";
import { relativeTime } from "@/lib/date";
import { Avatar, Badge, ButtonLink, ProgressBar } from "@/components/ui";
import { Card, CardHeader, PageHeader } from "@/components/page-header";
import { CheckInButton, PostComposer, ShareCardTrigger, SocialFeed } from "@/components/social-client";
import type { SocialComment, SocialPost, SocialUser } from "@/components/social-client";

function toSocialUser(u: {
  id: string; name: string; handle: string; initials: string; accent: string;
  level: number; streak: number; bio?: string | null;
}): SocialUser {
  return { id: u.id, name: u.name, handle: u.handle, initials: u.initials, accent: u.accent, level: u.level, streak: u.streak, bio: u.bio };
}

export default async function SocialPage() {
  const user = await requireUser();
  const ws = await getWorkspace(user.id);

  const me = toSocialUser(ws.user);
  const usersMap = ws.usersMap;

  const commentRows = ws.comments.map((c) => {
    const author = usersMap.get(c.userId);
    return {
      id: c.id,
      postId: c.postId,
      author: author ? toSocialUser(author) : toSocialUser(ws.user),
      content: c.content,
      createdAt: new Date(c.createdAt).getTime(),
    } satisfies SocialComment;
  });

  const feedPosts: SocialPost[] = ws.posts.map((p) => {
    const author = usersMap.get(p.userId) ?? ws.user;
    return {
      id: p.id,
      author: toSocialUser(author),
      type: p.type,
      title: p.title,
      body: p.body,
      meta: p.meta,
      likes: p.likes,
      comments: p.comments,
      createdAt: new Date(p.createdAt).getTime(),
      liked: ws.likedPosts.has(p.id),
      followed: ws.following.has(author.id) || author.id === user.id,
      commentList: commentRows.filter((c) => c.postId === p.id),
    };
  });

  const gyms = ws.gyms.map((g) => ({
    id: g.id, name: g.name, city: g.city, memberCount: g.memberCount, busyness: g.busyness, accent: g.accent,
  }));

  const board = leaderboard(ws);
  const myRank = board.findIndex((r) => r.isMe) + 1;
  const challenge = activeChallenge(ws);
  const otherChallenges = ws.challenges.filter((c) => c.id !== challenge?.id).slice(0, 3);

  const weekPosts = feedPosts.filter((p) => p.createdAt > Date.now() - 7 * 86_400_000).length;
  const communityVolume = ws.weekSets.reduce((a, s) => a + s.weightKg * s.reps, 0);
  const suggested = ws.users
    .filter((u) => u.id !== user.id && !ws.following.has(u.id))
    .sort((a, b) => b.level - a.level)
    .slice(0, 4);

  const gymCheckins = ws.checkins.slice(0, 4).map((c) => ({
    ...c,
    gym: ws.gyms.find((g) => g.id === c.gymId),
    member: usersMap.get(c.userId),
  }));

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Badge tone="acid" dot>Live community</Badge>
            <Badge tone="sky"><Users className="size-2.5" /> {ws.users.length + 12480} athletes</Badge>
            <span className="label-mono text-dim">Global · 24h</span>
          </>
        }
        title="The floor."
        subtitle="Training is solo until it isn't. Post the ugly session, steal the cue that fixes your squat, and let the leaderboard keep you honest. This is the room where the work gets witnessed."
        actions={
          <>
            <ButtonLink href="#leaderboard" variant="secondary" size="md">
              <Trophy className="size-3.5" /> Leaderboard
            </ButtonLink>
            <ShareCardTrigger
              workoutTitle="PPL Push Session Complete"
              volumeKg={communityVolume}
              streakDays={user.streak}
              userName={user.name}
            />
            <CheckInButton gyms={gyms} />
          </>
        }
      />

      {/* CHALLENGE HERO */}
      {challenge && (
        <Card className="relative overflow-hidden p-5 md:p-7">
          <div
            className="pointer-events-none absolute -right-28 -top-40 size-[480px] rounded-full opacity-30 blur-2xl"
            style={{ background: `radial-gradient(circle, ${challenge.accent}, transparent 66%)` }}
          />
          <div className="pointer-events-none absolute inset-0 grid-lines opacity-[0.13] [mask-image:radial-gradient(circle_at_20%_10%,black,transparent_70%)]" />
          <div className="relative grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full border border-flame/25 bg-flame/10 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-flame">
                  <Radio className="size-2.5 animate-pulse-dot" /> Live challenge
                </span>
                <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-dim">
                  {ws.challenges.find((c) => c.joined)?.participants ?? challenge.participants} athletes in
                </span>
              </div>
              <h2 className="mt-3 font-display text-[26px] font-bold leading-[1.02] tracking-[-0.04em] text-chalk md:text-[34px]">
                {challenge.title}
              </h2>
              <p className="mt-2 max-w-lg text-[12px] leading-relaxed text-mist">{challenge.description}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-[8.5px] uppercase tracking-[0.1em] text-mist">
                  <Target className="mr-1 inline size-2.5 text-acid" /> {challenge.metric} · {challenge.target} {challenge.unit}
                </span>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-[8.5px] uppercase tracking-[0.1em] text-mist">
                  <CalendarDays className="mr-1 inline size-2.5 text-sky" /> ends {new Date(challenge.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                {challenge.joined && (
                  <Badge tone="acid"><Zap className="size-2.5" /> You&apos;re in</Badge>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="label-mono mb-1">Your progress</p>
                  <p className="font-numeric text-[28px] font-bold leading-none tracking-[-0.05em] text-chalk">
                    {Math.round(challenge.progress)}
                    <span className="ml-1 text-[11px] font-normal text-dim">/ {challenge.target} {challenge.unit}</span>
                  </p>
                </div>
                <span className="font-display text-2xl font-bold" style={{ color: challenge.accent }}>
                  {Math.round((challenge.progress / Math.max(1, challenge.target)) * 100)}%
                </span>
              </div>
              <div className="mt-3">
                <ProgressBar value={(challenge.progress / Math.max(1, challenge.target)) * 100} color={challenge.accent} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[10px] text-dim">
                  {challenge.joined ? "Keep stacking sessions." : "Join the board and start counting."}
                </span>
                <form action={joinChallenge}>
                  <input type="hidden" name="challengeId" value={challenge.id} />
                  <button
                    type="submit"
                    className={
                      challenge.joined
                        ? "rounded-full border border-white/10 px-3 py-1.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-dim transition-colors hover:text-mist"
                        : "rounded-full bg-acid px-3.5 py-1.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-ink transition-colors hover:bg-acid-deep"
                    }
                  >
                    {challenge.joined ? "Leave challenge" : "Join challenge"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* FEED */}
        <div className="space-y-4 xl:col-span-8">
          <PostComposer me={me} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-white/[0.04] text-acid"><Sparkles className="size-3.5" /></span>
              <p className="text-[12px] font-semibold text-chalk">Today on the floor</p>
            </div>
            <div className="flex items-center gap-3 font-mono text-[8.5px] uppercase tracking-[0.1em] text-dim">
              <span>{weekPosts} posts · 7d</span>
              <span className="hidden items-center gap-1 sm:flex">
                <span className="size-1.5 animate-pulse-dot rounded-full bg-acid" /> synced
              </span>
            </div>
          </div>

          <SocialFeed posts={feedPosts} me={me} />

          <div className="surface rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-sky/10 text-sky"><Users className="size-4" /></span>
                <div>
                  <p className="text-[12px] font-semibold text-chalk">Find your people</p>
                  <p className="text-[10px] text-dim">Athletes training the same split and the same hours.</p>
                </div>
              </div>
              <ButtonLink href="/app/programs" variant="secondary" size="sm">
                Explore programs <ArrowUpRight className="size-3" />
              </ButtonLink>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {suggested.map((u) => (
                <div key={u.id} className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <Avatar initials={u.initials} accent={u.accent} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-chalk">{u.name}</p>
                    <p className="font-mono text-[8px] uppercase tracking-[0.08em] text-dim">
                      Lv {u.level} · {u.streak}d streak
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 px-2 py-1 font-mono text-[7.5px] uppercase tracking-[0.1em] text-dim">
                    Suggested
                  </span>
                </div>
              ))}
              {!suggested.length && <p className="text-[11px] text-dim">You follow everyone worth following. Rare.</p>}
            </div>
          </div>
        </div>

        {/* RAIL */}
        <div className="space-y-4 xl:col-span-4">
          {/* LEADERBOARD */}
          <Card id="leaderboard" className="scroll-mt-24 p-5">
            <CardHeader
              label="Weekly leaderboard"
              title="Volume kings"
              action={<Badge tone="amber"><Crown className="size-2.5" /> Top 8</Badge>}
            />
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-acid/15 bg-acid/[0.05] p-3">
              <span className="grid size-9 place-items-center rounded-lg bg-acid/15 font-numeric text-[15px] font-bold text-acid">
                {myRank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-semibold text-chalk">Your rank this week</p>
                <p className="font-mono text-[8.5px] uppercase tracking-[0.08em] text-dim">
                  {Math.round(communityVolume).toLocaleString()} kg moved · {ws.weekWorkouts.length} sessions
                </p>
              </div>
              <Flame className="size-4 text-flame" />
            </div>
            <div className="mt-3 space-y-1">
              {board.slice(0, 8).map((row, i) => (
                <div
                  key={row.id}
                  className={
                    row.isMe
                      ? "flex items-center gap-2.5 rounded-xl border border-acid/20 bg-acid/[0.05] px-2.5 py-2"
                      : "flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-white/[0.03]"
                  }
                >
                  <span className={
                    i === 0
                      ? "w-5 shrink-0 text-center font-numeric text-[11px] font-bold text-amber"
                      : i < 3
                        ? "w-5 shrink-0 text-center font-numeric text-[11px] font-bold text-chalk"
                        : "w-5 shrink-0 text-center font-numeric text-[11px] text-dim"
                  }>
                    {i + 1}
                  </span>
                  <Avatar initials={row.initials} accent={row.accent} size={26} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-chalk">
                      {row.name}{row.isMe && <span className="ml-1 text-[9px] text-acid">you</span>}
                    </p>
                    <p className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-dim">{row.streak}-day streak</p>
                  </div>
                  <span className="font-numeric text-[10.5px] font-semibold text-mist">
                    {row.volume.toLocaleString()}<span className="ml-0.5 text-[7.5px] font-normal text-dim">kg</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
              <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-dim">Resets Monday · 00:00</span>
              <button className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.1em] text-acid">
                Full board <ArrowUpRight className="size-2.5" />
              </button>
            </div>
          </Card>

          {/* CHALLENGES */}
          <Card className="p-5">
            <CardHeader
              label="Challenges"
              title="Pick a fight"
              action={<Badge tone="flame"><Zap className="size-2.5" /> {ws.challenges.length}</Badge>}
            />
            <div className="mt-4 space-y-2">
              {otherChallenges.map((c) => (
                <div key={c.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11.5px] font-semibold leading-tight text-chalk">{c.title}</p>
                      <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.08em] text-dim">
                        {c.metric} · {c.target} {c.unit} · {c.participants.toLocaleString()} in
                      </p>
                    </div>
                    <form action={joinChallenge}>
                      <input type="hidden" name="challengeId" value={c.id} />
                      <button
                        type="submit"
                        className={
                          c.joined
                            ? "shrink-0 rounded-full border border-acid/25 bg-acid/10 px-2.5 py-1 font-mono text-[7.5px] uppercase tracking-[0.1em] text-acid"
                            : "shrink-0 rounded-full border border-white/10 px-2.5 py-1 font-mono text-[7.5px] uppercase tracking-[0.1em] text-mist transition-colors hover:border-acid/30 hover:text-acid"
                        }
                      >
                        {c.joined ? "Joined" : "Join"}
                      </button>
                    </form>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <ProgressBar value={(c.progress / Math.max(1, c.target)) * 100} color={c.accent} />
                    <span className="shrink-0 font-numeric text-[9px] text-dim">{Math.round((c.progress / Math.max(1, c.target)) * 100)}%</span>
                  </div>
                </div>
              ))}
              {!otherChallenges.length && (
                <p className="py-4 text-center text-[11px] text-dim">New challenges drop every Monday.</p>
              )}
            </div>
          </Card>

          {/* GYMS */}
          <Card className="p-5">
            <CardHeader
              label="Gym radar"
              title="Where the city trains"
              action={<Badge tone="sky"><MapPin className="size-2.5" /> Live</Badge>}
            />
            <div className="mt-4 space-y-2">
              {gyms.map((g) => (
                <div key={g.id} className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: `${g.accent}16`, color: g.accent }}>
                    <MapPin className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-chalk">{g.name}</p>
                    <p className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-dim">{g.city} · {g.memberCount.toLocaleString()}</p>
                  </div>
                  <div className="w-14 text-right">
                    <div className="h-1 overflow-hidden rounded-full bg-white/[0.07]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${g.busyness}%`,
                          background: g.busyness > 75 ? "#FF6B35" : g.busyness > 50 ? "#FFD166" : "#C9F73A",
                        }}
                      />
                    </div>
                    <p className="mt-1 font-mono text-[7px] uppercase tracking-[0.08em] text-dim">{g.busyness}% busy</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-white/[0.06] pt-3">
              <p className="label-mono mb-2">Recent check-ins</p>
              <div className="space-y-1.5">
                {gymCheckins.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-[10px] text-mist">
                    <Avatar initials={c.member?.initials ?? "??"} accent={c.member?.accent ?? "#C9F73A"} size={18} />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium text-chalk/80">{c.member?.name ?? "Athlete"}</span> at {c.gym?.name ?? "a gym"}
                    </span>
                    <span className="shrink-0 font-mono text-[7.5px] uppercase tracking-[0.06em] text-dim">
                      {relativeTime(new Date(c.createdAt).getTime())}
                    </span>
                  </div>
                ))}
                {!gymCheckins.length && <p className="text-[10px] text-dim">No check-ins yet today. Be first.</p>}
              </div>
            </div>
          </Card>

          {/* SUGGESTED ATHLETES */}
          {suggested.length > 0 && (
            <Card className="p-5">
              <CardHeader label="Your circle" title="Athletes to follow" action={<Medal className="size-4 text-grape" />} />
              <div className="mt-4 space-y-2">
                {suggested.map((u) => (
                  <div key={u.id} className="flex items-center gap-2.5">
                    <Avatar initials={u.initials} accent={u.accent} size={30} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-chalk">{u.name}</p>
                      <p className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-dim">@{u.handle} · Lv {u.level}</p>
                    </div>
                    <Link
                      href="/app/social"
                      className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[7.5px] uppercase tracking-[0.1em] text-mist transition-colors hover:border-acid/30 hover:text-acid"
                    >
                      Follow
                    </Link>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <p className="mt-6 text-center font-mono text-[8px] uppercase tracking-[0.16em] text-dim">
        Show up. Level up. · {ws.users.length + 12480} athletes in the Forge
      </p>
    </>
  );
}
