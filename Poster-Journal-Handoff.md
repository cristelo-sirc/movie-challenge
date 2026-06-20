# Handoff: Poster Journal UI Refresh

## Goal

Refresh the Movie Quiz app UI into a modern, poster-first experience called **Poster Journal**. Keep the app's existing mechanics intact: swipe/review cards, decade filtering, progress tracking, stats, backup/share, completion states, and year transition cards.

This is a UI/UX polish pass, not a data or storage rewrite.

## North Star

The app should feel like a modern personal movie journal:

- Poster art is the visual hero.
- The surrounding UI is quiet, cinematic, and touch-friendly.
- Stats becomes more emotionally engaging as **Movie Diary**.
- Theme should be consistent but not overdone.
- Avoid fake vintage overload, scrapbook clutter, neon excess, or decorative gimmicks.

## Core Direction

Use **Poster Journal** as the design concept:

- Off-black / graphite foundation.
- Warm white typography.
- Cinema red as the main brand accent.
- Fresh green for Seen/progress.
- Soft coral/red for Haven't Seen.
- Tiny amber/ticket accents only where useful.
- Subtle blurred poster-color ambience behind the main card.
- Light film grain or texture is okay, but keep it restrained.

## Screens To Update

### 1. Review Screen

Make the movie poster card feel larger and more premium.

- Poster remains centered and dominant.
- Improve top HUD hierarchy: progress, decade filter, diary/stats access.
- Make decade chip feel polished and tappable.
- Bottom action controls should feel more modern and ergonomic.
- Seen / Undo / Haven't Seen should be clear thumb targets.
- Avoid clutter around the card.

### 2. Stats Screen -> Movie Diary

Reframe the dedicated Stats screen as **Movie Diary**.

Use existing stats data, but present it as a personal movie profile:

- "Movie Diary" title.
- "Movie DNA" summary module.
- Seen total, rated total, remaining total.
- Strongest decade.
- Top years.
- 1980-2025 timeline/heat strip.
- Decade breakdowns as "chapters."
- Keep charts simple and readable.

Do not make this feel like a generic analytics dashboard.

### 3. Decade / Year Detail Feel

Where decade stats or picker rows appear, make them feel like journal chapters:

- Decade name.
- Completion/progress.
- Seen/not seen counts.
- Tiny poster/thumb strip if already feasible with loaded data.
- Continue/choose actions should be clear.

### 4. Completion / Empty States

Update completion states to match the new tone:

- "Challenge Complete!" and "Decades complete!" should feel celebratory but restrained.
- Empty decade selection should feel polished, not like an error page.

## File Scope

Likely files:

- `index.html`
- `styles.css`
- `js/app.js`

Only touch JS if needed for labels, markup structure, or Movie Diary rendering. Prefer CSS/HTML where possible.

If cache-busting changes are needed, bump app asset query from the current version. Do **not** change `DataLoader.ASSET_VERSION` unless data/chunk files change.

## Guardrails

Do not change:

- Canonical movie list.
- Saved `currentIndex`.
- Share/QR bit-array format.
- Import/export behavior.
- Decade filter persistence semantics.
- Existing global vs scoped progress logic.
- Year transition logic, except visual styling if needed.
- Tests' expected behavior unless the UI text intentionally changed.

Avoid:

- New dependencies.
- External asset downloads.
- Real movie poster assets beyond the existing app data.
- Heavy animations that hurt mobile performance.
- Over-theming with ticket stubs, scrapbook paper, or neon.

## Design Details

Suggested tokens:

- Background: `#080809`, `#101113`, `#18191c`
- Text: `#f7f1e8`, `#b8b1a8`, `#7f7971`
- Seen/progress: `#2fd18b`
- Haven't Seen: `#f0656f`
- Cinema red: `#c83f3f`
- Amber accent: `#d8a441`

UI feel:

- Cards/panels: mostly 8px radius or less.
- Main poster card can keep a larger radius.
- Use stronger spacing and visual hierarchy.
- Favor icon buttons with labels only where helpful.
- No visible instructional copy unless already part of the flow.

## Implementation Priorities

1. Modernize Review screen first.
2. Rebrand Stats as Movie Diary.
3. Improve decade picker/stat rows.
4. Polish completion and empty states.
5. Final mobile responsive pass.

## Acceptance Checklist

- Main review screen looks modern and poster-forward on mobile and desktop.
- Movie Diary feels personal, not generic.
- Decade filtering still works exactly as before.
- Share/import/export behavior unchanged.
- Full completion and decade completion states still work.
- No new dependencies.
- No data format changes.
- Existing tests pass.
- Run syntax checks for changed JS.
- Visually inspect narrow mobile width around 375px and desktop width.

## Product Judgment

If a design detail competes with the poster, remove it.

If a stat does not make the user feel progress or identity, simplify it.

The final app should feel more premium, more personal, and more current, without becoming a different product.
