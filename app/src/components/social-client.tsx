"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Check, Dumbbell, Flame, Heart, ImagePlus, Loader2, MapPin, MessageCircle,
  Send, Share2, Sparkles, Trophy, Users, X, Zap,
} from "lucide-react";
import { addComment, checkIn, createPost, toggleFollow, toggleLike } from "@/app/actions";
import { Avatar, Badge, Button, IconButton } from "@/components/ui";
import { relativeTime } from "@/lib/date";
import { cn } from "@/lib/utils";

/* ───────────────────────────── TYPES ───────────────────────────── */

export type SocialUser = {
  id: string;
  name: string;
  handle: string;
  initials: string;
  accent: string;
  level: number;
  streak: number;
  bio?: string | null;
};

export type SocialComment = {
  id: string;
  postId: string;
  author: SocialUser;
  content: string;
  createdAt: number;
};

export type SocialPost = {
  id: string;
  author: SocialUser;
  type: string;
  title: string;
  body: string | null;
  meta: Record<string, string | number> | null;
  likes: number;
  comments: number;
  createdAt: number;
  liked: boolean;
  followed: boolean;
  commentList: SocialComment[];
};

export type GymView = {
  id: string;
  name: string;
  city: string;
  memberCount: number;
  busyness: number;
  accent: string;
};

const TYPE_META: Record<string, { label: string; tone: "acid" | "amber" | "sky" | "flame" | "grape" | "neutral"; icon: typeof Trophy }> = {
  pr: { label: "Personal record", tone: "amber", icon: Trophy },
  checkin: { label: "Gym check-in", tone: "sky", icon: MapPin },
  streak: { label: "Streak", tone: "flame", icon: Flame },
  workout: { label: "Workout", tone: "acid", icon: Dumbbell },
  text: { label: "Community", tone: "neutral", icon: Sparkles },
};

const FILTERS = [
  { key: "all", label: "For you" },
  { key: "following", label: "Following" },
  { key: "pr", label: "PRs" },
  { key: "checkin", label: "Check-ins" },
  { key: "streak", label: "Streaks" },
] as const;

/* ───────────────────────────── COMPOSER ───────────────────────────── */

export function PostComposer({ me }: { me: SocialUser }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [type, setType] = useState("text");
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim() || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("content", content.trim());
      fd.set("type", type);
      await createPost(fd);
      setContent("");
      setType("text");
      setExpanded(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="composer" className="surface scroll-mt-24 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <Avatar initials={me.initials} accent={me.accent} size={38} />
        <form onSubmit={submit} className="min-w-0 flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setExpanded(true)}
            placeholder="Share a win, a session note, or something the gym taught you…"
            rows={expanded ? 3 : 1}
            maxLength={600}
            className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-chalk placeholder:text-dim focus:border-acid/40 focus:outline-none"
          />
          {expanded && (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {[
                  { key: "text", label: "Update", icon: MessageCircle },
                  { key: "pr", label: "PR", icon: Trophy },
                  { key: "workout", label: "Session", icon: Dumbbell },
                  { key: "streak", label: "Streak", icon: Flame },
                ].map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setType(t.key)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[8.5px] uppercase tracking-[0.1em] transition-colors",
                        type === t.key
                          ? "border-acid/30 bg-acid/10 text-acid"
                          : "border-white/[0.07] text-dim hover:text-mist",
                      )}
                    >
                      <Icon className="size-2.5" /> {t.label}
                    </button>
                  );
                })}
                <span className="ml-auto font-mono text-[8px] text-dim">{content.length}/600</span>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
                <span className="hidden items-center gap-1.5 text-[10px] text-dim sm:flex">
                  <Users className="size-3" /> Visible to the Forge community
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setExpanded(false); setContent(""); }}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={!content.trim() || busy}>
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Post
                  </Button>
                </div>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

/* ───────────────────────────── FEED ───────────────────────────── */

export function SocialFeed({ posts, me }: { posts: SocialPost[]; me: SocialUser }) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [liked, setLiked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(posts.map((p) => [p.id, p.liked])),
  );
  const [likeCount, setLikeCount] = useState<Record<string, number>>(() =>
    Object.fromEntries(posts.map((p) => [p.id, p.likes])),
  );
  const [followed, setFollowed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(posts.map((p) => [p.author.id, p.followed])),
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [extraComments, setExtraComments] = useState<SocialComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    if (filter === "all") return posts;
    if (filter === "following") return posts.filter((p) => followed[p.author.id] || p.author.id === me.id);
    return posts.filter((p) => p.type === filter);
  }, [filter, posts, followed, me.id]);

  function like(postId: string) {
    const next = !liked[postId];
    setLiked((prev) => ({ ...prev, [postId]: next }));
    setLikeCount((prev) => ({ ...prev, [postId]: Math.max(0, (prev[postId] ?? 0) + (next ? 1 : -1)) }));
    startTransition(async () => {
      await toggleLike(postId);
      router.refresh();
    });
  }

  function follow(userId: string) {
    const next = !followed[userId];
    setFollowed((prev) => ({ ...prev, [userId]: next }));
    startTransition(async () => {
      const fd = new FormData();
      fd.set("userId", userId);
      await toggleFollow(fd);
      router.refresh();
    });
  }

  async function share(post: SocialPost) {
    const text = `${post.title} — ${post.author.name} on FORGE`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
      setCopied(post.id);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* cancelled */
    }
  }

  function commentsOf(post: SocialPost) {
    return [...post.commentList, ...extraComments.filter((c) => c.postId === post.id)];
  }

  async function submitComment(e: FormEvent, postId: string) {
    e.preventDefault();
    const value = commentText.trim();
    if (!value || commentBusy) return;
    setCommentBusy(true);
    try {
      const fd = new FormData();
      fd.set("postId", postId);
      fd.set("content", value);
      await addComment(fd);
      setExtraComments((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          postId,
          author: me,
          content: value,
          createdAt: Date.now(),
        },
      ]);
      setCommentText("");
      router.refresh();
    } finally {
      setCommentBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors",
                filter === f.key
                  ? "border-acid/30 bg-acid/10 text-acid"
                  : "border-white/[0.08] text-dim hover:text-mist",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-dim">
          <span className="size-1.5 animate-pulse-dot rounded-full bg-acid" /> Live feed
        </span>
      </div>

      <div className="space-y-3">
        {visible.map((post) => {
          const meta = TYPE_META[post.type] ?? TYPE_META.text;
          const Icon = meta.icon;
          const isLiked = Boolean(liked[post.id]);
          const comments = commentsOf(post);
          const open = expanded === post.id;
          const isMe = post.author.id === me.id;
          const isFollowed = Boolean(followed[post.author.id]);
          return (
            <article key={post.id} className="surface overflow-hidden rounded-2xl">
              {post.type === "pr" && (
                <div className="pointer-events-none absolute" aria-hidden />
              )}
              <div className="p-4 md:p-5">
                <div className="flex items-start gap-3">
                  <Avatar initials={post.author.initials} accent={post.author.accent} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <p className="text-[12.5px] font-semibold text-chalk">{post.author.name}</p>
                      <span className="font-mono text-[9px] text-dim">@{post.author.handle}</span>
                      <span className="font-mono text-[9px] text-dim">· {relativeTime(post.createdAt)}</span>
                      <Badge tone={meta.tone} className="ml-0.5 hidden sm:inline-flex">
                        <Icon className="size-2.5" /> {meta.label}
                      </Badge>
                    </div>
                    <p className="mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-dim">
                      Level {post.author.level} · {post.author.streak}-day streak
                    </p>
                  </div>
                  {!isMe && (
                    <button
                      onClick={() => follow(post.author.id)}
                      className={cn(
                        "press shrink-0 rounded-full border px-3 py-1.5 font-mono text-[8.5px] uppercase tracking-[0.1em] transition-colors",
                        isFollowed
                          ? "border-white/10 bg-white/[0.03] text-dim hover:text-mist"
                          : "border-acid/30 bg-acid/10 text-acid hover:bg-acid/15",
                      )}
                    >
                      {isFollowed ? "Following" : "Follow"}
                    </button>
                  )}
                </div>

                <div className="mt-3">
                  <h3 className={cn(
                    "font-display font-bold leading-[1.06] tracking-[-0.03em] text-chalk",
                    post.type === "pr" ? "text-[22px] md:text-[26px]" : "text-[16px]",
                  )}>
                    {post.title}
                  </h3>
                  {post.body && <p className="mt-1.5 text-[12px] leading-relaxed text-mist">{post.body}</p>}
                </div>

                {post.meta && Object.keys(post.meta).length > 0 && (
                  <div className={cn(
                    "mt-3 grid gap-2",
                    post.type === "pr" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3",
                  )}>
                    {Object.entries(post.meta).map(([key, value]) => (
                      <div key={key} className={cn(
                        "rounded-xl border px-3 py-2",
                        post.type === "pr"
                          ? "border-amber/15 bg-amber/[0.04]"
                          : "border-white/[0.06] bg-white/[0.02]",
                      )}>
                        <p className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-dim">{key}</p>
                        <p className={cn(
                          "mt-1 truncate font-numeric text-[12px] font-semibold",
                          post.type === "pr" ? "text-amber" : "text-chalk",
                        )}>
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 border-t border-white/[0.06] px-3 py-2">
                <button
                  onClick={() => like(post.id)}
                  disabled={pending}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10.5px] font-medium transition-colors",
                    isLiked ? "text-flame" : "text-dim hover:bg-white/[0.04] hover:text-mist",
                  )}
                >
                  <Heart className={cn("size-4", isLiked && "fill-flame")} />
                  <span className="font-numeric">{likeCount[post.id] ?? post.likes}</span>
                </button>
                <button
                  onClick={() => { setExpanded(open ? null : post.id); setCommentText(""); }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10.5px] font-medium transition-colors",
                    open ? "bg-white/[0.05] text-chalk" : "text-dim hover:bg-white/[0.04] hover:text-mist",
                  )}
                >
                  <MessageCircle className="size-4" />
                  <span className="font-numeric">{post.comments + (comments.length - post.commentList.length)}</span>
                </button>
                <button
                  onClick={() => share(post)}
                  className="ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10.5px] font-medium text-dim transition-colors hover:bg-white/[0.04] hover:text-mist"
                >
                  {copied === post.id ? <Check className="size-4 text-acid" /> : <Share2 className="size-4" />}
                  <span className="hidden sm:inline">{copied === post.id ? "Copied" : "Share"}</span>
                </button>
              </div>

              {open && (
                <div className="border-t border-white/[0.06] bg-black/15 p-3.5">
                  {comments.length > 0 && (
                    <div className="mb-3 space-y-2.5">
                      {comments.map((c) => (
                        <div key={c.id} className="flex items-start gap-2.5">
                          <Avatar initials={c.author.initials} accent={c.author.accent} size={26} />
                          <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm border border-white/[0.06] bg-white/[0.025] px-3 py-2">
                            <div className="flex items-center gap-2">
                              <p className="text-[10.5px] font-semibold text-chalk">{c.author.name}</p>
                              <span className="font-mono text-[8px] text-dim">{relativeTime(c.createdAt)}</span>
                            </div>
                            <p className="mt-0.5 text-[11px] leading-relaxed text-mist">{c.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <form onSubmit={(e) => submitComment(e, post.id)} className="flex items-center gap-2">
                    <Avatar initials={me.initials} accent={me.accent} size={26} />
                    <input
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={`Reply to ${post.author.name.split(" ")[0]}…`}
                      maxLength={400}
                      className="h-9 min-w-0 flex-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 text-[11px] text-chalk placeholder:text-dim focus:border-acid/40 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!commentText.trim() || commentBusy}
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-acid text-ink disabled:opacity-30"
                      aria-label="Send comment"
                    >
                      {commentBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                    </button>
                  </form>
                </div>
              )}
            </article>
          );
        })}
        {!visible.length && (
          <div className="surface rounded-2xl px-6 py-12 text-center">
            <p className="font-display text-lg font-bold">Quiet in here.</p>
            <p className="mt-1 text-[11px] text-mist">Follow more athletes or post the first update.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────── CHECK IN ───────────────────────────── */

export function CheckInButton({ gyms }: { gyms: GymView[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [gymId, setGymId] = useState(gyms[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!gymId || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("gymId", gymId);
      fd.set("note", note);
      await checkIn(fd);
      setDone(true);
      router.refresh();
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setNote("");
      }, 900);
    } finally {
      setBusy(false);
    }
  }

  const gym = gyms.find((g) => g.id === gymId) ?? gyms[0];

  return (
    <>
      <Button variant="secondary" size="md" onClick={() => setOpen(true)}>
        <MapPin className="size-3.5" /> Check in
      </Button>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
          <button className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Close" />
          <div className="animate-scale-in relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-panel p-5 shadow-2xl sm:max-w-md sm:rounded-3xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="label-mono mb-2">Live check-in</p>
                <h2 className="font-display text-2xl font-bold tracking-[-0.04em]">Where are you training?</h2>
              </div>
              <IconButton onClick={() => setOpen(false)} aria-label="Close"><X className="size-4" /></IconButton>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-2">
                {gyms.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGymId(g.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                      gymId === g.id ? "border-acid/30 bg-acid/[0.05]" : "border-white/[0.07] bg-white/[0.02] hover:border-white/15",
                    )}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ background: `${g.accent}16`, color: g.accent }}>
                      <MapPin className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-chalk">{g.name}</p>
                      <p className="font-mono text-[8.5px] uppercase tracking-[0.08em] text-dim">
                        {g.city} · {g.memberCount.toLocaleString()} members
                      </p>
                    </div>
                    <div className="w-16 text-right">
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                        <div className="h-full rounded-full" style={{ width: `${g.busyness}%`, background: g.busyness > 75 ? "#FF6B35" : g.busyness > 50 ? "#FFD166" : "#C9F73A" }} />
                      </div>
                      <p className="mt-1 font-mono text-[7.5px] uppercase tracking-[0.08em] text-dim">{g.busyness}% busy</p>
                    </div>
                  </button>
                ))}
              </div>
              <div>
                <label className="label-mono mb-1.5 block">Note (optional)</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={120}
                  placeholder="Leg day. Pray for me."
                  className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] text-chalk placeholder:text-dim focus:border-acid/40 focus:outline-none"
                />
              </div>
              {gym && (
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2 text-[10px] text-dim">
                  <Users className="size-3 text-sky" />
                  {Math.max(3, Math.round((gym.memberCount * gym.busyness) / 100 / 8))} people training at {gym.name} right now. Racks are {gym.busyness > 70 ? "in demand" : "available"}.
                </div>
              )}
              <Button type="submit" size="md" className="w-full" disabled={busy || done}>
                {done ? <><Check className="size-4" /> You&apos;re checked in</> : busy ? <Loader2 className="size-4 animate-spin" /> : <><Zap className="size-4" /> Check in &amp; post</>}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
