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
        backupBtn: document.getElementById('backupBtn')
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

    // Current mode for code input
    let codeInputMode = null; // 'export' or 'import'

    // Track last backup reminder milestone
    let lastBackupReminder = 0;

    /**
     * Initialize the application
     */
    function init() {
        try {
            // Initialize config system first
            config = ConfigLoader.init();

            // Initialize ItemManager
            ItemManager.init();

            // Initialize StorageManager with config
            StorageManager.init();

            // Check for URL-based progress first (for shared links)
            let savedState = StorageManager.checkURLForProgress();

            if (savedState) {
                // Progress restored from URL - save it locally
                StorageManager.save(savedState);
                showToast('Progress restored from link!', 'success');
            } else {
                // Load saved state from localStorage
                savedState = StorageManager.load();
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

            // Initialize the sliding window
            SlidingWindow.init(items, savedState, {
                onUpdate: handleUpdate,
                onComplete: handleComplete
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
                loadingEl.innerHTML = '<p style="color:red;padding:20px;text-align:center;">Error: ' + error.message + '<br><br>Please refresh the page.</p>';
            }
        }
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
            <span>💡 Tip: Use "Export Code" in the ☰ menu to backup your progress. Private browsing won't save data.</span>
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
     * Handle updates from the sliding window
     * @param {Object} data - Update data
     */
    function handleUpdate(data) {
        // Update progress bar
        elements.progressBar.style.width = `${data.progress.percent}%`;

        // Update counter with animation
        animateCounter(data.progress.current);

        // Update decade badge
        elements.decadeBadge.textContent = data.decade;

        // Update undo button state
        elements.undoBtn.disabled = !data.canUndo;

        // Update action bar counters (seen/not seen tally)
        elements.seenCounter.textContent = data.progress.seen.toLocaleString();
        elements.notSeenCounter.textContent = data.progress.notSeen.toLocaleString();

        // Render cards
        renderCards(data.window);

        // Preload images
        preloadImages(data.preload);

        // Save state
        StorageManager.save(data.state);

        // Update background (desktop)
        updateBackground(data.window[0]);

        // Update theme based on current movie's year
        if (data.window[0]) {
            const themeResult = ThemeManager.updateForYear(data.window[0].year);
            if (themeResult.changed && themeResult.from !== null) {
                // Decade changed! Celebrate
                AudioManager.playDecadeTransition();
                showDecadeToast(themeResult.theme);
            }
        }

        // Check for 100-movie backup reminder (mobile only)
        checkBackupReminder(data.progress.seen + data.progress.notSeen);
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
            <span>🎉 ${milestone} ${itemTypePlural} rated! Backup your progress?</span>
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
     * Show decade transition toast
     */
    function showDecadeToast(theme) {
        const toast = document.createElement('div');
        toast.className = 'decade-toast';
        toast.innerHTML = `
            <h2>Welcome to the ${theme.displayName}</h2>
            <p>Time travel mode activated</p>
        `;
        document.body.appendChild(toast);

        // Remove after animation
        setTimeout(() => toast.remove(), 2500);
    }

    /**
     * Handle challenge completion
     * @param {Object} state - Final state
     */
    function handleComplete(state) {
        elements.cardStack.innerHTML = '';
        elements.completionState.classList.remove('hidden');

        const stats = StorageManager.getStats(state);
        const totalCount = config.data.totalCount.toLocaleString();
        const itemTypePlural = config.itemTypePlural || 'movies';
        const positiveLabel = config.actions.positive.pastTense || 'seen';
        const negativeLabel = config.actions.negative.pastTense || 'not seen';

        elements.completionStats.innerHTML = `
            You've rated all <strong>${totalCount}</strong> ${itemTypePlural}!<br>
            ${positiveLabel.charAt(0).toUpperCase() + positiveLabel.slice(1)}: <span style="color: var(--accent-seen)">${stats.seenCount}</span> |
            ${negativeLabel.charAt(0).toUpperCase() + negativeLabel.slice(1)}: <span style="color: var(--accent-skip)">${stats.notSeenCount}</span>
        `;

        // Disable action buttons
        elements.seenBtn.disabled = true;
        elements.skipBtn.disabled = true;
    }

    /**
     * Render movie cards in the stack
     * @param {Array} movies - Movies to render
     */
    function renderCards(movies) {
        // Clear existing cards
        elements.cardStack.innerHTML = '';

        // Render in direct order (First item is Top Card due to CSS z-index)
        movies.forEach((movie, index) => {
            const card = createCardElement(movie, index === 0);
            elements.cardStack.appendChild(card);
        });

        // Attach drag listeners to top card (First Child)
        const topCard = elements.cardStack.firstElementChild;
        if (topCard) {
            attachDragListeners(topCard);
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
        card.className = 'movie-card';
        card.dataset.id = movie.id;

        // Generate rating stars
        const rating = movie.vote_average || 0;
        const fullStars = Math.floor(rating / 2);
        const halfStar = rating % 2 >= 1;
        const stars = '★'.repeat(fullStars) + (halfStar ? '½' : '') + '☆'.repeat(5 - fullStars - (halfStar ? 1 : 0));

        // Truncate overview for display on back
        const overview = movie.overview || 'No description available.';
        const truncatedOverview = overview.length > 300 ? overview.substring(0, 297) + '...' : overview;

        card.innerHTML = `
            <div class="card-inner">
                <div class="card-front">
                    <img 
                        class="card-poster" 
                        src="${getPosterUrl(movie)}" 
                        alt="${movie.title} poster"
                        loading="${isTop ? 'eager' : 'lazy'}"
                        onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 600%22><rect fill=%22%231a1a1a%22 width=%22400%22 height=%22600%22/><text x=%22200%22 y=%22300%22 text-anchor=%22middle%22 fill=%22%23555%22 font-size=%2224%22>No Poster</text></svg>'"
                    >
                    <div class="card-overlay">
                        <h2 class="card-title">${escapeHtml(movie.title)}</h2>
                        <p class="card-year">${movie.year}</p>
                    </div>
                    
                    <button class="info-btn" aria-label="More Info">Info</button>

                    <div class="swipe-indicator seen">SEEN</div>
                    <div class="swipe-indicator skip">NOPE</div>
                </div>
                <div class="card-back">
                    <div class="card-back-header">
                    <span class="card-back-title">${escapeHtml(movie.title)}</span>
                    <span class="card-back-year">${movie.year}</span>
                </div>
                <div class="card-back-rating">
                    <div class="rating-stars">${'★'.repeat(fullStars)}${halfStar ? '½' : ''}${'☆'.repeat(5 - fullStars - (halfStar ? 1 : 0))}</div>
                    <span class="rating-value">${rating.toFixed(1)}/10</span>
                </div>
                
                ${movie.runtime || movie.director ? `
                <div class="card-back-meta">
                    ${movie.runtime ? `<span>⏱ ${movie.runtime}m</span>` : ''}
                    ${movie.director ? `<span>🎬 ${movie.director}</span>` : ''}
                </div>` : ''}
                
                ${movie.cast && movie.cast.length ? `
                <div class="card-back-cast">
                    <strong>Cast:</strong> ${movie.cast.join(', ')}
                </div>` : ''}

                <div class="card-back-overview">${escapeHtml(truncatedOverview)}</div>
                
                <div class="card-back-footer">
                    Tap to flip back
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
                    card.classList.toggle('flipped');
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
        }

        return card;
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
        const result = GamificationManager.recordSeen();
        updateStreakDisplay(result.streak);

        // Check for milestone
        if (result.milestone) {
            AudioManager.playMilestoneSound();
            GamificationManager.triggerConfetti();
            showToast(`🎉 ${result.milestone} movies seen!`, 'success');
        }

        // Check for rank up
        if (result.rankUp) {
            setTimeout(() => {
                showToast(`${result.rankUp.emoji} Rank Up: ${result.rankUp.name}!`, 'success');
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
        GamificationManager.recordSkip();
        hideStreakDisplay();
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

        if (streak >= 5) {
            elements.streakIndicator.classList.add('hot');
        } else {
            elements.streakIndicator.classList.remove('hot');
        }
    }

    /**
     * Hide streak display
     */
    function hideStreakDisplay() {
        elements.streakIndicator.classList.add('hidden');
        elements.streakIndicator.classList.remove('hot');
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
            GamificationManager.recordUndo(true);
            hideStreakDisplay();
            SlidingWindow.undo();
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
        // Close backup modal on overlay click
        if (elements.backupModal) {
            elements.backupModal.querySelector('.modal-overlay')?.addEventListener('click', closeBackupModal);
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

        showToast(isEnabled ? '🔊 Sound On' : '🔇 Sound Off', 'success');
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
        const progress = SlidingWindow.getProgress();
        elements.statSeen.textContent = progress.seen.toLocaleString();
        elements.statSkipped.textContent = progress.notSeen.toLocaleString();
        elements.statRemaining.textContent = progress.remaining.toLocaleString();
    }

    // ===== EXPORT/IMPORT FUNCTIONS =====

    function handleExport() {
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

        StorageManager.save(newState);

        // Reinitialize the sliding window
        SlidingWindow.init(ItemManager.getAll(), newState, {
            onUpdate: handleUpdate,
            onComplete: handleComplete
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
        const progress = SlidingWindow.getProgress();
        const percentSeen = progress.current > 0
            ? Math.round((progress.seen / progress.current) * 100)
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

✅ ${positiveLabel.charAt(0).toUpperCase() + positiveLabel.slice(1)}: ${progress.seen.toLocaleString()} ${itemTypePlural} (${percentSeen}%)
❌ ${negativeLabel.charAt(0).toUpperCase() + negativeLabel.slice(1)}: ${progress.notSeen.toLocaleString()}
📊 Progress: ${progress.current.toLocaleString()} / ${totalCount}
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

        items.forEach(item => {
            if (seenSet.has(item.id)) {
                const era = getEra(item.year);
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
    function handleKeyboard(e) {
        // Ignore if typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // Close modal on Escape
        if (e.key === 'Escape' && !elements.modalOverlay.classList.contains('hidden')) {
            closeModal();
            return;
        }

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
        const topCard = elements.cardStack.lastElementChild;
        if (!topCard || SlidingWindow.isComplete()) return;

        topCard.classList.add(direction === 'right' ? 'swipe-right' : 'swipe-left');

        // Play audio and track gamification
        if (direction === 'right') {
            AudioManager.playSeenSound();
            handleSeenAction();
        } else {
            AudioManager.playSkipSound();
            handleSkipAction();
        }

        setTimeout(() => {
            if (direction === 'right') {
                SlidingWindow.markSeen();
            } else {
                SlidingWindow.markNotSeen();
            }
        }, 300);
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
                img.src = getPosterUrl(movie);
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

        if (window.matchMedia('(min-width: 768px)').matches) {
            const url = getPosterUrl(movie);
            elements.app.style.setProperty('--bg-image', `url(${url})`);
            elements.app.classList.add('has-bg');

            // Apply to ::before pseudo-element via CSS custom property
            document.documentElement.style.setProperty('--current-poster', `url(${url})`);
        }
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

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
