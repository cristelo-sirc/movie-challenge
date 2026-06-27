/**
 * Main Application
 * Ties together the sliding window engine, storage, and UI
 */

(function () {
    'use strict';

    // Configuration reference (will be set in init)
    let config = null;

    // DOM Elements
    const elements = {
        app: document.getElementById('app'),
        cardStack: document.getElementById('cardStack'),
        loadingState: document.getElementById('loadingState'),
        completionState: document.getElementById('completionState'),
        completionStats: document.getElementById('completionStats'),
        progressBar: document.getElementById('progressBar'),
        currentCount: document.getElementById('currentCount'),
        decadeBadge: document.getElementById('decadeBadge'),
        seenBtn: document.getElementById('seenBtn'),
        skipBtn: document.getElementById('skipBtn'),
        undoBtn: document.getElementById('undoBtn'),
        resetBtn: document.getElementById('resetBtn'),
        // Menu/Modal elements
        menuBtn: document.getElementById('menuBtn'),
        shareBtn: document.getElementById('shareBtn'),
        shareResultsBtn: document.getElementById('shareResultsBtn'),
        modalOverlay: document.getElementById('modalOverlay'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        exportBtn: document.getElementById('exportBtn'),
        importBtn: document.getElementById('importBtn'),
        codeInput: document.getElementById('codeInput'),
        codeActions: document.getElementById('codeActions'),
        copyCodeBtn: document.getElementById('copyCodeBtn'),
        applyCodeBtn: document.getElementById('applyCodeBtn'),
        resetProgressBtn: document.getElementById('resetProgressBtn'),
        toast: document.getElementById('toast'),
        // Stats
        statSeen: document.getElementById('statSeen'),
        statSkipped: document.getElementById('statSkipped'),
        statRemaining: document.getElementById('statRemaining'),
        // Action bar counters
        seenCounter: document.getElementById('seenCounter'),
        notSeenCounter: document.getElementById('notSeenCounter'),
        // V2.0 Elements
        soundToggleBtn: document.getElementById('soundToggleBtn'),
        soundOnIcon: document.getElementById('soundOnIcon'),
        soundOffIcon: document.getElementById('soundOffIcon'),
        streakIndicator: document.getElementById('streakIndicator'),
        streakCount: document.getElementById('streakCount'),
        // Backup Modal Elements
        backupModal: document.getElementById('backupModal'),
        closeBackupModal: document.getElementById('closeBackupModal'),
        qrCode: document.getElementById('qrCode'),
        backupProgressCount: document.getElementById('backupProgressCount'),
        shareEmail: document.getElementById('shareEmail'),
        shareSMS: document.getElementById('shareSMS'),
        shareDownload: document.getElementById('shareDownload'),
        shareLink: document.getElementById('shareLink'),
        backupBtn: document.getElementById('backupBtn'),
        // V3.3 — decade selection + stats
        decadeBadgeLabel: document.getElementById('decadeBadgeLabel'),
        statsBtn: document.getElementById('statsBtn'),
        decadeOverlay: document.getElementById('decadeOverlay'),
        closeDecadeBtn: document.getElementById('closeDecadeBtn'),
        decadeList: document.getElementById('decadeList'),
        decadeAllBtn: document.getElementById('decadeAllBtn'),
        decadeNoneBtn: document.getElementById('decadeNoneBtn'),
        decadeDoneBtn: document.getElementById('decadeDoneBtn'),
        statsOverlay: document.getElementById('statsOverlay'),
        closeStatsBtn: document.getElementById('closeStatsBtn'),
        statsTotalSeen: document.getElementById('statsTotalSeen'),
        statsTotalRated: document.getElementById('statsTotalRated'),
        statsPctSeen: document.getElementById('statsPctSeen'),
        statsPctLabel: document.getElementById('statsPctLabel'),
        statsByDecade: document.getElementById('statsByDecade'),
        statsTopYears: document.getElementById('statsTopYears'),
        statsYearsEmpty: document.getElementById('statsYearsEmpty'),
        emptySelectionState: document.getElementById('emptySelectionState'),
        emptyChooseBtn: document.getElementById('emptyChooseBtn'),
        chooseDecadesBtn: document.getElementById('chooseDecadesBtn')
    };

    // Touch/Drag State
    let dragState = {
        isDragging: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        cardElement: null
    };

    // Swipe threshold (pixels)
    const SWIPE_THRESHOLD = 100;
    const ROTATION_FACTOR = 0.1;

    // Preloaded images cache
    const imageCache = new Map();

    // ===== Card-transition state (v3.7) =====
    let isTransitioning = false;  // guards against double-rate from rapid taps/keys
    let lastRenderSig = null;     // ids of the last rendered window — skip redundant rebuilds
    let flyLayer = null;          // overlay that holds the outgoing card during its fly-off

    // Current mode for code input
    let codeInputMode = null; // 'export' or 'import'

    // Track last backup reminder milestone
    let lastBackupReminder = 0;

    // ===== Anticipation layer state (v3.1) =====
    let ratingsSinceDrop = 0;     // counts toward the next stat drop
    let cardsSinceIconic = 99;    // rate-limits iconic entrance effects
    let lastIconicId = null;      // never re-trigger for the same movie

    // ===== Year transition card state (v3.2) =====
    let currentYear = null;            // year of the top card we last reacted to
    const shownYears = new Set();      // years whose card has already been shown this session

    // ===== Decade selection state (v3.3) =====
    let eraCountsApp = {};             // era ID -> true total (from manifest)
    let allEraIdsApp = [];             // every era ID (default selection)
    let pendingSelection = new Set();  // working selection while the picker is open
    let suppressYearCardOnce = false;  // skip the year takeover on the next render
                                       // (used right after a selection change)

    // Small inline icons for the picker toggles
    const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    const ICON_CIRCLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle></svg>';
    const ICON_FILM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line></svg>';

    /**
     * Vibration feedback (Android etc.; iPhones ignore the API)
     */
    function vibrate(ms) {
        const enabled = config && config.anticipation && config.anticipation.haptics !== false;
        if (enabled && navigator.vibrate) {
            try { navigator.vibrate(ms); } catch (e) { /* no-op */ }
        }
    }

    /**
     * Called once per rating (seen or skip) — drives stat drops and
     * the iconic-card rate limiter.
     */
    function anticipationOnRated(ratedMovie, wasSeen) {
        cardsSinceIconic++;
        vibrate(8);

        const interval = (config.anticipation && config.anticipation.statDropInterval) || 0;
        if (interval <= 0) return;

        ratingsSinceDrop++;
        if (ratingsSinceDrop < interval) return;
        if (typeof DataLoader === 'undefined' || !DataLoader.isFullyLoaded) return;

        ratingsSinceDrop = 0;
        // Wait for the swipe to land and state to update, then compute
        setTimeout(() => {
            try {
                const state = SlidingWindow.getState();
                const insight = StatsEngine.computeInsight({
                    items: ItemManager.getAll(),
                    justRated: ratedMovie,
                    wasSeen: wasSeen,
                    seen: state.seen,
                    notSeen: state.notSeen,
                    history: state.history,
                    eras: config.eras.groups,
                    ranks: (config.gamification && config.gamification.ranks) || [],
                });
                if (insight) showStatDrop(insight);
            } catch (e) {
                console.error('Stat drop failed:', e);
            }
        }, 650);
    }

    /**
     * Show a stat-drop interstitial. Tap (or any key) to dismiss — no auto-dismiss.
     * "Armed" after a short delay so an in-flight tap aimed at the previous card
     * can't dismiss it before it's read. Never touches ratings/history/saved state.
     */
    function showStatDrop(insight) {
        if (document.querySelector('.stat-drop')) return;

        const overlay = document.createElement('div');
        overlay.className = 'stat-drop';
        overlay.innerHTML = `
            <div class="stat-drop-card">
                <div class="stat-drop-kicker">Stat drop</div>
                <h3>${escapeHtml(insight.title)}</h3>
                <p>${escapeHtml(insight.line)}</p>
                <div class="stat-drop-hint">Tap to continue</div>
            </div>
        `;
        document.body.appendChild(overlay);
        vibrate(20);

        // Arm after a short delay; until then, taps are ignored so a tap meant
        // for the next card can't accidentally dismiss this before it's read.
        setTimeout(() => overlay.classList.add('armed'), 700);
        const dismiss = () => {
            if (!overlay.classList.contains('armed')) return;
            overlay.classList.add('closing');
            setTimeout(() => overlay.remove(), 250);
        };
        // Dismiss ONLY via the "Tap to continue" control — taps elsewhere do nothing,
        // so a stray tap can't close it.
        const hint = overlay.querySelector('.stat-drop-hint');
        if (hint) hint.addEventListener('click', dismiss);
    }

    /**
     * Dismiss any open stat drop (keyboard path). Returns true if one was open.
     */
    function dismissStatDropIfOpen() {
        const overlay = document.querySelector('.stat-drop');
        if (overlay) {
            // Swallow the key so it never rates the next card; only actually
            // dismiss once the drop is armed (see showStatDrop).
            if (overlay.classList.contains('armed')) {
                overlay.classList.add('closing');
                setTimeout(() => overlay.remove(), 250);
            }
            return true;
        }
        return false;
    }

    /**
     * Initialize the application (async since v2.1: data loads in chunks)
     */
    async function init() {
        try {
            // Initialize config system first (no item data needed)
            config = ConfigLoader.init();

            // Initialize StorageManager with config
            StorageManager.init();

            // Shared-link progress (?p=) needs EVERY chunk before it can be
            // decoded (the QR format maps bits to item positions), so for
            // those visitors we wait for the full dataset.
            const urlParams = new URLSearchParams(window.location.search);
            const hasURLProgress = urlParams.has('p');

            // Load saved state — its position tells us which chunks we need first
            let savedState = StorageManager.load();

            // Load item data: the chunks covering the user's position now,
            // the rest quietly in the background.
            await DataLoader.start({
                savedIndex: savedState.currentIndex || 0,
                loadAll: hasURLProgress,
                onChunkLoaded: handleChunkLoaded,
            });

            // Items (at least the needed prefix) now exist
            ItemManager.init();

            // Update total count display (corrected from the manifest)
            const totalCountEl = document.querySelector('.count-total');
            if (totalCountEl) {
                totalCountEl.textContent = config.data.totalCount.toLocaleString();
            }

            // Now safe to decode URL-based progress (all chunks loaded above)
            if (hasURLProgress) {
                const imported = StorageManager.checkURLForProgress();
                if (imported) {
                    savedState = imported;
                    StorageManager.save(savedState);
                    showToast('Progress restored from link!', 'success');
                }
            }

            // Initialize v2.0 Managers
            ThemeManager.init();
            GamificationManager.init(savedState.seen?.length || 0, savedState.bestStreak || 0);

            // Initialize backup reminder tracking
            const totalRated = savedState.seen.length + savedState.notSeen.length;
            const reminderInterval = (config.gamification && config.gamification.backupReminderInterval) || 100;
            lastBackupReminder = Math.floor(totalRated / reminderInterval) * reminderInterval;

            // Get items from ItemManager
            const items = ItemManager.getAll();

            // Per-decade totals from the manifest (exact, even mid-load) and the
            // full list of era IDs — both feed the decade filter (v3.3).
            const manifest = DataLoader.manifest;
            eraCountsApp = {};
            if (manifest && manifest.chunks) {
                manifest.chunks.forEach(c => { eraCountsApp[c.id] = c.count; });
            }
            allEraIdsApp = (config.eras.groups || []).map(e => e.id);

            // Initialize the sliding window (totalExpected guards completion
            // and progress math while chunks are still arriving)
            SlidingWindow.init(items, savedState, {
                onUpdate: handleUpdate,
                onComplete: handleComplete
            }, {
                totalExpected: DataLoader.totalExpected,
                eraCounts: eraCountsApp,
                allEraIds: allEraIdsApp
            });

            // Set up event listeners
            setupEventListeners();

            // Initialize audio on first user interaction
            document.addEventListener('click', initAudioOnce, { once: true });
            document.addEventListener('touchstart', initAudioOnce, { once: true });

            // Check for private browsing mode
            checkPrivateBrowsing();

            // Hide loading, show cards
            elements.loadingState.classList.add('hidden');
        } catch (error) {
            console.error('Init error:', error);
            // Show error on page
            const loadingEl = document.getElementById('loadingState');
            if (loadingEl) {
                const fileHint = (window.location.protocol === 'file:')
                    ? '<br><br>Note: since v2.1 the app loads data over HTTP, so opening index.html directly from disk no longer works. Run a local server instead (e.g. <code>python3 -m http.server</code>).'
                    : '';
                loadingEl.innerHTML = '<p style="color:red;padding:20px;text-align:center;">Error: ' + error.message + '<br><br>Please refresh the page.' + fileHint + '</p>';
            }
        }
    }

    /**
     * A background chunk arrived: register it and refresh the card window
     * (the user may have been waiting at the edge of loaded data)
     */
    function handleChunkLoaded(chunkItems) {
        ItemManager.addItems(chunkItems);
        SlidingWindow.notifyItemsAppended();
    }

    /**
     * Some actions (QR backup, export, import, share) depend on the FULL
     * item list being in memory. Returns true and shows a toast if not ready.
     */
    function requiresFullData() {
        if (!DataLoader.isFullyLoaded) {
            showToast('Still loading movie data — try again in a few seconds', 'error');
            return true;
        }
        return false;
    }

    /**
     * Check if user is in private browsing mode
     * Private mode may not persist localStorage reliably
     */
    function checkPrivateBrowsing() {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

        // Only check on iOS Safari where private browsing is the issue
        if (!isIOS || !isSafari) return;

        // Check if user has any saved progress
        const savedState = StorageManager.load();
        const hasProgress = savedState.seen.length > 0 || savedState.notSeen.length > 0;

        // Show warning to iOS Safari users with no progress
        // This covers: new users, private browsing users, and users who lost data
        if (!hasProgress) {
            showPrivateBrowsingWarning();
        }
    }

    /**
     * Show warning banner for iOS Safari users
     */
    function showPrivateBrowsingWarning() {
        // Only show once per session
        if (sessionStorage.getItem('private_warning_shown')) return;

        const banner = document.createElement('div');
        banner.className = 'private-browsing-banner';
        banner.innerHTML = `
            <span>Tip: Use "Export Code" in the menu to backup your progress. Private browsing won't save data.</span>
            <button class="banner-close" aria-label="Dismiss">✕</button>
        `;

        document.body.insertBefore(banner, document.body.firstChild);

        banner.querySelector('.banner-close').addEventListener('click', () => {
            banner.remove();
            sessionStorage.setItem('private_warning_shown', '1');
        });

        // Auto-dismiss after 10 seconds
        setTimeout(() => {
            if (banner.parentNode) {
                banner.classList.add('fade-out');
                setTimeout(() => banner.remove(), 500);
            }
        }, 10000);
    }

    /**
     * Initialize audio context on first user interaction
     */
    function initAudioOnce() {
        AudioManager.init();
    }

    /**
     * v3.7.1 — Persist game state with the current best streak folded in.
     * bestStreak lives in GamificationManager, not in SlidingWindow.getState(), so
     * every save must carry it — otherwise a later save (e.g. a watchlist toggle)
     * would overwrite the stored value with nothing and the best streak would reset
     * to 0 on the next reload.
     * @param {Object} [state] - state to save (defaults to the current game state)
     */
    function persist(state) {
        const s = state || SlidingWindow.getState();
        if (typeof GamificationManager !== 'undefined' && typeof GamificationManager.bestStreak === 'number') {
            s.bestStreak = GamificationManager.bestStreak;
        }
        StorageManager.save(s);
    }

    /**
     * Handle updates from the sliding window
     * @param {Object} data - Update data
     */
    function handleUpdate(data) {
        // Update progress bar (scoped to the selected decades)
        elements.progressBar.style.width = `${data.progress.percent}%`;

        // Update counter with animation
        animateCounter(data.progress.current);

        // v3.5.1: keep the denominator (total to review) in step with the active
        // decade selection, so the fraction matches the scoped progress ring.
        // (Previously set once at init to the global total and never updated.)
        const totalEl = document.querySelector('.count-total');
        if (totalEl) totalEl.textContent = (data.progress.total || 0).toLocaleString();

        // Update decade badge label (keeps the caret intact)
        if (elements.decadeBadgeLabel) {
            elements.decadeBadgeLabel.textContent = data.decade;
        }

        // Update undo button state
        elements.undoBtn.disabled = !data.canUndo;

        // Update action bar counters (seen/not seen tally — scoped)
        elements.seenCounter.textContent = data.progress.seen.toLocaleString();
        elements.notSeenCounter.textContent = data.progress.notSeen.toLocaleString();

        // Render cards
        renderCards(data.window);

        // Is the user reviewing nothing because no decade is selected?
        const noSelection = SlidingWindow.getActiveEras().length === 0;
        if (elements.emptySelectionState) {
            elements.emptySelectionState.classList.toggle('hidden', !noSelection);
        }

        // When there ARE cards to show, make sure we're out of any completion
        // state (e.g. after the user re-enables a decade) and buttons are live.
        if (data.window.length > 0) {
            elements.completionState.classList.add('hidden');
            elements.seenBtn.disabled = false;
            elements.skipBtn.disabled = false;
        }

        // If the user caught up to the loaded edge while chunks are still
        // downloading, show a brief loading state instead of an empty stack.
        // (Not when the stack is empty simply because no decade is selected.)
        if (data.window.length === 0 && !noSelection && !SlidingWindow.isComplete()) {
            const loadingText = elements.loadingState.querySelector('p');
            if (loadingText) loadingText.textContent = 'Loading more movies...';
            elements.loadingState.classList.remove('hidden');
        } else {
            elements.loadingState.classList.add('hidden');
        }

        // Preload images
        preloadImages(data.preload);

        // Save state (decade selection + best streak folded in)
        persist(data.state);

        // Update background (desktop)
        updateBackground(data.window[0]);

        // Update theme based on current item's era field (year for movies).
        // The colour theme still changes by decade; the takeover card now fires
        // by year (see below).
        if (data.window[0]) {
            const eraValue = ItemManager.getEraValue(data.window[0]);
            ThemeManager.updateForYear(eraValue);

            // Year transition card (v3.2): show when we advance into a new year.
            const year = parseInt(eraValue, 10);
            if (!Number.isNaN(year)) {
                if (suppressYearCardOnce) {
                    // A selection change just rewound us — adopt the new year
                    // silently so we don't fire a takeover on the jump.
                    suppressYearCardOnce = false;
                    currentYear = year;
                } else if (currentYear !== null && year > currentYear && !shownYears.has(year)) {
                    // Don't fire on the very first render (fresh load or resume);
                    // only on an actual forward transition we haven't shown yet.
                    shownYears.add(year);
                    AudioManager.playDecadeTransition();
                    showYearCard(year);
                    currentYear = year;
                } else {
                    currentYear = year;
                }
            }
        }

        // Check for backup reminder (mobile only) — based on lifetime ratings
        checkBackupReminder(data.progress.globalRated);

        // v3.4: notify the Poster Journal shell (no-op on the legacy page)
        if (window.UIShell && typeof UIShell.onAppUpdate === 'function') {
            try { UIShell.onAppUpdate(data); } catch (e) { /* shell render must never break review */ }
        }
    }

    /**
     * Check if we should show a backup reminder
     * Shows at intervals defined in config on mobile devices
     */
    function checkBackupReminder(totalRated) {
        // Only show on mobile
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (!isMobile) return;

        // Get reminder interval from config (0 to disable)
        const reminderInterval = config.gamification.backupReminderInterval || 100;
        if (reminderInterval <= 0) return;

        // Check if we've hit a new milestone
        const currentMilestone = Math.floor(totalRated / reminderInterval) * reminderInterval;
        if (currentMilestone > lastBackupReminder && currentMilestone > 0) {
            lastBackupReminder = currentMilestone;
            showBackupReminder(currentMilestone);
        }
    }

    /**
     * Show backup reminder banner
     */
    function showBackupReminder(milestone) {
        // Don't show if one is already visible
        if (document.querySelector('.backup-reminder-banner')) return;

        const itemTypePlural = config.itemTypePlural || 'movies';

        const banner = document.createElement('div');
        banner.className = 'backup-reminder-banner';
        banner.innerHTML = `
            <span>${milestone} ${itemTypePlural} rated! Backup your progress?</span>
            <div style="display: flex; gap: 8px;">
                <button class="backup-now-btn">Backup Now</button>
                <button class="banner-close" aria-label="Dismiss">✕</button>
            </div>
        `;

        document.body.insertBefore(banner, document.body.firstChild);

        banner.querySelector('.backup-now-btn').addEventListener('click', () => {
            banner.remove();
            openBackupModal();
        });

        banner.querySelector('.banner-close').addEventListener('click', () => {
            banner.remove();
        });

        // Auto-dismiss after 15 seconds
        setTimeout(() => {
            if (banner.parentNode) {
                banner.classList.add('fade-out');
                setTimeout(() => banner.remove(), 500);
            }
        }, 15000);
    }

    /**
     * Cinematic year transition (v3.2): full-screen title card for a new year,
     * with up to three cinema fun facts and a famous quote from a film of that
     * year. Tap anywhere to dismiss (no auto-dismiss, since there's more to read).
     * @param {number} year
     */
    function showYearCard(year) {
        // Never stack two
        const existing = document.querySelector('.decade-takeover');
        if (existing) existing.remove();

        // Look up curated content; render gracefully if a year has no entry.
        const data = (typeof window !== 'undefined' && window.YEAR_FACTS)
            ? window.YEAR_FACTS[year]
            : null;

        let factsHtml = '';
        if (data && Array.isArray(data.facts) && data.facts.length) {
            const items = data.facts
                .map(f => `<li>${escapeHtml(f)}</li>`)
                .join('');
            factsHtml = `<ul class="dt-facts">${items}</ul>`;
        }

        let quoteHtml = '';
        if (data && data.quote && data.quote.text) {
            const attribution = [data.quote.who, data.quote.film]
                .filter(Boolean)
                .map(escapeHtml)
                .join(' — ');
            quoteHtml = `
                <figure class="dt-quote">
                    <blockquote>&ldquo;${escapeHtml(data.quote.text)}&rdquo;</blockquote>
                    ${attribution ? `<figcaption>${attribution}</figcaption>` : ''}
                </figure>
            `;
        }

        const takeover = document.createElement('div');
        takeover.className = 'decade-takeover';
        takeover.innerHTML = `
            <div class="dt-inner dt-year">
                <div class="dt-kicker">Now entering</div>
                <h1>${year}</h1>
                ${factsHtml}
                ${quoteHtml}
                <div class="dt-hint">Tap to continue</div>
            </div>
        `;
        document.body.appendChild(takeover);
        vibrate(20);

        // Armed after a short delay so an in-flight tap aimed at the previous
        // card can't dismiss the takeover before it's read.
        setTimeout(() => takeover.classList.add('armed'), 700);
        const dismiss = () => {
            if (!takeover.classList.contains('armed')) return;
            takeover.classList.add('closing');
            setTimeout(() => takeover.remove(), 350);
        };
        // Dismiss ONLY via the "Tap to continue" control so reading/scrolling the
        // facts can't accidentally close it.
        const dtHint = takeover.querySelector('.dt-hint');
        if (dtHint) dtHint.addEventListener('click', dismiss);
    }

    /**
     * Handle challenge completion
     * @param {Object} state - Final state
     */
    function handleComplete(state) {
        const allDone = SlidingWindow.isAllComplete();
        elements.cardStack.innerHTML = '';
        if (elements.emptySelectionState) elements.emptySelectionState.classList.add('hidden');
        elements.completionState.classList.remove('hidden');

        const itemTypePlural = config.itemTypePlural || 'movies';
        const positiveLabel = config.actions.positive.pastTense || 'seen';
        const negativeLabel = config.actions.negative.pastTense || 'not seen';
        const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
        const h2 = elements.completionState.querySelector('h2');

        if (allDone) {
            // Whole challenge finished — every decade rated
            const stats = StorageManager.getStats(state);
            if (h2) h2.textContent = 'Challenge Complete!';
            elements.completionStats.innerHTML = `
                You've rated all <strong>${config.data.totalCount.toLocaleString()}</strong> ${itemTypePlural}!<br>
                ${cap(positiveLabel)}: <span style="color: var(--accent-seen)">${stats.seenCount.toLocaleString()}</span> |
                ${cap(negativeLabel)}: <span style="color: var(--accent-skip)">${stats.notSeenCount.toLocaleString()}</span>
            `;
            if (elements.chooseDecadesBtn) elements.chooseDecadesBtn.classList.add('hidden');
        } else {
            // Only the selected decades are finished — invite to add more
            const prog = SlidingWindow.getProgress();
            const label = formatDecadeList(SlidingWindow.getActiveEras());
            if (h2) h2.textContent = 'Decades complete!';
            elements.completionStats.innerHTML = `
                You've reviewed every movie in ${label}.<br>
                ${cap(positiveLabel)}: <span style="color: var(--accent-seen)">${prog.seen.toLocaleString()}</span> |
                ${cap(negativeLabel)}: <span style="color: var(--accent-skip)">${prog.notSeen.toLocaleString()}</span><br>
                Add more decades to keep going.
            `;
            if (elements.chooseDecadesBtn) elements.chooseDecadesBtn.classList.remove('hidden');
        }

        // Disable action buttons
        elements.seenBtn.disabled = true;
        elements.skipBtn.disabled = true;
    }

    /**
     * Render movie cards in the stack
     * @param {Array} movies - Movies to render
     */
    function renderCards(movies) {
        // v3.7: skip the full rebuild when the visible window is unchanged (e.g. a
        // background decade chunk was appended out of view). Card content is a pure
        // function of the movie id (the saved-bookmark state is toggled in place),
        // so identical ids => identical cards => no work needed.
        const sig = movies.map(m => m && m.id).join(',');
        if (sig === lastRenderSig && elements.cardStack.firstElementChild) return;
        lastRenderSig = sig;

        // Clear existing cards
        elements.cardStack.innerHTML = '';

        // Render in direct order (First item is Top Card due to CSS z-index)
        movies.forEach((movie, index) => {
            const card = createCardElement(movie, index === 0);
            elements.cardStack.appendChild(card);
        });

        // Attach drag listeners to top card (First Child)
        const topCard = elements.cardStack.firstElementChild;
        // v3.4: swipe-to-rate removed — rating is via the buttons (and keys) only.
        // This lets the flipped info card scroll natively and trims per-touch work.

        // Iconic entrance effect (rate-limited, once per movie)
        const top = movies[0];
        if (top && top.tier === 'iconic' && top.id !== lastIconicId) {
            const minGap = (config.anticipation && config.anticipation.iconicMinGap) || 8;
            if (cardsSinceIconic >= minGap) {
                lastIconicId = top.id;
                cardsSinceIconic = 0;
                topCard.classList.add('iconic-reveal');
                AudioManager.playIconicSound();
                vibrate(15);
            }
        }
    }

    /**
     * Create a card DOM element
     * @param {Object} movie - Movie data
     * @param {boolean} isTop - Whether this is the top card
     * @returns {HTMLElement}
     */
    function createCardElement(movie, isTop) {
        const card = document.createElement('div');
        card.className = 'movie-card' + (movie.tier === 'iconic' ? ' iconic-card' : '');
        card.dataset.id = movie.id;

        // Generate rating stars
        const rating = movie.vote_average || 0;
        const fullStars = Math.floor(rating / 2);
        const halfStar = rating % 2 >= 1;
        const stars = '★'.repeat(fullStars) + (halfStar ? '½' : '') + '☆'.repeat(5 - fullStars - (halfStar ? 1 : 0));

        // Truncate overview for display on back
        const overview = movie.overview || 'No description available.';
        const truncatedOverview = overview; // v3.4: full synopsis — the info card scrolls

        // Extract metadata (handle both flat and nested structures)
        const director = movie.director || (movie.credits && movie.credits.director);
        const cast = movie.cast || (movie.credits && movie.credits.cast);

        // v3.5: is this movie already on the "Want to See" list?
        const isSaved = (typeof SlidingWindow !== 'undefined' && SlidingWindow.isWatchlisted)
            ? SlidingWindow.isWatchlisted(movie.id) : false;

        card.innerHTML = `
            <div class="card-inner">
                <div class="card-front">
                    <img
                        class="card-poster"
                        src="${getPosterUrl(movie)}"
                        alt="${movie.title} poster"
                        loading="${isTop ? 'eager' : 'lazy'}"
                        decoding="async"
                        ${isTop ? 'fetchpriority="high"' : ''}
                        onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 600%22><rect fill=%22%231a1a1a%22 width=%22400%22 height=%22600%22/><text x=%22200%22 y=%22300%22 text-anchor=%22middle%22 fill=%22%23555%22 font-size=%2224%22>No Poster</text></svg>'"
                    >
                    <div class="card-overlay">
                        <h2 class="card-title">${escapeHtml(ItemManager.getTitle(movie))}</h2>
                        <p class="card-year">${ItemManager.getSubtitle(movie)}</p>
                    </div>
                    
                    <!-- v3.8: one aligned control row — Save (left), Watch (center), Info (right) -->
                    <div class="pj-controls">
                        <button class="pj-bookmark${isSaved ? ' is-saved' : ''}" aria-label="Save to Want to See" aria-pressed="${isSaved ? 'true' : 'false'}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                            </svg>
                        </button>

                        <button class="watch-btn" aria-label="Where to watch">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polygon points="6 4 20 12 6 20 6 4"></polygon>
                            </svg>
                            <span>Watch</span>
                        </button>

                        <button class="info-btn" aria-label="More Info">Info</button>
                    </div>

                    <div class="swipe-indicator seen">SEEN</div>
                    <div class="swipe-indicator skip">NOPE</div>
                </div>
                <div class="card-back">
                    <!-- INFO panel (shown when Info is tapped) -->
                    <div class="card-back-info">
                        <div class="card-back-header">
                            <span class="card-back-title">${escapeHtml(ItemManager.getTitle(movie))}</span>
                            <span class="card-back-year">${ItemManager.getSubtitle(movie)}</span>
                        </div>
                        <div class="card-back-rating">
                            <div class="rating-stars">${'★'.repeat(fullStars)}${halfStar ? '½' : ''}${'☆'.repeat(5 - fullStars - (halfStar ? 1 : 0))}</div>
                            <span class="rating-value">${rating.toFixed(1)}/10</span>
                        </div>
                        ${movie.runtime || director ? `
                        <div class="card-back-meta">
                            ${movie.runtime ? `<span>${movie.runtime} min</span>` : ''}
                            ${director ? `<span>Dir. ${escapeHtml(director)}</span>` : ''}
                        </div>` : ''}
                        ${cast && cast.length ? `
                        <div class="card-back-cast">
                            <strong>Cast:</strong> ${cast.join(', ')}
                        </div>` : ''}
                        <div class="card-back-overview">${escapeHtml(truncatedOverview)}</div>
                        <div class="card-back-footer">Tap to flip back</div>
                    </div>
                    <!-- WATCH panel (shown when Watch is tapped) -->
                    <div class="card-back-watch">
                        <div class="card-back-header">
                            <span class="card-back-title">${escapeHtml(ItemManager.getTitle(movie))}</span>
                            <span class="card-back-year">${ItemManager.getSubtitle(movie)}</span>
                        </div>
                        <div class="card-watch-stream" data-stream-id="${movie.id}"></div>
                        <div class="card-back-footer">Tap to flip back</div>
                    </div>
                </div>
            </div>
        `;

        // Add flip logic (only for top card interactions)
        if (isTop) {
            // Find info button and attach click handler
            const infoBtn = card.querySelector('.info-btn');
            if (infoBtn) {
                // Prevent drag from starting when touching the button
                const stopProp = (e) => e.stopPropagation();
                infoBtn.addEventListener('mousedown', stopProp);
                infoBtn.addEventListener('touchstart', stopProp, { passive: true });

                infoBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    card.classList.remove('show-watch'); // v3.6: Info shows the synopsis side
                    card.classList.add('flipped');
                });
            }

            // v3.6: Watch button — flips to the streaming view (same flip as Info).
            const watchBtn = card.querySelector('.watch-btn');
            if (watchBtn) {
                const stopProp = (e) => e.stopPropagation();
                watchBtn.addEventListener('mousedown', stopProp);
                watchBtn.addEventListener('touchstart', stopProp, { passive: true });
                watchBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    // v3.7: render streaming lazily on first Watch tap (this is what
                    // triggers the deferred data load — see Streaming.ensureLoaded).
                    const streamEl = card.querySelector('.card-watch-stream');
                    if (streamEl && !streamEl.dataset.rendered &&
                        window.Streaming && typeof Streaming.renderInto === 'function') {
                        streamEl.dataset.rendered = '1';
                        Streaming.renderInto(streamEl, movie.id);
                    }
                    card.classList.add('show-watch'); // show the Watch (streaming) panel
                    card.classList.add('flipped');
                });
            }

            // Clicking back of card flips it back
            const backFace = card.querySelector('.card-back');
            if (backFace) {
                backFace.addEventListener('click', (e) => {
                    e.stopPropagation();
                    card.classList.remove('flipped');
                });
            }

            // v3.5: bookmark ("Want to See") — a quick tap that saves WITHOUT
            // rating or advancing the card. Mirrors the info-btn pattern so a
            // touch here never starts a drag or flips the card.
            const bookmarkBtn = card.querySelector('.pj-bookmark');
            if (bookmarkBtn) {
                const stopProp = (e) => e.stopPropagation();
                bookmarkBtn.addEventListener('mousedown', stopProp);
                bookmarkBtn.addEventListener('touchstart', stopProp, { passive: true });
                bookmarkBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleWatchlist(movie, bookmarkBtn);
                });
            }

            // v3.6: the streaming ("Where to watch") block lives in the Watch panel.
            // v3.7: it is now filled lazily on the first Watch tap (handler above),
            // so a session that never opens Watch never downloads the streaming map.
            const streamEl = card.querySelector('.card-watch-stream');
            if (streamEl) {
                // taps inside the streaming block (e.g. a provider link) must not
                // bubble up and flip the card back
                streamEl.addEventListener('click', (e) => e.stopPropagation());
            }
        }

        return card;
    }

    /**
     * v3.5 — Toggle a movie on/off the "Want to See" watchlist from the poster
     * bookmark. Saves locally (never touches the share/QR format) and refreshes
     * the Diary list if the shell is present. Does NOT rate or advance the card.
     */
    function toggleWatchlist(movie, btn) {
        if (typeof SlidingWindow === 'undefined' || !SlidingWindow.toggleWatchlist) return;
        const nowSaved = SlidingWindow.toggleWatchlist(movie.id);
        if (btn) {
            btn.classList.toggle('is-saved', nowSaved);
            btn.setAttribute('aria-pressed', nowSaved ? 'true' : 'false');
        }
        vibrate(10);
        persist();
        showToast(nowSaved ? 'Added to Want to See' : 'Removed from Want to See', 'success');
        if (window.UIShell && typeof UIShell.onWatchlistChange === 'function') {
            try { UIShell.onWatchlistChange(); } catch (e) { /* shell render must never break review */ }
        }
    }

    /**
     * Attach drag/touch listeners to a card
     * @param {HTMLElement} card
     */
    function attachDragListeners(card) {
        // Mouse events
        card.addEventListener('mousedown', handleDragStart);
        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);

        // Touch events
        card.addEventListener('touchstart', handleDragStart, { passive: true });
        document.addEventListener('touchmove', handleDragMove, { passive: false });
        document.addEventListener('touchend', handleDragEnd);
    }

    /**
     * Handle drag start
     * @param {Event} e
     */
    function handleDragStart(e) {
        const card = e.currentTarget;
        if (!card.classList.contains('movie-card')) return;

        dragState.isDragging = true;
        dragState.cardElement = card;
        dragState.startX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
        dragState.startY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
        dragState.currentX = 0;
        dragState.currentY = 0;

        card.classList.add('dragging');
    }

    /**
     * Handle drag move
     * @param {Event} e
     */
    function handleDragMove(e) {
        if (!dragState.isDragging || !dragState.cardElement) return;

        if (e.type === 'touchmove') {
            e.preventDefault();
        }

        const clientX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
        const clientY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;

        dragState.currentX = clientX - dragState.startX;
        dragState.currentY = clientY - dragState.startY;

        const rotation = dragState.currentX * ROTATION_FACTOR;

        dragState.cardElement.style.transform =
            `translate(${dragState.currentX}px, ${dragState.currentY}px) rotate(${rotation}deg)`;

        // Update hint classes
        if (dragState.currentX > 50) {
            dragState.cardElement.classList.add('hint-right');
            dragState.cardElement.classList.remove('hint-left');
        } else if (dragState.currentX < -50) {
            dragState.cardElement.classList.add('hint-left');
            dragState.cardElement.classList.remove('hint-right');
        } else {
            dragState.cardElement.classList.remove('hint-left', 'hint-right');
        }
    }

    /**
     * Handle drag end
     * @param {Event} e
     */
    function handleDragEnd(e) {
        if (!dragState.isDragging || !dragState.cardElement) return;

        const card = dragState.cardElement;
        card.classList.remove('dragging', 'hint-left', 'hint-right');

        // Check if swipe threshold reached
        if (dragState.currentX > SWIPE_THRESHOLD) {
            // Swipe right - Seen
            card.classList.add('swipe-right');
            AudioManager.playSeenSound();
            handleSeenAction();
            setTimeout(() => SlidingWindow.markSeen(), 300);
        } else if (dragState.currentX < -SWIPE_THRESHOLD) {
            // Swipe left - Not Seen
            card.classList.add('swipe-left');
            AudioManager.playSkipSound();
            handleSkipAction();
            setTimeout(() => SlidingWindow.markNotSeen(), 300);
        } else {
            // Return to center
            card.style.transform = '';
        }

        // Reset drag state
        dragState.isDragging = false;
        dragState.cardElement = null;
        dragState.currentX = 0;
        dragState.currentY = 0;
    }

    /**
     * Handle "Seen" action gamification
     */
    function handleSeenAction() {
        const ratedMovie = SlidingWindow.getCurrentMovie();
        const result = GamificationManager.recordSeen();
        updateStreakDisplay(result.streak);
        anticipationOnRated(ratedMovie, true);

        // Check for milestone
        if (result.milestone) {
            AudioManager.playMilestoneSound();
            GamificationManager.triggerConfetti();
            const itemTypePlural = config.itemTypePlural || 'movies';
            const pastTense = config.actions.positive.pastTense || 'seen';
            showToast(`${result.milestone} ${itemTypePlural} ${pastTense}!`, 'success');
        }

        // Check for rank up
        if (result.rankUp) {
            setTimeout(() => {
                showToast(`Rank up: ${result.rankUp.name}!`, 'success');
            }, 500);
        }

        // Streak sound
        if (result.streak > 1) {
            AudioManager.playStreakSound(result.streak);
        }
    }

    /**
     * Handle "Skip" action gamification
     */
    function handleSkipAction() {
        const ratedMovie = SlidingWindow.getCurrentMovie();
        GamificationManager.recordSkip();
        hideStreakDisplay();
        anticipationOnRated(ratedMovie, false);
    }

    /**
     * Update streak display
     */
    function updateStreakDisplay(streak) {
        if (streak < 2) {
            hideStreakDisplay();
            return;
        }

        elements.streakCount.textContent = streak;
        elements.streakIndicator.classList.remove('hidden');

        // Living streak (v3.1): visual stages escalate at 10 and 25
        elements.streakIndicator.classList.toggle('hot', streak >= 10 && streak < 25);
        elements.streakIndicator.classList.toggle('inferno', streak >= 25);
    }

    /**
     * Hide streak display
     */
    function hideStreakDisplay() {
        elements.streakIndicator.classList.add('hidden');
        elements.streakIndicator.classList.remove('hot', 'inferno');
    }

    /**
     * Set up all event listeners
     */
    function setupEventListeners() {
        // Action buttons
        elements.seenBtn.addEventListener('click', () => {
            animateButtonSwipe('right');
        });

        elements.skipBtn.addEventListener('click', () => {
            animateButtonSwipe('left');
        });

        elements.undoBtn.addEventListener('click', () => {
            AudioManager.playUndoSound();
            // Check what the last action was before undo removes it
            const state = SlidingWindow.getState();
            const lastAction = state.history.length > 0
                ? state.history[state.history.length - 1]
                : null;
            const wasSeen = lastAction?.action === 'seen';
            GamificationManager.recordUndo(wasSeen);
            hideStreakDisplay();
            SlidingWindow.undo();
            // Re-sync seen count from authoritative source (lifetime total,
            // so ranks/milestones never depend on the active decade filter)
            const progress = SlidingWindow.getProgress();
            GamificationManager.syncSeenCount(progress.globalSeen);
        });

        elements.resetBtn.addEventListener('click', handleReset);

        // Menu/Settings
        elements.menuBtn.addEventListener('click', openModal);
        elements.closeModalBtn.addEventListener('click', closeModal);
        elements.modalOverlay.addEventListener('click', (e) => {
            if (e.target === elements.modalOverlay) closeModal();
        });

        // Share buttons
        elements.shareBtn.addEventListener('click', shareResults);
        if (elements.shareResultsBtn) {
            elements.shareResultsBtn.addEventListener('click', shareResults);
        }

        // Export/Import
        elements.exportBtn.addEventListener('click', handleExport);
        elements.importBtn.addEventListener('click', handleImportStart);
        elements.copyCodeBtn.addEventListener('click', handleCopyCode);
        elements.applyCodeBtn.addEventListener('click', handleApplyCode);

        // QR Backup button
        if (elements.backupBtn) {
            elements.backupBtn.addEventListener('click', () => {
                closeModal();
                // Brief delay to allow settings modal to hide properly
                setTimeout(() => openBackupModal(), 50);
            });
        }

        // Reset in modal
        elements.resetProgressBtn.addEventListener('click', () => {
            closeModal();
            handleReset();
        });

        // Sound toggle
        if (elements.soundToggleBtn) {
            elements.soundToggleBtn.addEventListener('click', toggleSound);
        }

        // Backup modal
        if (elements.closeBackupModal) {
            elements.closeBackupModal.addEventListener('click', closeBackupModal);
        }
        if (elements.shareEmail) {
            elements.shareEmail.addEventListener('click', shareViaEmail);
        }
        if (elements.shareSMS) {
            elements.shareSMS.addEventListener('click', shareViaSMS);
        }
        if (elements.shareDownload) {
            elements.shareDownload.addEventListener('click', downloadAsFile);
        }
        if (elements.shareLink) {
            elements.shareLink.addEventListener('click', copyShareLink);
        }
        // Close backup modal on overlay click (markup uses .backup-overlay, not
        // .modal-overlay — the old selector silently matched nothing).
        if (elements.backupModal) {
            elements.backupModal.querySelector('.backup-overlay')?.addEventListener('click', closeBackupModal);
        }

        // ===== Decade picker (v3.3) =====
        if (elements.decadeBadge) {
            elements.decadeBadge.addEventListener('click', openDecadePicker);
        }
        if (elements.closeDecadeBtn) {
            elements.closeDecadeBtn.addEventListener('click', closeAndApplyDecadePicker);
        }
        if (elements.decadeDoneBtn) {
            elements.decadeDoneBtn.addEventListener('click', closeAndApplyDecadePicker);
        }
        if (elements.decadeOverlay) {
            elements.decadeOverlay.addEventListener('click', (e) => {
                if (e.target === elements.decadeOverlay) closeAndApplyDecadePicker();
            });
        }
        if (elements.decadeAllBtn) {
            elements.decadeAllBtn.addEventListener('click', () => {
                pendingSelection = new Set(allEraIdsApp);
                buildDecadeRows();
            });
        }
        if (elements.decadeNoneBtn) {
            elements.decadeNoneBtn.addEventListener('click', () => {
                pendingSelection = new Set();
                buildDecadeRows();
            });
        }

        // ===== Stats screen (v3.3) =====
        if (elements.statsBtn) {
            elements.statsBtn.addEventListener('click', () => {
                elements.statsBtn.classList.remove('hint');
                openStatsScreen();
            });
        }
        if (elements.closeStatsBtn) {
            elements.closeStatsBtn.addEventListener('click', closeStatsScreen);
        }
        if (elements.statsOverlay) {
            elements.statsOverlay.addEventListener('click', (e) => {
                if (e.target === elements.statsOverlay) closeStatsScreen();
            });
        }
        if (elements.emptyChooseBtn) {
            elements.emptyChooseBtn.addEventListener('click', openDecadePicker);
        }
        if (elements.chooseDecadesBtn) {
            elements.chooseDecadesBtn.addEventListener('click', openDecadePicker);
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboard);
    }

    /**
     * Toggle sound on/off
     */
    function toggleSound() {
        const isEnabled = AudioManager.toggle();

        if (elements.soundOnIcon && elements.soundOffIcon) {
            elements.soundOnIcon.classList.toggle('hidden', !isEnabled);
            elements.soundOffIcon.classList.toggle('hidden', isEnabled);
        }

        showToast(isEnabled ? 'Sound on' : 'Sound off', 'success');
    }

    // ===== MODAL FUNCTIONS =====

    function openModal() {
        updateModalStats();
        elements.modalOverlay.classList.remove('hidden');
        // Reset code input state
        elements.codeInput.classList.add('hidden');
        elements.codeActions.classList.add('hidden');
        elements.codeInput.value = '';
        codeInputMode = null;
    }

    function closeModal() {
        elements.modalOverlay.classList.add('hidden');
    }

    function updateModalStats() {
        // Settings shows lifetime totals (all decades); the HUD shows the
        // scoped selection, and the Stats screen shows the full breakdown.
        const progress = SlidingWindow.getProgress();
        elements.statSeen.textContent = progress.globalSeen.toLocaleString();
        elements.statSkipped.textContent = progress.globalNotSeen.toLocaleString();
        elements.statRemaining.textContent = progress.globalRemaining.toLocaleString();
    }

    // ===== EXPORT/IMPORT FUNCTIONS =====

    function handleExport() {
        if (requiresFullData()) return;
        const state = SlidingWindow.getState();

        // Use new compressed format (v2)
        const encoded = StorageManager.exportCompressed(state);

        elements.codeInput.value = encoded;
        elements.codeInput.classList.remove('hidden');
        elements.codeActions.classList.remove('hidden');
        elements.applyCodeBtn.classList.add('hidden');
        codeInputMode = 'export';

        // Select the text
        elements.codeInput.select();
    }

    function handleImportStart() {
        elements.codeInput.value = '';
        elements.codeInput.placeholder = 'Paste your progress code here...';
        elements.codeInput.classList.remove('hidden');
        elements.codeActions.classList.remove('hidden');
        elements.applyCodeBtn.classList.remove('hidden');
        elements.copyCodeBtn.classList.add('hidden');
        codeInputMode = 'import';
        elements.codeInput.focus();
    }

    function handleCopyCode() {
        elements.codeInput.select();
        navigator.clipboard.writeText(elements.codeInput.value)
            .then(() => showToast('Code copied to clipboard!', 'success'))
            .catch(() => showToast('Failed to copy', 'error'));
    }

    function handleApplyCode() {
        if (requiresFullData()) return;
        const code = elements.codeInput.value.trim();
        if (!code) {
            showToast('Please paste a progress code', 'error');
            return;
        }

        // Use new importCompressed which handles both v1 and v2 formats
        const newState = StorageManager.importCompressed(code);

        if (!newState) {
            showToast('Invalid progress code', 'error');
            return;
        }

        // Keep the user's LOCAL-only settings across an import (neither is carried
        // in a share code): the active decade selection and the "Want to See" list.
        newState.activeEras = SlidingWindow.getActiveEras();
        newState.watchlist = SlidingWindow.getWatchlist(); // v3.7.1: don't wipe the watchlist
        StorageManager.save(newState);

        // Reinitialize the sliding window
        SlidingWindow.init(ItemManager.getAll(), newState, {
            onUpdate: handleUpdate,
            onComplete: handleComplete
        }, {
            totalExpected: DataLoader.totalExpected,
            eraCounts: eraCountsApp,
            allEraIds: allEraIdsApp
        });

        // Re-sync gamification manager with imported seen count
        GamificationManager.init(newState.seen.length, 0);

        // Update backup reminder tracking
        const totalRated = newState.seen.length + newState.notSeen.length;
        const reminderInterval = config.gamification.backupReminderInterval || 100;
        lastBackupReminder = Math.floor(totalRated / reminderInterval) * reminderInterval;

        closeModal();
        showToast(`Imported ${newState.seen.length + newState.notSeen.length} ratings!`, 'success');

        // Re-enable buttons if not complete
        if (!SlidingWindow.isComplete()) {
            elements.seenBtn.disabled = false;
            elements.skipBtn.disabled = false;
            elements.completionState.classList.add('hidden');
        }
    }

    // ===== SHARE FUNCTION =====

    function shareResults() {
        if (requiresFullData()) return;
        const progress = SlidingWindow.getProgress();
        // v3.7.1: share LIFETIME totals, not the decade-scoped view. The share code
        // is filter-agnostic, so pairing a scoped numerator with the global 4,719
        // denominator was inconsistent. Use the global fields throughout.
        const seenCount = progress.globalSeen;
        const notSeenCount = progress.globalNotSeen;
        const ratedCount = progress.globalRated;
        const percentSeen = ratedCount > 0
            ? Math.round((seenCount / ratedCount) * 100)
            : 0;

        // Calculate era breakdown
        const state = SlidingWindow.getState();
        const eraStats = calculateEraStats(state.seen);
        const bestEra = Object.entries(eraStats)
            .sort((a, b) => b[1] - a[1])[0];

        // Get config values
        const challengeName = config.name || '5000 Movie Challenge';
        const itemTypePlural = config.itemTypePlural || 'movies';
        const totalCount = config.data.totalCount.toLocaleString();
        const positiveLabel = config.actions.positive.pastTense || 'seen';
        const negativeLabel = config.actions.negative.pastTense || 'not seen';
        const hashtag = config.sharing.hashtag || '#5000MovieChallenge';
        const shareUrl = ConfigLoader.getShareUrl();

        const shareText = `🎬 My ${challengeName} Progress

✅ ${positiveLabel.charAt(0).toUpperCase() + positiveLabel.slice(1)}: ${seenCount.toLocaleString()} ${itemTypePlural} (${percentSeen}%)
❌ ${negativeLabel.charAt(0).toUpperCase() + negativeLabel.slice(1)}: ${notSeenCount.toLocaleString()}
📊 Progress: ${ratedCount.toLocaleString()} / ${totalCount}
${bestEra ? `🏆 Favorite era: ${bestEra[0]} (${bestEra[1]} ${positiveLabel})` : ''}

Try it yourself: ${shareUrl}

${hashtag}`;

        // Try native share API first (works best on iOS/mobile)
        if (navigator.share) {
            navigator.share({
                title: challengeName,
                text: shareText,
                url: shareUrl
            }).then(() => {
                showToast('Shared!', 'success');
            }).catch((err) => {
                // User cancelled or share failed - try clipboard
                if (err.name !== 'AbortError') {
                    copyShareText(shareText);
                }
            });
        } else {
            copyShareText(shareText);
        }
    }

    function copyShareText(text) {
        // Try modern clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => showToast('Results copied to clipboard!', 'success'))
                .catch(() => fallbackCopy(text));
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        // Fallback for iOS Safari and older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        try {
            document.execCommand('copy');
            showToast('Results copied to clipboard!', 'success');
        } catch (e) {
            showToast('Long press to copy text', 'error');
        }

        document.body.removeChild(textarea);
    }

    function calculateEraStats(seenIds) {
        // Use ItemManager if available, otherwise fallback
        if (typeof ItemManager !== 'undefined' && ItemManager.isInitialized) {
            return ItemManager.calculateEraStats(seenIds);
        }

        // Fallback to hardcoded logic
        const stats = {
            '1980s': 0,
            '1990s': 0,
            '2000s': 0,
            '2010s': 0,
            '2020s': 0
        };

        const seenSet = new Set(seenIds);
        const items = (typeof MOVIES !== 'undefined') ? MOVIES : [];

        // Get field names from config or use defaults
        const idField = (config && config.data && config.data.idField) || 'id';
        const eraField = (config && config.schema && config.schema.display && config.schema.display.eraField) || 'year';

        items.forEach(item => {
            if (seenSet.has(item[idField])) {
                const era = getEra(item[eraField]);
                if (era in stats) {
                    stats[era]++;
                }
            }
        });

        return stats;
    }

    // Alias for backwards compatibility
    function calculateDecadeStats(seenIds) {
        return calculateEraStats(seenIds);
    }

    function getEra(year) {
        if (typeof ConfigLoader !== 'undefined' && ConfigLoader.isInitialized) {
            const era = ConfigLoader.getEraForValue(year);
            return era ? era.id : '2020s';
        }
        // Fallback
        if (year < 1990) return '1980s';
        if (year < 2000) return '1990s';
        if (year < 2010) return '2000s';
        if (year < 2020) return '2010s';
        return '2020s';
    }

    // Alias for backwards compatibility
    function getDecade(year) {
        return getEra(year);
    }

    // ===== BACKUP MODAL FUNCTIONS =====

    /**
     * Open the backup modal and generate QR code
     */
    function openBackupModal() {
        if (requiresFullData()) return;
        const state = SlidingWindow.getState();
        const totalRated = state.seen.length + state.notSeen.length;

        // Update progress count
        elements.backupProgressCount.textContent = totalRated.toLocaleString();

        // Generate share URL
        const shareURL = StorageManager.generateShareURL(state);

        // Clear previous QR code
        elements.qrCode.innerHTML = '';

        // Generate QR code
        try {
            const qr = qrcode(0, 'L');
            qr.addData(shareURL);
            qr.make();
            elements.qrCode.innerHTML = qr.createImgTag(4, 8);
        } catch (e) {
            console.error('QR generation failed:', e);
            elements.qrCode.innerHTML = '<p style="color: #666; font-size: 0.8rem;">QR code unavailable</p>';
        }

        // Store URL for sharing buttons
        elements.backupModal.dataset.shareUrl = shareURL;

        // Show modal
        elements.backupModal.classList.remove('hidden');
    }

    /**
     * Close the backup modal
     */
    function closeBackupModal() {
        elements.backupModal.classList.add('hidden');
    }

    /**
     * Share via email
     */
    function shareViaEmail() {
        const shareURL = elements.backupModal.dataset.shareUrl;
        const challengeName = config.shortName || config.name || 'Challenge';
        const subject = encodeURIComponent(`My ${challengeName} Progress`);
        const body = encodeURIComponent(`🎬 Here's my ${challengeName} progress!\n\nClick to continue where I left off:\n${shareURL}`);

        window.location.href = `mailto:?subject=${subject}&body=${body}`;
        showToast('Opening email...', 'success');
    }

    /**
     * Share via SMS
     */
    function shareViaSMS() {
        const shareURL = elements.backupModal.dataset.shareUrl;
        const challengeName = config.shortName || config.name || 'Challenge';
        const body = encodeURIComponent(`🎬 My ${challengeName} Progress\n\nClick to restore:\n${shareURL}`);

        // iOS uses &body=, Android uses ?body=
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const separator = isIOS ? '&' : '?';

        window.location.href = `sms:${separator}body=${body}`;
        showToast('Opening messages...', 'success');
    }

    /**
     * Download as file
     */
    function downloadAsFile() {
        const state = SlidingWindow.getState();
        const shareURL = elements.backupModal.dataset.shareUrl;
        const code = StorageManager.exportCompressed(state);
        const totalRated = state.seen.length + state.notSeen.length;

        const challengeName = config.name || '5000 Movie Challenge';
        const itemTypePlural = config.itemTypePlural || 'Movies';
        const positiveLabel = config.actions.positive.pastTense || 'Seen';
        const negativeLabel = config.actions.negative.pastTense || 'Not Seen';
        const baseUrl = ConfigLoader.getShareUrl();

        const content = `🎬 ${challengeName} - Progress Backup
========================================

Total ${itemTypePlural.charAt(0).toUpperCase() + itemTypePlural.slice(1)} Rated: ${totalRated}
${positiveLabel.charAt(0).toUpperCase() + positiveLabel.slice(1)}: ${state.seen.length}
${negativeLabel.charAt(0).toUpperCase() + negativeLabel.slice(1)}: ${state.notSeen.length}
Date: ${new Date().toLocaleDateString()}

OPTION 1: Click this link to restore
${shareURL}

OPTION 2: Paste this code in the app
${code}

========================================
${baseUrl}`;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filePrefix = (config.itemType || 'movie').toLowerCase();
        a.download = `${filePrefix}-challenge-backup-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('File downloaded!', 'success');
    }

    /**
     * Copy shareable link
     */
    function copyShareLink() {
        const shareURL = elements.backupModal.dataset.shareUrl;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareURL)
                .then(() => showToast('Link copied!', 'success'))
                .catch(() => {
                    // Fallback
                    fallbackCopyLink(shareURL);
                });
        } else {
            fallbackCopyLink(shareURL);
        }
    }

    function fallbackCopyLink(url) {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        try {
            document.execCommand('copy');
            showToast('Link copied!', 'success');
        } catch (e) {
            showToast('Failed to copy', 'error');
        }

        document.body.removeChild(textarea);
    }

    // ===== DECADE PICKER (v3.3) =====

    function openDecadePicker() {
        pendingSelection = new Set(SlidingWindow.getActiveEras());
        buildDecadeRows();
        elements.decadeOverlay.classList.remove('hidden');
    }

    function buildDecadeRows() {
        const eras = config.eras.groups || [];
        const state = SlidingWindow.getState();
        const seenSet = new Set(state.seen);
        const notSeenSet = new Set(state.notSeen);
        const rows = StatsEngine.statsByEra(ItemManager.getAll(), seenSet, notSeenSet, eras);
        const byId = {};
        rows.forEach(r => { byId[r.id] = r; });

        elements.decadeList.innerHTML = eras.map(e => {
            const r = byId[e.id] || { rated: 0, total: 0 };
            const total = (eraCountsApp[e.id] != null) ? eraCountsApp[e.id] : (r.total || 0);
            const on = pendingSelection.has(e.id);
            return `
                <button class="decade-row ${on ? 'on' : ''}" data-era="${e.id}" role="switch" aria-checked="${on}">
                    <span class="decade-row-check">${on ? ICON_CHECK : ICON_CIRCLE}</span>
                    <span class="decade-row-name">${escapeHtml(e.name)}</span>
                    <span class="decade-row-tally">${r.rated.toLocaleString()} / ${total.toLocaleString()}</span>
                </button>`;
        }).join('');

        elements.decadeList.querySelectorAll('.decade-row').forEach(btn => {
            btn.addEventListener('click', () => toggleDecadeRow(btn.dataset.era, btn));
        });
    }

    function toggleDecadeRow(id, btn) {
        const on = !pendingSelection.has(id);
        if (on) pendingSelection.add(id); else pendingSelection.delete(id);
        btn.classList.toggle('on', on);
        btn.setAttribute('aria-checked', String(on));
        const check = btn.querySelector('.decade-row-check');
        if (check) check.innerHTML = on ? ICON_CHECK : ICON_CIRCLE;
    }

    function closeAndApplyDecadePicker() {
        elements.decadeOverlay.classList.add('hidden');
        applyDecadeSelection();
    }

    function applyDecadeSelection() {
        const before = SlidingWindow.getActiveEras().slice().sort().join(',');
        const after = Array.from(pendingSelection).sort().join(',');
        if (before === after) return; // nothing changed — no jump, no notice

        suppressYearCardOnce = true;
        SlidingWindow.setActiveEras(Array.from(pendingSelection));
        persist();

        const active = SlidingWindow.getActiveEras();
        if (active.length === 0) {
            showFilterNotice('No decades selected — tap the badge to choose', 'empty');
            return;
        }
        const prog = SlidingWindow.getProgress();
        if (prog.remaining <= 0) {
            showFilterNotice('Nothing left in your selection — add more decades', 'empty');
        } else {
            const current = SlidingWindow.getCurrentEra();
            showFilterNotice(`Showing ${current} — ${prog.remaining.toLocaleString()} left to review`);
        }
    }

    /**
     * Prominent, hard-to-miss notice for selection changes / rewinds.
     * Top-center, accent border, ~4.5s, tap to dismiss.
     */
    function showFilterNotice(message, kind) {
        const existing = document.querySelector('.filter-notice');
        if (existing) existing.remove();

        const el = document.createElement('div');
        el.className = 'filter-notice' + (kind === 'empty' ? ' is-empty' : '');
        el.innerHTML = `<span class="filter-notice-icon">${ICON_FILM}</span><span class="filter-notice-text">${escapeHtml(message)}</span>`;
        document.body.appendChild(el);
        vibrate(20);

        const dismiss = () => {
            el.classList.add('fade-out');
            setTimeout(() => el.remove(), 400);
        };
        el.addEventListener('click', dismiss);
        setTimeout(() => { if (el.parentNode) dismiss(); }, 4500);
    }

    /**
     * Human-readable decade list: "the 1980s", "the 1980s & 1990s", etc.
     */
    function formatDecadeList(eraIds) {
        const all = config.eras.groups || [];
        const names = all.filter(e => eraIds.includes(e.id)).map(e => e.name);
        if (names.length === 0) return 'your selection';
        if (names.length === all.length) return 'every decade';
        if (names.length === 1) return `the ${names[0]}`;
        const last = names.pop();
        return `the ${names.join(', ')} & ${last}`;
    }

    // ===== STATS SCREEN (v3.3) =====

    function openStatsScreen() {
        if (requiresFullData()) return; // needs the full dataset for accurate totals
        renderStats();
        elements.statsOverlay.classList.remove('hidden');
    }

    function closeStatsScreen() {
        elements.statsOverlay.classList.add('hidden');
    }

    function renderStats() {
        const state = SlidingWindow.getState();
        const seenSet = new Set(state.seen);
        const notSeenSet = new Set(state.notSeen);
        const items = ItemManager.getAll();
        const eras = config.eras.groups || [];
        const total = config.data.totalCount;
        const seenCount = state.seen.length;
        const ratedCount = state.seen.length + state.notSeen.length;

        // Overview cards
        elements.statsTotalSeen.textContent = seenCount.toLocaleString();
        elements.statsTotalRated.textContent = ratedCount.toLocaleString();
        elements.statsPctSeen.textContent = (total > 0 ? Math.round((seenCount / total) * 100) : 0) + '%';
        if (elements.statsPctLabel) {
            elements.statsPctLabel.textContent = 'Of ' + total.toLocaleString();
        }

        // Seen by decade (bars scaled to the busiest decade)
        const rows = StatsEngine.statsByEra(items, seenSet, notSeenSet, eras);
        const maxDecade = Math.max(1, ...rows.map(r => r.seen));
        elements.statsByDecade.innerHTML = rows.map(r =>
            statBarRow(null, r.name, r.seen, r.seen / maxDecade, false)
        ).join('');

        // Most-watched years
        const years = StatsEngine.rankYears(items, seenSet, 8);
        if (years.length === 0) {
            elements.statsTopYears.innerHTML = '';
            elements.statsYearsEmpty.classList.remove('hidden');
        } else {
            elements.statsYearsEmpty.classList.add('hidden');
            const maxYear = Math.max(1, ...years.map(y => y.seen));
            elements.statsTopYears.innerHTML = years.map((y, i) =>
                statBarRow(i + 1, String(y.year), y.seen, y.seen / maxYear, true)
            ).join('');
        }
    }

    function statBarRow(rank, label, value, ratio, isYear) {
        const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
        const rankHtml = rank != null ? `<span class="stat-bar-rank">${rank}</span>` : '';
        const labelClass = 'stat-bar-label' + (isYear ? ' year' : '');
        return `
            <div class="stat-bar-row">
                ${rankHtml}
                <span class="${labelClass}">${escapeHtml(label)}</span>
                <span class="stat-bar-track"><span class="stat-bar-fill" style="width:${pct}%"></span></span>
                <span class="stat-bar-value">${value.toLocaleString()}</span>
            </div>`;
    }

    // ===== TOAST NOTIFICATION =====

    function showToast(message, type = '') {
        elements.toast.textContent = message;
        elements.toast.className = 'toast' + (type ? ' ' + type : '');
        elements.toast.classList.remove('hidden');

        setTimeout(() => {
            elements.toast.classList.add('hidden');
        }, 3000);
    }

    // ===== RESET FUNCTION =====

    function handleReset() {
        if (confirm('Reset all progress? This cannot be undone.')) {
            StorageManager.reset();
            SlidingWindow.reset();
            GamificationManager.init(0, 0); // Reset gamification state
            elements.completionState.classList.add('hidden');
            elements.seenBtn.disabled = false;
            elements.skipBtn.disabled = false;
            showToast('Progress reset', 'success');
        }
    }

    /**
     * Handle keyboard input
     * @param {KeyboardEvent} e
     */
    /**
     * v3.7.1 — Is the deck actually interactive right now? Rating/undo keys must
     * only act when the Review tab is the visible screen, no overlay is open, and
     * no year takeover is covering the card. (Fixes off-screen ratings and the
     * year-takeover keyboard gap.)
     */
    function canReviewByKey() {
        const active = document.querySelector('.pj-screen.active');
        if (active && active.dataset.screen && active.dataset.screen !== 'review') return false;
        if (elements.decadeOverlay && !elements.decadeOverlay.classList.contains('hidden')) return false;
        if (elements.statsOverlay && !elements.statsOverlay.classList.contains('hidden')) return false;
        if (elements.modalOverlay && !elements.modalOverlay.classList.contains('hidden')) return false;
        if (elements.backupModal && !elements.backupModal.classList.contains('hidden')) return false;
        if (document.querySelector('.decade-takeover')) return false; // year card is up
        return true;
    }

    function handleKeyboard(e) {
        // Ignore if typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // Any key dismisses an open stat drop (and does nothing else)
        if (dismissStatDropIfOpen()) {
            e.preventDefault();
            return;
        }

        // Close overlays on Escape (decade picker applies its selection)
        if (e.key === 'Escape') {
            if (elements.decadeOverlay && !elements.decadeOverlay.classList.contains('hidden')) {
                closeAndApplyDecadePicker();
                return;
            }
            if (elements.statsOverlay && !elements.statsOverlay.classList.contains('hidden')) {
                closeStatsScreen();
                return;
            }
            if (!elements.modalOverlay.classList.contains('hidden')) {
                closeModal();
                return;
            }
        }

        // Rating/undo keys only act on the live Review deck — never off-screen or
        // behind an overlay / year takeover.
        const ratingKey = ['ArrowRight', 'd', 'D', 'ArrowLeft', 'a', 'A', 'z', 'Z'].indexOf(e.key) !== -1;
        if (ratingKey && !canReviewByKey()) return;

        switch (e.key) {
            case 'ArrowRight':
            case 'd':
            case 'D':
                e.preventDefault();
                animateButtonSwipe('right');
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                e.preventDefault();
                animateButtonSwipe('left');
                break;
            case 'z':
            case 'Z':
                e.preventDefault();
                if (!elements.undoBtn.disabled) {
                    SlidingWindow.undo();
                }
                break;
        }
    }

    /**
     * Animate swipe from button click
     * @param {string} direction - 'left' or 'right'
     */
    function animateButtonSwipe(direction) {
        // v3.7: input guard — a rapid double-tap or key repeat can't rate twice.
        if (isTransitioning) return;
        const topCard = elements.cardStack.firstElementChild;
        if (!topCard || SlidingWindow.isComplete()) return;

        isTransitioning = true;
        // Schedule the release FIRST so the guard can never stick, even if an
        // advance below were to throw (fallback for a missing animationend, too).
        setTimeout(() => { isTransitioning = false; }, 200);

        // Audio + gamification for the movie being rated (must run BEFORE we
        // advance, while it is still the current item).
        if (direction === 'right') {
            AudioManager.playSeenSound();
            handleSeenAction();
        } else {
            AudioManager.playSkipSound();
            handleSkipAction();
        }

        // v3.7: reveal the next card immediately. The outgoing card flies off on
        // its own overlay layer while the next poster renders underneath at once —
        // no fixed wait-for-animation timer (the old model waited 160ms first).
        flyOffCard(topCard, direction);
        if (direction === 'right') {
            SlidingWindow.markSeen();
        } else {
            SlidingWindow.markNotSeen();
        }
    }

    /**
     * v3.7 — Clone the just-rated card onto a fixed overlay and let it finish its
     * swipe animation independently, so the next card can appear instantly under
     * it. Purely cosmetic — wrapped so it can never block or break the rating.
     * @param {HTMLElement} cardEl
     * @param {string} direction - 'left' or 'right'
     */
    function flyOffCard(cardEl, direction) {
        try {
            const rect = cardEl.getBoundingClientRect();
            if (!rect || !rect.width) return;   // no layout (e.g. test env) — skip the effect
            const clone = cardEl.cloneNode(true);
            clone.classList.remove('flipped', 'show-watch', 'iconic-reveal');
            clone.classList.add(direction === 'right' ? 'swipe-right' : 'swipe-left');
            clone.style.cssText +=
                ';position:fixed;margin:0;pointer-events:none;z-index:50;' +
                'left:' + rect.left + 'px;top:' + rect.top + 'px;' +
                'width:' + rect.width + 'px;height:' + rect.height + 'px;';
            const layer = getFlyLayer();
            layer.appendChild(clone);
            const done = () => { if (clone.parentNode) clone.parentNode.removeChild(clone); };
            clone.addEventListener('animationend', done);
            setTimeout(done, 450);
        } catch (e) { /* cosmetic only — ignore */ }
    }

    function getFlyLayer() {
        if (flyLayer && flyLayer.parentNode) return flyLayer;
        flyLayer = document.createElement('div');
        flyLayer.className = 'pj-fly-layer';
        flyLayer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:50;overflow:hidden;';
        document.body.appendChild(flyLayer);
        return flyLayer;
    }

    /**
     * Animate the counter
     * @param {number} target - Target number
     */
    function animateCounter(target) {
        const current = parseInt(elements.currentCount.textContent) || 0;
        if (current === target) return;

        elements.currentCount.textContent = target;
        elements.currentCount.style.transform = 'scale(1.2)';
        setTimeout(() => {
            elements.currentCount.style.transform = '';
        }, 150);
    }

    /**
     * Preload images for upcoming cards
     * @param {Array} movies - Movies to preload
     */
    function preloadImages(movies) {
        movies.forEach(movie => {
            if (!imageCache.has(movie.id)) {
                const img = new Image();
                img.decoding = 'async';
                img.src = getPosterUrl(movie);
                // v3.7: decode ahead of time so the next poster paints instantly
                // instead of decoding on first display. Best-effort; ignore errors.
                if (typeof img.decode === 'function') { img.decode().catch(() => {}); }
                imageCache.set(movie.id, img);
            }
        });

        // Clean up old cache entries (keep only last 20)
        if (imageCache.size > 20) {
            const keysToDelete = Array.from(imageCache.keys()).slice(0, imageCache.size - 20);
            keysToDelete.forEach(key => imageCache.delete(key));
        }
    }

    /**
     * Update background image (desktop)
     * @param {Object} movie - Current movie
     */
    function updateBackground(movie) {
        if (!movie) return;

        // v3.0: ambient blurred backdrop on ALL devices. Prefer the wide
        // backdrop image; fall back to the poster. Size by viewport so
        // phones download a small source (it's blurred anyway).
        const isMobile = window.matchMedia('(max-width: 767px)').matches;
        const size = isMobile ? 'w300' : 'w780';
        const path = movie.backdrop_path || movie.poster_path || movie.poster;
        if (!path) return;

        const url = path.startsWith('http')
            ? path
            : `https://image.tmdb.org/t/p/${size}${path}`;
        elements.app.style.setProperty('--bg-image', `url(${url})`);
        elements.app.classList.add('has-bg');
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} str
     * @returns {string}
     */
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Get the full poster URL
     * Handles both absolute URLs (placeholders) and TMDB paths
     * @param {Object} movie
     * @returns {string}
     */
    function getPosterUrl(movie) {
        // Handle new data structure where property might be 'poster_path' or 'poster'
        const path = movie.poster_path || movie.poster;

        if (!path) return '';

        // If it starts with http, it's a full URL (legacy/placeholder data)
        if (path.startsWith('http')) {
            return path;
        }

        // Otherwise it's a TMDB path
        return `https://image.tmdb.org/t/p/w500${path}`;
    }

    // v3.4: small bridge so the Poster Journal shell can open the decade
    // filter and "Continue" into a decade. Reuses the existing, tested filter
    // path — it does NOT change persistence or share semantics.
    window.AppBridge = {
        openDecadePicker: function () { openDecadePicker(); },
        // v3.5: watchlist writes routed through app.js so the render-only shell
        // never persists state itself. Returns the new membership state.
        isWatchlisted: function (id) {
            return (typeof SlidingWindow !== 'undefined' && SlidingWindow.isWatchlisted)
                ? SlidingWindow.isWatchlisted(id) : false;
        },
        toggleWatchlist: function (id) {
            if (typeof SlidingWindow === 'undefined' || !SlidingWindow.toggleWatchlist) return false;
            const nowSaved = SlidingWindow.toggleWatchlist(id);
            persist();
            return nowSaved;
        },
        reviewDecade: function (eraId) {
            if (typeof SlidingWindow === 'undefined' || !eraId) return;
            suppressYearCardOnce = true;
            SlidingWindow.setActiveEras([eraId]);
            persist();
            elements.completionState.classList.add('hidden');
            elements.seenBtn.disabled = false;
            elements.skipBtn.disabled = false;
            const prog = SlidingWindow.getProgress();
            if (prog.remaining <= 0) {
                showFilterNotice('Nothing left in this decade — add more decades', 'empty');
            } else {
                showFilterNotice(`Showing ${SlidingWindow.getCurrentEra()} — ${prog.remaining.toLocaleString()} left to review`);
            }
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
