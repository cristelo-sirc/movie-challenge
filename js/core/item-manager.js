/**
 * Item Manager
 *
 * Provides a unified interface for accessing and working with items (movies, books, etc.)
 * Abstracts away the data source and provides helper methods.
 */

const ItemManager = (function () {
    'use strict';

    let items = [];
    let itemsById = new Map();
    let initialized = false;

    /**
     * Initialize the item manager
     * Loads items from the configured data source
     */
    function init() {
        const config = ConfigLoader.get();
        const varName = config.data.variableName;

        // Get items from global variable
        items = window[varName] || [];

        // Build lookup map
        const idField = config.data.idField;
        items.forEach(item => {
            itemsById.set(item[idField], item);
        });

        initialized = true;

        return items;
    }

    /**
     * Get all items
     * @returns {Array}
     */
    function getAll() {
        if (!initialized) init();
        return items;
    }

    /**
     * Get an item by ID
     * @param {number|string} id
     * @returns {Object|undefined}
     */
    function getById(id) {
        if (!initialized) init();
        return itemsById.get(id);
    }

    /**
     * Get the total count of items
     * @returns {number}
     */
    function getCount() {
        if (!initialized) init();
        return items.length;
    }

    /**
     * Get the configured total count (from config, not actual data)
     * @returns {number}
     */
    function getConfiguredCount() {
        return ConfigLoader.getTotalCount();
    }

    /**
     * Get the image URL for an item
     * @param {Object} item
     * @returns {string}
     */
    function getImageUrl(item) {
        const config = ConfigLoader.get();
        const schema = config.schema.display;

        // Try primary image field, then fallback to 'poster' for backwards compatibility
        const path = item[schema.image] || item.poster_path || item.poster || item.image;

        if (!path) return '';

        // If it's already an absolute URL, return as-is
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path;
        }

        // Prepend base URL
        const baseUrl = schema.imageBaseUrl || '';
        return baseUrl + path;
    }

    /**
     * Get the title of an item
     * @param {Object} item
     * @returns {string}
     */
    function getTitle(item) {
        const config = ConfigLoader.get();
        const titleField = config.schema.display.title || 'title';
        return item[titleField] || 'Untitled';
    }

    /**
     * Get the subtitle of an item (e.g., year)
     * @param {Object} item
     * @returns {string}
     */
    function getSubtitle(item) {
        const config = ConfigLoader.get();
        const subtitleField = config.schema.display.subtitle || 'year';
        return item[subtitleField] || '';
    }

    /**
     * Get the era field value for an item (used for theming)
     * @param {Object} item
     * @returns {number|string}
     */
    function getEraValue(item) {
        const config = ConfigLoader.get();
        const eraField = config.schema.display.eraField || config.eras.field || 'year';
        return item[eraField];
    }

    /**
     * Get the era object for an item
     * @param {Object} item
     * @returns {Object|null}
     */
    function getEra(item) {
        const value = getEraValue(item);
        return ConfigLoader.getEraForValue(value);
    }

    /**
     * Get the era ID (string) for an item
     * @param {Object} item
     * @returns {string}
     */
    function getEraId(item) {
        const era = getEra(item);
        return era ? era.id : ConfigLoader.get().eras.default || '';
    }

    /**
     * Get the ID field value for an item
     * @param {Object} item
     * @returns {number|string}
     */
    function getId(item) {
        const config = ConfigLoader.get();
        const idField = config.data.idField || 'id';
        return item[idField];
    }

    /**
     * Get detail fields for card back display
     * @param {Object} item
     * @returns {Array} Array of { label, value, icon, format } objects
     */
    function getDetails(item) {
        const config = ConfigLoader.get();
        const detailConfigs = config.schema.details || [];

        return detailConfigs
            .map(detailConfig => {
                const value = item[detailConfig.field];
                if (value === null || value === undefined || value === '') {
                    return null;
                }

                return {
                    field: detailConfig.field,
                    label: detailConfig.label || '',
                    value: value,
                    formattedValue: ConfigLoader.formatField(value, detailConfig),
                    icon: detailConfig.icon || null,
                    format: detailConfig.format || 'text',
                    showValue: detailConfig.showValue || false,
                };
            })
            .filter(d => d !== null);
    }

    /**
     * Calculate era statistics for a set of item IDs
     * @param {Array} itemIds - Array of item IDs
     * @returns {Object} Map of era ID to count
     */
    function calculateEraStats(itemIds) {
        if (!initialized) init();

        const config = ConfigLoader.get();
        const stats = {};

        // Initialize all eras to 0
        config.eras.groups.forEach(era => {
            stats[era.id] = 0;
        });

        // Count items per era
        const idSet = new Set(itemIds);
        items.forEach(item => {
            if (idSet.has(getId(item))) {
                const eraId = getEraId(item);
                if (eraId in stats) {
                    stats[eraId]++;
                }
            }
        });

        return stats;
    }

    /**
     * Validate items against the schema
     * @returns {Object} { valid: boolean, errors: Array }
     */
    function validateItems() {
        if (!initialized) init();

        const config = ConfigLoader.get();
        const requiredFields = config.schema.required || ['id', 'title'];
        const errors = [];

        items.forEach((item, index) => {
            requiredFields.forEach(field => {
                if (item[field] === undefined || item[field] === null) {
                    errors.push(`Item at index ${index}: missing required field '${field}'`);
                }
            });
        });

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    // Public API
    return {
        init,
        getAll,
        getById,
        getCount,
        getConfiguredCount,
        getImageUrl,
        getTitle,
        getSubtitle,
        getEraValue,
        getEra,
        getEraId,
        getId,
        getDetails,
        calculateEraStats,
        validateItems,
        get isInitialized() { return initialized; },
    };
})();

// Export for ES modules if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ItemManager;
}
