
# 🎬 Poster Journal
[![Live Demo](https://img.shields.io/badge/demo-live-green.svg?style=for-the-badge&logo=github)](https://cristelo-sirc.github.io/movie-challenge/)

**A personal movie journal for the films you've seen.**
Poster Journal (repo: *movie-challenge*) is a local-first web app that helps you track your film history across **4,719 movies** spanning **1980–2025** — one poster at a time. No account, no tracking; everything lives in your browser.

## ✨ Features

### 📒 Poster Journal UI
A four-tab app with a bottom nav bar:

*   **Review** — the poster deck. Tap **Seen** or **Haven't Seen** to log a film (or use the keyboard: A / D / arrow keys; **Undo** reverses the last call). Previous/next posters peek in from the sides.
*   **Diary** — your "Movie DNA": seen / rated / remaining totals, strongest decade, top years, a 1980–2025 timeline, and decade-by-decade "chapters." Also holds your **Want to See** list.
*   **Decades** — browse each decade as a journal chapter (progress, counts, top years) and jump straight into reviewing just that decade.
*   **Settings** — sound toggle, decade filter, where-to-watch region, and backup/share.

### 🎞 The Card
*   **4,719 movies** — curated English-language hits, cult classics, and global crossover films (the curation method is in [`docs/curation_strategy.md`](docs/curation_strategy.md)).
*   **Info** — tap to flip the poster for the **synopsis, cast, and rating**.
*   **Watch** — tap for **where to watch** in the US, split honestly into **Free · Subscription · Rent · Buy** (data from TMDB/JustWatch). Movies with no listing link out to the live TMDB watch page.
*   **Save** — bookmark a film to your **Want to See** list, which then appears in the Diary.

### 🗓 Year Cards
Crossing into a new year shows a brief full-screen card with a few cinema facts from that year plus a famous quote from a film released that year. Tap to continue.

### 🎨 Subtle Decade Theming
The interface shifts a single accent color and a soft ambient glow as you move through the decades (magenta → amber → emerald → blue → violet), over a dark cinema base with light film grain. Restrained, not neon.

### 🔊 Immersive Audio
*   Synthesized sound effects generated in real time via the **Web Audio API** — a "ding" for Seen, a "thud" for Haven't Seen, fanfares for milestones.
*   Optional, with an on-screen mute toggle.

### 🎮 Gamification
*   **Streaks** — build a "Seen" streak (🔥) that escalates as it grows.
*   **Ranks** — level up from "Extra" to "Legend" as you rate more films.
*   **Milestones** — confetti when you hit 10, 50, 100+ seen.

### 💾 Backup & Sync
*   **Local first** — progress saves automatically to your browser.
*   **Cross-device** — export your progress as a **QR / share code** (compressed with LZString) and import it on another device. (Your Want-to-See list stays local and is preserved across imports.)

## 🛠 Tech Stack
*   **Core:** Vanilla JavaScript (ES6+), HTML5, CSS3, Web Audio API. Zero frameworks.
*   **Storage:** `localStorage` for persistence; `LZString` for compressed share codes.
*   **Performance:**
    *   Decade-chunked data loading — the first card appears after ~280 KB instead of ~1.4 MB; remaining decades stream in the background.
    *   Virtual "sliding window" rendering (only ~5 cards in the DOM at a time).
    *   Decoded image preloading for instant card turnover.

## 🚀 Deployment
Hosted on **GitHub Pages**.
*   **Live URL:** [https://cristelo-sirc.github.io/movie-challenge/](https://cristelo-sirc.github.io/movie-challenge/)
*   **Deploy:** Pushing to `main` triggers `.github/workflows/deploy.yml` (static deploy).
*   **Streaming refresh:** a separate daily Action (`.github/workflows/refresh-streaming.yml`) re-bakes US watch-provider data into `data/streaming-us.json`, using the repo secret `TMDB_KEY`.

## 💻 Run Locally
This is a static app — no build step. Since v2.1 the movie data loads over HTTP (decade chunks), so you need a local web server:

1.  Clone the repository.
2.  From the project folder, run a simple server, e.g. `python3 -m http.server`
3.  Open `http://localhost:8000`. (Opening `index.html` from disk no longer works.)

To run the regression tests: `npm install` then `npm test`.

## 👏 Credits
*   Movie data and streaming availability from [The Movie Database (TMDB)](https://www.themoviedb.org/) and JustWatch.
*   *This product uses the TMDB API but is not endorsed or certified by TMDB.*
