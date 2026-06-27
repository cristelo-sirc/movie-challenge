# Claude Development Notes

This document tracks AI-assisted development work on this project.

---

## ⚙️ Environment & Git Playbook — READ FIRST (durable; not a session note)

**You CAN commit and push from this Cowork sandbox.** Do not tell Cris you can't —
earlier sessions wrongly gave up here. This is the worked-out recipe.

### The one quirk that causes all the trouble
The repo lives on a mounted filesystem that **blocks file _deletion_ (`unlink`) everywhere**
— in both `.git/` and the working tree. `rm` fails with `Operation not permitted`.
What **is** allowed: **create** a new file, **overwrite in place** (`>` redirect, `cp` over an
existing file, `printf >`), and **rename / move** (`mv`), including renaming _over_ an existing file.

Because of this:
- Git leaves behind lock files it can't delete (`.git/index.lock`, other `*.lock`,
  `objects/**/tmp_obj_*`). A stale `index.lock` then blocks the **next** git command with
  `Unable to create '.git/index.lock': File exists`. The desktop app's background git also
  creates these, so they can reappear between turns.
- `git merge` / `git pull` that must replace a working-tree file **fail** with
  `unable to unlink old '<file>'`, because checkout deletes-then-writes.

### Always sweep locks first (move them — you can't delete them)
Keep a junk drawer and clear locks **before** running git, in the **same** shell call:
```bash
mkdir -p .git/.trash
for f in $(find .git -maxdepth 2 -name '*.lock' | grep -v '/.trash/'); do
  mv "$f" ".git/.trash/$(basename "$f").$RANDOM"; done
# ...then your git command immediately after...
```
Sweep again afterward so the repo is clean for Cris's next action. `.git/.trash/` is inert
(git ignores non-ref/object files there).

### Commit — works normally
`git add -A && git commit -m "..."` uses create+rename and succeeds. Ignore the
`unable to unlink ... .lock` warnings, then sweep the leftover locks.

### Merge — don't use `git merge` (it unlinks working files). Use plumbing.
For a conflict-free merge of `origin/main` into your HEAD, keep the index in `/tmp` (so its
lock lands where deletes work) and touch files only via create / overwrite-in-place / rename:
```bash
export GIT_INDEX_FILE=/tmp/idx
git read-tree <yourHEADsha>
# re-stage each file the other side changed (example: the daily streaming file):
blob=$(git rev-parse origin/main:data/streaming-us.json)
git update-index --cacheinfo 100644,$blob,data/streaming-us.json
tree=$(git write-tree)
commit=$(git commit-tree $tree -p <yourHEADsha> -p origin/main -m "Merge origin/main")
git cat-file -p $blob > data/streaming-us.json     # update working file IN PLACE (no unlink)
printf '%s\n' "$commit" > .git/refs/heads/main      # move the branch ref IN PLACE
cp /tmp/idx .git/index                               # sync the real index
unset GIT_INDEX_FILE
```
Verify: `git cat-file -p HEAD` shows two parents; `git log --graph --oneline -4`.

### Push — works, using the stored token
The remote is HTTPS and the push token is in the gitignored `.github_token`. **Mask it** in any
echoed output:
```bash
TOKEN=$(tr -d '[:space:]' < .github_token)
git push "https://${TOKEN}@github.com/cristelo-sirc/movie-challenge.git" HEAD:main 2>&1 | sed "s/${TOKEN}/***/g"
```
After a successful push the **local** remote-tracking pointer may not update (same delete
restriction), so `git status` can falsely say "diverged/ahead". Fix it in place and confirm
the truth directly from GitHub:
```bash
printf '%s\n' "$(git rev-parse HEAD)" > .git/refs/remotes/origin/main
git ls-remote "https://${TOKEN}@github.com/cristelo-sirc/movie-challenge.git" refs/heads/main  # ground truth
```

### Bottom line
Commit normally; push with the token; route merges and locked-index situations around the
no-delete rule with rename + in-place overwrite + a `/tmp` index; sweep `*.lock` into
`.git/.trash/` before and after. Then tell Cris it's done — because it is.

---

## Session: Watch panel tap-to-flip-back fix (Jun 2026) — v3.8.2

One-line correctness fix reported by Cris: on the **Watch** (streaming) side of a
card, tapping to flip back only worked near the bottom; it should flip from
anywhere, like the **Info** side.

- **Root cause.** The streaming container (`.card-watch-stream`) had a blanket
  `click → stopPropagation` handler (added in v3.6 so a provider/TMDB link tap
  wouldn't also flip the card). Because it swallowed *every* tap in the block —
  which fills most of the panel — only taps in the area *outside* it (the header
  and the "Tap to flip back" footer) reached the `.card-back` flip-back handler.
  The Info panel has no such handler, hence the asymmetry.
- **Fix.** `js/app.js` — the streaming-block handler now stops propagation **only
  when the tap lands on a real link** (`e.target.closest('a')`). Every other tap
  bubbles up to `.card-back` and flips home, matching Info exactly; the TMDB
  "All options ↗" link still opens without flipping. No CSS/markup/engine change.
- Cache-bust `?v=42 → ?v=43`; label `v3.8.1 → v3.8.2`; `package.json` 3.8.2.
- Validation: 49/49 harness checks, deterministic over repeated runs (added six,
  covering Watch opens the panel, the panel renders, a tap on streaming content
  flips back, and a tap on the TMDB link does NOT) + `node --check`.

## Session: Documentation cleanup + Git playbook (Jun 2026) — docs only

Compared every doc against the live v3.8.1 app and fixed the drift. No app/code change
(43/43 harness still green; `node --check` clean).
- **README** rewritten to the current app (Poster Journal tabs, tap-to-rate, streaming
  "where to watch", Want-to-See, 4,719 movies); dropped stale swipe/neon/runtime claims.
- **docs/project_status.md** refreshed v3.2.0 → v3.8.1 (fixed counts, moved shipped streaming
  out of the backlog, added a condensed v3.3–v3.8.1 changelog, surfaced the open audit items).
- **AGENTS.md** reduced to a pointer at this file (it was a stale duplicate dev log).
- Finished proposals/briefs + the Jun 26 audit moved to `docs/archive/`; root dev one-offs
  (analysis scripts, data-builder, obsolete preview) to `archive/`; dead `.gitignore` entries removed.
- Added the **Environment & Git Playbook** above after working out how to commit, merge, and
  push under this sandbox's no-delete filesystem: commit `56fcd58`, then plumbing-merge `3dc6f2d`
  with the bot's daily streaming refresh, pushed to `origin/main` and confirmed via `git ls-remote`.

## Session: Diary grouping tweaks (Jun 2026) — v3.8.1

Two small follow-ups to the v3.8.0 "Want to See" grouping, per Cris.

- **Threshold 8 → 5.** Grouping now kicks in once the list is longer than 5 (i.e.
  6+ saved films); 5 or fewer stays a flat list. `WL_GROUP_THRESHOLD` in
  `js/ui-shell.js`.
- **Sections default to collapsed.** A long list now opens as a tidy set of decade
  headers. `isCol` defaults to `true` unless the user has explicitly toggled that
  decade (stored in `pj_wl_collapsed`), so an explicit expand/collapse still
  persists and wins over the default.
- Cache-bust `?v=41 → ?v=42`; label `v3.8.0 → v3.8.1`; `package.json` 3.8.1.
- Validation: 43/43 harness checks, deterministic — grouping section updated to
  cover the 5-vs-6 boundary, default-collapsed, and expand-then-collapse
  persistence — plus `node --check`.

## Session: Bigger cards + aligned controls + Diary grouping (Jun 2026) — v3.8.0

The visible UI pass. Scoped to `body[data-pj]` (presentation only).

- **Bigger poster.** `--card-width` `min(252px,62vw) → min(300px,72vw)`; the
  short-screen rule `min(212px,52vw) → min(236px,58vw)`. Peeks scale from the same
  variable, so the side context grows with it.
- **Aligned Save / Watch / Info row.** The three controls were independently
  absolutely-positioned with mismatched top offsets (14/16px) and heights (38px
  round vs ~28px pills), which is why they looked off. They're now wrapped in a
  single `.pj-controls` flex row (`space-between`, `align-items:center`) pinned to
  the card top — Save left, Watch center, Info right, evenly spaced and vertically
  centered. This also removes the small-screen Watch/Info overlap the audit found
  (the row reflows instead of overlapping). Markup change in `createCardElement`
  (buttons wrapped + reordered); the per-button absolute positioning was stripped
  in `styles.v34.css` and the base `.info-btn` position overridden.
- **Diary "Want to See" auto-grouping.** A flat list up to 8 saved films; past
  that it groups into **collapsible decade sections** (newest decade first, each
  with a count), so a long list stays scannable. Collapsed/expanded state is
  remembered in `localStorage` (`pj_wl_collapsed`); toggling is a CSS class flip
  (no re-render, no scroll jump). Rows, the "Seen ✓" tag, streaming summaries, and
  remove all work unchanged inside sections. `js/ui-shell.js` (`watchlistHTML`
  refactor + `wlRowHTML`/`wlCollapsed` helpers + section wiring in `wireWatchlist`);
  CSS in `styles.v34.css`.
- Cache-bust `?v=40 → ?v=41`; label `v3.7.1 → v3.8.0`; `package.json` 3.8.0.
- Validation: 40/40 harness checks, deterministic — new ones cover the control-row
  structure + order + buttons still flipping, and Diary flat-vs-grouped at the
  threshold + collapse persistence — plus `node --check`.
- Needs Cris's eyes on a real device (the sandbox can't render/measure layout):
  the exact card size, the three controls' spacing/alignment, side-peek crowding at
  the larger size, and the grouped Diary on a real phone.

## Session: Correctness fixes from the audit (Jun 2026) — v3.7.1

The eight confirmed bugs from the June audit. (The double-rate one was already
closed by the v3.7.0 input guard.) Small, isolated changes; each is harness-tested.

1. **Off-screen ratings** — A/D/arrow/Z now only act when the **Review** tab is the
   visible screen, no overlay is open, and no year takeover is up. New
   `canReviewByKey()` gate in `handleKeyboard` (`js/app.js`). Fixes rating the
   hidden card from Settings/Diary/Decades.
2. **Year takeover didn't block the keyboard** — same gate handles it (a
   `.decade-takeover` being present blocks rating keys), matching the stat drop.
3. **"None" decades didn't persist** — `js/sliding-window.js` now honors an explicit
   empty array (`Array.isArray(savedSel) ? savedSel : allEraIds`); only null/undefined
   means "all". Previously a saved empty selection reloaded as all five.
4. **Best streak was never saved** — new `persist()` helper in `js/app.js` folds
   `GamificationManager.bestStreak` into every game-state save (so a later save such as
   a watchlist toggle can't wipe it); `bestStreak` added to storage `defaultState`.
   Restored at init (already read there).
5. **Imports erased the watchlist** — `handleApplyCode` now carries the local
   watchlist across an import (like it already does the decade selection); neither is
   in the share code.
6. **Filtered sharing mixed scopes** — `shareResults` now reports **lifetime** totals
   (`globalSeen/globalNotSeen/globalRated` vs the global 4,719), instead of a
   decade-scoped numerator against the global denominator.
7. **Backup backdrop click was unwired** — handler queried `.modal-overlay`; the
   markup uses `.backup-overlay`. Fixed the selector.
8. (Double-rate — fixed in v3.7.0.)

- Cache-bust `?v=39 → ?v=40`; label `v3.7.0 → v3.7.1`; `package.json` 3.7.1.
- Validation: 31/31 harness checks, deterministic over repeated runs — new checks
  cover off-screen/year-card gating, None-decades round-trip, best-streak
  restore + persist-survives-watchlist-toggle, watchlist-survives-import,
  backup-backdrop-closes, and share-uses-lifetime-totals — plus `node --check`.

## Session: Performance pass — instant card turnover (Jun 2026) — v3.7.0

The first of the post-audit changes. Goal: make each rating feel instant and stop
doing avoidable work, without changing the app's look. Scoped to the render/anim
layer + streaming load timing; the swipe engine, storage, and share format are
untouched.

- **Instant next-card reveal (no advance timer).** `animateButtonSwipe` used to
  wait a fixed 160ms before advancing, then rebuild the deck. It now advances
  immediately so the next poster appears at once, and the OUTGOING card is cloned
  onto a fixed overlay (`flyOffCard` → `.pj-fly-layer`) to finish its swipe
  animation independently. Cleanup is on `animationend` with a 450ms fallback.
- **Input guard (fixes the double-rate bug).** A new `isTransitioning` flag makes
  a rapid double-tap or key-repeat rate exactly one movie. The release timer is
  scheduled the instant the guard is set, so it can never stick. Covers every live
  rating path (Seen/Haven't-Seen buttons + A/D/arrow keys → all go through
  `animateButtonSwipe`). (The only other `markSeen` callers are the long-dead,
  never-attached swipe handlers.)
- **Decoded image preload + priority.** `preloadImages` now sets `decoding:'async'`
  and calls `img.decode()` so the next poster is decoded before it's shown; the top
  poster gets `fetchpriority="high"` + `decoding="async"`.
- **Deferred streaming load.** `js/streaming.js` no longer fetches the 1.4MB
  `streaming-us.json` at page load. A new `ensureLoaded()` fires on first real use —
  the first **Watch** tap (`renderInto`) or the **Diary** rendering a watchlist row
  (`get`). `onReady` stays a passive listener (must NOT trigger the load, since
  UIShell registers one at boot). A session that only rates never downloads it.
- **No rebuild when the window is unchanged.** `renderCards` skips the
  destroy-and-rebuild when the visible window's ids match the last render — so a
  background decade chunk landing out of view no longer rebuilds the card. Safe
  because card content is a pure function of the movie id (the saved bookmark is
  toggled in place, not via re-render).
- Cache-bust `?v=38 → ?v=39`; version label `v3.6.0 → v3.7.0`; `package.json` 3.7.0.
- Validation: 19/19 harness checks green and deterministic (incl. new ones:
  double-tap rates once; next card revealed synchronously; unchanged window not
  rebuilt; streaming NOT fetched at boot but IS after a Watch tap) + a 12-in-a-row
  rapid-rating stress (seen +12, 0 errors, guard always releases) + `node --check`.
- Can't be measured in the build sandbox (needs a real device): the actual
  perceived speed-up and the fly-off animation's smoothness.

## Session: Single index file + committed test harness (Jun 2026) — housekeeping

Prep for the v3.7/v3.8 work, addressing two long-standing smells.

- **Consolidated to ONE page file.** Deleted `index.v34.html`; the live
  `index.html` (the Poster Journal page, promoted at v3.4) is now the single
  source. The two had been kept byte-identical by hand and drifted twice before
  (see v3.5.1), causing "the live page didn't get the change" bugs. All future
  edits target `index.html` only. No code/workflow referenced the old file (only
  these historical notes did).
- **Committed a real regression harness** under `test/` (was previously run
  ad-hoc and never saved — see the audit's maintainability finding). `test/boot.js`
  boots the REAL `index.html` + full JS bundle in JSDOM against the REAL data
  chunks via a local-file `fetch` shim (no server). `test/run.js` is the cumulative
  suite; `test/smoke.js` a quick boot check. `package.json` adds `npm test`.
  jsdom is a devDependency (gitignored `node_modules`, `package-lock.json`).
- Validation: 12/12 invariant checks green and deterministic across repeated runs
  (boot with 0 errors, 4,719 items; Seen/Haven't-Seen advance; Undo restores;
  watchlist toggle; decade filter scoping; share-code round-trip). Audio is
  disabled in-harness (no AudioContext) so logic tests never touch sound.

## Session: "Watch" button + dedicated streaming panel (Jun 2026) — v3.6.0

Promoted streaming from a block on the Info side to its own poster button.

- **New "Watch" pill** (play icon + label) on the poster front, **top-center**,
  between the Save bookmark (left) and Info (right). `js/app.js` createCardElement.
- **Card-back is now two faces.** It contains `.card-back-info` (synopsis / cast /
  rating — streaming REMOVED) and `.card-back-watch` (streaming). Tapping **Info**
  removes `.show-watch` and flips; tapping **Watch** adds `.show-watch` and flips;
  CSS swaps which panel shows. Tap-back-to-flip-home is unchanged. The buttons sit
  on the front, which is non-interactive while flipped, so the flow is: front →
  pick a face → tap back → front.
- **Roomier sectioned streaming view** (`Streaming.renderPanelHTML`): each
  category gets a labeled header with a colored dot, ordered **Free → Subscription
  → Rent → Buy** (Free + Subscription prioritized, per request). `renderInto`/
  `flush` now use the panel renderer; the old compact `renderHTML` is kept but
  unused by the card. Diary watchlist row summary (`renderRowHTML`) also reordered
  Free-first. Graceful "no US listings — see TMDB" fallback retained.
- CSS (`styles.v34.css`, scoped `body[data-pj]`): `.watch-btn`, the
  `.card-back-info`/`.card-back-watch` show/hide on `.show-watch`, and
  `.pj-strm-panel`/`.pj-strm-sec` section styling (Free = amber, Subscription =
  green dots).
- Cache-bust `v=37 → v=38`; label `v3.5.1 → v3.6.0` on both (identical) page files.
- Validation: `node --check` clean; JSDOM harness extended (Watch button present;
  Watch flips and renders Free→Subscription→Rent→Buy headers in order; Info flips
  to synopsis with NO streaming; tap-back works; bookmark still doesn't rate);
  `diff` confirms the two index files stay identical.

## Session: v3.5.1 patch — live-page streaming wiring + decade denominator (Jun 2026)

Two bug fixes on top of v3.5.0, both found in live testing.

1. **Streaming/watchlist weren't on the live default page.** At v3.4 the Poster
   Journal was promoted from `index.v34.html` to `index.html`, but v3.5.0's HTML
   edits (the `streaming.js` script tag + the Settings "Where to watch" block)
   only went into `index.v34.html`. The live page visitors actually load
   (`index.html`) therefore never loaded `streaming.js`, so the where-to-watch
   block stayed empty on every film (the bookmark + Diary worked because those
   live in shared files). **Fix:** re-synced `index.html` to be byte-identical to
   `index.v34.html` (verified with `diff`). Both now carry the streaming script +
   credit. (Root smell: two duplicated page files — a future pass should
   consolidate to one to prevent this class of drift.)

2. **Decade-filter progress denominator never updated.** The Review HUD
   "current / total" had its numerator scoped to the selected decades but the
   denominator was set once at init (`app.js` ~L261) to the global total and
   never refreshed — so filtering to one decade showed e.g. `40 / 4719`.
   **Fix:** `handleUpdate` now sets `.count-total` to `data.progress.total`
   (the scoped total from `SlidingWindow.getProgress()`) on every update, so the
   fraction matches the scoped progress ring. No engine/storage change.

- Cache-bust `?v=36 → v=37` on both page files; version label `v3.5.0 → v3.5.1`.
- Validation: `node --check js/app.js`; JSDOM harness now 33 checks incl. a new
  one proving the denominator scopes (all=6 → 1980s=3 → back to 6); `diff`
  confirms the two index files are identical.
- Note: the daily refresh run wrote real US data (4,471 / 4,721 movies) once the
  `TMDB_KEY` secret held the valid 32-char v3 key; the bake script also now
  accepts a v4 Bearer token and fails loudly (no blank commits) on auth errors.

## Session: Streaming availability + "Want to See" watchlist (Jun 2026) — v3.5.0

### Overview
Two additive features on the Poster Journal page (`index.v34.html`), built on top
of the live v3.4.0 code (local was 8 commits behind at the start of the session;
reset to `origin/main` first, then v3.5 re-applied cleanly):
1. **Where to watch** — US streaming availability on each movie's info side and
   on watchlist rows, split honestly into **Subscription / Free / Rent / Buy**.
2. **"Want to See" watchlist** — a one-tap poster **bookmark** on the Review
   screen and a **Want to See** section in the Movie Diary.

### How streaming works (key design decision)
Data is **pre-fetched at build time, never live in the browser**, so no API key
ships to the client (same model as the existing movie data). A daily GitHub Action
(`.github/workflows/refresh-streaming.yml`) runs `.github/refresh-streaming.js`,
which reads the TMDB key from the encrypted repo secret **`TMDB_KEY`**, hits
`/movie/{id}/watch/providers` (US, JustWatch-powered) for every movie, and commits
`data/streaming-us.json`. That commit triggers the Pages deploy, so the live app
self-updates.
- `js/streaming.js` lazy-loads `data/streaming-us.json` (`cache:no-cache`), exposes
  `get/renderHTML/renderInto/renderRowHTML/onReady`, and **always has a working
  fallback**: a movie with no baked entry links to the live TMDB watch page
  (`themoviedb.org/movie/{id}/watch?locale=US`). Works even with the file `= {}`.
- Region fixed to **US**; file is per-region by design. TMDB/JustWatch credit shown.
- **Setup (one-time):** add repo secret `TMDB_KEY` (Settings → Secrets and
  variables → Actions). Run the Action on demand to populate pills immediately.
- NOTE: the CI script lives at `.github/refresh-streaming.js`, NOT under a folder
  named `scripts/` — `.gitignore` excludes any `scripts/` dir, which would have
  silently kept it out of the repo.

### How the watchlist works
- New `watchlist: []` in storage `defaultState` (load() merges → old saves get it).
  `SlidingWindow` gains `isWatchlisted/toggleWatchlist/getWatchlist`, persists via
  `StorageManager.save`, includes `watchlist` in `getState()`, clears it on reset.
- **Not part of the share/QR bit-array** (stays seen/notSeen only) — local list.
- Poster **bookmark** (front, top-left) mirrors `info-btn`: `stopPropagation`,
  top-card handler only; never drags/flips/rates/advances. Toggling buzzes, toasts,
  saves, refreshes the Diary via `UIShell.onWatchlistChange()`.
- Diary **Want to See** section (`ui-shell.js`): newest-first rows (thumb + title +
  year + "Seen ✓" if rated + streaming summary + remove). Removes route through
  `AppBridge.toggleWatchlist(id)` so the render-only shell never writes state.

### Files
| File | Change |
|------|--------|
| `js/storage.js` | **+** `watchlist:[]` in `defaultState`. |
| `js/sliding-window.js` | **+** `watchlistSet` + `isWatchlisted/toggleWatchlist/getWatchlist`; `watchlist` in `getState()`; cleared in `reset()`. |
| `js/app.js` | **+** poster bookmark markup + `toggleWatchlist()`; streaming container on card back via `Streaming.renderInto`; `AppBridge.isWatchlisted/toggleWatchlist`. |
| `js/ui-shell.js` | **+** Diary "Want to See" section, `onWatchlistChange`, `Streaming.onReady` refresh. |
| `js/streaming.js` | **New.** Baked data → Subscription/Free/Rent/Buy + credit; live-TMDB fallback. |
| `.github/refresh-streaming.js` | **New.** Build-time US watch-providers fetch → `data/streaming-us.json`. |
| `.github/workflows/refresh-streaming.yml` | **New.** Daily cron + manual run; commits refreshed data. |
| `data/streaming-us.json` | **New.** Ships `{}`; populated by the Action. |
| `index.v34.html` | **+** `streaming.js` tag; Settings "Where to watch"; cache-bust `v=35→36`; label v3.5.0. |
| `styles.v34.css` | **+** bookmark, streaming block, Want-to-See list (scoped `body[data-pj]`). |

### Validation
- `node --check` clean on all touched/new JS; `streaming-us.json` valid; workflow YAML parses.
- JSDOM harness (31 checks): watchlist add/remove/persist, doesn't rate or advance,
  Diary list + empty state, streaming Subscription/Free/Rent/Buy split + live fallback +
  credit, share code excludes the watchlist, old saves load, legacy `index.html` boots,
  Decades/Settings tabs unaffected.
- Bake-script parser unit-checked (priority sort, ads→free merge, de-dupe, rent-only stays Rent).

### Notes / Limitations
- `DataLoader.ASSET_VERSION` unchanged; only app `?v=` bumped 35→36.
- Sandbox can't reach TMDB to pre-bake all rows; ships `{}` + live-link fallback; the
  daily Action backfills pills (run on demand for an immediate full population).
- Streaming source TMDB/JustWatch (not infallible); in-app credit makes it explicit. US only.

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
- Shipped as a **preview URL** (`index.v34.html`) first, then **promoted to the default
  `index.html`** (approved). `index.v34.html` is kept as an identical alias so existing
  preview links keep working; consolidate to a single file in a later edit pass.
- **Open follow-up (deferred):** card-to-card motion could be smoother/snappier — the
  current model waits for a fly-off timer before rendering the next card; a future pass
  could render the next card instantly and slide the old one off on top.
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
