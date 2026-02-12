/**
 * Enrichment Script: Fetch Cast & Director for Curated List
 * Usage: node scripts/enrich_metadata.js <API_KEY>
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const MOVIES_FILE = path.join(__dirname, '../data/movies.js');
const TEMP_FILE = path.join(__dirname, '../data/movies_enriched_temp.json');
const API_KEY = process.argv[2];

if (!API_KEY) {
    console.error('Please provide API Key');
    process.exit(1);
}

// 1. Load current movies
const content = fs.readFileSync(MOVIES_FILE, 'utf8');
const start = content.indexOf('[');
const end = content.lastIndexOf(']');
const movies = JSON.parse(content.substring(start, end + 1));

console.log(`Loaded ${movies.length} movies to enrich.`);

// Helper to fetch credits
function fetchCredits(id) {
    return new Promise((resolve, reject) => {
        const url = `https://api.themoviedb.org/3/movie/${id}/credits?api_key=${API_KEY}`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
    let updated = 0;

    for (let i = 0; i < movies.length; i++) {
        const m = movies[i];

        // Skip if already has credits (unless force update needed, but assume clean for now)
        if (m.credits) continue;

        process.stdout.write(`[${i + 1}/${movies.length}] ${m.title}... `);

        const credits = await fetchCredits(m.id);

        if (credits) {
            // Process to minimal format to save space
            const director = credits.crew.find(c => c.job === 'Director');
            const topCast = credits.cast.slice(0, 5).map(c => c.name);

            m.credits = {
                director: director ? director.name : 'Unknown',
                cast: topCast
            };
            console.log('✅');
        } else {
            console.log('❌ Failed');
        }

        updated++;

        // Rate limit (40 requests/10 seconds = 4/sec max) -> 250ms delay
        await sleep(250);

        // Save progress every 100 items
        if (updated % 100 === 0) {
            fs.writeFileSync(TEMP_FILE, JSON.stringify(movies, null, 2));
        }
    }

    // Final Output (Restoring the JS variable format)
    const fileContent = `/**
 * 5000 Movie Challenge - Curated Dataset (Enriched)
 * Generated: ${new Date().toISOString()}
 * Total: ${movies.length}
 */

var MOVIES = ${JSON.stringify(movies, null, 2)};

// Export for ES modules if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MOVIES;
}
`;

    fs.writeFileSync(MOVIES_FILE, fileContent);
    console.log('\nDone! Updated data/movies.js');
    if (fs.existsSync(TEMP_FILE)) fs.unlinkSync(TEMP_FILE);
}

main();
