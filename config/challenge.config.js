/**
 * Challenge Configuration
 *
 * This file defines all configurable aspects of the challenge.
 * To create a new challenge type (books, music, games, etc.),
 * copy this file and modify the values.
 */

const ChallengeConfig = {
    // ===== IDENTITY =====
    name: "Movie Challenge",
    shortName: "Movie Challenge",
    description: "Track your movie watching journey through films from 1980 to 2025",

    // Item terminology (used throughout the UI)
    itemType: "movie",
    itemTypePlural: "movies",

    // ===== DATA =====
    data: {
        // The global variable name where items are stored
        variableName: "MOVIES",
        // Total expected count (display fallback; the chunk manifest is the
        // source of truth and overrides this at load time)
        totalCount: 4719,
        // Field used as the unique identifier
        idField: "id",
        // Chunked data manifest (loaded by js/core/data-loader.js)
        manifestUrl: "data/chunks/manifest.json",
    },

    // ===== SCHEMA =====
    // Defines how items are displayed on cards
    schema: {
        // Required fields every item must have
        required: ["id", "title", "year"],

        // How to display the main card
        display: {
            // Field containing image path
            image: "poster_path",
            // Base URL for images (prepended to image field if not absolute URL)
            imageBaseUrl: "https://image.tmdb.org/t/p/w500",
            // Field shown as main title
            title: "title",
            // Field shown below title
            subtitle: "year",
            // Field used for era/decade calculation
            eraField: "year",
        },

        // Fields shown on card back (detail view)
        // format options: "rating_stars", "minutes", "array_join", "text_truncate", "number"
        details: [
            { field: "vote_average", label: "Rating", format: "rating_stars", showValue: true },
            { field: "runtime", label: "", format: "minutes", icon: "clock" },
            { field: "director", label: "", format: "text", icon: "director" },
            { field: "cast", label: "Cast", format: "array_join" },
            { field: "overview", label: "", format: "text_truncate", maxLength: 300 },
        ],
    },

    // ===== ERAS/GROUPING =====
    // How items are grouped into eras (for theming and stats)
    eras: {
        // Field to use for grouping
        field: "year",
        // Era definitions
        groups: [
            { id: "1980s", name: "1980s", displayName: "80's Synthwave", min: 1980, max: 1989 },
            { id: "1990s", name: "1990s", displayName: "90's Grunge", min: 1990, max: 1999 },
            { id: "2000s", name: "2000s", displayName: "Y2K Future", min: 2000, max: 2009 },
            { id: "2010s", name: "2010s", displayName: "Modern", min: 2010, max: 2019 },
            { id: "2020s", name: "2020s", displayName: "Neo Modern", min: 2020, max: 2029 },
        ],
        // Default era if item's year doesn't match any group
        default: "2020s",
    },

    // ===== THEMES =====
    // Visual themes for each era (v3.0: one premium design system, eras
    // express through a single refined accent + ambient tint — no font swaps)
    themes: {
        "1980s": {
            name: "1980s",
            displayName: "The 1980s",
            colors: {
                primary: "#e879f9",   // refined magenta
                secondary: "#22d3ee",
                accent: "#f0abfc",
                background: "#120a1d",
                surface: "#1c1229",
                cardGlow: "rgba(232, 121, 249, 0.22)"
            },
            pattern: "ambient"
        },
        "1990s": {
            name: "1990s",
            displayName: "The 1990s",
            colors: {
                primary: "#fbbf24",   // warm amber
                secondary: "#f87171",
                accent: "#fcd34d",
                background: "#15100c",
                surface: "#201813",
                cardGlow: "rgba(251, 191, 36, 0.20)"
            },
            pattern: "ambient"
        },
        "2000s": {
            name: "2000s",
            displayName: "The 2000s",
            colors: {
                primary: "#34d399",   // refined emerald
                secondary: "#22d3ee",
                accent: "#6ee7b7",
                background: "#0a120e",
                surface: "#131e18",
                cardGlow: "rgba(52, 211, 153, 0.20)"
            },
            pattern: "ambient"
        },
        "2010s": {
            name: "2010s",
            displayName: "The 2010s",
            colors: {
                primary: "#60a5fa",   // refined blue
                secondary: "#818cf8",
                accent: "#93c5fd",
                background: "#0a0e15",
                surface: "#131a24",
                cardGlow: "rgba(96, 165, 250, 0.20)"
            },
            pattern: "ambient"
        },
        "2020s": {
            name: "2020s",
            displayName: "The 2020s",
            colors: {
                primary: "#a78bfa",   // refined violet
                secondary: "#f472b6",
                accent: "#c4b5fd",
                background: "#0e0a16",
                surface: "#181222",
                cardGlow: "rgba(167, 139, 250, 0.20)"
            },
            pattern: "ambient"
        }
    },

    // ===== GAMIFICATION =====
    gamification: {
        // Enable/disable features
        enableStreaks: true,
        enableRanks: true,
        enableMilestones: true,
        enableConfetti: true,

        // Rank definitions (threshold = minimum items seen)
        ranks: [
            { threshold: 0, name: "Extra", emoji: "film" },
            { threshold: 100, name: "Supporting Actor", emoji: "theater" },
            { threshold: 500, name: "Lead Actor", emoji: "star" },
            { threshold: 1000, name: "Director", emoji: "camera" },
            { threshold: 2500, name: "Producer", emoji: "trophy" },
            { threshold: 4000, name: "Legend", emoji: "crown" },
        ],

        // Milestone thresholds (triggers celebration)
        milestones: [10, 50, 100, 250, 500, 1000, 1500, 2000, 2500, 3000, 3500],

        // Backup reminder interval (0 to disable)
        backupReminderInterval: 100,
    },

    // ===== ACTIONS =====
    // Labels for the two main actions
    actions: {
        positive: {
            label: "Seen",
            pastTense: "seen",
            color: "#00ff9d",
            swipeIndicator: "SEEN",
        },
        negative: {
            label: "Haven't Seen",
            pastTense: "not seen",
            color: "#ff0055",
            swipeIndicator: "NOPE",
        },
    },

    // ===== STORAGE =====
    storage: {
        // localStorage key for saving progress
        key: "movie_challenge_progress",
        // Save debounce delay in milliseconds
        debounceMs: 500,
        // Maximum undo history size
        maxHistorySize: 100,
    },

    // ===== SHARING =====
    sharing: {
        hashtag: "#MovieChallenge",
        // Will be auto-detected from window.location if not set
        url: null,
    },

    // ===== ANTICIPATION (v3.1) =====
    // Variable-reward layer: tune frequencies here
    anticipation: {
        // Show a personal "stat drop" insight card every N ratings (0 = off)
        statDropInterval: 25,
        // Minimum cards between iconic-movie entrance effects
        iconicMinGap: 8,
        // Vibration feedback on supported devices (Android; iPhones ignore it)
        haptics: true,
    },

    // ===== UI SETTINGS =====
    ui: {
        // Number of cards to render in the DOM
        windowSize: 5,
        // Number of cards ahead to preload images
        preloadAhead: 3,
        // Swipe threshold in pixels
        swipeThreshold: 100,
        // Card rotation factor during drag
        rotationFactor: 0.1,
    },
};

// Make config globally available
if (typeof window !== 'undefined') {
    window.ChallengeConfig = ChallengeConfig;
}

// Export for ES modules if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChallengeConfig;
}
