/**
 * OpenGym Session Builder Engine
 * Direct TypeScript port of openGym's lib/session-builder.js
 */

import type { CatalogExercise } from "@/lib/opengym-catalog";
import type { ExerciseStat } from "@/components/exercise-library";
import { OG_MUSCLE_NAME, ogMusclesOf, shownMuscles } from "@/lib/muscle-explorer";

export const SESSION_DURATIONS = [20, 40, 60] as const;
export const MAX_SESSION_PICKS = 9;

const NOT_A_LIFT =
  /stretch|mobility|mobilization|\bpose\b|toe touch|\broll(er)?\b|circles|warm-?up|form check|massage|release|isometric squeeze|breathing/i;
const OK_CAT = new Set(["strength", "calisthenics", "isometric", "compound", "isolation"]);
const CORE_MUSCLES = new Set(["abs", "obliques"]);

const KIT =
  /\b(barbell|dumbbells?|cable|lever(age)?|machine|smith|band|kettlebell|ez|body ?weight|weighted|sled|assisted|seated|standing|lying|close[- ]grip|wide[- ]grip|v\.? ?\d|\(.*?\))\b/gi;
const movementOf = (e: CatalogExercise) =>
  String(e.name || "")
    .toLowerCase()
    .replace(KIT, " ")
    .replace(/\s+/g, " ")
    .trim();

const MINOR_MUSCLES = new Set(["hip-flexors", "tibialis", "adductors", "serratus", "forearm"]);
const COMPOUND_RE =
  /press|row\b|rows\b|squat|deadlift|lunge|pull-?ups?|chin-?ups?|\bdips?\b|thrust|clean|snatch|push-?ups?|pulldown|step-?up|good morning|swing/i;
const ODD_RE =
  /\bv\. ?\d|\bpov\b|side lying|exercise ball|stability ball|swiss ball|bosu|\bone arm\b|\bsingle arm\b|palm up|palm down|iron cross|on knees|\(male\)|kneeling/i;
const NEEDS_BALL_RE = /exercise ball|stability ball|swiss ball|bosu/i;
const BIG_MUSCLES = new Set(["chest", "lats", "upper-back", "quadriceps", "gluteal", "hamstring"]);

const CLASSIC_RE =
  /^(barbell |dumbbell |cable |pull-up|chin-up|push-up|dip|chest dip|front plank|plank|squat|deadlift|bench press|overhead press|shoulder press|lateral raise|rear fly|upright row|biceps curl|hammer curl|triceps|leg press|leg curl|leg extension|calf raise|romanian deadlift|hip thrust|lat pulldown|seated row)/i;

function rng(seed: number) {
  let x = (Number(seed) >>> 0) || 0x9e3779b9;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

export function capOfMuscle(m: string, alone: boolean): number {
  if (alone) return 4;
  return BIG_MUSCLES.has(m) ? 3 : 2;
}

export interface SessionPick {
  id: string;
  exercise: CatalogExercise;
  sets: number;
  reps: number;
  sec?: number;
  mode: "reps" | "time";
  restSec: number;
  muscles: string[];
  compound: boolean;
  why: string[];
}

export interface BuiltSession {
  picks: SessionPick[];
  minutes: number;
  muscles: string[];
  profileLabel: string | null;
}

export function estimateSessionMinutes(picks: SessionPick[]): number {
  let sec = 0;
  for (const p of picks) {
    const sets = Math.max(1, p.sets || 1);
    const work = p.mode === "time" ? p.sec || 30 : Math.max(35, (p.reps || 10) * 4);
    sec += sets * work + (sets - 1) * (p.restSec || 90) + 90;
  }
  return Math.round(sec / 60);
}

function everydayScore(ex: CatalogExercise): number {
  let score = ex.source === "forge" ? 9 : 5;
  if (CLASSIC_RE.test(ex.name)) score += 4;
  if (ex.equipment === "barbell" || ex.equipment === "dumbbell" || ex.equipment === "cable") score += 2;
  if (ex.equipment === "bodyweight") score += 1;
  return score;
}

export interface BuildSessionParams {
  catalog: CatalogExercise[];
  terms: string[];
  minutes?: number;
  seed?: number;
  stats?: Record<string, ExerciseStat>;
  favIds?: string[];
  equipment?: string[];
  onlyMyGym?: boolean;
  exclude?: string[];
}

export function buildSession(params: BuildSessionParams): BuiltSession {
  const {
    catalog,
    terms,
    minutes = 40,
    seed = 1,
    stats = {},
    favIds = [],
    equipment = [],
    onlyMyGym = false,
    exclude = [],
  } = params;

  const named = new Set(terms.filter((x) => !x.startsWith("group:")));
  const fresh = shownMuscles(terms).filter((m) => named.has(m) || !MINOR_MUSCLES.has(m));

  const out: BuiltSession = {
    picks: [],
    minutes: 0,
    muscles: fresh,
    profileLabel: onlyMyGym && equipment.length ? `${equipment.length} equipment types` : null,
  };
  if (!fresh.length) return out;

  const favSet = new Set(favIds);
  const skip = new Set(exclude);
  const eqSet = new Set(equipment);
  const rand = rng(seed);

  const pool: Array<{
    e: CatalogExercise;
    w: Record<string, number>;
    main: string[];
    score: number;
    n: number;
    compound: boolean;
  }> = [];

  for (const e of catalog) {
    if (!e || skip.has(e.id) || e.bodyPart === "cardio" || e.category === "cardio") continue;
    if (onlyMyGym && eqSet.size > 0 && !eqSet.has(e.equipment) && e.equipment !== "bodyweight") continue;

    const custom = e.source === "custom";
    const n = stats[e.id]?.totalSets ?? 0;
    const name = e.name || "";
    if (!custom && (!OK_CAT.has(e.category) || NOT_A_LIFT.test(name) || /female/i.test(name))) continue;
    if (!custom && !n && NEEDS_BALL_RE.test(name)) continue;

    const w = ogMusclesOf(e);
    const main = fresh.filter((m) => (w[m] ?? 0) >= 1);
    if (!main.length) continue;
    if (e.hold && !main.some((m) => CORE_MUSCLES.has(m))) continue;

    const familiar = everydayScore(e) + (CLASSIC_RE.test(name) ? 3 : -4) - (ODD_RE.test(name) ? 6 : 0);
    const score =
      (favSet.has(e.id) ? 14 : 0) +
      (n > 0 ? 18 + Math.min(6, n) * 3 : 0) +
      familiar * (n > 0 ? 0.8 : 1.6) +
      (custom ? 4 : 0) +
      (main.length - 1) * 2 +
      rand() * 4;

    pool.push({
      e,
      w,
      main,
      score,
      n,
      compound: COMPOUND_RE.test(name) || main.length >= 2,
    });
  }

  pool.sort((a, b) => b.score - a.score || (a.e.id < b.e.id ? -1 : 1));

  const taken = new Set<string>();
  const moves = new Set<string>();
  const hits: Record<string, number> = Object.fromEntries(fresh.map((m) => [m, 0]));
  const cap = (m: string) => capOfMuscle(m, fresh.length === 1);
  const picks: SessionPick[] = [];

  const calcTime = (extra: SessionPick[] = []) => estimateSessionMinutes([...picks, ...extra]);

  for (let guard = 0; guard < 40 && picks.length < MAX_SESSION_PICKS; guard++) {
    if (picks.length && calcTime() >= minutes - 3) break;
    const open = fresh.filter((m) => hits[m] < cap(m));
    if (!open.length) break;
    const m = [...open].sort((a, b) => hits[a] - hits[b] || fresh.indexOf(a) - fresh.indexOf(b))[0];
    const c = pool.find((p) => !taken.has(p.e.id) && !moves.has(movementOf(p.e)) && p.main.includes(m));
    if (!c) {
      hits[m] = cap(m);
      continue;
    }

    const loaded = c.e.equipment !== "bodyweight";
    const pick: SessionPick = c.e.hold
      ? {
          id: c.e.id,
          exercise: c.e,
          sets: 3,
          reps: 1,
          sec: 30,
          mode: "time",
          restSec: 60,
          muscles: c.main,
          compound: c.compound,
          why: [],
        }
      : {
          id: c.e.id,
          exercise: c.e,
          sets: 3,
          reps: c.compound && loaded ? 8 : c.e.equipment === "bodyweight" ? 10 : 12,
          mode: "reps",
          restSec: c.compound && loaded ? 120 : 75,
          muscles: c.main,
          compound: c.compound,
          why: [],
        };

    if (picks.length >= 2 && calcTime([pick]) > minutes + 5) break;

    taken.add(c.e.id);
    moves.add(movementOf(c.e));
    for (const mm of c.main) hits[mm] = (hits[mm] || 0) + 1;

    const why: string[] = [];
    if (favSet.has(c.e.id)) why.push("One of your favourites");
    if (c.n > 0) why.push(c.n === 1 ? "You did it once" : `You did it ${c.n} times`);
    else if (everydayScore(c.e) >= 8) why.push(`A classic for ${OG_MUSCLE_NAME[c.main[0]] || c.main[0]}`);
    pick.why = why;

    picks.push(pick);
  }

  // Scale sets upward (4, then 5 on compounds) if time remains
  for (let round = 0; round < 2 && picks.length; round++) {
    for (const p of [...picks].sort((a, b) => Number(b.compound) - Number(a.compound))) {
      if (calcTime() >= minutes - 3) break;
      if (p.sets >= (p.compound ? 5 : 4)) continue;
      const more = { ...p, sets: p.sets + 1 };
      const test = picks.map((x) => (x === p ? more : x));
      if (estimateSessionMinutes(test) > minutes + 3) continue;
      p.sets = more.sets;
    }
  }

  picks.sort((a, b) => Number(b.compound) - Number(a.compound));
  out.picks = picks;
  out.minutes = calcTime();
  return out;
}

export function swapSessionPick(
  params: Omit<BuildSessionParams, "terms" | "minutes" | "exclude">,
  session: BuiltSession,
  index: number,
  seed: number,
): BuiltSession {
  const was = session.picks[index];
  if (!was) return session;
  const keep = session.picks.filter((_, i) => i !== index).map((p) => p.id);
  const alt = buildSession({
    ...params,
    terms: was.muscles,
    minutes: 1,
    seed,
    exclude: [...keep, was.id],
  });
  const p0 = alt.picks[0];
  if (!p0) return session;
  const swapped: SessionPick = { ...p0, sets: was.sets };
  const picks = session.picks.map((x, i) => (i === index ? swapped : x));
  return {
    ...session,
    picks,
    minutes: estimateSessionMinutes(picks),
  };
}
