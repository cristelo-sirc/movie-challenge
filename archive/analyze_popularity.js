const fs = require('fs');
const path = './data/movies.js';

const content = fs.readFileSync(path, 'utf8');
// Simple extraction of the array
const start = content.indexOf('[');
const end = content.lastIndexOf(']');
const json = content.substring(start, end + 1);

try {
    // Determine if we can parse it as JSON or need eval
    let movies;
    try {
        movies = JSON.parse(json);
    } catch (e) {
        // Fallback to eval if keys aren't quoted or it's JS literal
        movies = eval(json);
    }

    const total = movies.length;
    const sorted = [...movies].sort((a, b) => b.vote_count - a.vote_count);

    // Percentiles
    const p50 = sorted[Math.floor(total * 0.5)].vote_count;
    const p75 = sorted[Math.floor(total * 0.75)].vote_count; // 25th percentile from bottom
    const p90 = sorted[Math.floor(total * 0.9)].vote_count; // 10th percentile from bottom

    // Buckets
    const over10k = movies.filter(m => m.vote_count >= 10000).length;
    const over5k = movies.filter(m => m.vote_count >= 5000).length;
    const over1k = movies.filter(m => m.vote_count >= 1000).length;
    const under500 = movies.filter(m => m.vote_count < 500).length;
    const under100 = movies.filter(m => m.vote_count < 100).length;

    console.log(`
🎬 Movie Popularity Analysis
==========================
Total Movies: ${total}

Vote Count Distribution:
- Median (50%): ${p50} votes
- Bottom 25%:   < ${p75} votes
- Bottom 10%:   < ${p90} votes

Breakdown:
- Massive Hits (>10k votes): ${over10k} (${(over10k / total * 100).toFixed(1)}%)
- Popular (>5k votes):       ${over5k} (${(over5k / total * 100).toFixed(1)}%)
- Known (>1k votes):         ${over1k} (${(over1k / total * 100).toFixed(1)}%)
- Obscure (<500 votes):      ${under500} (${(under500 / total * 100).toFixed(1)}%)
- Very Obscure (<100 votes): ${under100} (${(under100 / total * 100).toFixed(1)}%)
`);

} catch (e) {
    console.error("Error:", e);
}
