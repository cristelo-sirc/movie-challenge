const fs = require('fs');
const path = './data/movies.js';

// Read the file content
const content = fs.readFileSync(path, 'utf8');

// The file exports MOVIES const, so we need to extract the array manually
// or eval it. Since it's a simple JS file, let's just eval the assignment part.
// But it's `const MOVIES = [...]`, so we can strip the constellation.
const jsonStr = content.replace(/const MOVIES = /, '').replace(/;$/, '');
// Actually, it might have comments at the top.
const start = content.indexOf('[');
const end = content.lastIndexOf(']');
const json = content.substring(start, end + 1);

try {
    const movies = eval(json); // using eval because it's proper JS syntax, not necessarily JSON (keys might not be quoted? actually they are in the file I saw)
    // Actually from file view keys are quoted. JSON.parse might work if I clean it.
    // But eval is safer for "JS object literal".

    const total = movies.length;
    const below4 = movies.filter(m => m.vote_average < 4.0).length;
    const below5 = movies.filter(m => m.vote_average < 5.0).length;
    const below6 = movies.filter(m => m.vote_average < 6.0).length;
    const below65 = movies.filter(m => m.vote_average < 6.5).length;

    console.log(`Total Movies: ${total}`);
    console.log(`< 4.0: ${below4} (${(below4 / total * 100).toFixed(1)}%)`);
    console.log(`< 5.0: ${below5} (${(below5 / total * 100).toFixed(1)}%)`);
    console.log(`< 6.0: ${below6} (${(below6 / total * 100).toFixed(1)}%)`);
    console.log(`< 6.5: ${below65} (${(below65 / total * 100).toFixed(1)}%)`);

} catch (e) {
    console.error("Error parsing:", e);
}
