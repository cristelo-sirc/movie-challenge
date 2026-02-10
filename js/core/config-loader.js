/**
 * Config Loader
 *
 * Loads and provides access to the challenge configuration.
 * Also provides helper methods for working with config values.
 */

const ConfigLoader = (function () {
    'use strict';

    let config = null;
    let initialized = false;

    /**
     * Default configuration values (fallbacks)
     */
    const defaults = {
        name: "Challenge",
        shortName: "Challenge",
        itemType: "item",
        itemTypePlural: "items",
        data: {
            variableName: "ITEMS",
            totalCount: 100,
            idField: "id",
        },
        schema: {
            required: ["id", "title"],
            display: {
                image: "image",
                imageBaseUrl: "",
                title: "title",
                subtitle: "year",
                eraField: "year",
            },
            details: [],
        },
        eras: {
            field: "year",
            groups: [],
            default: null,
        },
        themes: {},
        gamification: {
            enableStreaks: true,
            enableRanks: true,
            enableMilestones: true,
            enableConfetti: true,
            ranks: [{ threshold: 0, name: "Beginner", emoji: "star" }],
            milestones: [10, 50, 100],
            backupReminderInterval: 100,
        },
        actions: {
            positive: { label: "Yes", pastTense: "completed", color: "#00ff9d", swipeIndicator: "YES" },
            negative: { label: "No", pastTense: "skipped", color: "#ff0055", swipeIndicator: "NO" },
        },
        storage: {
            key: "challenge_progress",
            debounceMs: 500,
            maxHistorySize: 100,
        },
        sharing: {
            hashtag: "#Challenge",
            url: null,
        },
        ui: {
            windowSize: 5,
            preloadAhead: 3,
            swipeThreshold: 100,
            rotationFactor: 0.1,
        },
    };

    /**
     * Deep merge two objects
     */
    function deepMerge(target, source) {
        const result = { ...target };

        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = deepMerge(target[key] || {}, source[key]);
            } else if (source[key] !== undefined) {
                result[key] = source[key];
            }
        }

        return result;
    }

    /**
     * Validate the configuration
     */
    function validate(cfg) {
        const errors = [];

        // Required top-level fields
        if (!cfg.name) errors.push("Missing required field: name");
        if (!cfg.itemType) errors.push("Missing required field: itemType");

        // Data configuration
        if (!cfg.data) {
            errors.push("Missing required field: data");
        } else {
            if (!cfg.data.variableName) errors.push("Missing required field: data.variableName");
            if (!cfg.data.totalCount || cfg.data.totalCount < 1) {
                errors.push("data.totalCount must be a positive number");
            }
        }

        // Schema configuration
        if (!cfg.schema) {
            errors.push("Missing required field: schema");
        }

        if (errors.length > 0) {
            console.error("Configuration validation errors:", errors);
            return false;
        }

        return true;
    }

    /**
     * Initialize the config loader
     * @param {Object} customConfig - Optional custom configuration to merge
     */
    function init(customConfig = null) {
        // Get config from window.ChallengeConfig or use provided config
        const baseConfig = customConfig || window.ChallengeConfig || {};

        // Merge with defaults
        config = deepMerge(defaults, baseConfig);

        // Validate
        if (!validate(config)) {
            console.warn("Using default configuration due to validation errors");
            config = deepMerge(defaults, {});
        }

        initialized = true;

        return config;
    }

    /**
     * Get the current configuration
     */
    function get() {
        if (!initialized) {
            init();
        }
        return config;
    }

    /**
     * Get a specific config value by path
     * @param {string} path - Dot-separated path (e.g., "data.totalCount")
     * @param {*} defaultValue - Default value if path not found
     */
    function getValue(path, defaultValue = undefined) {
        if (!initialized) init();

        const parts = path.split('.');
        let current = config;

        for (const part of parts) {
            if (current && typeof current === 'object' && part in current) {
                current = current[part];
            } else {
                return defaultValue;
            }
        }

        return current;
    }

    /**
     * Get the era for a given value (usually year)
     * @param {number} value - The value to check against era ranges
     * @returns {Object|null} The matching era or null
     */
    function getEraForValue(value) {
        if (!initialized) init();

        const eras = config.eras;
        if (!eras || !eras.groups || eras.groups.length === 0) {
            return null;
        }

        for (const era of eras.groups) {
            if (value >= era.min && value <= era.max) {
                return era;
            }
        }

        // Return default era if specified
        if (eras.default) {
            return eras.groups.find(e => e.id === eras.default) || null;
        }

        // Return last era as fallback
        return eras.groups[eras.groups.length - 1];
    }

    /**
     * Get the theme for an era
     * @param {string} eraId - The era ID
     * @returns {Object|null} The theme object or null
     */
    function getThemeForEra(eraId) {
        if (!initialized) init();

        return config.themes[eraId] || null;
    }

    /**
     * Get the items array from the global variable
     * @returns {Array} The items array
     */
    function getItems() {
        if (!initialized) init();

        const varName = config.data.variableName;
        return window[varName] || [];
    }

    /**
     * Get the total count from config
     * @returns {number}
     */
    function getTotalCount() {
        if (!initialized) init();
        return config.data.totalCount;
    }

    /**
     * Get the storage key
     * @returns {string}
     */
    function getStorageKey() {
        if (!initialized) init();
        return config.storage.key;
    }

    /**
     * Get the share URL (auto-detect if not configured)
     * @returns {string}
     */
    function getShareUrl() {
        if (!initialized) init();

        if (config.sharing.url) {
            return config.sharing.url;
        }

        // Auto-detect from current location
        if (typeof window !== 'undefined') {
            return window.location.origin + window.location.pathname;
        }

        return '';
    }

    /**
     * Format an item field for display
     * @param {*} value - The field value
     * @param {Object} fieldConfig - The field configuration from schema.details
     * @returns {string} Formatted string
     */
    function formatField(value, fieldConfig) {
        if (value === null || value === undefined) return '';

        switch (fieldConfig.format) {
            case 'rating_stars': {
                const rating = parseFloat(value) || 0;
                const fullStars = Math.floor(rating / 2);
                const halfStar = rating % 2 >= 1;
                return '★'.repeat(fullStars) + (halfStar ? '½' : '') + '☆'.repeat(5 - fullStars - (halfStar ? 1 : 0));
            }

            case 'minutes':
                return `${value}m`;

            case 'array_join':
                if (Array.isArray(value)) {
                    return value.join(', ');
                }
                return String(value);

            case 'text_truncate': {
                const maxLength = fieldConfig.maxLength || 300;
                const text = String(value);
                return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
            }

            case 'number':
                return Number(value).toLocaleString();

            default:
                return String(value);
        }
    }

    // Public API
    return {
        init,
        get,
        getValue,
        getEraForValue,
        getThemeForEra,
        getItems,
        getTotalCount,
        getStorageKey,
        getShareUrl,
        formatField,
        get isInitialized() { return initialized; },
    };
})();

// Export for ES modules if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigLoader;
}
