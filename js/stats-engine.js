/**
 * Stats Engine (v3.1.0)
 *
 * Computes personal insights for "stat drop" interstitials, purely from
 * local data — no network, no tracking. Pure functions over the items
 * array + rating state so everything is unit-testable in Node.
 */

const StatsEngine = (function () {
    'use strict';

    let lastInsightType = null;

    /**
     * How many SEEN movies share this director (including the one just rated).
     */
    function directorSeenCount(items, seenSet, director) {
        if (!director) return 0;
        let count = 0;
        for (const m of items) {
            const d = m.credits && m.credits.director;
            if (d === director && seenSet.has(m.id)) count++;
        }
        return count;
    }

    /**
     * Is every movie from `year` rated?
     */
    function isYearComplete(items, ratedSet, year) {
        let total = 0;
        for (const m of items) {
            if (m.year === year) {
                total++;
                if (!ratedSet.has(m.id)) return false;
            }
        }
        return total > 0;
    }

    /**
     * Progress through a decade: { rated, total, pct }
     */
    function decadeProgress(items, ratedSet, minYear, maxYear) {
        let total = 0, rated = 0;
        for (const m of items) {
            if (m.year >= minYear && m.year <= maxYear) {
                total++;
                if (ratedSet.has(m.id)) rated++;
            }
        }
        return { rated, total, pct: total > 0 ? Math.round((rated / total) * 100) : 0 };
    }

    /**
     * Seen-rate across the last N history entries.
     */
    function recentSeenRate(history, n) {
        const recent = history.slice(-n);
        if (recent.length === 0) return null;
        const seen = recent.filter(h => h.action === 'seen').length;
        return { seen, of: recent.length };
    }

    /**
     * Pick the best insight for this moment. Returns {title, line} or null.
     * Rotates away from the previously shown type so drops don't repeat.
     *
     * @param {Object} p
     *   - items: full item array
     *   - justRated: the movie that was just rated
     *   - wasSeen: whether it was rated "seen"
     *   - seen / notSeen: arrays of IDs
     *   - history: [{id, action}]
     *   - eras: config era groups [{id, min, max}]
     *   - ranks: config ranks [{threshold, name}]
     */
    function computeInsight(p) {
        const seenSet = new Set(p.seen);
        const ratedSet = new Set([...p.seen, ...p.notSeen]);
        const candidates = [];

        // 1. Year completed (rare, satisfying)
        if (p.justRated && isYearComplete(p.items, ratedSet, p.justRated.year)) {
            candidates.push({
                type: 'year',
                weight: 100,
                title: `${p.justRated.year}: complete!`,
                line: `You've rated every ${p.justRated.year} movie in the challenge.`,
            });
        }

        // 2. Director milestone (2nd+ seen film by the same director)
        if (p.justRated && p.wasSeen) {
            const director = p.justRated.credits && p.justRated.credits.director;
            const count = directorSeenCount(p.items, seenSet, director);
            if (director && count >= 2) {
                const ordinal = count === 2 ? '2nd' : count === 3 ? '3rd' : `${count}th`;
                candidates.push({
                    type: 'director',
                    weight: 80,
                    title: `That's your ${ordinal} ${director}`,
                    line: `You've now seen ${count} of their films in this challenge.`,
                });
            }
        }

        // 3. Decade milestone (crossed 25/50/75/100%)
        if (p.justRated && p.eras) {
            const era = p.eras.find(e => p.justRated.year >= e.min && p.justRated.year <= e.max);
            if (era) {
                const prog = decadeProgress(p.items, ratedSet, era.min, era.max);
                const milestones = [25, 50, 75];
                // Fire only when this rating crossed the line
                const before = prog.rated - 1;
                const pctBefore = prog.total > 0 ? Math.floor((before / prog.total) * 100) : 0;
                for (const ms of milestones) {
                    if (prog.pct >= ms && pctBefore < ms) {
                        candidates.push({
                            type: 'decade',
                            weight: 70,
                            title: `${era.id}: ${ms}% explored`,
                            line: `${prog.rated} of ${prog.total} ${era.id} movies rated.`,
                        });
                        break;
                    }
                }
            }
        }

        // 4. Rank distance (when close)
        if (p.ranks) {
            const totalSeen = p.seen.length;
            const next = p.ranks.find(r => r.threshold > totalSeen);
            if (next) {
                const away = next.threshold - totalSeen;
                if (away <= 15) {
                    candidates.push({
                        type: 'rank',
                        weight: 60,
                        title: `${away} away from ${next.name}`,
                        line: `Keep going — the next rank is within reach.`,
                    });
                }
            }
        }

        // 5. Recent seen-rate (always available fallback)
        const rate = recentSeenRate(p.history || [], 25);
        if (rate && rate.of >= 10) {
            candidates.push({
                type: 'rate',
                weight: 20,
                title: `You've seen ${rate.seen} of the last ${rate.of}`,
                line: rate.seen / rate.of >= 0.5
                    ? `Strong run — your film history runs deep here.`
                    : `Plenty of discoveries waiting in this stretch.`,
            });
        }

        if (candidates.length === 0) return null;

        // Prefer the heaviest candidate that isn't a repeat of last time
        candidates.sort((a, b) => b.weight - a.weight);
        const pick = candidates.find(c => c.type !== lastInsightType) || candidates[0];
        lastInsightType = pick.type;
        return pick;
    }

    // Public API
    return {
        computeInsight,
        // exposed for unit tests
        directorSeenCount,
        isYearComplete,
        decadeProgress,
        recentSeenRate,
        _resetRotation() { lastInsightType = null; },
    };
})();

// Export for ES modules / tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StatsEngine;
}
