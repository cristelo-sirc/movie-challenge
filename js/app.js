/**
 * Main Application for 5000 Movie Challenge
 * Ties together the sliding window engine, storage, and UI
 */

(function () {
    'use strict';

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
        // New elements
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
        statRemaining: document.getElementById('statRemaining')
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

    /**
     * Initialize the application
     */
    function init() {
        // Load saved state
        const savedState = StorageManager.load();

        // Initialize the sliding window
        SlidingWindow.init(MOVIES, savedState, {
            onUpdate: handleUpdate,
            onComplete: handleComplete
        });

        // Set up event listeners
        setupEventListeners();

        // Hide loading, show cards
        elements.loadingState.classList.add('hidden');
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

        // Render cards
        renderCards(data.window);

        // Preload images
        preloadImages(data.preload);

        // Save state
        StorageManager.save(data.state);

        // Update background (desktop)
        updateBackground(data.window[0]);
    }

    /**
     * Handle challenge completion
     * @param {Object} state - Final state
     */
    function handleComplete(state) {
        elements.cardStack.innerHTML = '';
        elements.completionState.classList.remove('hidden');

        const stats = StorageManager.getStats(state);
        elements.completionStats.innerHTML = `
            You've rated all <strong>5,000</strong> movies!<br>
            Seen: <span style="color: var(--accent-seen)">${stats.seenCount}</span> | 
            Not Seen: <span style="color: var(--accent-skip)">${stats.notSeenCount}</span>
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

        // Render in reverse order so first item is on top
        movies.slice().reverse().forEach((movie, reverseIndex) => {
            const index = movies.length - 1 - reverseIndex;
            const card = createCardElement(movie, index === 0);
            elements.cardStack.appendChild(card);
        });

        // Attach drag listeners to top card
        const topCard = elements.cardStack.lastElementChild;
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

        card.innerHTML = `
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
            <div class="swipe-indicator seen">SEEN</div>
            <div class="swipe-indicator skip">SKIP</div>
        `;

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
            setTimeout(() => SlidingWindow.markSeen(), 300);
        } else if (dragState.currentX < -SWIPE_THRESHOLD) {
            // Swipe left - Not Seen
            card.classList.add('swipe-left');
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

        // Reset in modal
        elements.resetProgressBtn.addEventListener('click', () => {
            closeModal();
            handleReset();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboard);
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
        const exportData = {
            v: 1,
            s: state.seen,
            n: state.notSeen,
            i: state.currentIndex,
            t: Date.now()
        };

        // Compress to base64
        const json = JSON.stringify(exportData);
        const encoded = btoa(json);

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

        try {
            const json = atob(code);
            const data = JSON.parse(json);

            if (!data.v || !Array.isArray(data.s) || !Array.isArray(data.n)) {
                throw new Error('Invalid format');
            }

            // Apply the imported state
            const newState = {
                currentIndex: data.i || 0,
                seen: data.s,
                notSeen: data.n,
                history: []
            };

            StorageManager.save(newState);

            // Reinitialize the sliding window
            SlidingWindow.init(MOVIES, newState, {
                onUpdate: handleUpdate,
                onComplete: handleComplete
            });

            closeModal();
            showToast(`Imported ${data.s.length + data.n.length} ratings!`, 'success');

            // Re-enable buttons if not complete
            if (!SlidingWindow.isComplete()) {
                elements.seenBtn.disabled = false;
                elements.skipBtn.disabled = false;
                elements.completionState.classList.add('hidden');
            }

        } catch (e) {
            showToast('Invalid progress code', 'error');
        }
    }

    // ===== SHARE FUNCTION =====

    function shareResults() {
        const progress = SlidingWindow.getProgress();
        const percentSeen = progress.current > 0
            ? Math.round((progress.seen / progress.current) * 100)
            : 0;

        // Calculate decade breakdown
        const state = SlidingWindow.getState();
        const decadeStats = calculateDecadeStats(state.seen);
        const bestDecade = Object.entries(decadeStats)
            .sort((a, b) => b[1] - a[1])[0];

        const shareText = `🎬 My 5000 Movie Challenge Progress

✅ Seen: ${progress.seen.toLocaleString()} movies (${percentSeen}%)
❌ Skipped: ${progress.notSeen.toLocaleString()}
📊 Progress: ${progress.current.toLocaleString()} / 5,000
${bestDecade ? `🏆 Favorite decade: ${bestDecade[0]} (${bestDecade[1]} seen)` : ''}

#5000MovieChallenge`;

        // Try native share API first (mobile)
        if (navigator.share) {
            navigator.share({
                title: '5000 Movie Challenge',
                text: shareText
            }).catch(() => {
                // Fall back to clipboard
                copyShareText(shareText);
            });
        } else {
            copyShareText(shareText);
        }
    }

    function copyShareText(text) {
        navigator.clipboard.writeText(text)
            .then(() => showToast('Results copied to clipboard!', 'success'))
            .catch(() => showToast('Failed to copy results', 'error'));
    }

    function calculateDecadeStats(seenIds) {
        const stats = {
            '1980s': 0,
            '1990s': 0,
            '2000s': 0,
            '2010s': 0,
            '2020s': 0
        };

        const seenSet = new Set(seenIds);

        MOVIES.forEach(movie => {
            if (seenSet.has(movie.id)) {
                const decade = getDecade(movie.year);
                stats[decade]++;
            }
        });

        return stats;
    }

    function getDecade(year) {
        if (year < 1990) return '1980s';
        if (year < 2000) return '1990s';
        if (year < 2010) return '2000s';
        if (year < 2020) return '2010s';
        return '2020s';
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
