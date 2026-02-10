/**
 * Theme Manager - Dynamic Era-Based Theming
 * Changes the visual style based on the current item's era
 */

const ThemeManager = (function () {
    'use strict';

    let currentTheme = null;
    let currentEra = null;
    let themes = {};

    // Default theme definitions (used if config doesn't provide themes)
    const defaultThemes = {
        '1980s': {
            name: '1980s',
            displayName: "80's Synthwave",
            colors: {
                primary: '#00d4ff',      // Cyan (readable)
                secondary: '#ff00ff',    // Magenta
                accent: '#ffff00',       // Yellow
                background: '#1a0a2e',   // Dark Purple
                surface: '#2d1b4e',
                cardGlow: 'rgba(0, 212, 255, 0.4)'
            },
            font: "'Press Start 2P', monospace",
            pattern: 'grid'
        },
        '1990s': {
            name: '1990s',
            displayName: "90's Grunge",
            colors: {
                primary: '#8b0000',      // Dark Red
                secondary: '#2f4f4f',    // Dark Slate
                accent: '#daa520',       // Goldenrod
                background: '#1a1a1a',   // Near Black
                surface: '#2a2a2a',
                cardGlow: 'rgba(139, 0, 0, 0.4)'
            },
            font: "'Rock Salt', cursive",
            pattern: 'grunge'
        },
        '2000s': {
            name: '2000s',
            displayName: "Y2K Future",
            colors: {
                primary: '#00ff41',      // Matrix Green
                secondary: '#0080ff',    // Electric Blue
                accent: '#c0c0c0',       // Silver
                background: '#0a0a0f',   // Deep Black
                surface: '#1a1a2e',
                cardGlow: 'rgba(0, 255, 65, 0.3)'
            },
            font: "'Orbitron', sans-serif",
            pattern: 'matrix'
        },
        '2010s': {
            name: '2010s',
            displayName: "Modern",
            colors: {
                primary: '#1db954',      // Spotify Green
                secondary: '#5865f2',    // Discord Blurple
                accent: '#ffffff',       // White
                background: '#0a0a0a',   // True Black
                surface: '#1a1a1a',
                cardGlow: 'rgba(29, 185, 84, 0.3)'
            },
            font: "'Inter', sans-serif",
            pattern: 'minimal'
        },
        '2020s': {
            name: '2020s',
            displayName: "Neo Modern",
            colors: {
                primary: '#a855f7',      // Purple
                secondary: '#ec4899',    // Pink
                accent: '#06b6d4',       // Cyan
                background: '#09090b',   // Zinc-950
                surface: '#18181b',      // Zinc-900
                cardGlow: 'rgba(168, 85, 247, 0.3)'
            },
            font: "'Inter', sans-serif",
            pattern: 'gradient'
        }
    };

    /**
     * Load themes from config
     */
    function loadThemesFromConfig() {
        if (typeof ConfigLoader !== 'undefined' && ConfigLoader.isInitialized) {
            const config = ConfigLoader.get();
            if (config.themes && Object.keys(config.themes).length > 0) {
                themes = config.themes;
                return;
            }
        }
        // Fallback to default themes
        themes = defaultThemes;
    }

    /**
     * Get era ID for a given year using config
     */
    function getEraForYear(year) {
        if (typeof ConfigLoader !== 'undefined' && ConfigLoader.isInitialized) {
            const era = ConfigLoader.getEraForValue(year);
            if (era) return era.id;
        }
        // Fallback to hardcoded logic
        if (year >= 2020) return '2020s';
        if (year >= 2010) return '2010s';
        if (year >= 2000) return '2000s';
        if (year >= 1990) return '1990s';
        return '1980s';
    }

    /**
     * Get theme for a given year
     */
    function getThemeForYear(year) {
        const eraId = getEraForYear(year);
        return themes[eraId] || themes['2020s'] || Object.values(themes)[0];
    }

    /**
     * Get decade string for a year (alias for backwards compatibility)
     */
    function getDecadeForYear(year) {
        return getEraForYear(year);
    }

    /**
     * Apply theme CSS variables to document
     */
    function applyTheme(theme) {
        const root = document.documentElement;
        const body = document.body;

        // Set CSS custom properties
        root.style.setProperty('--theme-primary', theme.colors.primary);
        root.style.setProperty('--theme-secondary', theme.colors.secondary);
        root.style.setProperty('--theme-accent', theme.colors.accent);
        root.style.setProperty('--theme-background', theme.colors.background);
        root.style.setProperty('--theme-surface', theme.colors.surface);
        root.style.setProperty('--theme-card-glow', theme.colors.cardGlow);
        root.style.setProperty('--theme-font', theme.font);

        // Set data attribute for CSS selectors
        body.setAttribute('data-theme', theme.name);
        body.setAttribute('data-pattern', theme.pattern);

        currentTheme = theme;
    }

    /**
     * Update theme based on current item's year
     * Returns true if era changed
     */
    function updateForYear(year) {
        const newEra = getEraForYear(year);

        if (newEra !== currentEra) {
            const oldEra = currentEra;
            currentEra = newEra;

            const theme = themes[newEra];
            if (theme) {
                applyTheme(theme);
            }

            return { changed: true, from: oldEra, to: newEra, theme };
        }

        return { changed: false };
    }

    /**
     * Initialize with default theme
     */
    function init() {
        // Load themes from config
        loadThemesFromConfig();

        // Determine default era from config or fallback to first era
        let defaultEra = '1980s';
        if (typeof ConfigLoader !== 'undefined' && ConfigLoader.isInitialized) {
            const config = ConfigLoader.get();
            if (config.eras.groups && config.eras.groups.length > 0) {
                defaultEra = config.eras.groups[0].id;
            }
        }

        // Start with default theme
        const defaultTheme = themes[defaultEra] || Object.values(themes)[0];
        if (defaultTheme) {
            applyTheme(defaultTheme);
        }
        currentEra = defaultEra;
    }

    /**
     * Get current theme info
     */
    function getCurrentTheme() {
        return currentTheme;
    }

    /**
     * Get current era
     */
    function getCurrentEra() {
        return currentEra;
    }

    /**
     * Get current decade (alias for backwards compatibility)
     */
    function getCurrentDecade() {
        return currentEra;
    }

    // Public API
    return {
        init,
        updateForYear,
        getThemeForYear,
        getEraForYear,
        getDecadeForYear, // Alias for backwards compatibility
        getCurrentTheme,
        getCurrentEra,
        getCurrentDecade, // Alias for backwards compatibility
        get themes() { return themes; }
    };
})();
