
# 🎬 Movie Challenge
[![Live Demo](https://img.shields.io/badge/demo-live-green.svg?style=for-the-badge&logo=github)](https://cristelo-sirc.github.io/movie-challenge/)

**Can you watch them all?**
A Tinder-style movie discovery app that challenges you to track your film history across **4,719 movies** spanning from 1980 to 2025.

## ✨ Features

### 🎞 Massive Dataset
*   **4,719 Movies:** Curated selection of English-language hits, cult classics, and award-winning international films.
*   **Rich Metadata:** Tap any card to flip it and see **Rating**, **Runtime**, and **Synopsis**.
*   **Decade Filtering:** Jump straight to the 80s, 90s, 2000s, 2010s, or 2020s.

### 🎨 Dynamic Themes
*   **Time Travel UI:** The interface transforms as you swipe through time.
    *   **1980s:** Neon Synthwave grid with magenta glow.
    *   **1990s:** Dark Grunge with distressed textures.
    *   **2000s:** Y2K Matrix digital aesthetic.
    *   **2010s/20s:** Modern, clean dark mode with vibrant gradients.

### 🔊 Immersive Audio
*   **Synthesized Sound Engine:** Custom sound effects generated in real-time using the **Web Audio API**.
*   **Feedback:** Satisfying "Ding" for Seen, "Thud" for Nope, and Fanfare for milestones.
*   **Toggle:** Optional sound with easy on-screen mute button.

### 🎮 Gamification
*   **Streaks:** Build up a "Seen" streak (🔥) to unlock fire animations and sounds.
*   **Ranks:** Level up from "Extra" to "Legend" as you rate more movies.
*   **Milestones:** Celebrate hitting 10, 50, 100+ movies seen with confetti explosions.

### 💾 Backup & Sync
*   **Local First:** All progress is saved automatically to your browser.
*   **Privacy Focused:** No account required. No tracking.
*   **Cross-Device Sync:** Export your progress as a **QR Code** to move from Desktop to Mobile instantly.

## 🛠 Tech Stack
Built for speed and simplicity using modern web standards.
*   **Core:** Vanilla JavaScript (ES6+), HTML5, CSS3, Web Audio API.
*   **Storage:** `localStorage` for persistence, `LZString` for compressed QR codes.
*   **Performance:**
    *   Zero frameworks (No React/Vue/Angular bloat).
    *   Decade-chunked data loading: the first card appears after ~280KB instead of ~1.4MB; remaining decades stream in the background.
    *   Virtual "Sliding Window" DOM rendering (renders only 5 cards at a time for 60fps performance).
    *   Smart image preloading.

## 🚀 Deployment
This project is automatically deployed/hosted via **GitHub Pages**.
*   **Live URL:** [https://cristelo-sirc.github.io/movie-challenge/](https://cristelo-sirc.github.io/movie-challenge/)
*   **Workflow:** Pushing to the `main` branch triggers a GitHub Action (`.github/workflows/deploy.yml`) that builds and deploys the static content.

## 💻 Run Locally
This is a static web application — no build step. Since v2.1 the movie data loads over HTTP (decade chunks), so you need a local web server:

1.  Clone the repository.
2.  Run a simple server from the project folder, e.g. `python3 -m http.server`
3.  Open `http://localhost:8000` in your browser. (Opening `index.html` directly from disk no longer works.)

## 👏 Credits
*   Movie Data provided by [The Movie Database (TMDB)](https://www.themoviedb.org/).
*   *This product uses the TMDB API but is not endorsed or certified by TMDB.*
