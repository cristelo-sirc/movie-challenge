/**
 * Data Loader (v2.1.0)
 *
 * Loads item data as per-decade JSON chunks instead of one blocking file.
 *
 * Strategy:
 *  - Fetch the manifest (tiny) to learn chunk layout and true total count.
 *  - Load the contiguous prefix of chunks needed to cover the user's saved
 *    position, then render immediately.
 *  - Quietly load remaining chunks in order, appending to the same array.
 *
 * The items array (window[config.data.variableName]) is APPEND-ONLY and
 * preserves the exact canonical order. Saved progress (currentIndex and
 * the QR bit-array format) depends on this invariant.
 */

const DataLoader = (function () {
    'use strict';

    let manifest = null;
    let items = [];               // The canonical, growing array
    let loadedChunks = 0;
    let fullyLoaded = false;
    let loadingPromise = null;
    let fullyLoadedResolvers = [];
    let callbacks = {};

    const ASSET_VERSION = '25';   // cache-buster, keep in sync with index.html

    function manifestUrl() {
        const cfg = (typeof ConfigLoader !== 'undefined' && ConfigLoader.isInitialized)
            ? ConfigLoader.get() : null;
        const base = (cfg && cfg.data && cfg.data.manifestUrl) || 'data/chunks/manifest.json';
        return base + '?v=' + ASSET_VERSION;
    }

    async function fetchJSON(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch ' + url + ' (' + res.status + ')');
        return res.json();
    }

    /**
     * Which chunk (by index) contains a given global item index?
     */
    function chunkIndexFor(globalIndex) {
        if (!manifest) return 0;
        const idx = Math.max(0, Math.min(globalIndex, manifest.totalCount - 1));
        for (let i = 0; i < manifest.chunks.length; i++) {
            const c = manifest.chunks[i];
            if (idx >= c.startIndex && idx < c.startIndex + c.count) return i;
        }
        return manifest.chunks.length - 1;
    }

    function appendChunk(chunkItems) {
        for (let i = 0; i < chunkItems.length; i++) {
            items.push(chunkItems[i]);
        }
        loadedChunks++;
    }

    function markFullyLoaded() {
        fullyLoaded = true;
        fullyLoadedResolvers.forEach(resolve => resolve());
        fullyLoadedResolvers = [];
        if (callbacks.onAllLoaded) callbacks.onAllLoaded();
    }

    /**
     * Start loading.
     * @param {Object} options
     *   - savedIndex: the user's saved currentIndex (0 for new users)
     *   - loadAll: if true, wait for ALL chunks before onReady (URL imports)
     *   - onReady(items, manifest): enough data is loaded to start the app
     *   - onChunkLoaded(chunkItems, loadedCount, totalCount): background progress
     *   - onAllLoaded(): everything is in memory
     * @returns {Promise} resolves when onReady fires
     */
    function start(options) {
        if (loadingPromise) return loadingPromise;
        callbacks = options || {};

        loadingPromise = (async () => {
            manifest = await fetchJSON(manifestUrl());

            // Expose the canonical array under the configured global name
            const cfg = (typeof ConfigLoader !== 'undefined' && ConfigLoader.isInitialized)
                ? ConfigLoader.get() : null;
            const varName = (cfg && cfg.data && cfg.data.variableName) || 'MOVIES';
            window[varName] = items;

            // Correct the configured total from the manifest (single source of truth)
            if (cfg && cfg.data) cfg.data.totalCount = manifest.totalCount;

            const savedIndex = options.savedIndex || 0;
            const neededThrough = options.loadAll
                ? manifest.chunks.length - 1
                : chunkIndexFor(savedIndex);

            // Load required prefix in parallel, append in order
            const prefixData = await Promise.all(
                manifest.chunks.slice(0, neededThrough + 1).map(c =>
                    fetchJSON('data/chunks/' + c.file + '?v=' + ASSET_VERSION))
            );
            prefixData.forEach(appendChunk);

            if (loadedChunks >= manifest.chunks.length) {
                markFullyLoaded();
            }

            if (callbacks.onReady) callbacks.onReady(items, manifest);

            // Background-load the rest, strictly in order
            if (!fullyLoaded) {
                loadRemaining(neededThrough + 1);
            }
        })();

        return loadingPromise;
    }

    async function loadRemaining(fromChunk) {
        try {
            for (let i = fromChunk; i < manifest.chunks.length; i++) {
                const c = manifest.chunks[i];
                const data = await fetchJSON('data/chunks/' + c.file + '?v=' + ASSET_VERSION);
                appendChunk(data);
                if (callbacks.onChunkLoaded) callbacks.onChunkLoaded(data, items.length, manifest.totalCount);
            }
            markFullyLoaded();
        } catch (err) {
            console.error('Background chunk load failed, retrying in 5s:', err);
            setTimeout(() => loadRemaining(loadedChunks), 5000);
        }
    }

    /**
     * Promise that resolves once every chunk is in memory.
     */
    function whenFullyLoaded() {
        if (fullyLoaded) return Promise.resolve();
        return new Promise(resolve => fullyLoadedResolvers.push(resolve));
    }

    // Public API
    return {
        start,
        whenFullyLoaded,
        get isFullyLoaded() { return fullyLoaded; },
        get totalExpected() { return manifest ? manifest.totalCount : 0; },
        get loadedCount() { return items.length; },
        get manifest() { return manifest; },
    };
})();

// Export for ES modules / tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataLoader;
}
