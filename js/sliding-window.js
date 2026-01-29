/**
 * Sliding Window Engine for 5000 Movie Challenge
 * 
 * Manages a virtualized view of 5,000 movies to prevent memory issues.
 * Only a small "window" of cards is rendered to the DOM at any time.
 */

const SlidingWindow = (function () {
    // Configuration
    const WINDOW_SIZE = 5;          // Number of cards to render at once
    const PRELOAD_AHEAD = 3;        // How many cards ahead to preload images
    const HISTORY_MAX_SIZE = 100;   // Max undo history

    // State
    let movies = [];                 // Full movie list (lightweight metadata only)
    let currentIndex = 0;            // Current position in the list
    let seenSet = new Set();         // Fast lookup for seen movies
    let notSeenSet = new Set();      // Fast lookup for not-seen movies
    let history = [];                // Action history for undo

    // Callbacks
    let onUpdate = null;
    let onComplete = null;

    /**
     * Initialize the sliding window with movie data and saved state
     * @param {Array} movieList - Full list of movies
     * @param {Object} savedState - State from StorageManager
     * @param {Object} callbacks - { onUpdate, onComplete }
     */
    function init(movieList, savedState, callbacks) {
        movies = movieList;
        currentIndex = savedState.currentIndex || 0;
        seenSet = new Set(savedState.seen || []);
        notSeenSet = new Set(savedState.notSeen || []);
        history = savedState.history || [];

        onUpdate = callbacks.onUpdate || (() => { });
        onComplete = callbacks.onComplete || (() => { });

        // Skip already-rated movies to find the real current position
        while (currentIndex < movies.length && isRated(movies[currentIndex].id)) {
            currentIndex++;
        }

        triggerUpdate();
    }

    /**
     * Check if a movie has been rated
     * @param {number} id - Movie ID
     * @returns {boolean}
     */
    function isRated(id) {
        return seenSet.has(id) || notSeenSet.has(id);
    }

    /**
     * Get the current window of movies to display
     * @returns {Array} Movies in the current window
     */
    function getWindow() {
        const windowMovies = [];
        let idx = currentIndex;

        // Collect unrated movies for the window
        while (windowMovies.length < WINDOW_SIZE && idx < movies.length) {
            const movie = movies[idx];
            if (!isRated(movie.id)) {
                windowMovies.push({
                    ...movie,
                    index: idx
                });
            }
            idx++;
        }

        return windowMovies;
    }

    /**
     * Get movies to preload (for image prefetching)
     * @returns {Array} Movie objects to preload
     */
    function getPreloadQueue() {
        const queue = [];
        let idx = currentIndex;
        let count = 0;

        while (count < WINDOW_SIZE + PRELOAD_AHEAD && idx < movies.length) {
            const movie = movies[idx];
            if (!isRated(movie.id)) {
                queue.push(movie);
                count++;
            }
            idx++;
        }

        return queue;
    }

    /**
     * Mark the current movie as seen
     */
    function markSeen() {
        const currentMovie = getCurrentMovie();
        if (!currentMovie) return false;

        seenSet.add(currentMovie.id);
        history.push({ id: currentMovie.id, action: 'seen' });
        trimHistory();
        advanceToNext();

        return true;
    }

    /**
     * Mark the current movie as not seen (skip)
     */
    function markNotSeen() {
        const currentMovie = getCurrentMovie();
        if (!currentMovie) return false;

        notSeenSet.add(currentMovie.id);
        history.push({ id: currentMovie.id, action: 'notSeen' });
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

        // Find the index of the movie we just un-rated
        const movieIdx = movies.findIndex(m => m.id === lastAction.id);
        if (movieIdx !== -1 && movieIdx < currentIndex) {
            currentIndex = movieIdx;
        }

        triggerUpdate();
        return true;
    }

    /**
     * Get the current (top) movie
     * @returns {Object|null}
     */
    function getCurrentMovie() {
        let idx = currentIndex;
        while (idx < movies.length) {
            const movie = movies[idx];
            if (!isRated(movie.id)) {
                return { ...movie, index: idx };
            }
            idx++;
        }
        return null;
    }

    /**
     * Advance to the next unrated movie
     */
    function advanceToNext() {
        currentIndex++;

        // Skip any already-rated movies
        while (currentIndex < movies.length && isRated(movies[currentIndex].id)) {
            currentIndex++;
        }

        triggerUpdate();

        // Check for completion
        if (currentIndex >= movies.length || !getCurrentMovie()) {
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
     * Get the current decade based on current movie
     * @returns {string}
     */
    function getCurrentDecade() {
        const movie = getCurrentMovie();
        if (!movie) return '2020s';

        const year = movie.year;
        if (year < 1990) return '1980s';
        if (year < 2000) return '1990s';
        if (year < 2010) return '2000s';
        if (year < 2020) return '2010s';
        return '2020s';
    }

    /**
     * Get progress information
     * @returns {Object}
     */
    function getProgress() {
        const total = seenSet.size + notSeenSet.size;
        return {
            current: total,
            total: movies.length,
            percent: movies.length > 0 ? (total / movies.length) * 100 : 0,
            seen: seenSet.size,
            notSeen: notSeenSet.size,
            remaining: movies.length - total
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
                decade: getCurrentDecade(),
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
        return !getCurrentMovie();
    }

    // Public API
    return {
        init,
        getWindow,
        getPreloadQueue,
        markSeen,
        markNotSeen,
        undo,
        getCurrentMovie,
        getState,
        getProgress,
        getCurrentDecade,
        reset,
        isComplete,
        get historyLength() { return history.length; }
    };
})();

// Export for ES modules if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SlidingWindow;
}
