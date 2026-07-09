# 🎬 Poster Journal — Project Status

| | |
|---|---|
| **Phase** | Live — maintenance & polish |
| **Version** | v3.9.0 |
| **Updated** | July 9, 2026 |
| **One-liner** | Local-first movie review app (Poster Journal) covering **4,719 films, 1980–2025**. Live on GitHub Pages; recent work has been a post-audit performance/correctness pass and UI polish. |
| **TMDB Key** | Local scripts read `.tmdb_key` (gitignored). CI streaming refresh reads the repo secret `TMDB_KEY`. |

> **Note:** The detailed, always-current development log lives in [`CLAUDE.md`](../CLAUDE.md). This file is the higher-level status, backlog, and changelog.

---

### Current Focus: Open items from the June 26 audit

The audit's performance findings and all 8 correctness bugs were resolved in v3.7.0 / v3.7.1. These items remain open:

| Priority | Item | Notes |
| :--- | :--- | :--- |
| **Medium** | **Accessibility** | Pinch-zoom is disabled (`user-scalable=no`); "Tap to continue" controls are non-focusable `div`s; modals lack focus-trap/restore; no `:focus-visible` styles; reduced-motion still waits the transition timer. |
| **Medium** | **Streaming refresh safety** | The daily refresh writes a partial `streaming-us.json` if only some API calls succeed — a transient outage could erase valid entries. Needs an all-or-nothing / minimum-coverage guard. |
| Low | **Deploy ships unused data** | Pages deploys the whole repo, including `data/movies.js` (4.6 MB) and `data/movies_raw.js` (6.0 MB) — source/raw files the app never loads (it loads the 2.7 MB chunks). Keep them in-repo for the build pipeline, but exclude from the deployed artifact. |
| Low | **Refresh uses the stale monolith** | The refresh script reads the 4,721-entry `movies.js` (2 duplicate IDs) instead of the canonical 4,719-item manifest/chunks. |
| Low | **CI doesn't run the tests** | The JSDOM harness is committed under `test/` and runs via `npm test`, but `deploy.yml` doesn't run it before publishing. |
| Low | **Maintainability** | Dead swipe-handling code still sits in `app.js`; some movie fields are hardcoded despite the config abstraction; HTML escaping is inconsistent (cast names/attributes interpolated raw — hardening, not an active exploit). |

Full audit: [`docs/archive/AUDIT-REPORT-2026-06-26.txt`](archive/AUDIT-REPORT-2026-06-26.txt).

---

<details>
<summary><strong>✅ Completed Features</strong></summary>

### App / UI
- **Start Here intro (v3.9):** a first-visit overlay explaining the app (rate the poster, explore via Info/Watch/Save, track patterns in Diary/Decades), with a "Go to Settings first" option. Shows once per device, reopenable anytime from Settings.
- **Poster Journal UI (v3.4):** four-tab app — Review · Diary · Decades · Settings — replacing the old single-screen + overlay layout.
- **Rating:** tap **Seen** / **Haven't Seen** (or A / D / arrow keys), with **Undo**. *(Swipe-to-rate was removed in v3.4.)*
- **The card:** **Info** flips to synopsis / cast / rating; **Watch** shows where-to-watch; **Save** bookmarks to Want to See.
- **Movie Diary (v3.4):** Movie DNA (seen / rated / remaining), strongest decade, top years, 1980–2025 timeline, decade chapters.
- **Decade filter (v3.3):** scope Review to chosen decades; per-decade tallies; most-watched-years ranking; share codes stay filter-agnostic.
- **Year transition cards (v3.2):** per-year fun facts + a verified in-dataset quote.
- **Premium redesign (v3.0):** one type system (Inter), one desaturated accent per decade + ambient wash, SVG icons (emoji-as-UI removed).
- **Anticipation layer (v3.1):** iconic-tier cards, periodic stat drops, escalating streaks, light haptics.

### Streaming & Watchlist (v3.5)
- **Where to watch (US):** Free / Subscription / Rent / Buy, baked daily at build time (no API key in the browser); live-TMDB link fallback.
- **Want to See:** one-tap poster bookmark + a Diary section. Local only — excluded from share codes, preserved across imports.

### Data & Performance
- **Curation:** 4,719 movies via the 3-layer strategy (Cable Canon + Cultural Reach Scorer + Global-Hit filter + dedup), enriched with director + top-5 cast.
- **Decade-chunked loading (v2.1):** first card after ~280 KB instead of ~1.4 MB; remaining decades stream in.
- **Sliding-window rendering:** ~5 cards in the DOM at once; decoded image preloading for instant turnover (v3.7).

### Persistence & Infra
- `localStorage` autosave; QR / share-code export-import (LZString).
- Gamification (streaks, ranks, milestone confetti); synthesized Web Audio SFX with mute.
- GitHub Pages deploy via Actions; daily streaming-refresh Action; committed JSDOM regression harness (`npm test`).

</details>

<details>
<summary><strong>🧠 Lessons Learned</strong></summary>

### Data Quality vs. Quantity
- **The "Deep Trawl" Trap:** broad `/discover/movie` searches return high volume but low metadata quality. A targeted enrichment pass (`/movie/{id}/credits`) is necessary for a high-value app.
- **The "Global Hit" Proxy:** `vote_count > 2000` is an effective proxy for foreign films that crossed into the mainstream (*Parasite*, *Spirited Away*) while excluding regional obscurities.

### UI Resilience
- Verify data-structure depth (`movie.credits.cast` vs `movie.cast`); components must handle missing metadata gracefully.

### Process
- **Duplicate page files drift.** Keeping `index.html` and `index.v34.html` "byte-identical by hand" caused two silent live-page bugs; consolidating to a single `index.html` (and committing the test harness) fixed the class of problem.
- **Parallel dev logs drift too.** `CLAUDE.md` is now the single canonical development log; this status file links to it instead of duplicating it.

</details>

<details>
<summary><strong>📋 Backlog / Future Ideas</strong></summary>

*Open audit items are tracked under **Current Focus** above.*

- **Share-card images** — generate social-media images of your stats.
- **User accounts** — optional cloud sync (currently local-first, no account).
- **Accessibility hardening** — see Current Focus (focus management, pinch-zoom, reduced-motion).

</details>

<details>
<summary><strong>📝 Changelog</strong></summary>

### Jun 27, 2026 — v3.8.1
- Want-to-See list groups into collapsible decade sections once it passes 5 films; sections default collapsed.

### Jun 27, 2026 — v3.8.0
- Bigger poster card; **Save / Watch / Info** controls aligned into one row; Diary "Want to See" auto-groups by decade.

### Jun 27, 2026 — v3.7.1
- Fixed 8 correctness bugs from the June 26 audit: off-screen keyboard ratings, year-card keyboard gating, "None" decade selection now persists, best-streak now saved, imports no longer wipe the watchlist, filtered sharing reports lifetime totals, and the backup backdrop closes on click.

### Jun 27, 2026 — v3.7.0
- Performance: next poster reveals immediately (the outgoing card animates off independently), an input guard prevents double-rating, decoded image preload, and streaming data isn't downloaded until Watch/Diary needs it.

### Jun 2026 — housekeeping
- Consolidated two duplicate page files to a single `index.html`; committed the JSDOM regression harness under `test/` (`npm test`).

### Jun 2026 — v3.6.0
- Streaming moved to a dedicated **Watch** button with a sectioned Free → Subscription → Rent → Buy panel.

### Jun 2026 — v3.5.1
- Wired streaming into the live `index.html` (v3.5.0's edits had only reached the preview file); decade-filter progress denominator now scopes correctly.

### Jun 2026 — v3.5.0 "Where to Watch + Want to See"
- US streaming availability (baked daily at build time — no API key in the browser) and a one-tap **Want to See** watchlist with a Diary section.

### Jun 2026 — v3.4.0 "Poster Journal"
- Full UI refresh into the four-tab app (Review · Diary · Decades · Settings); Stats became Movie Diary; swipe-to-rate removed in favor of tap/keyboard; the info card scrolls.

### Jun 2026 — v3.3.0 "Decade Selection"
- Per-decade review filter, per-decade tallies, and a most-watched-years ranking, plus a dedicated Stats screen. Share codes remain filter-agnostic.

### Jun 12, 2026 — v3.2.0 "Year by Year"
- The full-screen takeover now fires on every *year* change (~46 cards/pass) with up to 3 cinema facts + one verified in-dataset quote per year. Tap-only dismissal. Decade color theming unchanged.

### Jun 11, 2026 — v3.1.0 "Anticipation Layer"
- Iconic cards (gold ring + shine for top-5%-by-votes), periodic stat drops computed locally, cinematic decade transitions, escalating streak + haptics. All tunable in `challenge.config.js`.

### Jun 11, 2026 — v3.0.0 "Premium Redesign"
- One type system (Inter); each decade reduced to one desaturated accent + ambient wash (neon grids/matrix removed); blurred backdrop fixed and extended to mobile; emoji-as-UI replaced with SVG icons; reduced-motion support.

### Jun 11, 2026 — v2.1.0 "Decade Split"
- Movie data split into 5 per-decade JSON chunks + manifest, loaded async; first-load transfer dropped ~5× (1.4 MB → 280 KB gzipped). Removed 2 duplicate movies (total now **4,719**). Completion/backup guards while chunks load.

### Jun 11, 2026
- **Security:** TMDB key removed from docs; now a gitignored `.tmdb_key` file / `TMDB_API_KEY` env var. Key not rotated (accepted risk — read-only, no billing); remains in old git history.

### Feb 12, 2026
- Data enrichment (Director/Cast for all movies); foreign-language filter; Cast/Director shown on card back.

### Feb 11, 2026
- Popularity-bias analysis; drafted the Hybrid Curation strategy.

### Feb 3, 2026
- Fixed v2.0 bugs (Seen button, streak indicator, audio, 80s theme); GitHub Pages deployment live.

### Jan 29, 2026
- Launched v2.0: gamification, Time Travel theming, sliding-window card stack.

</details>

---

## 📂 Related Docs

- [Usage Guide](../README.md)
- [Curation Strategy](./curation_strategy.md)
- [Development Log (CLAUDE.md)](../CLAUDE.md)
- [Archive](./archive/) — finished proposals, design briefs, and the June 2026 audit.
