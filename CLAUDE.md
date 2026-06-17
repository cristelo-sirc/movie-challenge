# Claude Development Notes

This document tracks AI-assisted development work on this project.

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
