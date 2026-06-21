# Claude Development Notes

This document tracks AI-assisted development work on this project.

## Session: Poster Journal UI overhaul (Jun 2026) — v3.4.0

### Overview
Full UI/UX refresh into **Poster Journal**: a four-tab bottom-nav app
(Review · Diary · Decades · Settings) replacing the single-screen + pop-up-overlay
layout. The Stats screen is reborn as **Movie Diary**; the decade picker gains a
browsable per-decade detail page (top years with poster thumbs, recently seen,
milestone ticket, Continue). Mechanics — swipe engine, decade filter, share/QR
bit-array, completion states, year cards, gamification, storage — are UNCHANGED.
This is a presentation layer added on top of the existing engine, not a rewrite.

### How it works (key design decision)
`js/app.js` stays the controller for Review + all data actions + the decade filter +
backup/share + completion + year cards + gamification. A new **layer** sits on top:

- `js/ui-shell.js` owns the bottom-nav tab switching and RENDERS the new Diary and
  Decades (list + detail) screens, the Review progress ring, and the prev/next poster
  peeks — all computed from the SAME engine modules (SlidingWindow, StatsEngine,
  ItemManager, GamificationManager, ConfigLoader). It never writes progress.
- `js/app.js` got two additive, guarded hooks only: a `UIShell.onAppUpdate(data)` call at
  the end of `handleUpdate` (no-op when the shell is absent) and `window.AppBridge`
  ({ openDecadePicker, reviewDecade }). No swipe/filter/share/completion logic changed.
- The new markup (`index.v34.html`) keeps EVERY element id the engine binds (incl.
  vestigial hidden `#menuBtn`/`#closeModalBtn`/`#modalOverlay`) so app.js wires safely.
- Settings is a real tab holding the existing controls (same ids) plus relocated Sound +
  Share. The old Stats overlay is retired — Diary replaces it.

Movie DNA uses the accurate three-way split (Seen / Haven't Seen / Remaining); the donut
centre shows reviewed/total ("Complete"). "Recently seen" reads the chronological action
history, falling back to seen-in-decade when history is thin (e.g. after an import) — no
storage-format change. "Continue" on a decade detail sets the active filter to that decade
via the existing `setActiveEras()` path.

### Files
| File | Change |
|------|--------|
| `index.v34.html` | **New.** Tabbed shell (Review/Diary/Decades/Settings + decade-detail), ring header, labelled action buttons, bottom nav. Loads `styles.v34.css` + `js/ui-shell.js`; app-asset cache-bust `v=30`. Live `index.html` untouched. |
| `styles.v34.css` | **New.** Poster Journal design system as additive overrides over `styles.css`: tokens (off-black / warm-white / cinema-red / green / coral / amber), tab layout, bottom nav, ring, deck + side peeks + ambient wash, Diary, Decades list/detail, Settings, desktop + short-screen passes. |
| `js/ui-shell.js` | **New.** Nav + Diary + Decades(list/detail) + Settings stats + Review ring/peeks. Pure render over the existing engine. |
| `js/app.js` | **+** guarded `UIShell.onAppUpdate(data)` in `handleUpdate`; **+** `window.AppBridge` ({ openDecadePicker, reviewDecade }). No other logic changed. |

### Validation
- **node --check** clean on all touched JS.
- **JSDOM boot of the new app (26 checks):** full data load (~4,719); every engine-bound id
  present; no init error; Diary Movie DNA renders and numbers reconcile
  (seen + notSeen + remaining = total); timeline 46 bars; 5 chapters; 5 decade cards; decade
  detail (hero + milestone ticket + top years); Continue → Review with single-decade filter;
  Settings stats; decade-filter rewind intact; share-code round-trips.
- **JSDOM boot of legacy `index.html` (7 checks):** still boots/loads; old Stats overlay and
  decade picker still work — additive `app.js` edits cause no regression.

### Notes / Limitations
- `DataLoader.ASSET_VERSION` stays **27** (no data/chunk change); only the app-asset `?v=`
  is bumped to 30 on the new page.
- Shipped first as a **preview URL** (`index.v34.html`) alongside the unchanged live
  `index.html`; promotion to the default page is a follow-up one-line swap.
- Visual/pixel polish (exact spacing, side-peek motion, ambient intensity, small-phone
  contrast) is best confirmed in a real browser — logic and DOM wiring are covered by the
  tests above; HTML could not be rasterised in the build sandbox.

### Follow-up — Moments restyle (preview iteration)
Unified all transient feedback ("Moments") into the Poster Journal language and fixed
placement so nothing collides with the new header / tab bar:
- **Streak pill** — root cause of the misplaced "🔥" was the `.pj-review > *` rule
  overriding its `position:fixed`; restored via `body[data-pj] .streak-indicator` (higher
  specificity) + amber pill, serif count, tasteful hot/inferno escalation.
- **Stat drop & year takeover** — kept full-screen per request; recoloured from the
  per-decade `--theme-primary` to the fixed palette (cinema-red / amber) + Fraunces serif.
- **Filter notice / toast / backup-nudge / private-browsing** — repositioned to tuck under
  the header (top pills) or above the tab bar (bottom pills); off-black + palette accents.
- **Confetti** — retinted to the palette (1-line change in `gamification.js`).
All CSS-only overrides scoped to `body[data-pj]` (legacy page untouched). Re-verified:
26-check boot harness + a streak-fires check (count→3, unhidden) + node --check, all clean.
Preview asset cache-bust bumped `v=30`→`v=31`.

### Follow-up — Moment dismissal + performance
- **Stat drop & year takeover no longer auto-dismiss, and a stray in-flight tap can't
  close them.** Both gain a 700ms "arm" delay (a tap meant for the previous card is
  swallowed) and the "Tap to continue" hint fades in only once armed. The stat drop's 6s
  auto-dismiss was removed (now tap-only, matching the year card). The keyboard path also
  swallows the key during arming so it never rates the next card.
- **Performance:** Review ambient blur cut 62px→30px (smaller buffer, far less repaint per
  swipe); the bottom-nav `backdrop-filter` removed for a near-opaque background (kills
  scroll jank); takeover blurs trimmed (10/12→6/8px); prev/next peeks now load w185 not w342.
- Verified: 26-check boot harness + a 4-step stat-drop arming test + node --check, all clean.
  Preview cache-bust `v=31`→`v=32`. (app.js changes are shared but improve the legacy page identically.)

### Follow-up — Swipe removed + scrollable info card + stricter moment dismissal
- **Swipe-to-rate removed app-wide.** `renderCards` no longer attaches drag listeners
  (the handlers remain as dead code). Rating is via the Seen/Haven't-Seen/Undo buttons
  (and keys). This frees the flipped info card to scroll and removes the document-level
  touchmove work — a perf win the user could feel.
- **Info card scrolls.** First pass (overflow-y:auto on `.card-back`) still wouldn't scroll on
  iOS — WebKit refuses to scroll overflow inside a `rotateY()`/`preserve-3d` flip face. Fixed by
  dropping the 3D flip on `body[data-pj]` for a flat **opacity cross-fade** (`perspective:none`,
  `transform-style:flat`, `.card-inner` transform `none !important`, front/back toggled by opacity)
  and making `.card-back` a plain `display:block` block scroller. Synopsis truncation (300 chars)
  removed so the full overview shows. Tap (no drag) still flips back.
- **Stat drop & year takeover dismiss ONLY via their "Tap to continue" control** (now a real
  button), not a tap anywhere — so stray taps/scroll can't close them. Still armed-gated +
  no auto-dismiss. Year hint reworded "Tap anywhere"→"Tap to continue".
- Verified: 26-check boot harness + no-drag/full-synopsis/hint-only-dismiss checks +
  node --check, all clean. Cache-bust `v=32`→`v=33`. (Swipe removal/scroll fixes are scoped
  to the new page via `body[data-pj]`; the app.js no-drag change is shared but harmless on legacy.)

### Follow-up — Faster card turnover
The next card now renders **160ms** after a Seen/Haven't-Seen tap (was 300ms) on the Poster
Journal page, with the fly-off animation shortened to match (`0.4s`→`0.18s`, scoped to
`body[data-pj]`). Root cause was a deliberate timer paired to the swipe-off animation;
`StorageManager.save` is already debounced (500ms) and the card render is cheap, so neither
was touched (would not move the needle). Legacy page keeps its 300ms/0.4s. Cache-bust `v=34`→`v=35`.

## Session: Decade Selection + Stats Screen (Jun 2026) — v3.3.0

### Overview
Added a per-decade review filter, a per-decade tally, and a most-watched-years
ranking. Users tap the header decade badge to open a picker and turn each decade
on/off (1 to all). The card stream, counter, and progress bar are scoped to the
selected decades; a new dedicated Stats screen shows the full lifetime breakdown.

### How it works (key design decision)
The canonical movie list, saved `currentIndex`, and the QR/share bit-array are
**untouched**. Switched-off decades are *skipped* in every scan, exactly like
already-rated items. The decade selection is a personal view setting persisted in
localStorage only — it is **never** baked into share codes (verified: codes
round-trip identically and remain filter-agnostic; legacy v1 codes still import).

**Chronological re-add:** changing the selection rewinds to the *earliest unrated
item in the new selection*, so a decade you'd already scrolled past is picked up
again. A prominent top-center notice ("Showing 1980s — N left to review") fires on
every selection change so the jump is never a surprise. The year takeover card is
suppressed on the rewinding render.

**Scoped vs global:** HUD counter / progress bar / action-bar tallies are scoped
to the selection. Ranks, streaks, milestones, backup reminders, and the Settings
"Your Progress" totals stay **global** (lifetime) so filtering never costs rank.
Two completion states: "Decades complete!" (selection done, offers "Choose
Decades") vs the full "Challenge Complete!" (every movie rated).

### Files
| File | Change |
|------|--------|
| `js/stats-engine.js` | **+** `statsByEra()` (seen/notSeen/total/pct per decade) and `rankYears()` (most-watched years, desc). Pure + unit-tested. |
| `js/sliding-window.js` | Active-era skip logic (`isActive`/`isSelectable`); `setActiveEras()` with rewind-to-earliest; `getActiveEras()`; `isAllComplete()`; scoped **and** global fields in `getProgress()`; `activeEras` added to `getState()`; reset restores all decades. |
| `js/storage.js` | `activeEras` added to `defaultState` (null = all). Export/import paths unchanged. |
| `js/app.js` | Decade picker (open/build/toggle/apply), prominent `showFilterNotice()`, dedicated Stats screen render, scoped HUD vs global gamification, empty-selection + dual completion states, year-card suppression on filter change, manifest-derived `eraCounts`/`allEraIds`, keyboard Esc for new overlays. |
| `index.html` | Decade badge → button (label + caret); labeled **Stats** button (left cluster, accent + one-time pulse); decade picker overlay; Stats screen overlay; empty-selection state; "Choose Decades" completion button. Cache-bust `v=28`→`v=29`. |
| `styles.css` | Badge-as-button, accent Stats button + pulse hint, picker rows/toggles, stat bars, empty state, prominent `.filter-notice` banner, mobile HUD tightening (≤600px). |

### Validation
- **Node unit tests (28):** statsByEra/rankYears math; filtering, rewind, the
  chronological re-add case, scoped vs global progress, empty selection,
  isComplete vs isAllComplete.
- **JSDOM full-page boot (26):** real boot renders cards; picker opens with 5
  tallied rows; filter to 2020s (notice + scoped reset + stream switch); re-add
  1980s rewinds into the '80s; Stats screen renders; None → empty state.
- **Completion states (10):** "Decades complete!" + Choose Decades, resume on
  re-add, full "Challenge Complete!".
- **Share-code round-trip (6):** seen/notSeen/currentIndex round-trip; codes
  filter-agnostic; legacy v1 import intact.
- All `node --check` syntax checks pass; with all five decades on, behavior is
  identical to v3.2.0.

### Notes / Limitations
- Stats screen requires the full dataset (gated, like backup/share); the picker
  works mid-load (totals from manifest, rated counts may lag a beat while later
  chunks stream in, then self-correct).
- Chunk JSON is unchanged, so `DataLoader.ASSET_VERSION` stays `27`; only the app
  asset cache-bust (`?v=`) was bumped to `29`.
- Visual/touch polish (exact spacing on very small phones, animation feel) is best
  confirmed in a real browser; logic and DOM wiring are covered by the tests above.

## Session: Yearly Transition Card (Jun 2026) — v3.2.0

### Overview
Expanded the decade transition takeover into a per-year transition card. It now fires on each year change (1980→1981→…) and shows up to 3 movie/cinema fun facts about that year plus one famous quote from a film released that year. Color theming still changes by decade (unchanged).

### Files
| File | Change |
|------|--------|
| `data/year-facts.js` | **New.** `window.YEAR_FACTS` — per-year `{ facts:[…], quote:{text,film,who}|null }`. 1980–2025; each quote's film is verified to exist in that year's movie data. 2025 has no quote (none reliably verifiable post-cutoff). |
| `js/app.js` | Added `currentYear` + `shownYears` state; year-change trigger in `handleUpdate` (forward-only, not on first render/resume, no re-fire on undo); replaced `showDecadeToast` with `showYearCard` (renders facts + quote, tap-only dismiss). |
| `styles.css` | Added `.dt-year`, `.dt-facts`, `.dt-quote`, `.dt-hint`; card scrolls if taller than viewport. |
| `index.html` | Loads `data/year-facts.js`; cache-bust bumped `v=27`→`v=28`. |

### Notes / Limitations
- Card is **tap-only** (auto-dismiss removed) — ~46 taps per full pass by design.
- The decade *theme/color* change is untouched; only the takeover trigger moved decade→year.
- Facts are stable film history; 2024/2025 web-verified. Quote films auto-checked against dataset (45/45). Render + escaping tested across all 46 years.

## Session: Configuration System Implementation (Feb 2026)

### Overview
Transformed the movie challenge into a reusable template that can be adapted for other challenge types (books, music, games, etc.) through a centralized configuration system.

### New Files Added

| File | Purpose |
|------|---------|
| `config/challenge.config.js` | Central configuration defining all customizable aspects |
| `js/core/config-loader.js` | Loads, validates, and provides access to configuration |
| `js/core/item-manager.js` | Unified interface for working with items (movies, books, etc.) |

### Modified Files

| File | Changes |
|------|---------|
| `js/app.js` | Uses config system, ItemManager methods, error handling |
| `js/storage.js` | Uses config for storage keys and total counts |
| `js/sliding-window.js` | Renamed movies→items, uses config for settings |
| `js/theme-manager.js` | Loads themes from config |
| `js/gamification.js` | Loads ranks/milestones from config |
| `data/movies.js` | Added `window.MOVIES` assignment for global access |
| `index.html` | Updated script loading order |

### Bug Fixes
- **Button animation**: Fixed `lastElementChild` → `firstElementChild` (buttons were animating wrong card)
- **Syntax error**: Fixed escaped exclamation mark in movies.js
- **Hardcoded values**: Replaced hardcoded "movies", ".year", and "5000" with config references

### Configuration System

The `config/challenge.config.js` file controls:
- **Identity**: name, itemType, itemTypePlural
- **Data**: source variable name, total count, ID field
- **Schema**: display fields, detail fields, era grouping
- **Themes**: colors, fonts, patterns per era
- **Gamification**: ranks, milestones, streaks
- **Actions**: labels for seen/not seen buttons
- **Storage**: localStorage key, debounce settings
- **UI**: window size, swipe threshold

### Creating a New Challenge Type

1. Copy `config/challenge.config.js` and modify values
2. Create a new data file (e.g., `data/books.js`) with items array
3. Add `window.BOOKS = BOOKS;` at end of data file
4. Update `data.variableName` in config to match
5. Customize themes, ranks, and actions as needed

### Script Loading Order

Scripts must load in this order:
1. Libraries (lz-string, qrcode)
2. Configuration (challenge.config.js, config-loader.js)
3. Data (movies.js)
4. Core modules (item-manager.js, sliding-window.js, storage.js)
5. Feature modules (audio-manager.js, theme-manager.js, gamification.js)
6. Main application (app.js)
