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
    "Hardbodies",
    "Teen Witch",
    "Bachelor Party",
    "Rock 'n' Roll High School Forever",
    "Ski Patrol",
    "Ski School",
    "Back to the Beach",
    "Moving Violations",
    "Summer School",
    "Hamburger: The Motion Picture",
    "The Bikini Carwash Company",
    "Saturday the 14th",
    "One Crazy Summer",
    "No Retreat, No Surrender",
    "Solarbabies",
    "Ratboy",
    "The Wraith",
    "Troll",
    "Alien from L.A."
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
    console.log("Checking keywords for expanded movie list...\n");

    for (const title of moviesToCheck) {
        // 1. Search for movie
        const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(title)}`;
        const searchData = await fetchJson(searchUrl);

        if (searchData.results && searchData.results.length > 0) {
            // Find best match (prefer 80s/90s)
            const movie = searchData.results.find(m => {
                const y = m.release_date ? parseInt(m.release_date.substring(0, 4)) : 0;
                return y >= 1980 && y <= 1999;
            }) || searchData.results[0];

            // 2. Get details (keywords + genres)
            const detailsUrl = `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${API_KEY}&append_to_response=keywords`;
            const data = await fetchJson(detailsUrl);

            const keywords = data.keywords ? data.keywords.keywords : [];
            const genres = data.genres || [];

            console.log(`🎬 ${data.title} (${data.release_date ? data.release_date.substring(0, 4) : 'N/A'})`);
            console.log(`   ID: ${data.id}`);
            console.log(`   Vote Count: ${data.vote_count}`);
            console.log(`   Genres: ${genres.map(g => g.name).join(', ')}`);
            console.log(`   Keywords: ${keywords.map(k => `${k.name} (${k.id})`).join(', ')}`);
            console.log('---------------------------------------------------');
        } else {
            console.log(`❌ Could not find "${title}"`);
        }

        // Rate limit
        await new Promise(r => setTimeout(r, 200));
    }
}

main();
