/**
 * TMDB Data Builder Script for 5000 Movie Challenge
 * 
 * Fetches top movies from 1980-2025 using The Movie Database (TMDB) API.
 * 
 * Usage:
 * 1. Get a free API key from https://www.themoviedb.org/documentation/api
 * 2. Run: node scripts/fetch_movies.js YOUR_API_KEY
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const START_YEAR = 1980;
const END_YEAR = 2025;
const TARGET_TOTAL = 5000;
const OUTPUT_FILE = path.join(__dirname, '../data/movies_raw.js');
const CANON_FILE = path.join(__dirname, '../data/cable_canon.js');

// Helper to get all canon IDs
function getCanonIds() {
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

    return ids;
}

// Get API Key from args
const API_KEY = process.argv[2];

if (!API_KEY) {
    console.error(`
❌ Error: API Key missing.

Usage: node scripts/fetch_movies.js <TMDB_API_KEY>

To get a key:
1. Sign up at https://www.themoviedb.org/
2. Go to Settings > API
3. Copy your "API Key (v3 auth)"
    `);
    process.exit(1);
}

const TOTAL_YEARS = END_YEAR - START_YEAR + 1;
const MOVIES_PER_YEAR = Math.ceil(TARGET_TOTAL / TOTAL_YEARS); // ~109 movies/year

console.log(`
🎬 5000 Movie Challenge - Data Builder
======================================
Target: ${TARGET_TOTAL} movies
Range:  ${START_YEAR} - ${END_YEAR}
Per Year: ~${MOVIES_PER_YEAR}
Output: ${OUTPUT_FILE}
`);

const allMovies = [];

// Helper to fetch JSON
function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Helper to delay (rate limiting)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchMoviesForYear(year, limit) {
    let movies = [];
    let page = 1;

    // We need about 25 pages (20 items per page) to get 500 movies
    const maxPages = Math.ceil(limit / 20) + 1;

    while (movies.length < limit && page <= maxPages) {
        const url = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&include_video=false&primary_release_year=${year}&vote_count.gte=50&page=${page}`; // Lowered vote count floor to 50 for deep cuts

        try {
            const data = await fetchJson(url);

            if (!data.results || data.results.length === 0) break;

            for (const m of data.results) {
                // FOREIGN LANGUAGE FILTER
                // Rule: Must be English OR have massive global popularity (> 2000 votes)
                const isEnglish = m.original_language === 'en';
                const isGlobalHit = m.vote_count > 2000;

                if (!isEnglish && !isGlobalHit) continue;

                if (m.poster_path && m.backdrop_path) {
                    movies.push({
                        id: m.id,
                        title: m.title,
                        year: year,
                        original_language: m.original_language, // Capture for debug
                        poster_path: m.poster_path,
                        backdrop_path: m.backdrop_path,
                        overview: m.overview,
                        vote_average: m.vote_average,
                        vote_count: m.vote_count,
                        popularity: m.popularity
                    });
                }
            }

            page++;
            await sleep(100); // Be nice to the API
        } catch (e) {
            console.error(`Error fetching ${year} page ${page}:`, e.message);
            break;
        }
    }

    // Trim to exact amount needed
    return movies.slice(0, limit);
}

async function main() {
    for (let year = START_YEAR; year <= END_YEAR; year++) {
        // Deep Trawl Strategy:
        // 1980-2010: Fetch 500 movies/year to catch cult classics
        // 2011-2025: Fetch 200 movies/year (recency bias makes hits easier to find)
        const limit = year <= 2010 ? 500 : 200;

        process.stdout.write(`Fetching ${year} (limit ${limit})... `);
        const yearMovies = await fetchMoviesForYear(year, limit);
        allMovies.push(...yearMovies);
        console.log(`✅ ${yearMovies.length} movies`);
        await sleep(200);
    }

    console.log(`\nProcessing ${allMovies.length} total movies...`);

    // Sort chronologically
    allMovies.sort((a, b) => a.year - b.year);

    // --- FORCE FETCH CANON MOVIES ---
    const canonIds = getCanonIds();
    console.log(`\nChecking ${canonIds.size} cable canon movies...`);

    const seenIds = new Set(allMovies.map(m => m.id));

    let addedCanon = 0;
    for (const id of canonIds) {
        if (!seenIds.has(id)) {
            try {
                const url = `https://api.themoviedb.org/3/movie/${id}?api_key=${API_KEY}&append_to_response=credits,keywords,release_dates`;
                const m = await fetchJson(url);

                if (m && m.poster_path) {
                    allMovies.push({
                        id: m.id,
                        title: m.title,
                        year: m.release_date ? parseInt(m.release_date.substring(0, 4)) : 0,
                        poster_path: m.poster_path,
                        backdrop_path: m.backdrop_path,
                        overview: m.overview,
                        vote_average: m.vote_average,
                        vote_count: m.vote_count,
                        budget: m.budget,
                        genres: m.genres ? m.genres.map(g => g.id) : []
                    });
                    addedCanon++;
                    console.log(`  + Added canon movie: ${m.title} (${m.release_date ? m.release_date.substr(0, 4) : 'N/A'})`);
                }
                await sleep(200); // Rate limit
            } catch (e) {
                console.error(`  Failed to fetch canon movie ID ${id}: ${e.message}`);
                // If 404, we should probably ignore it
            }
        }
    }
    console.log(`Added ${addedCanon} missing cable canon movies.`);

    console.log(`\nFetched total ${allMovies.length} unique movies.`);

    // Sort again to include new additions in correct order
    allMovies.sort((a, b) => a.year - b.year);

    // Create the file content
    const fileContent = `/**
 * 5000 Movie Challenge - Dataset
 * Generated: ${new Date().toISOString()}
 * Source: TMDB
 * Total: ${allMovies.length}
 */

const MOVIES = ${JSON.stringify(allMovies, null, 2)};

// Export for ES modules if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MOVIES;
}
`;

    fs.writeFileSync(OUTPUT_FILE, fileContent);
    console.log(`\n🎉 Success! Saved to data/movies.js`);
    console.log(`Now you can open index.html to see real movies!`);
}

main().catch(console.error);
