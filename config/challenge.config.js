/**
 * Challenge Configuration
 *
 * This file defines all configurable aspects of the challenge.
 * To create a new challenge type (books, music, games, etc.),
 * copy this file and modify the values.
 */

const ChallengeConfig = {
    // ===== IDENTITY =====
    name: "5000 Movie Challenge",
    shortName: "Movie Challenge",
    description: "Track your movie watching journey through 5,000 films from 1980 to 2025",

    // Item terminology (used throughout the UI)
    itemType: "movie",
    itemTypePlural: "movies",

    // ===== DATA =====
    data: {
        // The global variable name where items are stored
        variableName: "MOVIES",
        // Total expected count (used for progress display)
        totalCount: 5000,
        // Field used as the unique identifier
        idField: "id",
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
    // Visual themes for each era
    themes: {
        "1980s": {
            name: "1980s",
            displayName: "80's Synthwave",
            colors: {
                primary: "#00d4ff",
                secondary: "#ff00ff",
                accent: "#ffff00",
                background: "#1a0a2e",
                surface: "#2d1b4e",
                cardGlow: "rgba(0, 212, 255, 0.4)"
            },
            font: "'Press Start 2P', monospace",
            pattern: "grid"
        },
        "1990s": {
            name: "1990s",
            displayName: "90's Grunge",
            colors: {
                primary: "#8b0000",
                secondary: "#2f4f4f",
                accent: "#daa520",
                background: "#1a1a1a",
                surface: "#2a2a2a",
                cardGlow: "rgba(139, 0, 0, 0.4)"
            },
            font: "'Rock Salt', cursive",
            pattern: "grunge"
        },
        "2000s": {
            name: "2000s",
            displayName: "Y2K Future",
            colors: {
                primary: "#00ff41",
                secondary: "#0080ff",
                accent: "#c0c0c0",
                background: "#0a0a0f",
                surface: "#1a1a2e",
                cardGlow: "rgba(0, 255, 65, 0.3)"
            },
            font: "'Orbitron', sans-serif",
            pattern: "matrix"
        },
        "2010s": {
            name: "2010s",
            displayName: "Modern",
            colors: {
                primary: "#1db954",
                secondary: "#5865f2",
                accent: "#ffffff",
                background: "#0a0a0a",
                surface: "#1a1a1a",
                cardGlow: "rgba(29, 185, 84, 0.3)"
            },
            font: "'Inter', sans-serif",
            pattern: "minimal"
        },
        "2020s": {
            name: "2020s",
            displayName: "Neo Modern",
            colors: {
                primary: "#a855f7",
                secondary: "#ec4899",
                accent: "#06b6d4",
                background: "#09090b",
                surface: "#18181b",
                cardGlow: "rgba(168, 85, 247, 0.3)"
            },
            font: "'Inter', sans-serif",
            pattern: "gradient"
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
        milestones: [10, 50, 100, 250, 500, 1000, 2000, 3000, 4000, 5000],

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
        hashtag: "#5000MovieChallenge",
        // Will be auto-detected from window.location if not set
        url: null,
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
