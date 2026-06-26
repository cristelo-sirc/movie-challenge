/**
 * Refresh "Where to watch" (streaming) data — v3.5
 *
 * Fetches US watch providers (powered by JustWatch) from TMDB for every movie
 * and writes a compact lookup to data/streaming-us.json. Run daily by the
 * companion GitHub Action (.github/workflows/refresh-streaming.yml).
 *
 * Credential: read from TMDB_KEY env var, argv[2], or .tmdb_key. TMDB offers
 * TWO credential types and this script accepts EITHER, so a mix-up can't break
 * the job:
 *   - v3 "API Key"            -> 32 hex chars      -> sent as ?api_key=
 *   - v4 "API Read Access Token" -> long JWT (eyJ…) -> sent as Authorization: Bearer
 * In the Action the credential comes from the encrypted Secrets store — it is
 * NEVER committed and never ships to the browser. (This file lives in .github/
 * so it is committed for CI; it contains no secret. It must NOT live under any
 * folder named "scripts/", which .gitignore excludes.)
 *
 * If authentication fails (or no movie returns data), the script logs the real
 * TMDB error and exits non-zero WITHOUT writing — so the run goes red and the
 * last good data file is preserved instead of being overwritten with "{}".
 *
 * Usage:
 *   TMDB_KEY=xxxx node .github/refresh-streaming.js
 *   node .github/refresh-streaming.js <CREDENTIAL>
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const REGION = 'US';
const REPO_ROOT = path.resolve(__dirname, '..'); // .github -> repo root
const MOVIES_FILE = path.join(REPO_ROOT, 'data/movies.js');
const OUT_FILE = path.join(REPO_ROOT, 'data/streaming-us.json');
const CONCURRENCY = 15;          // polite parallelism (TMDB allows ~50/s)
const RETRIES = 1;

const API_KEY = (process.env.TMDB_KEY || process.argv[2] || readKeyFile() || '').trim();
if (!API_KEY) {
    console.error('No TMDB credential. Set the TMDB_KEY env var, pass it as an argument, or add a .tmdb_key file.');
    process.exit(1);
}

// Decide which auth style the supplied credential needs. A v4 read token is a
// JWT (starts "eyJ", contains dots, and is long); anything else is treated as a
// classic v3 api_key.
const USE_BEARER = /^eyJ/.test(API_KEY) || API_KEY.includes('.') || API_KEY.length > 45;
console.log(`Auth mode: ${USE_BEARER ? 'v4 Bearer token' : 'v3 api_key'} (credential length ${API_KEY.length}).`);

function readKeyFile() {
    try { return fs.readFileSync(path.join(REPO_ROOT, '.tmdb_key'), 'utf8'); }
    catch (e) { return ''; }
}

// Load movie ids from the existing static data file.
function loadMovies() {
    const content = fs.readFileSync(MOVIES_FILE, 'utf8');
    const start = content.indexOf('[');
    const end = content.lastIndexOf(']');
    return JSON.parse(content.substring(start, end + 1));
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Surface the FIRST real failure once, so a silent "0 with US data" run becomes
// diagnosable (e.g. "HTTP 401 {status_message:Invalid API key...}").
let firstErrorLogged = false;
function logFirstError(msg) {
    if (firstErrorLogged) return;
    firstErrorLogged = true;
    console.error('First TMDB error: ' + msg);
}

function fetchProviders(id, attempt) {
    attempt = attempt || 0;
    return new Promise((resolve) => {
        const base = `https://api.themoviedb.org/3/movie/${id}/watch/providers`;
        const url = USE_BEARER ? base : `${base}?api_key=${API_KEY}`;
        const options = USE_BEARER
            ? { headers: { Authorization: 'Bearer ' + API_KEY, Accept: 'application/json' } }
            : {};
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', async () => {
                if (res.statusCode !== 200) {
                    logFirstError(`HTTP ${res.statusCode} ${String(data).slice(0, 180)}`);
                    // 429 = rate limited: wait longer before the retry
                    if (res.statusCode === 429 && attempt <= RETRIES) { await sleep(1500); return resolve(await fetchProviders(id, attempt + 1)); }
                    if (attempt < RETRIES) { await sleep(400); return resolve(await fetchProviders(id, attempt + 1)); }
                    return resolve(null);
                }
                try { resolve(JSON.parse(data)); }
                catch (e) { resolve(null); }
            });
        }).on('error', async (e) => {
            logFirstError('network ' + e.message);
            if (attempt < RETRIES) { await sleep(400); return resolve(await fetchProviders(id, attempt + 1)); }
            resolve(null);
        });
    });
}

// Provider arrays come sorted-ish; respect display_priority and de-dupe names.
function names(arr) {
    if (!Array.isArray(arr)) return [];
    return arr
        .slice()
        .sort((a, b) => (a.display_priority || 0) - (b.display_priority || 0))
        .map(p => p.provider_name)
        .filter((n, i, a) => n && a.indexOf(n) === i);
}

function buildEntry(payload) {
    const us = payload && payload.results && payload.results[REGION];
    if (!us) return null;
    const stream = names(us.flatrate);
    const free = names((us.free || []).concat(us.ads || []));
    const rent = names(us.rent);
    const buy = names(us.buy);
    if (!us.link && !stream.length && !free.length && !rent.length && !buy.length) return null;
    const entry = { link: us.link || '' };
    if (stream.length) entry.stream = stream;
    if (free.length) entry.free = free;
    if (rent.length) entry.rent = rent;
    if (buy.length) entry.buy = buy;
    return entry;
}

async function main() {
    const movies = loadMovies();
    console.log(`Loaded ${movies.length} movies. Fetching ${REGION} providers…`);

    const out = {};
    let done = 0, withData = 0, cursor = 0;

    async function worker() {
        while (cursor < movies.length) {
            const m = movies[cursor++];
            const payload = await fetchProviders(m.id);
            const entry = buildEntry(payload);
            if (entry) { out[m.id] = entry; withData++; }
            done++;
            if (done % 250 === 0) console.log(`  ${done}/${movies.length} (${withData} with US data)`);
        }
    }

    const workers = [];
    for (let w = 0; w < CONCURRENCY; w++) workers.push(worker());
    await Promise.all(workers);

    // Safety: if nothing came back, the credential was almost certainly rejected.
    // Fail loudly and DON'T overwrite the existing file with an empty one.
    if (withData === 0) {
        console.error(`\nERROR: 0 of ${movies.length} movies returned US data.`);
        console.error('The TMDB credential was rejected or unreachable (see "First TMDB error" above).');
        console.error('Check the TMDB_KEY secret. Not writing an empty file — keeping the last good data.');
        process.exit(1);
    }

    // Stable numeric key order so daily diffs stay small and readable.
    const sorted = {};
    Object.keys(out).map(Number).sort((a, b) => a - b).forEach(k => { sorted[k] = out[k]; });

    fs.writeFileSync(OUT_FILE, JSON.stringify(sorted));
    console.log(`Wrote ${OUT_FILE}: ${withData}/${movies.length} movies have US listings.`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
