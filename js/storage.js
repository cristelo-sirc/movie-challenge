/**
 * Storage Manager for 5000 Movie Challenge
 * Handles all localStorage persistence with batched writes
 */

const StorageManager = (function() {
    const STORAGE_KEY = 'movie_challenge_progress';
    const SAVE_DEBOUNCE_MS = 500;
    
    let saveTimeout = null;
    let pendingState = null;
    
    /**
     * Default state structure
     */
    const defaultState = {
        currentIndex: 0,
        seen: [],           // Array of movie IDs marked as seen
        notSeen: [],        // Array of movie IDs marked as not seen
        history: [],        // Last N actions for undo (stores {id, action} objects)
        lastUpdated: null,
        version: 1
    };
    
    /**
     * Load state from localStorage
     * @returns {Object} The saved state or default state
     */
    function load() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) {
                return { ...defaultState };
            }
            
            const parsed = JSON.parse(saved);
            
            // Migrate old versions if needed
            if (!parsed.version) {
                parsed.version = 1;
                parsed.history = parsed.history || [];
            }
            
            return {
                ...defaultState,
                ...parsed
            };
        } catch (error) {
            console.error('Failed to load progress from localStorage:', error);
            return { ...defaultState };
        }
    }
    
    /**
     * Save state to localStorage (debounced)
     * @param {Object} state - The state to save
     */
    function save(state) {
        pendingState = {
            ...state,
            lastUpdated: new Date().toISOString()
        };
        
        // Debounce writes to avoid blocking main thread
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }
        
        saveTimeout = setTimeout(() => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingState));
                pendingState = null;
            } catch (error) {
                console.error('Failed to save progress to localStorage:', error);
                
                // Handle quota exceeded
                if (error.name === 'QuotaExceededError') {
                    // Trim history to make room
                    pendingState.history = pendingState.history.slice(-50);
                    try {
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingState));
                    } catch (e) {
                        console.error('Still cannot save after trimming history:', e);
                    }
                }
            }
        }, SAVE_DEBOUNCE_MS);
    }
    
    /**
     * Force immediate save (for before page unload)
     */
    function saveImmediate(state) {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
            saveTimeout = null;
        }
        
        const finalState = state || pendingState;
        if (finalState) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    ...finalState,
                    lastUpdated: new Date().toISOString()
                }));
            } catch (error) {
                console.error('Failed to save on unload:', error);
            }
        }
    }
    
    /**
     * Reset all progress
     */
    function reset() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.error('Failed to reset progress:', error);
        }
        return { ...defaultState };
    }
    
    /**
     * Get statistics from current state
     * @param {Object} state
     * @returns {Object} Statistics
     */
    function getStats(state) {
        const total = state.seen.length + state.notSeen.length;
        const seenCount = state.seen.length;
        const percentComplete = total > 0 ? Math.round((total / 5000) * 100) : 0;
        const percentSeen = total > 0 ? Math.round((seenCount / total) * 100) : 0;
        
        return {
            total,
            seenCount,
            notSeenCount: state.notSeen.length,
            percentComplete,
            percentSeen,
            remaining: 5000 - total
        };
    }
    
    // Save on page unload
    window.addEventListener('beforeunload', () => {
        saveImmediate();
    });
    
    // Public API
    return {
        load,
        save,
        saveImmediate,
        reset,
        getStats,
        STORAGE_KEY
    };
})();

// Export for ES modules if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
}
