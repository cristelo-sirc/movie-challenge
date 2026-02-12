/**
 * Build Movie Pool
 * 
 * Implements the 3-Layer Curation Strategy:
 * 1. Layer 1: Cable Canon (Auto-include from data/cable_canon.js)
 * 2. Layer 2: Cultural Reach Scorer (Include if score >= threshold)
 * 3. Layer 3: Dedup & Merge
 * 
 * Usage: node scripts/build_movie_pool.js
 */

const fs = require('fs');
const path = require('path');
const { scoreMovie, calculateMoviesStats } = require('./cultural_reach_scorer');

const MOVIES_FILE = path.join(__dirname, '../data/movies_raw.js'); // Source (14k)
const CANON_FILE = path.join(__dirname, '../data/cable_canon.js');
const OUTPUT_FILE = path.join(__dirname, '../data/movies.js');     // Output (Curated)
const REPORT_FILE = path.join(__dirname, '../data/curation_report.txt');

// Per-Decade Thresholds
// 1980s/90s: 0.45 (Keep cult favorites)
// 2000s:     0.52 (Trim the DVD boom bloat)
// 2010s+:    0.53 (Trim streaming era bloat)
const DECADE_THRESHOLDS = {
    1980: 0.42, // Lowered from 0.45 to recover count
    1990: 0.42,
    2000: 0.48, // Lowered from 0.52
    2010: 0.49, // Lowered from 0.53
    2020: 0.49
};

function loadMovies() {
    if (!fs.existsSync(MOVIES_FILE)) {
        console.error(`Error: ${MOVIES_FILE} not found. Run fetch_movies.js first.`);
        process.exit(1);
    }
    const content = fs.readFileSync(MOVIES_FILE, 'utf8');
    const start = content.indexOf('[');
    const end = content.lastIndexOf(']');
    return JSON.parse(content.substring(start, end + 1));
}

function loadCanonIds() {
    if (!fs.existsSync(CANON_FILE)) return new Set();
    const canon = require(CANON_FILE);
    const ids = new Set();

    // Helper to add from list
    const addMovies = (list) => {
        if (!list) return;
        list.forEach(m => {
            if (m.tmdb_id) ids.add(m.tmdb_id);
        });
    };

    addMovies(canon.hbo80s);
    addMovies(canon.usaUpAllNight);
    addMovies(canon.tntTbsConsensus);
    // addMovies(canon.userRequests); // Disabled for organic verification check

    return ids;
}

function main() {
    console.log('Building Final Movie Pool...');

    // 1. Load Data
    const rawMovies = loadMovies();
    const canonIds = loadCanonIds();
    console.log(`Loaded ${rawMovies.length} raw movies.`);
    console.log(`Loaded ${canonIds.size} cable canon IDs.`);

    // 2. Score All Movies
    const stats = calculateMoviesStats(rawMovies);
    const scoredMovies = rawMovies.map(m => scoreMovie(m, stats));

    // 3. Filter & Tag
    const finalPool = [];
    let sourceStats = {
        canon_only: 0,
        score_only: 0,
        both: 0,
        rejected: 0
    };

    for (const m of scoredMovies) {
        const isCanon = canonIds.has(m.id);

        // Determine threshold based on decade
        const decade = Math.floor(m.year / 10) * 10;
        const threshold = DECADE_THRESHOLDS[decade] || 0.50; // Fallback

        const isHighScorer = m.score >= threshold;

        if (isCanon || isHighScorer) {
            // Determine source tag
            let source = 'score';
            if (isCanon && isHighScorer) {
                source = 'both';
                sourceStats.both++;
            } else if (isCanon) {
                source = 'canon';
                sourceStats.canon_only++;
            } else {
                source = 'score';
                sourceStats.score_only++;
            }

            // Add to pool
            finalPool.push({
                ...m,
                curation_source: source
            });
        } else {
            sourceStats.rejected++;
        }
    }

    // 4. Sort Chronologically
    finalPool.sort((a, b) => a.year - b.year);

    // 5. Final Year Filter (Strict 1980+)
    const filteredPool = finalPool.filter(m => m.year >= 1980);
    const removedCount = finalPool.length - filteredPool.length;
    if (removedCount > 0) {
        console.log(`Removed ${removedCount} movies released before 1980.`);
    }

    // 6. Generate Report
    const report = [
        `Curation Report - ${new Date().toISOString()}`,
        `============================================`,
        `Strategy: Per-Decade Thresholds (${JSON.stringify(DECADE_THRESHOLDS)})`,
        `Total Input: ${rawMovies.length}`,
        `Final Pool:  ${filteredPool.length}`,
        ``,
        `Source Breakdown:`,
        `  - Canon Only (Rescue): ${sourceStats.canon_only}`,
        `  - Score Only (Reach):  ${sourceStats.score_only}`,
        `  - Both (Core):         ${sourceStats.both}`,
        `  - Rejected:            ${sourceStats.rejected}`,
        ``,
        `Per Decade Breakdown:`,
    ];

    const decadeCounts = {};
    filteredPool.forEach(m => {
        const dec = Math.floor(m.year / 10) * 10;
        decadeCounts[dec] = (decadeCounts[dec] || 0) + 1;
    });

    Object.keys(decadeCounts).sort().forEach(dec => {
        report.push(`  ${dec}s: ${decadeCounts[dec]}`);
    });

    console.log(report.join('\n'));
    fs.writeFileSync(REPORT_FILE, report.join('\n'));

    // 7. Write Output
    const fileContent = `/**
 * 5000 Movie Challenge - Curated Dataset
 * Generated: ${new Date().toISOString()}
 * Strategy: Variable Decade Thresholds
 * Total: ${filteredPool.length}
 */

var MOVIES = ${JSON.stringify(filteredPool, null, 2)};

// Export for ES modules if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MOVIES;
}
`;

    fs.writeFileSync(OUTPUT_FILE, fileContent);
    console.log(`\nSaved final pool to ${OUTPUT_FILE}`);
}

main();
