const https = require('https');

const fs = require('fs');
const path = require('path');

function loadApiKey() {
    if (process.env.TMDB_API_KEY) return process.env.TMDB_API_KEY.trim();
    try {
        return fs.readFileSync(path.join(__dirname, '.tmdb_key'), 'utf8').trim();
    } catch (e) {
        console.error('TMDB API key not found. Set the TMDB_API_KEY environment variable or create a .tmdb_key file in the project root.');
        process.exit(1);
    }
}
const API_KEY = loadApiKey();
const moviesToCheck = [
    "Zapped!",
    "Hunk",
    "Soul Man",
    "Oh, God! You Devil",
    "Stewardess School"
];

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({});
                }
            });
        }).on('error', reject);
    });
}

async function main() {
    console.log("Checking keywords for specific movies...\n");

    for (const title of moviesToCheck) {
        // 1. Search for movie
        const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(title)}`;
        const searchData = await fetchJson(searchUrl);

        if (searchData.results && searchData.results.length > 0) {
            // Pick the best match (usually the first one, but let's prefer 80s if possible)
            const movie = searchData.results[0]; // Simplification

            // 2. Get details (keywords)
            const detailsUrl = `https://api.themoviedb.org/3/movie/${movie.id}/keywords?api_key=${API_KEY}`;
            const keywordData = await fetchJson(detailsUrl);

            const keywords = keywordData.keywords || [];

            console.log(`🎬 ${movie.title} (${movie.release_date ? movie.release_date.substring(0, 4) : 'N/A'})`);
            console.log(`   ID: ${movie.id}`);
            console.log(`   Vote Count: ${movie.vote_count}`);
            console.log(`   Keywords: ${keywords.map(k => `${k.name} (${k.id})`).join(', ')}`);
            console.log('---------------------------------------------------');
        } else {
            console.log(`❌ Could not find "${title}"`);
        }

        // Rate limit slightly
        await new Promise(r => setTimeout(r, 200));
    }
}

main();
