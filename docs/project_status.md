# 🎬 Movie Challenge — Project Status

| | |
|---|---|
| **Phase** | Implementation & Content Refinement |
| **Version** | v2.0 |
| **Updated** | February 11, 2026 |
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
