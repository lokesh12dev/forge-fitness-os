# Design System

**Name:** Forge Signal
**Premise:** a serious training instrument, not a cheerful wellness app. The number is the hero; the interface stays quiet until it has something to say.

**Source:** [`app/src/app/globals.css`](../app/src/app/globals.css), [`app/src/components/ui.tsx`](../app/src/components/ui.tsx)

---

## 1. Principles

1. **The number is the hero.** Weight, reps, readiness, protein left. Type does the work; decoration earns its place.
2. **One primary action per screen.** Start session, log set, close the gap. Everything else is secondary.
3. **Dark by physics, not fashion.** A gym at 6 am or 9 pm is dim. Dark reduces glare and makes luminous data pop.
4. **Signal color is earned.** Acid lime means “go / adapted / PR”. Flame means “attention”. Never both on the same element.
5. **Motion explains, never decorates.** Sheets rise from the action; numbers count; nothing loops.
6. **Accessible is premium.** Focus rings, contrast, tap targets, reduced motion — not an afterthought.

---

## 2. Color

### Core palette

| Token | Hex | Use |
| --- | --- | --- |
| `ink` | `#060708` | App background, deepest layer |
| `ink-2` | `#090B0E` | Alternating sections |
| `panel` | `#0C0E12` | Cards, surfaces |
| `panel-2` | `#11141A` | Nested surfaces, inputs |
| `panel-3` | `#171B22` | Hover, selected rows |
| `chalk` | `#F2F3EE` | Primary text (warm off-white, not pure white) |
| `mist` | `#8B919C` | Secondary text |
| `dim` | `#5C626D` | Tertiary/meta text |
| `acid` | `#C9F73A` | Primary accent: CTA, progress, “ready”, PR |
| `acid-deep` | `#A4CC24` | Pressed/hover acid, borders |
| `flame` | `#FF6B35` | Attention, fatigue, surplus, destructive-ish |
| `sky` | `#6EA8FF` | Informational, back/lats mapping |
| `mint` | `#7BE0AD` | Positive secondary, “ready” alternative |
| `amber` | `#FFD166` | Caution, moderate readiness |
| `grape` | `#B49CFF` | Triceps/accessory data |
| `rose` | `#FF8FA3` | Hamstrings, negative deltas |

### Usage ratios
- 80% ink/panel/chalk/mist.
- 15% neutral borders and gradients.
- 5% accent. If two accents compete, remove one.

### Semantic rules
| Meaning | Color |
| --- | --- |
| Primary action | Acid fill, ink text |
| Secondary action | Transparent, white border, chalk text |
| Ready / on target | Acid or mint |
| Caution / moderate | Amber |
| Fatigue / over target / attention | Flame |
| Destructive | Flame text + subtle flame border; never a solid red button |
| Info | Sky |

### Contrast
- Body text `mist` on `ink` ≈ 6.3:1; `dim` is meta only, never body copy.
- Acid on ink ≈ 14:1; ink on acid ≈ 14:1.
- Flame on ink ≈ 6.1:1; use for large text/icons, not 12 px body.
- Never rely on color alone: pair with label, icon, or value.

### Gradients & texture
- Surfaces use a top-light gradient (`rgba(255,255,255,0.035)` → transparent) over panel color for depth.
- `glow-acid` for hero cards only; not on every card.
- `grid-lines` for hero/landing sections; 56 px grid at 4.5% opacity.
- `noise` at 4.5% for filmic texture on large dark areas.
- No glassmorphism blur on data cards; it reduces legibility.

---

## 3. Typography

### Families
| Role | Family | Notes |
| --- | --- | --- |
| Display | **Bricolage Grotesque** | Editorial, slightly condensed, confident. Headlines and big numbers. |
| UI | **Inter** | Neutral, legible at 12–16 px, excellent tabular figures. |
| Numeric/mono | **JetBrains Mono** | Labels, weights, reps, timestamps, technical metadata. |

All loaded via `next/font` with `display: swap`; no layout shift from FOUT.

### Scale (desktop)

| Token | Size / line | Use |
| --- | --- | --- |
| Display XL | 72–112 px / 0.9 | Landing hero |
| Display L | 48–64 px / 0.94 | Page hero, big statement |
| Display M | 32–40 px / 0.98 | Section titles |
| H1 | 30–36 px / 1.0 | Page title |
| H2 | 22–26 px / 1.05 | Card group title |
| H3 | 17–19 px / 1.15 | Card title |
| Body L | 16 px / 1.6 | Long copy |
| Body | 14 px / 1.55 | Default UI |
| Small | 12.5 px / 1.45 | Meta, helper |
| Label | 10 px mono / 1, 0.18em tracking, uppercase | Eyebrows, table headers |

### Rules
- Headlines use `letter-spacing: -0.035em`, `line-height: 0.96`; never center long headlines.
- Numbers use `.font-numeric` (JetBrains Mono, tabular, −0.04em) so digits don't jump.
- Maximum 2 weights per family (Inter 400/500/600; Bricolage 600/700).
- Body line length 60–75 characters.
- No all-caps body; uppercase only for labels ≤ 3 words.
- Numeric units are smaller and dimmer than the value: `82.5` at 32 px, `kg` at 12 px `mist`.

---

## 4. Spacing & layout

### Spacing scale (4 px base)
`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96`

### Radius
| Token | Value | Use |
| --- | --- | --- |
| `sm` | 8 px | Inputs, chips |
| `md` | 12 px | Buttons, small cards |
| `lg` | 16 px | Standard cards |
| `xl` | 20–24 px | Feature cards, sheets |
| `4xl` | 32 px | Hero containers |
| `full` | 999 px | Pills, avatars, rings |

### Grid
- App shell: max width 1320 px, 24 px gutters desktop, 16 px mobile.
- Dashboard: 12-column grid; main 8, rail 4. Collapses to single column < 1024 px.
- Card padding: 20–24 px desktop, 16 px mobile.
- Section vertical rhythm: 32–48 px app, 96–140 px marketing.
- Never nest more than 2 surfaces with borders; use spacing or background shift instead.

### Breakpoints
| Name | Min width | Behavior |
| --- | --- | --- |
| `sm` | 640 | 2-col stats |
| `md` | 768 | Side-by-side cards |
| `lg` | 1024 | App rail + content |
| `xl` | 1280 | Full dashboard grid |
| `2xl` | 1536 | Max width, more air |

Mobile-first. Test at 320, 390, 430, 768, 1024, 1440.

---

## 5. Elevation & borders

- **No drop shadows for hierarchy.** Use background lightness + 1 px borders.
- Border default: `rgba(255,255,255,0.075)`; hover `0.14`; active acid `0.35`.
- Surface stack: `ink` → `panel` → `panel-2` → `panel-3`.
- Glow only for: primary CTA hover, PR celebration, active live-session card.
- Hairline dividers at 7% white; never heavy rules.

---

## 6. Components

### Buttons
| Variant | Spec |
| --- | --- |
| Primary | Acid fill, ink text, 44–48 px height, 12 px radius, 600 weight, hover `acid-deep`, active scale 0.98 |
| Secondary | Transparent, 1 px white/14 border, chalk text, hover panel-2 |
| Ghost | No border, mist text, hover panel-2 + chalk |
| Danger | Flame text, flame/30 border, hover flame/10 fill |
| Icon | 36–40 px square, centered 18 px icon, `aria-label` required |

Rules: one primary per view; loading state preserves width; disabled at 40% opacity with `cursor-not-allowed`; no icon-only primary without label on mobile.

### Cards
```
background: linear-gradient(180deg, rgba(255,255,255,.035), transparent 45%), #0C0E12;
border: 1px solid rgba(255,255,255,.075);
border-radius: 16–20px;
padding: 20–24px;
```
Variants: `interactive` (hover border + translateY −1 px), `accent` (acid left border 2 px), `flush` (no padding for tables/lists).

### Inputs
- Height 44–48 px; panel-2 background; 1 px border; 12 px radius.
- Label above, 10 px mono uppercase; helper below 12 px mist.
- Focus: acid border + 2 px acid ring at 40%.
- Error: flame border + 12 px flame message; never color alone (icon + text).
- Steppers for weight/reps: large touch targets (≥ 44 px), long-press acceleration.

### Stats
- Label 10 px mono uppercase mist.
- Value 26–40 px, font-numeric, chalk; unit 11–12 px mist.
- Delta chip: mint for positive, rose for negative, with explicit sign.
- Hint 11–12 px dim below.

### Badges / chips
- Height 24–28 px; 999 px radius; 10 px mono uppercase; 0.12em tracking.
- Variants: neutral, acid, flame, sky, mint, outline.
- Max 1 accent chip per card header.

### Tables
- Header 10 px mono uppercase dim; rows 48–56 px; hairline separators.
- Numeric columns right-aligned, tabular.
- Hover row panel-2; selected row acid/8%.
- Mobile: convert to stacked cards, not horizontal scroll for primary data.

### Sheets / dialogs
- Bottom sheet on mobile (radius 24 top, drag handle, safe-area padding); centered modal on desktop.
- Backdrop `rgba(0,0,0,.7)` + 4 px blur max.
- Focus trap; Esc closes; initial focus on title or first input; return focus to trigger.
- Max height 90dvh; inner scroll; sticky footer action.

### Navigation
- Desktop rail: 232 px, logo top, 5 primary destinations, settings bottom.
- Mobile: bottom bar 5 items, 56–64 px + safe area; labels 10 px.
- Active: acid text + 2 px acid indicator; inactive mist.
- No hamburger for primary nav; more menu only for secondary.

### Charts
- SVG, 1.5–2 px lines, area gradient 18% → 0.
- Grid lines 6% white; axis labels 9–10 px mono dim.
- One accent series + neutral comparison. No 3D, no pie > 3 slices.
- Always label the unit; empty state explains what will appear.
- Reduced motion: no draw animation, final state only.

### Body map
- Front/back SVG silhouette, 12 muscle regions.
- Fill = recovery/volume color at 20–90% opacity; stroke 1 px white/12.
- Selected region: acid stroke 2 px + label.
- Colorblind-safe: pair with numeric legend and pattern on hover.

### PR card
- 1080×1350 canvas; ink background, subtle grid, acid headline.
- Hierarchy: lift name → weight × reps → e1RM → date/handle → Forge mark.
- Safe margins 96 px; no text below 28 px at export scale.
- Share via Web Share API with file; download fallback.

---

## 7. Iconography

- **Lucide**, 1.5 px stroke, 16/18/20/24 px sizes.
- Icons support labels; never replace a primary action label on mobile with an unlabeled icon.
- Custom marks: Forge logo (anvil/F), plate, PR bolt; keep on the same grid.
- No emoji in product UI; allowed in social copy only.

---

## 8. Motion

### Principles
- Motion confirms cause and effect, preserves context, or directs attention. Otherwise, none.
- 120–200 ms for micro-interactions; 240–320 ms for sheets; 600–900 ms for landing reveals.
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` (out-expo-ish); no bounce except PR celebration.
- Never animate layout properties; transform/opacity only.

### Patterns
| Pattern | Spec |
| --- | --- |
| Button press | scale 0.98, 120 ms |
| Card hover | translateY −1 px + border lighten, 160 ms |
| Sheet | translateY 100% → 0, 280 ms; backdrop fade 200 ms |
| Set complete | row background acid/8 → transparent 500 ms; check scale 0.9 → 1 |
| PR | confetti-free: ring pulse + number count + acid glow, 900 ms, once |
| Number change | count 250 ms, tabular figures, no layout shift |
| Page reveal | fade-up 12 px, 600 ms, stagger 60 ms, only on marketing |

### Reduced motion
`prefers-reduced-motion: reduce` → duration 0.01 ms, no transforms, no count-up, no parallax. Charts render final state.

---

## 9. Accessibility

### Requirements (WCAG 2.2 AA)
- Contrast ≥ 4.5:1 body, ≥ 3:1 large text/icons.
- Visible focus: 2 px acid ring, 2 px offset, on every interactive element.
- Keyboard: full session flow without a pointer; logical tab order; no traps outside modals.
- Touch targets ≥ 44×44 px (48 preferred for primary gym actions).
- Forms: programmatic labels, `aria-describedby` for errors, no placeholder-only labels.
- Live regions: rest timer completion, PR announcement, toast (`role="status"`).
- Charts: text summary + table alternative; not color-only.
- Video/pose: captions for audio cues; no flashing; camera optional.
- Motion: honor reduced motion; no autoplay video with sound.
- Zoom: usable at 200%; no horizontal scroll at 320 px.
- Screen reader names for icon buttons: “Decrease weight”, “Swap exercise”, “Close”.

### Gym-context specifics
- One-handed reach: primary actions in bottom third on mobile.
- High-glare mode: avoid thin 10 px body text; labels only.
- Sweat/gloves: large targets, forgiving hit areas.
- Audio cues optional; never required.

---

## 10. Voice & tone

### Voice
Direct, knowledgeable, calm. A good training partner, not a hype account and not a clinician.

| Do | Don't |
| --- | --- |
| “Sleep debt detected. Top set capped at RPE 8.” | “Uh oh! You're tired 😴” |
| “60 g protein left. Three ways to close it.” | “You failed your protein goal.” |
| “Rack taken? Keep the stimulus.” | “Error: exercise unavailable.” |
| “One cue: brace, sit between your hips.” | “Your form is bad.” |
| “Deload week. Recovery is the workout.” | “You lost your streak. Start over.” |

### Rules
- Numbers before adjectives.
- No shame, no streak threats, no “crush it” clichés.
- Explain changes in one sentence with the input.
- Use the athlete's units and vocabulary (squat, not “lower-body movement pattern”).
- Medical topics: plain, cautious, route to a professional.

---

## 11. Screen recipes

### Dashboard
```
[eyebrow: Tuesday · Week 3 of 8]        [streak chip]
[H1: Morning, Alex.]                    [readiness ring]
[Today's session card: name · time · focus · Start]
[Fuel card: kcal ring + protein left + Close the gap]
[Recovery body map + “train what's ready”]
[Volume chart + PR rail]
[Community strip]
```
Hierarchy: readiness → session → fuel → recovery → progress → social. One primary CTA (Start session).

### Live session
```
[sticky: elapsed · volume · Finish]
[exercise tabs / current exercise]
[last time ghost · target · RPE target]
[weight stepper] [rep stepper] [RPE chips] [Log set]
[set rows with checkmarks]
[rest timer bar]
[swap · add · compress · voice]
```
Thumb zone: Log set + steppers. Destructive actions behind confirmation. Never more than one modal at a time.

### Nutrition
```
[date nav]
[calorie ring | protein/carbs/fat bars]
[remaining + Close the gap CTA]
[meal sections with add]
[water chip]
[photo scan CTA]
```
The ring is the anchor; the protein gap is the action.

### Progress
```
[range tabs 4w/12w/6m]
[headline stat + delta]
[e1RM chart]
[volume chart]
[body trends]
[strength standards]
[PR cards]
```
One chart per question; no dashboard of 8 tiny charts.

---

## 12. Content & data formatting

- Units: `82.5 kg` (space, lowercase unit), `8 reps`, `RPE 8`, `2,480 kcal`, `190 g`.
- Dates: “Tue 25 Nov”, relative “2 days ago” under 7 days.
- Deltas: explicit sign, color + arrow + text.
- Percentages: whole numbers unless < 1%.
- Empty: explain the value (“Log a set to start your e1RM trend”), one action.
- Errors: what happened, what to do, retain input.
- Numbers never truncate mid-value; use compact notation only in charts (`12.4k`).

---

## 13. Implementation notes

- Tailwind v4 `@theme` tokens map to CSS variables; no ad-hoc hex in components except data colors from `MUSCLES`.
- `cn()` (clsx + tailwind-merge) for conditional classes.
- `ui.tsx` primitives: `Button`, `ButtonLink`, `Badge`, `Avatar`, `Stat`, `ProgressBar`, `SectionLabel`, `Divider`, `EmptyState`, `Logo`, `IconButton`.
- Charts are client components; pass only serializable props (no functions from server components). Formatters live inside client wrappers (`VolumeChart`).
- Fonts via `next/font` variables on `<html>`.
- No CSS-in-JS; no component library; no animation dependency.
- Dark only for v1; light mode is a later, separately designed theme (not an inversion).

---

## 14. Quality checklist

- [ ] One primary action visible.
- [ ] Number hierarchy readable at arm's length.
- [ ] 320 px layout has no horizontal scroll.
- [ ] Focus visible on every control; keyboard flow works.
- [ ] Contrast checked for body/meta/accent.
- [ ] Empty, loading, error states designed.
- [ ] Units and signs correct; no ambiguous “5” without context.
- [ ] Reduced motion respected.
- [ ] No color-only meaning.
- [ ] Touch targets ≥ 44 px in gym flows.
- [ ] Copy passes the “training partner” test (no shame, no hype).
- [ ] No more than 2 accents on a screen.
