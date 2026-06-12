# 🎬 Movie Challenge — Project Status

| | |
|---|---|
| **Phase** | Implementation & Content Refinement |
| **Version** | v3.2.0 |
| **Updated** | June 12, 2026 |
| **One-liner** | Swipe-style movie tracker for 5,000+ films (1980–2025). Core app is live; now refining the movie list via Hybrid Curation. |
| **TMDB Key** | Stored locally in `.tmdb_key` (gitignored, never committed) |

---

### Current Sprint: Refinement & Polish

| Priority | Task | Status | Owner |
| :--- | :--- | :--- | :--- |
| **High** | **Foreign Language Filter** (Global Hits Only) | **Completed** | @Antigravity |
| **High** | **Data Enrichment** (Cast & Director) | **Completed** | @Antigravity |
| Medium | Verify Mobile Loading Fix | In Progress | @Antigravity |
| Low | Refine Income Viz | Planned | @Antigravity |

---

<details>
<summary><strong>✅ Completed Features</strong></summary>

- **Curation Strategy (v2.1):**
  - **Foreign Language Filter:** Strict `en` filter with exceptions for Global Hits (>2,000 votes).
  - **Data Enrichment:** Added Directors and Top 5 Cast for all 4,721 movies.
  - **3-Layer Curation:** Cable Canon + Cultural Reach Scorer + Dedup.
  - Final pool: **4,721 movies** (Quality > Quantity).
- **Core Game Loop:**
  - Swipe left/right logic (Tinder-style).
  - "Seen" / "Not Seen" / "Skip" actions.
  - Undo functionality with state restoration.

### UI / UX
- **Enriched Cards:** Back of card now shows Director and Cast.
- High-performance "Sliding Window" card stack (60 fps).
- Dynamic "Time Travel" theming (80s Synthwave → 2020s Modern).

### Data Persistence
- LocalStorage support for saving progress.
- QR Code export/import logic (cross-device sync).

### Gamification
- Streak tracking and "Fire" mode.
- Ranks and Milestone celebrations (Confetti).

### Infrastructure
- CI/CD pipeline via GitHub Actions.
- Automated generation scripts: `fetch` → `build` → `enrich`.

</details>

<details>
<summary><strong>🧠 Lessons Learned</strong></summary>

### Data Quality vs. Quantity
- **The "Deep Trawl" Trap:** Broad searches (`/discover/movie`) return high volume but low metadata quality (missing credits).
- **Solution:** A targeted "Enrichment" pass (`/movie/{id}/credits`) is necessary for high-value apps, even if it takes longer to run.

### Algorithmic Curation
- **Language Bias:** Raw popularity sorts bring in niche regional hits (e.g., French TV movies) that clutter a global "pop culture" list.
- **The "Global Hit" Proxy:** Using `vote_count > 2000` proved an effective proxy for identifying foreign films that crossed over into the mainstream (e.g., *Parasite*, *Spirited Away*).

### UI Resilience
- **Nested Data:** Always verify data structure depth (`movie.credits.cast` vs `movie.cast`).
- **Fail-safes:** UI components must gracefully handle missing metadata (null checks for Directors/Runtime).

</details>

<details>
<summary><strong>📋 Backlog / Future Ideas</strong></summary>

- **Share Features** — Generate social media images of stats.
- **Advanced Filtering** — Filter by streaming service (future API integration).
- **User Accounts** — Optional cloud sync (currently local-first).

</details>

<details>
<summary><strong>📝 Changelog</strong></summary>

### Jun 12, 2026 — v3.2.0 "Year by Year"
- **Yearly transition card:** the full-screen takeover now fires on every *year* change (1980→1981→…) instead of only at decade boundaries (~46 cards per full pass vs. 4). Color theming still changes by decade, unchanged.
- **Curated content:** new `data/year-facts.js` holds up to 3 movie/cinema fun facts per year (box-office milestones, Academy Awards) plus one famous quote drawn from a film **verified to exist in the dataset** for that year. 45 of 46 years have a quote; 2025 shows facts only (no famous in-dataset quote could be reliably verified post-knowledge-cutoff).
- **Dismissal:** tap-only (auto-dismiss removed) since there's more to read. Card scrolls if content exceeds the viewport.
- **Safeguards:** never fires on first render or on resume; fires forward-only; a `shownYears` set prevents re-firing when undoing back across a boundary. Renders gracefully when a year has no facts/quote.
- **Accuracy:** 2024/2025 facts web-verified (97th & 98th Academy Awards, box-office records). All 45 quotes auto-checked against per-year dataset titles; render + escaping tested across all 46 years (0 failures).
- Files: added `data/year-facts.js`; modified `js/app.js` (year trigger + `showYearCard`), `styles.css` (card layout), `index.html` (script load + cache-bust v=28).

### Jun 11, 2026 — v3.1.0 "Anticipation Layer"
- **Iconic cards:** top-5%-by-votes movies carry a quiet gold ring and enter with a one-time shine sweep + shimmer sound (rate-limited via `anticipation.iconicMinGap`).
- **Stat drops:** every 25 ratings (configurable), a dismissible insight card computed locally by new `js/stats-engine.js` — year completions, director counts ("That's your 3rd Kubrick"), decade-progress milestones, rank distance, recent seen-rate. Never touches ratings/undo/save state.
- **Cinematic decade transitions:** the small toast is now a brief full-screen era title card (tap to skip, auto-dismisses in 1.7s).
- **Living streak + haptics:** streak pill escalates at 10 (hot) and 25 (inferno); light vibration on each rating with stronger pulses at moments (Android — iPhones ignore the vibration API).
- All frequencies tunable in `challenge.config.js` → `anticipation`. Honors sound toggle and reduced-motion.
- Tests: `scripts/test_phase3.js` (13 stats-engine checks); Phase 1 harness still green (34/34).

### Jun 11, 2026 — v3.0.0 "Premium Redesign"
- **One type system:** Press Start 2P, Rock Salt, and Orbitron removed; Inter (400–800) everywhere. Smaller font payload, no costume changes between decades.
- **Era theming refined:** each decade is now one desaturated accent color + a soft ambient radial wash (magenta / amber / emerald / blue / violet). Neon grids and matrix overlays removed; subtle shared film-grain layer added.
- **Poster as hero:** blurred movie-backdrop atmosphere layer now works (it was silently broken) and extends to mobile, sized per device (w300/w780).
- **Emoji purge:** all emoji-as-UI replaced with consistent SVG icons (streak flame, backup, share buttons, completion clapperboard); toasts are clean text. Share text keeps its emojis on purpose.
- **Component polish:** quiet era pill, glassy action buttons, layered card shadows, taller smoother poster scrim, refined swipe indicators, card-settle entrance animation, de-glowed progress bar, refreshed confetti palette.
- **Accessibility:** prefers-reduced-motion now disables decorative animation.

### Jun 11, 2026 — v2.1.0 "Decade Split"
- **Performance:** Movie data split into 5 per-decade JSON chunks + manifest (`data/chunks/`), loaded asynchronously by new `js/core/data-loader.js`. First-load transfer drops ~5x (1.4MB → 280KB gzipped); page no longer blocks on a 4.5MB script.
- **Data diet:** Stripped 8 unused fields from runtime data (4.53MB → 2.66MB total); added `tier: "iconic"` flag (top 5% by votes) for the upcoming v3.1 anticipation features.
- **Bug fix:** Removed 2 duplicate movies (Ice Age 3, Transformers: Rise of the Beasts) that appeared twice in a row and made 100% completion mathematically impossible. Total is now 4,719.
- **Safety guards:** completion can't fire while chunks are loading; QR backup/export/import/share wait for full data with a friendly toast; "Loading more movies..." state if a fast swiper reaches the loaded edge.
- **Known change:** local dev now requires a simple web server (`python3 -m http.server`) — file:// no longer works. Progress codes exported before v2.1 may import with minor misalignment for 2010s/2020s titles (2 removed duplicates shifted positions); current-user localStorage progress is unaffected (ID-based).
- Build pipeline: `scripts/build_chunks.js` (regenerates chunks + verifies ID-sequence integrity); `scripts/test_phase1.js` (34-check integration harness).

### Jun 11, 2026
- **Security:** Removed TMDB API key from docs. Key now lives in a gitignored `.tmdb_key` file; all local scripts read it from there (or the `TMDB_API_KEY` environment variable). Decision: key not rotated (accepted risk — read-only, no billing). Note: key remains visible in old git history.

### Feb 12, 2026
- **Data Enrichment:** Fetching Director/Cast for all movies.
- **Foreign Filter:** Excluded ~1,500 non-English obscurities; kept Global Hits.
- **UI Update:** Displaying Cast/Director on card back.

### Feb 11, 2026
- Completed popularity-bias analysis of existing movie list.
- Drafted Hybrid Curation strategy.

### Feb 3, 2026
- Fixed v2.0 bugs (Seen button visibility, streak indicator, audio, 80s theme).
- GitHub Pages deployment live via Actions.

### Jan 29, 2026
- Launched v2.0: gamification (streaks, ranks, milestones), Time Travel theming, sliding window card stack.

</details>

---

## 📂 Related Docs

- [Usage Guide](../README.md)
- [Curation Strategy](./curation_strategy.md)
