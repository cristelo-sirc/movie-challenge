/**
 * Cumulative regression + feature suite for the Poster Journal app.
 * Boots the real app in JSDOM (see boot.js) and asserts on real behavior.
 * Grows per release; every section must stay green before a deploy.
 *
 *   node test/run.js
 */
const { boot } = require('./boot');

const results = [];
let section = '(init)';
const SECTION = (s) => { section = s; };
const ok = (name, cond, extra) => {
    results.push({ section, name, pass: !!cond, extra: cond ? '' : (extra || '') });
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Helpers to read live state through the test-only __app bridge.
const SW = (w) => w.__app.SlidingWindow;
const title = (d) => (d.querySelector('.card-title') || {}).textContent || '';
const click = (el) => { if (el) el.click(); };

async function run() {
    // ===================================================================
    SECTION('boot / regression invariants');
    // ===================================================================
    {
        const app = await boot();
        const { window: w, document: d } = app;
        ok('boots with no errors', app.errors.length === 0, app.errors.join('\n'));
        ok('loaded full dataset (4719)', w.__app.ItemManager.getAll().length === 4719);
        ok('a card is shown', !!d.querySelector('#cardStack .movie-card'));

        // Rating advances to a different movie and increments the seen tally.
        const before = title(d);
        const seenBefore = SW(w).getProgress().seen;
        click(d.getElementById('seenBtn'));
        await sleep(260);
        ok('Seen advances to a new movie', title(d) && title(d) !== before, `before=${before} after=${title(d)}`);
        ok('Seen increments seen count', SW(w).getProgress().seen === seenBefore + 1);

        // Undo restores the previous movie.
        click(d.getElementById('undoBtn'));
        await sleep(60);
        ok('Undo restores previous movie', title(d) === before, `expected=${before} got=${title(d)}`);
        ok('Undo restores seen count', SW(w).getProgress().seen === seenBefore);

        // Haven't-Seen also advances.
        const b2 = title(d);
        click(d.getElementById('skipBtn'));
        await sleep(260);
        ok("Haven't-Seen advances", title(d) !== b2);

        app.close();
    }

    // ===================================================================
    SECTION('watchlist + decade filter + share round-trip');
    // ===================================================================
    {
        const app = await boot();
        const { window: w, document: d } = app;

        // Bookmark toggles watchlist membership.
        const topId = Number(d.querySelector('#cardStack .movie-card').dataset.id);
        w.AppBridge.toggleWatchlist(topId);
        ok('watchlist add reflected', SW(w).isWatchlisted(topId));
        w.AppBridge.toggleWatchlist(topId);
        ok('watchlist remove reflected', !SW(w).isWatchlisted(topId));

        // Decade filter scopes the active set.
        SW(w).setActiveEras(['1990s']);
        await sleep(40);
        const era = w.__app.ItemManager.getEraId(SW(w).getCurrentItem());
        ok('decade filter scopes to selection', era === '1990s', `got ${era}`);
        SW(w).setActiveEras(['1980s', '1990s', '2000s', '2010s', '2020s']);

        // Share code round-trips seen/notSeen.
        const SM = w.__app.StorageManager;
        const sample = SW(w).getState();
        const code = SM.exportCompressed ? SM.exportCompressed(sample) : null;
        if (code) {
            const back = SM.importCompressed(code);
            ok('share code round-trips seen set',
                JSON.stringify((back.seen || []).sort()) === JSON.stringify((sample.seen || []).sort()));
        } else {
            ok('exportCompressed present', false, 'no exportCompressed');
        }
        app.close();
    }

    report();
}

function report() {
    const bySection = {};
    let pass = 0;
    for (const r of results) {
        (bySection[r.section] = bySection[r.section] || []).push(r);
        if (r.pass) pass++;
    }
    for (const s of Object.keys(bySection)) {
        console.log('\n## ' + s);
        for (const r of bySection[s]) {
            console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '  <<< ' + r.extra}`);
        }
    }
    console.log(`\n${pass}/${results.length} checks passed`);
    process.exit(pass === results.length ? 0 : 1);
}

run().catch(e => { console.error('SUITE CRASHED:\n', e.stack || e.message); process.exit(2); });
