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
    let items = [];                  // Full item list (movies, books, etc.) — may grow as chunks load
    let totalExpected = 0;           // True total per manifest (items.length may be smaller while loading)
    let currentIndex = 0;            // Current position in the list
    let seenSet = new Set();         // Fast lookup for seen items
    let notSeenSet = new Set();      // Fast lookup for not-seen items
    let history = [];                // Action history for undo

    // ===== Decade filtering (v3.3) =====
    // Only items whose era is in activeEras are shown. Switched-off decades
    // are SKIPPED in every scan (exactly like already-rated items), so the
    // canonical item order, saved currentIndex, and QR export are untouched.
    let activeEras = new Set();      // era IDs currently being reviewed
    let allEraIds = [];              // every era ID (the default selection)
    let eraCounts = {};              // era ID -> true total count (from manifest)

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
    function init(itemList, savedState, callbacks, options) {
        // Load config values
        loadConfig();

        items = itemList;
        // With chunked loading, items may still be arriving. totalExpected is
        // the manifest's true count; completion must never fire before then.
        totalExpected = (options && options.totalExpected) || itemList.length;
        eraCounts = (options && options.eraCounts) || {};
        allEraIds = (options && options.allEraIds && options.allEraIds.length)
            ? options.allEraIds.slice()
            : deriveAllEraIds();

        // Decade selection: use the saved one, else default to every decade.
        const savedSel = savedState.activeEras;
        activeEras = new Set(
            (Array.isArray(savedSel) && savedSel.length) ? savedSel : allEraIds
        );

        currentIndex = savedState.currentIndex || 0;
        seenSet = new Set(savedState.seen || []);
        notSeenSet = new Set(savedState.notSeen || []);
        history = savedState.history || [];

        onUpdate = callbacks.onUpdate || (() => { });
        onComplete = callbacks.onComplete || (() => { });

        // Skip already-rated OR filtered-out items to find the real position
        while (currentIndex < items.length && !isSelectable(items[currentIndex])) {
            currentIndex++;
        }

        triggerUpdate();
    }

    /**
     * Default selection = every configured era (or a sensible fallback).
     */
    function deriveAllEraIds() {
        if (typeof ConfigLoader !== 'undefined' && ConfigLoader.isInitialized) {
            const groups = (ConfigLoader.get().eras.groups) || [];
            if (groups.length) return groups.map(e => e.id);
        }
        return ['1980s', '1990s', '2000s', '2010s', '2020s'];
    }

    /**
     * Era ID for an item (uses ItemManager when available, else year ranges).
     */
    function eraIdForItem(item) {
        if (typeof ItemManager !== 'undefined' && ItemManager.isInitialized) {
            return ItemManager.getEraId(item);
        }
        const year = item.year;
        if (year < 1990) return '1980s';
        if (year < 2000) return '1990s';
        if (year < 2010) return '2000s';
        if (year < 2020) return '2010s';
        return '2020s';
    }

    /**
     * Is the item in a currently-active decade?
     */
    function isActive(item) {
        return activeEras.has(eraIdForItem(item));
    }

    /**
     * Should this item be shown? (unrated AND in an active decade)
     */
    function isSelectable(item) {
        return !isRated(getItemId(item)) && isActive(item);
    }

    /**
     * Is every active decade selected? (the default, no-filter case)
     */
    function isAllSelected() {
        return allEraIds.length > 0
            && activeEras.size === allEraIds.length
            && allEraIds.every(id => activeEras.has(id));
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

        // Collect unrated items in active decades for the window
        while (windowItems.length < WINDOW_SIZE && idx < items.length) {
            const item = items[idx];
            if (isSelectable(item)) {
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
            if (isSelectable(item)) {
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
            if (isSelectable(item)) {
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

        // Skip any already-rated OR filtered-out items
        while (currentIndex < items.length && !isSelectable(items[currentIndex])) {
            currentIndex++;
        }

        triggerUpdate();

        // Check for completion — guard: never complete while chunks are still
        // loading, and never when the selection is empty (that's an empty state).
        if (activeEras.size > 0 && !getCurrentItem() && allItemsLoaded()) {
            onComplete(getState());
        }
    }

    /**
     * Whether every expected item is in memory
     */
    function allItemsLoaded() {
        return items.length >= totalExpected;
    }

    /**
     * Called when new chunks have been appended to the items array.
     * Refreshes the window (the user may have been waiting at the loaded edge)
     * and re-checks completion.
     */
    function notifyItemsAppended() {
        triggerUpdate();
        if (activeEras.size > 0 && !getCurrentItem() && allItemsLoaded()) {
            onComplete(getState());
        }
    }

    /**
     * Change which decades are under review (v3.3).
     * Rewinds to the EARLIEST unrated item in the new selection so decades you
     * had already scrolled past chronologically are picked up again.
     * @param {Array} eraIds
     */
    function setActiveEras(eraIds) {
        activeEras = new Set(eraIds || []);

        // Rewind: find the earliest unrated, active item from the very start.
        currentIndex = 0;
        while (currentIndex < items.length && !isSelectable(items[currentIndex])) {
            currentIndex++;
        }

        triggerUpdate();

        // Selection may now be fully reviewed (but never "complete" when empty).
        if (activeEras.size > 0 && !getCurrentItem() && allItemsLoaded()) {
            onComplete(getState());
        }
    }

    /**
     * The decades currently under review.
     * @returns {Array} era IDs
     */
    function getActiveEras() {
        return Array.from(activeEras);
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
            history: history.slice(), // Copy
            activeEras: Array.from(activeEras) // v3.3: remember decade selection
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
        // ----- Global (lifetime, every decade) -----
        const globalSeen = seenSet.size;
        const globalNotSeen = notSeenSet.size;
        const globalRated = globalSeen + globalNotSeen;
        const globalTotal = totalExpected || items.length;

        // ----- Scoped to the active decades (drives the HUD) -----
        let scopedSeen, scopedNotSeen, scopedTotal;

        if (isAllSelected()) {
            // No filter: identical to lifetime totals (and avoids a transient
            // undercount while later chunks are still streaming in).
            scopedSeen = globalSeen;
            scopedNotSeen = globalNotSeen;
            scopedTotal = globalTotal;
        } else {
            // Denominator from the manifest (exact, even mid-load)
            scopedTotal = 0;
            if (eraCounts && Object.keys(eraCounts).length) {
                activeEras.forEach(id => { scopedTotal += (eraCounts[id] || 0); });
            }
            // Numerators from loaded items (rated items are always loaded)
            scopedSeen = 0;
            scopedNotSeen = 0;
            for (const m of items) {
                if (!isActive(m)) continue;
                const id = getItemId(m);
                if (seenSet.has(id)) scopedSeen++;
                else if (notSeenSet.has(id)) scopedNotSeen++;
            }
            if (!scopedTotal) {
                // Fallback if manifest counts weren't supplied
                for (const m of items) if (isActive(m)) scopedTotal++;
            }
        }

        const scopedRated = scopedSeen + scopedNotSeen;

        return {
            // Scoped (HUD counter, progress bar, action-bar tallies)
            current: scopedRated,
            total: scopedTotal,
            percent: scopedTotal > 0 ? (scopedRated / scopedTotal) * 100 : 0,
            seen: scopedSeen,
            notSeen: scopedNotSeen,
            remaining: Math.max(0, scopedTotal - scopedRated),
            // Global (settings, gamification, backup reminders)
            globalSeen,
            globalNotSeen,
            globalRated,
            globalTotal,
            globalRemaining: Math.max(0, globalTotal - globalRated)
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
        // Back to the default: every decade selected
        activeEras = new Set(allEraIds);
        triggerUpdate();
    }

    /**
     * Has EVERY item (all decades) been rated? Distinct from the filter-aware
     * isComplete(), which only checks the active selection.
     * @returns {boolean}
     */
    function isAllComplete() {
        return (seenSet.size + notSeenSet.size) >= (totalExpected || items.length)
            && allItemsLoaded();
    }

    /**
     * Check if challenge is complete
     * @returns {boolean}
     */
    function isComplete() {
        return !getCurrentItem() && allItemsLoaded();
    }

    // Public API
    return {
        init,
        notifyItemsAppended,
        allItemsLoaded,
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
        setActiveEras,    // v3.3: change decade selection
        getActiveEras,    // v3.3
        isAllComplete,    // v3.3: every decade fully rated
        reset,
        isComplete,
        get historyLength() { return history.length; }
    };
})();

// Export for ES modules if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SlidingWindow;
}
