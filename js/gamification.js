/**
 * Gamification Manager - Streaks, Ranks, Achievements & Effects
 */

const GamificationManager = (function () {
    'use strict';

    // State
    let currentStreak = 0;
    let bestStreak = 0;
    let totalSeen = 0;
    let firedMilestones = new Set();

    // Feature flags (loaded from config)
    let enableStreaks = true;
    let enableRanks = true;
    let enableMilestones = true;
    let enableConfetti = true;

    // Rank definitions (loaded from config or defaults)
    let ranks = [
        { threshold: 0, name: 'Extra', emoji: '🎬' },
        { threshold: 100, name: 'Supporting Actor', emoji: '🎭' },
        { threshold: 500, name: 'Lead Actor', emoji: '⭐' },
        { threshold: 1000, name: 'Director', emoji: '🎥' },
        { threshold: 2500, name: 'Producer', emoji: '🏆' },
        { threshold: 4000, name: 'Legend', emoji: '👑' }
    ];

    // Milestone thresholds (loaded from config or defaults)
    let milestones = [10, 50, 100, 250, 500, 1000, 2000, 3000, 4000, 5000];

    // Emoji mapping for config-based ranks
    const emojiMap = {
        'film': '🎬',
        'theater': '🎭',
        'star': '⭐',
        'camera': '🎥',
        'trophy': '🏆',
        'crown': '👑',
        'book': '📚',
        'pen': '🖊️',
        'graduation': '🎓',
        'music': '🎵',
        'headphones': '🎧',
        'game': '🎮',
        'controller': '🕹️',
    };

    /**
     * Load configuration values
     */
    function loadConfig() {
        if (typeof ConfigLoader !== 'undefined' && ConfigLoader.isInitialized) {
            const config = ConfigLoader.get();
            const gamification = config.gamification;

            // Load feature flags
            enableStreaks = gamification.enableStreaks !== false;
            enableRanks = gamification.enableRanks !== false;
            enableMilestones = gamification.enableMilestones !== false;
            enableConfetti = gamification.enableConfetti !== false;

            // Load ranks from config, converting emoji strings to actual emojis
            if (gamification.ranks && gamification.ranks.length > 0) {
                ranks = gamification.ranks.map(rank => ({
                    threshold: rank.threshold,
                    name: rank.name,
                    emoji: emojiMap[rank.emoji] || rank.emoji || '⭐'
                }));
            }

            // Load milestones from config
            if (gamification.milestones && gamification.milestones.length > 0) {
                milestones = gamification.milestones;
            }
        }
    }

    /**
     * Initialize with saved state
     */
    function init(seenCount, savedBestStreak = 0) {
        // Load config values first
        loadConfig();

        totalSeen = seenCount;
        bestStreak = savedBestStreak;
        currentStreak = 0;
        // Mark milestones already passed as fired
        firedMilestones = new Set(milestones.filter(m => m <= seenCount));
    }

    /**
     * Record a "Seen" action - builds streak
     */
    function recordSeen() {
        if (enableStreaks) {
            currentStreak++;

            if (currentStreak > bestStreak) {
                bestStreak = currentStreak;
            }
        }

        totalSeen++;

        const result = {
            streak: enableStreaks ? currentStreak : 0,
            isNewBest: enableStreaks && currentStreak === bestStreak && currentStreak > 1,
            milestone: null,
            rankUp: null
        };

        // Check for milestone
        if (enableMilestones && milestones.includes(totalSeen)) {
            result.milestone = totalSeen;
            firedMilestones.add(totalSeen);
        }

        // Check for rank up
        if (enableRanks) {
            const newRank = getRank(totalSeen);
            const previousRank = getRank(totalSeen - 1);
            if (newRank.name !== previousRank.name) {
                result.rankUp = newRank;
            }
        }

        return result;
    }

    /**
     * Record a "Skip" action - breaks streak
     */
    function recordSkip() {
        const wasStreak = currentStreak;
        if (enableStreaks) {
            currentStreak = 0;
        }
        return { brokenStreak: wasStreak };
    }

    /**
     * Record an undo - adjusts state
     * @param {boolean} wasSeen - true if the undone action was 'seen', false if 'notSeen'
     */
    function recordUndo(wasSeen) {
        if (wasSeen) {
            totalSeen = Math.max(0, totalSeen - 1);
        }
        // Always reset streak on undo
        currentStreak = 0;
    }

    /**
     * Sync totalSeen from authoritative source (SlidingWindow)
     * Call after undo to prevent drift
     */
    function syncSeenCount(count) {
        totalSeen = count;
    }

    /**
     * Get current rank based on seen count
     */
    function getRank(seenCount = totalSeen) {
        let currentRank = ranks[0];
        for (const rank of ranks) {
            if (seenCount >= rank.threshold) {
                currentRank = rank;
            }
        }
        return currentRank;
    }

    /**
     * Get progress to next rank
     */
    function getNextRankProgress() {
        const currentRank = getRank();
        const nextRank = ranks.find(r => r.threshold > totalSeen);

        if (!nextRank) {
            return { current: currentRank, next: null, progress: 100 };
        }

        const prevThreshold = currentRank.threshold;
        const nextThreshold = nextRank.threshold;
        const progress = ((totalSeen - prevThreshold) / (nextThreshold - prevThreshold)) * 100;

        return { current: currentRank, next: nextRank, progress: Math.min(progress, 100) };
    }

    /**
     * Get streak display info
     */
    function getStreakDisplay() {
        if (currentStreak < 2) return null;

        return {
            count: currentStreak,
            flames: Math.min(currentStreak, 10), // Max 10 flames displayed
            isHot: currentStreak >= 5,
            isOnFire: currentStreak >= 10
        };
    }

    /**
     * Simple confetti effect (CSS-based, no library)
     */
    function triggerConfetti(container) {
        if (!enableConfetti) return;

        const colors = ['#ff0', '#f0f', '#0ff', '#0f0', '#f00', '#00f'];
        const confettiCount = 50;

        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti-piece';
            confetti.style.cssText = `
                position: fixed;
                width: 10px;
                height: 10px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                left: ${50 + (Math.random() - 0.5) * 60}%;
                top: -10px;
                opacity: 1;
                pointer-events: none;
                z-index: 1000;
                transform: rotate(${Math.random() * 360}deg);
                animation: confetti-fall ${2 + Math.random() * 2}s ease-out forwards;
                animation-delay: ${Math.random() * 0.5}s;
            `;

            document.body.appendChild(confetti);

            // Clean up after animation
            setTimeout(() => confetti.remove(), 4000);
        }
    }

    /**
     * Get current state for saving
     */
    function getState() {
        return {
            bestStreak,
            totalSeen
        };
    }

    // Public API
    return {
        init,
        recordSeen,
        recordSkip,
        recordUndo,
        syncSeenCount,
        getRank,
        getNextRankProgress,
        getStreakDisplay,
        triggerConfetti,
        getState,
        get currentStreak() { return currentStreak; },
        get bestStreak() { return bestStreak; },
        get totalSeen() { return totalSeen; }
    };
})();
