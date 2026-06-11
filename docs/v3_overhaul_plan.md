# Movie Challenge — v3 Overhaul Plan (PROPOSAL — awaiting approval)

**Date:** June 11, 2026
**Goal:** Top-notch look, top-notch performance, and moment-to-moment feedback that keeps users curious about what comes next.
**Direction approved by Cris:** Premium base + era accents. All four anticipation features.

Work is split into three phases. Each ships separately with its own validation and changelog entry, so if something regresses we know exactly which phase caused it.

---

## Phase 1 — Data: Decade Split + Diet (v2.1.0)

### What
1. New build script (`scripts/build_chunks.js`) that converts `data/movies.js` (4.6MB, one blocking file) into:
   - 5 lean JSON files: `data/chunks/movies-1980s.json` … `movies-2020s.json`
   - A tiny `data/chunks/manifest.json` (per-decade counts, total, version)
2. **Field diet:** strip data the app never uses at runtime (`signals`, `score`, `popularity`, `vote_count`, `curation_source`, `original_language`). Add one new build-time field: `tier` (flags top ~5% most-voted movies as "iconic" — needed for Phase 3 rare cards). Original `movies.js` stays in the repo for the curation pipeline; only the app stops loading it.
3. New `js/core/data-loader.js`: reads the manifest, figures out which chunk(s) the user's saved position needs, fetches only those before showing the first card, then quietly loads the remaining decades in the background.
4. Quick win bundled in: `preconnect` to `image.tmdb.org` (missing today — every poster pays a connection-setup tax).

*(API key handling was completed separately on Jun 11: key moved to a gitignored `.tmdb_key` file, scripts updated to read it. Rotation declined — risk accepted by Cris. Key remains in old git history; optional history scrub available on request.)*

### Why
Today the page is blank until the entire 4.6MB parses — the single biggest first-impression killer, especially on mobile data. After this phase a new user downloads roughly **one-fifth of today's payload** before the first card appears (one lean decade chunk instead of everything).

### Risks (and how each is handled)
| Risk | Mitigation |
|---|---|
| **False "Challenge Complete!"** — the engine fires completion when it runs out of items; with partial data that triggers early | Add an "all chunks loaded" guard before completion can fire |
| Wrong progress totals while chunks load | Totals come from the manifest (4,721), never from the partially-loaded array |
| Order/position corruption — saved progress depends on item order staying identical | Build script verifies chunks concatenate to the *exact* same ID sequence as today's file; automated check, not eyeballing |
| Undo reaching into a not-yet-loaded decade | Undo only moves backward into already-loaded data; disabled edge handled gracefully |
| Stale cached chunks after future updates | Versioned via manifest + cache-busting params, same pattern the app already uses |

### Alternatives considered
- **Just strip fields, keep one file:** half the work, but still one big blocking parse. Half the win.
- **5 script tags instead of fetch:** simple, but all 5 still block the page like today. No real win.
- **Full PWA with service-worker caching:** the eventual end state, but a much bigger lift. Parked for later.
- **Chosen: JSON chunks + manifest + async loader** — best first-load improvement for moderate, well-contained complexity.

### Validation
- Build check: chunk ID sequence identical to original, count = 4,721
- New user on throttled "Fast 3G": first card visible with only chunk 1 fetched (verified in network log)
- Simulated veteran user (saved position ~#3,000): correct card, correct totals, no false completion
- Undo across a chunk boundary; QR export → wipe → import round-trip; full reset
- Decade theme switching still triggers correctly
- Before/after numbers recorded: transfer size + time-to-first-card

---

## Phase 2 — Visual Redesign: Premium Base + Era Accents (v3.0.0)

### What
**Typography.** Drop Press Start 2P, Rock Salt, and Orbitron entirely. One family (Inter, full weight range) with a real hierarchy — tight, confident headings; quiet metadata. Smaller font payload, no more costume changes.

**Color & surfaces.** Keep the dark cinema base but desaturate the neon. Each era gets one refined accent hue (80s magenta → 90s rust → 00s green → 10s blue → 20s violet) expressed only through: the progress bar, the era pill, button accents, and a soft ambient radial wash behind the cards. The neon grid and matrix overlays are removed; a single shared, barely-visible film-grain texture adds depth instead.

**Poster as hero.** The blurred movie-backdrop behind the card stack (currently desktop-only) extends to mobile — it's the cheapest way to make every screen feel rich and changes with each card, which feeds the "what's next" effect.

**Components.** Every emoji used as an icon (🔥💾📧💬📥🔗🎬) is replaced with the same SVG icon style the header already uses. Decade badge becomes a quiet pill. The two loud gradient banners (private browsing, backup reminder) merge into one consistent toast style. Action buttons get a weightier, tactile design with proper pressed states. Card back gets a cleaner hierarchy (title / meta chips / cast / synopsis).

**Motion.** Tuned spring feel on swipe release, subtle settle of the next card rising to the top, and refined flip timing. All animation stays on GPU-friendly transforms (no new layout work), and everything respects the system "reduce motion" setting.

### Why
The current look mixes four fonts, three glow systems, and emoji UI — that's the cheese. Premium feel comes from restraint: one type system, one accent at a time, and letting 4,721 pieces of professional poster art carry the visuals.

### Risks
- **Taste is subjective.** Mitigation: I'll deliver before/after screenshots (phone + desktop sizes, all five eras) for your sign-off *before* it merges. If you hate it, we iterate on screenshots, not on the live app.
- **Config contract.** Theme fonts/patterns live in `challenge.config.js` (used by the template system). The font/pattern keys become optional rather than removed, so future challenge types (books, music) still work.
- **Mobile backdrop performance.** Blur is expensive on weak phones; it ships behind a capability check and gets verified on a throttled CPU profile before release.

### Alternatives considered
- Single theme with no era expression: safer, but loses the app's one distinctive idea.
- Keep all five themed fonts but "do them better": rejected per your direction — highest effort, most likely to stay kitschy.

### Validation
- Screenshot matrix: 2 viewports × 5 eras × key screens (card, flip, modal, completion), reviewed by you
- Headless-browser smoke test of full swipe/flip/undo/settings flow after the CSS/HTML changes
- Contrast check on all text (WCAG AA), keyboard shortcuts re-verified
- Lighthouse before/after (performance + accessibility scores recorded in changelog)

---

## Phase 3 — Anticipation Layer (v3.1.0)

The psychology: variable rewards. If every swipe looks identical for 4,721 cards, boredom is guaranteed. If roughly 1 in 20 swipes produces *something* — a rare card, a personal stat, a transition moment — the next swipe always might.

### What
1. **Rare card moments.** "Iconic" tier movies (flag built in Phase 1) enter with a brief shine sweep, accent border, and a distinct sound. Rate-limited so back-to-back blockbusters don't spam the effect.
2. **Stat drops.** Every ~25 ratings, a special interstitial card slides in with one earned insight, computed locally from your own data: "That's your 3rd Kubrick," "1985: complete!", "You've seen 19 of the last 25," "12 away from Film Buff." Swipe to dismiss in any direction — it never records a rating, never touches undo history (this is explicitly unit-tested).
3. **Cinematic decade transitions.** The current small toast becomes a ~1.5s full-screen title card — era name, accent color wash, sound sting. Tap to skip instantly.
4. **Living streak + haptics.** The streak pill evolves through three visual stages (3 / 10 / 25), swipe effects escalate with it, and on supported phones a light vibration tick lands on each rating with a stronger pulse at milestones. *Known limitation: iPhones ignore the vibration API — Android-only. Everything else works everywhere.*

All of it honors the existing sound toggle and "reduce motion" setting.

### Risks
- **Annoyance over delight** if effects fire too often. All frequencies (rare-card cap, stat-drop interval) live in `challenge.config.js` so tuning is a one-line change, and we'll tune together after you play with it.
- **Interrupting flow.** Stat drops and transitions are always skippable with the same gesture you're already making.
- **State corruption.** Interstitials are the riskiest item — they sit inside the card stack but must be invisible to progress/undo/save. Dedicated tests cover rate → stat drop → undo sequences.

### Validation
- Unit tests for every stat function (director counts, year completion, rank distance) run in Node against fixture data
- Scripted play-through: 100+ ratings with interstitials enabled, then full state integrity check (counts, undo history, save/restore)
- Manual session on phone + desktop; reduced-motion and sound-off passes

---

## Sequencing, Versioning, Out of Scope

| Phase | Version | Ships |
|---|---|---|
| 1 — Data split + diet | v2.1.0 | First (invisible foundation; Phase 3 needs the `tier` field) |
| 2 — Visual redesign | v3.0.0 | Second, after screenshot sign-off |
| 3 — Anticipation layer | v3.1.0 | Third |

Each phase gets: changelog entry in `project_status.md`, cache-bust version bumps, and a post-ship audit (the outcome checks listed above, plus a regression pass on everything that previously worked).

**Explicitly out of scope** (parked, not forgotten): share-card image generation, daily mode, accounts/leaderboards.

**Resolved Jun 11:** TMDB key hidden (gitignored local file); rotation declined, risk accepted.
