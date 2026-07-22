# Design roadmap — Simple / Deep

Context doc for the "Simple, Deep" concept work. Foundation (theme) is done; everything below is unbuilt, grouped by area with the research rationale kept inline so future sessions don't need to re-derive it.

## Done

- [x] Base neutral: Ledger warm-stone palette (light + dark), `src/styles/global.css`
- [x] Heading font: Source Serif 4 (`@fontsource-variable/source-serif-4`)
- [x] Body/UI font: Pretendard single (`@fontsource/pretendard`, weights 400/500/600)
- [x] Data/mono font: Jetendard, self-hosted at `public/fonts/jetendard/` (Regular + SemiBold only, out of 16 upstream weights)
- [x] Material color tokens for 3 clothing categories: `--material-denim`, `--material-chino`, `--material-leather` (+ `-soft` backgrounds), light/dark
- [x] Fitness `StatTileRow` (`src/components/fitness/StatTileRow.astro`) + `TrainingHeatmap` (`src/components/fitness/TrainingHeatmap.astro`), wired into `EntryLayout`/`fitness/index.astro`
- [x] Clothing detail page rebuilt around `ClothingLayout.astro` — construction hotspot diagram (`ConstructionFigure.astro`), `QuickFacts.astro`, `DetailTabs.astro` (Overview/Story/Care). See "Clothing" section below — this superseded the original tabs+spec-table plan.

## Open decisions (need input before building)

- [ ] **Material colors are placeholder/generic.** Denim/chino/leather use generic material-association hues, not real reference brands. Revisit if specific brand colors should replace them.
- [ ] **Only 3 of 6 categories have color tokens.** Knit, outerwear, footwear were deferred — add when those categories actually get used, following the same `--material-<category>` / `--material-<category>-soft` pattern in `global.css`.
- [ ] **Fitness has no activity color map yet.** Research proposed `--activity-cardio` / `--activity-strength` / `--activity-mobility` / `--activity-hiit` (see Fitness section) — not decided whether to adopt, and not scoped to specific real colors yet.
- [ ] Chart color ramp (`--chart-1..5` in `global.css`) currently reuses the material/base palette loosely — revisit once `VolumeTrendChart` is actually built and real data is on screen.

---

## Fitness — data-driven training log

Currently: `fitness` schema has `title/description/pubDate/tags/workoutType/durationMinutes`, rendered as plain prose via `EntryLayout`. Goal: make it read as a record, not a diary entry.

### Schema additions (`src/content.config.ts`, `fitness` collection, all optional)

- [ ] `exercises: {name, sets: {reps, weight, rpe?}[]}[]`
- [ ] `distanceKm: number`
- [ ] `paceMinPerKm: number`
- [ ] `elevationM: number`
- [ ] `heartRate: {avg, max, zones: {z1..z5: minutes}}`
- [ ] `bodyweightKg: number`

### Components

- [ ] `StatTileRow` — 3–4 KPI tiles per entry (volume/duration/avg HR/distance). Card-based, no new primitive.
- [ ] `TrainingHeatmap` — GitHub-style annual calendar heatmap of training days, colored by volume/type. Custom component + Tooltip primitive.
- [ ] `VolumeTrendChart` — weekly/monthly volume or pace trend. Use **shadcn Chart** (`npx shadcn add chart`, wraps Recharts v3) — it consumes the existing `--chart-1..5` oklch vars directly, unlike Tremor/visx which fight shadcn's theming.
- [ ] `ExerciseTable` — sets/reps/weight per exercise. Needs `npx shadcn add table`.
- [ ] `PRBadge` — auto-fires when an entry beats a prior best (computed from `exercises` or `paceMinPerKm`). Extend existing `Badge`.
- [ ] `HeartRateZoneBar` — time-in-zone stacked bar for cardio/hiit entries.
- [ ] `StreakCounter` — consecutive-day streak, derived from `pubDate` sequence across entries.
- [ ] `WorkoutTypeTabs` — filter `fitness/index.astro` by `workoutType`. Needs `npx shadcn add tabs`.

### Effects (tasteful, not SaaS-dashboard)

- [ ] Stat tiles count up from 0 on first scroll-into-view (one-time, `IntersectionObserver`)
- [ ] Heatmap cells fade/scale in with ~10–15ms stagger on first paint only
- [ ] `PRBadge` gets a single subtle pulse the first time it renders in view

---

## Clothing — archive-style catalog + detail page

**Status: detail page rebuilt (2026-07-22).** The original plan below (gallery carousel, rating, cost-per-wear, wear log, spec-table tabs) was superseded after design review — this is wardrobe archiving, not a shop, so selling/scoring mechanics (rating, purchase link, times-worn/cost-per-wear) were dropped entirely. Kept for history; see "What actually shipped" underneath.

### What actually shipped

- `src/content.config.ts` — `clothing` schema: removed `rating`, `purchaseUrl`; added `madeIn`, `purchasedDate`, `purchasePlace`, `measurements` (free-text line), `frontImage`/`backImage` (optional real photos), `story`, `storyQuote`, `care: string[]`, `hotspots: {view, x, y, label, description, image?}[]`
- `src/lib/materialColor.ts` — maps `category` → the `--material-*` CSS var pair, falls back to `--foreground`/`--secondary` for categories with no color yet (e.g. outerwear)
- `src/components/clothing/ConstructionFigure.astro` — front/back garment diagram (CSS clip-path silhouette, diagonal-texture placeholder or `frontImage`/`backImage` if provided) with clickable hotspot pins: hover → label tooltip, click → popover with description + detail-shot placeholder, click-elsewhere-to-close via a viewport-covering `<label>` backdrop (inert until a pin is open, so normal page clicks aren't intercepted). All radio-button CSS, zero JS. Front/Back switch only renders if both views actually have hotspots/images; whole component renders nothing if `hotspots` is empty.
- `src/components/clothing/QuickFacts.astro` — 3 tiles: purchased date / where / price paid (no rating, no times-worn)
- `src/components/clothing/DetailTabs.astro` — Overview (markdown body via slot) / The Story (frontmatter `story` + optional `storyQuote` pull-quote) / Care (frontmatter `care` bullet list). Tabs only render if their content exists (Story/Care are optional).
- `src/layouts/ClothingLayout.astro` — composes the above; category badge uses the material color
- Sample content: `daily-jacket.md` updated to new schema (outerwear, no material color, 2 front-only hotspots — demonstrates graceful fallback); `raw-indigo-5-pocket.md` added (denim, full 4+4 front/back hotspots — demonstrates the full feature)
- `astro.config.mjs` — added `vite.server.watch.ignored` for `.playwright-mcp/**` and image files, since QA screenshots dropped in the repo root were triggering Vite full-reloads during testing

### Not done / still open

- [ ] `CategoryFilterBar` on `clothing/index.astro` — category chips, still a plain list today
- [ ] Real photos — `frontImage`/`backImage`/hotspot `image` all fall back to a CSS texture placeholder; no image pipeline yet
- [ ] Popover auto-placement (`anchorFor` in `ConstructionFigure.astro`) is a simple quadrant heuristic — fine for 4–8 pins, may need real tuning once real photos change proportions
- [ ] Accessibility gap carried over from the approved mockup: no `aria-expanded`/live-region announcement when a popover opens or closes for screen reader users

---

## Reading experience — applies mainly to `posts`, selectively to `fitness`/`clothing`

Currently: `EntryLayout` is h1 + date + tag badges + `prose` typography, identical across all three collections.

### Patterns to add

- [ ] Reading time estimate — remark plugin (`reading-time` + `mdast-util-to-string`), all collections
- [ ] Sticky "on this page" TOC — `rehype-slug` + `remark-toc`; **posts only**, hide if <3 headings
- [ ] Tufte-style sidenotes — CSS-only checkbox-toggle margin notes from GFM footnotes; **posts only**
- [ ] Pull-quote / callout block — custom `<Callout>` component for key stats/claims; **posts only**
- [ ] Figure captions — `rehype-figure` (auto-wraps images using alt as caption); all collections
- [ ] `<details>`/`<summary>` collapsible sections for optional depth; all collections, native HTML
- [ ] Reading-progress bar — thin top bar, CSS `scroll-timeline`, no JS; all collections
- [ ] Inline stat-summary card for `fitness`/`clothing` — pulls frontmatter (pace/distance/price/fit) into a small card above the fold; **higher priority than TOC/sidenotes for these two collections** since entries are short and structured

### Explicitly avoid

Parallax, scroll-jacking, cascading/staggered reveal animations, autoplay, hover-triggered link previews, gradient/glassmorphism cards, gamified read-time badges.

---

## Priority order (as previously agreed)

1. ~~Theme foundation (color/typography)~~ — done
2. ~~Fitness `StatTileRow` + `TrainingHeatmap`~~ — done
3. ~~Clothing detail page~~ — done (hotspot diagram, not tabs+spec-table — see above)
4. Reading-experience components, starting with `posts` (TOC, reading-time, callout) — next up
