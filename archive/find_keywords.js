const https = require('https');

// Key from fetch_movies.js (or passed as arg)
// I'll assume the user runs it like: node find_keywords.js <API_KEY>
const API_KEY = process.argv[2];

if (!API_KEY) {
    console.error("Please provide API Key");
    process.exit(1);
}

const terms = [
    "cult",
    "cult film",
    "cult classic",
    "b-movie",
    "b movie",
    "so bad it's good",
    "camp",
    "midnight movie",
    "classic",
    "staple",
    "teen movie",
    "slasher"
];

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function main() {
    console.log("Searching for keywords...");
    for (const term of terms) {
        const url = `https://api.themoviedb.org/3/search/keyword?api_key=${API_KEY}&query=${encodeURIComponent(term)}`;
        try {
            const data = await fetchJson(url);
            if (data.results && data.results.length > 0) {
                console.log(`\nResults for "${term}":`);
                data.results.forEach(r => {
                    console.log(`  - [${r.id}] ${r.name}`);
                });
            } else {
                console.log(`\nNo results for "${term}"`);
            }
        } catch (e) {
            console.error(e);
        }
    }
}

main();
