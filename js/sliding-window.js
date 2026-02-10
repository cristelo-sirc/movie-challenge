/**
 * Sliding Window Engine
 *
 * Manages a virtualized view of items to prevent memory issues.
 * Only a small "window" of cards is rendered to the DOM at any time.
 */

const SlidingWindow = (function () {
    // Configuration - will be loaded from config
    let WINDOW_SIZE = 5;          // Number of cards to render at once
    let PRELOAD_AHEAD = 3;        // How many cards ahead to preload images
    let HISTORY_MAX_SIZE = 100;   // Max undo history

    // State
    let items = [];                  // Full item list (movies, books, etc.)
    let currentIndex = 0;            // Current position in the list
    let seenSet = new Set();         // Fast lookup for seen items
    let notSeenSet = new Set();      // Fast lookup for not-seen items
    let history = [];                // Action history for undo

    // Callbacks
    let onUpdate = null;
    let onComplete = null;

    /**
     * Load configuration values
     */
    function loadConfig() {
        if (typeof ConfigLoader !== 'undefined' && ConfigLoader.isInitialized) {
            const config = ConfigLoader.get();
            WINDOW_SIZE = config.ui.windowSize;
            PRELOAD_AHEAD = config.ui.preloadAhead;
            HISTORY_MAX_SIZE = config.storage.maxHistorySize;
        }
    }

    /**
     * Initialize the sliding window with item data and saved state
     * @param {Array} itemList - Full list of items (movies, books, etc.)
     * @param {Object} savedState - State from StorageManager
     * @param {Object} callbacks - { onUpdate, onComplete }
     */
    function init(itemList, savedState, callbacks) {
        // Load config values
        loadConfig();

        items = itemList;
        currentIndex = savedState.currentIndex || 0;
        seenSet = new Set(savedState.seen || []);
        notSeenSet = new Set(savedState.notSeen || []);
        history = savedState.history || [];

        onUpdate = callbacks.onUpdate || (() => { });
        onComplete = callbacks.onComplete || (() => { });

        // Skip already-rated items to find the real current position
        while (currentIndex < items.length && isRated(getItemId(items[currentIndex]))) {
            currentIndex++;
        }

        triggerUpdate();
    }

    /**
     * Get the ID of an item using config
     */
    function getItemId(item) {
        if (typeof ConfigLoader !== 'undefined' && ConfigLoader.isInitialized) {
            const config = ConfigLoader.get();
            return item[config.data.idField];
        }
        return item.id;
    }

    /**
     * Check if an item has been rated
     * @param {number|string} id - Item ID
     * @returns {boolean}
     */
    function isRated(id) {
        return seenSet.has(id) || notSeenSet.has(id);
    }

    /**
     * Get the current window of items to display
     * @returns {Array} Items in the current window
     */
    function getWindow() {
        const windowItems = [];
        let idx = currentIndex;

        // Collect unrated items for the window
        while (windowItems.length < WINDOW_SIZE && idx < items.length) {
            const item = items[idx];
            if (!isRated(getItemId(item))) {
                windowItems.push({
                    ...item,
                    index: idx
                });
            }
            idx++;
        }

        return windowItems;
    }

    /**
     * Get items to preload (for image prefetching)
     * @returns {Array} Item objects to preload
     */
    function getPreloadQueue() {
        const queue = [];
        let idx = currentIndex;
        let count = 0;

        while (count < WINDOW_SIZE + PRELOAD_AHEAD && idx < items.length) {
            const item = items[idx];
            if (!isRated(getItemId(item))) {
                queue.push(item);
                count++;
            }
            idx++;
        }

        return queue;
    }

    /**
     * Mark the current item as seen
     */
    function markSeen() {
        const currentItem = getCurrentItem();
        if (!currentItem) return false;

        const itemId = getItemId(currentItem);
        seenSet.add(itemId);
        history.push({ id: itemId, action: 'seen' });
        trimHistory();
        advanceToNext();

        return true;
    }

    /**
     * Mark the current item as not seen (skip)
     */
    function markNotSeen() {
        const currentItem = getCurrentItem();
        if (!currentItem) return false;

        const itemId = getItemId(currentItem);
        notSeenSet.add(itemId);
        history.push({ id: itemId, action: 'notSeen' });
        trimHistory();
        advanceToNext();

        return true;
    }

    /**
     * Undo the last action
     * @returns {boolean} Whether undo was successful
     */
    function undo() {
        if (history.length === 0) return false;

        const lastAction = history.pop();

        if (lastAction.action === 'seen') {
            seenSet.delete(lastAction.id);
        } else {
            notSeenSet.delete(lastAction.id);
        }

        // Find the index of the item we just un-rated
        const itemIdx = items.findIndex(m => getItemId(m) === lastAction.id);
        if (itemIdx !== -1 && itemIdx < currentIndex) {
            currentIndex = itemIdx;
        }

        triggerUpdate();
        return true;
    }

    /**
     * Get the current (top) item
     * @returns {Object|null}
     */
    function getCurrentItem() {
        let idx = currentIndex;
        while (idx < items.length) {
            const item = items[idx];
            if (!isRated(getItemId(item))) {
                return { ...item, index: idx };
            }
            idx++;
        }
        return null;
    }

    // Alias for backwards compatibility
    function getCurrentMovie() {
        return getCurrentItem();
    }

    /**
     * Advance to the next unrated item
     */
    function advanceToNext() {
        currentIndex++;

        // Skip any already-rated items
        while (currentIndex < items.length && isRated(getItemId(items[currentIndex]))) {
            currentIndex++;
        }

        triggerUpdate();

        // Check for completion
        if (currentIndex >= items.length || !getCurrentItem()) {
            onComplete(getState());
        }
    }

    /**
     * Trim history to max size
     */
    function trimHistory() {
        if (history.length > HISTORY_MAX_SIZE) {
            history = history.slice(-HISTORY_MAX_SIZE);
        }
    }

    /**
     * Get the current state for saving
     * @returns {Object}
     */
    function getState() {
        return {
            currentIndex,
            seen: Array.from(seenSet),
            notSeen: Array.from(notSeenSet),
            history: history.slice() // Copy
        };
    }

    /**
     * Get the current era based on current item
     * @returns {string}
     */
    function getCurrentEra() {
        const item = getCurrentItem();
        if (!item) {
            // Return default era from config or fallback
            if (typeof ConfigLoader !== 'undefined' && ConfigLoader.isInitialized) {
                return ConfigLoader.get().eras.default || '2020s';
            }
            return '2020s';
        }

        // Use ItemManager if available
        if (typeof ItemManager !== 'undefined' && ItemManager.isInitialized) {
            return ItemManager.getEraId(item);
        }

        // Fallback to hardcoded logic for backwards compatibility
        const year = item.year;
        if (year < 1990) return '1980s';
        if (year < 2000) return '1990s';
        if (year < 2010) return '2000s';
        if (year < 2020) return '2010s';
        return '2020s';
    }

    // Alias for backwards compatibility
    function getCurrentDecade() {
        return getCurrentEra();
    }

    /**
     * Get progress information
     * @returns {Object}
     */
    function getProgress() {
        const total = seenSet.size + notSeenSet.size;
        return {
            current: total,
            total: items.length,
            percent: items.length > 0 ? (total / items.length) * 100 : 0,
            seen: seenSet.size,
            notSeen: notSeenSet.size,
            remaining: items.length - total
        };
    }

    /**
     * Trigger update callback with current state
     */
    function triggerUpdate() {
        if (onUpdate) {
            onUpdate({
                window: getWindow(),
                preload: getPreloadQueue(),
                progress: getProgress(),
                decade: getCurrentEra(), // Keep 'decade' key for backwards compatibility
                era: getCurrentEra(),
                state: getState(),
                canUndo: history.length > 0
            });
        }
    }

    /**
     * Reset all progress
     */
    function reset() {
        currentIndex = 0;
        seenSet.clear();
        notSeenSet.clear();
        history = [];
        triggerUpdate();
    }

    /**
     * Check if challenge is complete
     * @returns {boolean}
     */
    function isComplete() {
        return !getCurrentItem();
    }

    // Public API
    return {
        init,
        getWindow,
        getPreloadQueue,
        markSeen,
        markNotSeen,
        undo,
        getCurrentItem,
        getCurrentMovie, // Alias for backwards compatibility
        getState,
        getProgress,
        getCurrentEra,
        getCurrentDecade, // Alias for backwards compatibility
        reset,
        isComplete,
        get historyLength() { return history.length; }
    };
})();

// Export for ES modules if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SlidingWindow;
}
