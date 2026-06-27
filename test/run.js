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

    // ===================================================================
    SECTION('Phase 1 — performance + input guard (v3.7.0)');
    // ===================================================================
    {
        const app = await boot();
        const { window: w, document: d } = app;

        // Guard: two synchronous taps rate exactly ONE movie (was the double-rate bug).
        const seenBefore = SW(w).getProgress().seen;
        const seenBtn = d.getElementById('seenBtn');
        seenBtn.click(); seenBtn.click();          // rapid double-tap, same tick
        await sleep(40);
        ok('double-tap rates only once (input guard)',
            SW(w).getProgress().seen === seenBefore + 1,
            'seen=' + SW(w).getProgress().seen + ' expected ' + (seenBefore + 1));
        await sleep(260);                           // let the 200ms guard release

        // Instant reveal: the next card is in the DOM synchronously after the tap,
        // with no wait-for-timer (the old model needed ~160ms before advancing).
        const t0 = title(d);
        d.getElementById('seenBtn').click();        // no await after this
        ok('next card revealed instantly (no advance timer)',
            title(d) && title(d) !== t0, 'before=' + t0 + ' immediate=' + title(d));
        await sleep(260);

        // Redundant rebuild skipped: a chunk-arrival update with an unchanged
        // visible window must not destroy/recreate the current card element.
        const cardEl = d.querySelector('#cardStack .movie-card');
        cardEl.dataset.probe = 'keep';
        SW(w).notifyItemsAppended();                // simulates a background chunk landing
        await sleep(40);
        const cardAfter = d.querySelector('#cardStack .movie-card');
        ok('unchanged window is not rebuilt',
            cardAfter && cardAfter.dataset.probe === 'keep');

        ok('no errors during Phase 1 interactions', app.errors.length === 0, app.errors.join('\n'));
        app.close();
    }

    // ===================================================================
    SECTION('Phase 1 — streaming data is deferred until needed');
    // ===================================================================
    {
        const app = await boot();
        const hit = (u) => u.includes('streaming-us.json');

        ok('streaming map NOT downloaded at page load',
            !app.fetched.some(hit), app.fetched.filter(u => u.includes('streaming')).join(','));

        const watch = app.document.querySelector('.watch-btn');
        ok('Watch button present on the card', !!watch);
        if (watch) watch.click();                   // first Watch tap should trigger the load
        await sleep(150);
        ok('streaming map downloaded after opening Watch', app.fetched.some(hit));
        app.close();
    }

    // ===================================================================
    SECTION('Phase 1 — Watch panel flips back from anywhere (like Info)');
    // v3.8.2: a tap on the streaming CONTENT must flip the card back (it used to
    // only work on the footer); a tap on a real link must NOT flip it.
    // ===================================================================
    {
        const app = await boot();
        const { window: w, document: d } = app;
        const card = d.querySelector('#cardStack .movie-card');
        const watchBtn = d.querySelector('.watch-btn');

        watchBtn.click();                       // flip to Watch + kick the streaming render
        // Wait for the panel to upgrade from its loading placeholder to real
        // content (the always-present "Where to watch" header + TMDB link).
        for (let i = 0; i < 40 && !d.querySelector('.card-watch-stream a.pj-strm-link'); i++) {
            await sleep(25);
        }
        const panel = d.querySelector('.card-watch-stream');
        ok('Watch opened the streaming panel',
            card.classList.contains('flipped') && card.classList.contains('show-watch'));
        ok('streaming panel rendered its content',
            !!panel && !!panel.querySelector('.pj-strm-h') && !!panel.querySelector('a.pj-strm-link'));

        // (1) The fix: a tap on streaming CONTENT (a non-link element) flips back.
        const content = panel.querySelector('.pj-strm-h');
        content.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
        ok('tap on streaming content flips the card back', !card.classList.contains('flipped'));

        // Re-open Watch for the link case (panel is already rendered, so it just flips).
        watchBtn.click();
        await sleep(20);
        ok('Watch re-opened', card.classList.contains('flipped'));

        // (2) A tap on the TMDB link must NOT flip back (the link still wins).
        const link = panel.querySelector('a.pj-strm-link');
        link.addEventListener('click', (e) => e.preventDefault(), { once: true }); // no jsdom navigation
        link.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
        ok('tap on a real link does NOT flip the card back', card.classList.contains('flipped'));

        ok('no errors during Watch flip-back interactions', app.errors.length === 0, app.errors.join('\n'));
        app.close();
    }

    // ===================================================================
    SECTION('Phase 2 — off-screen + year-card keyboard gating');
    // ===================================================================
    {
        const app = await boot();
        const { window: w, document: d } = app;
        const key = (k) => d.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true }));

        // Off-screen: a rating key while on the Settings tab must do nothing.
        let seen = SW(w).getProgress().seen;
        w.UIShell.switchTo('settings');
        key('d'); await sleep(250);
        ok('rating key ignored on Settings tab', SW(w).getProgress().seen === seen);

        // Back on Review it works again.
        w.UIShell.switchTo('review');
        key('d'); await sleep(250);
        ok('rating key works again on Review tab', SW(w).getProgress().seen === seen + 1);

        // Year takeover up: rating keys must not reach the hidden card.
        seen = SW(w).getProgress().seen;
        const over = d.createElement('div'); over.className = 'decade-takeover'; d.body.appendChild(over);
        key('d'); await sleep(250);
        ok('rating key ignored while year card is up', SW(w).getProgress().seen === seen);
        over.remove();
        key('d'); await sleep(250);
        ok('rating key works after year card dismissed', SW(w).getProgress().seen === seen + 1);
        app.close();
    }

    // ===================================================================
    SECTION('Phase 2 — persistence: None decades, best streak, watchlist import');
    // ===================================================================
    {
        const KEY = 'movie_challenge_progress';

        // "None" decades round-trips as none (was reloading as all five).
        const noneState = JSON.stringify({ currentIndex: 0, seen: [], notSeen: [], history: [], activeEras: [], watchlist: [], version: 1 });
        const appNone = await boot({ localStorage: { [KEY]: noneState }, allowNoCard: true });
        ok('saved "None" decades stays none on reload',
            appNone.window.__app.SlidingWindow.getActiveEras().length === 0,
            'got ' + JSON.stringify(appNone.window.__app.SlidingWindow.getActiveEras()));
        appNone.close();

        // null decades => all (unchanged behavior).
        const allState = JSON.stringify({ currentIndex: 0, seen: [], notSeen: [], history: [], activeEras: null, watchlist: [], version: 1 });
        const appAll = await boot({ localStorage: { [KEY]: allState } });
        ok('null decades still means all', appAll.window.__app.SlidingWindow.getActiveEras().length === 5);
        appAll.close();

        // Best streak restores from storage.
        const streakState = JSON.stringify({ currentIndex: 0, seen: [1, 2, 3], notSeen: [], history: [], activeEras: null, watchlist: [], bestStreak: 9, version: 1 });
        const appStreak = await boot({ localStorage: { [KEY]: streakState } });
        ok('best streak restored from storage',
            appStreak.window.__app.GamificationManager.bestStreak === 9,
            'got ' + appStreak.window.__app.GamificationManager.bestStreak);
        appStreak.close();

        // Best streak is actually written (and a watchlist toggle does not wipe it).
        {
            const app = await boot();
            const { window: w, document: d } = app;
            for (let i = 0; i < 4; i++) { d.getElementById('seenBtn').click(); await sleep(230); }
            const id = Number(d.querySelector('#cardStack .movie-card').dataset.id);
            w.AppBridge.toggleWatchlist(id);           // a save that must NOT drop bestStreak
            await sleep(650);                           // let the debounced save flush
            const saved = JSON.parse(w.localStorage.getItem('movie_challenge_progress'));
            ok('best streak is persisted to storage', (saved.bestStreak || 0) >= 1, 'saved bestStreak=' + saved.bestStreak);
            app.close();
        }
    }

    // ===================================================================
    SECTION('Phase 2 — watchlist survives import; backup backdrop; share scope');
    // ===================================================================
    {
        const app = await boot();
        const { window: w, document: d } = app;

        // Watchlist must survive a progress-code import (it is local-only, like the
        // decade selection, and not carried in the code).
        const id = Number(d.querySelector('#cardStack .movie-card').dataset.id);
        w.AppBridge.toggleWatchlist(id);
        ok('movie added to watchlist', SW(w).isWatchlisted(id));
        const code = w.__app.StorageManager.exportCompressed(SW(w).getState());
        d.getElementById('importBtn').click();          // reveals the code input
        d.getElementById('codeInput').value = code;
        d.getElementById('applyCodeBtn').click();
        await sleep(80);
        ok('watchlist preserved after import', SW(w).isWatchlisted(id));

        // Backup modal closes when its backdrop is clicked (selector was wrong).
        const bm = d.getElementById('backupModal');
        bm.classList.remove('hidden');
        d.querySelector('#backupModal .backup-overlay').click();
        ok('backup backdrop click closes the modal', bm.classList.contains('hidden'));
        app.close();
    }

    // ===================================================================
    SECTION('Phase 2 — shared result reports lifetime (not scoped) totals');
    // ===================================================================
    {
        const app = await boot();
        const { window: w, document: d } = app;
        let captured = '';
        try {
            Object.defineProperty(w.navigator, 'clipboard', {
                value: { writeText: (t) => { captured = t; return Promise.resolve(); } }, configurable: true
            });
        } catch (e) { /* fall through */ }

        // Rate 3 movies (all in the first decade), then filter to a DIFFERENT decade
        // (scoped rated there = 0). The share must still report the lifetime 3.
        for (let i = 0; i < 3; i++) { d.getElementById('seenBtn').click(); await sleep(230); }
        const globalRated = SW(w).getProgress().globalRated;
        SW(w).setActiveEras(['2020s']);
        await sleep(60);
        d.getElementById('shareBtn').click();
        await sleep(80);
        ok('share text uses lifetime rated count, not scoped',
            captured.indexOf('/ 4,719') !== -1 && captured.indexOf(globalRated.toLocaleString() + ' / 4,719') !== -1,
            'captured=' + JSON.stringify(captured.split('\n').filter(l => l.indexOf('Progress') !== -1)));
        app.close();
    }

    // ===================================================================
    SECTION('Phase 3 — aligned control row');
    // ===================================================================
    {
        const app = await boot();
        const { window: w, document: d } = app;
        const row = d.querySelector('#cardStack .movie-card .pj-controls');
        ok('Save/Watch/Info wrapped in one control row', !!row);
        const order = row ? Array.from(row.children).map(c => c.className.split(' ')[0]) : [];
        ok('row order is bookmark, watch, info (left/center/right)',
            order.join(',') === 'pj-bookmark,watch-btn,info-btn', order.join(','));

        // The buttons still work after the markup change.
        const card = d.querySelector('#cardStack .movie-card');
        d.querySelector('.info-btn').click();
        ok('Info still flips to the synopsis (no streaming)',
            card.classList.contains('flipped') && !card.classList.contains('show-watch'));
        app.close();
    }

    // ===================================================================
    SECTION('Phase 3 — Diary "Want to See" grouping');
    // ===================================================================
    {
        const app = await boot();
        const { window: w, document: d } = app;
        const IM = w.__app.ItemManager;
        const all = IM.getAll();
        const pick = (era, n) => all.filter(m => IM.getEraId(m) === era).slice(0, n).map(m => m.id);

        // Flat at/below the threshold (<=5).
        pick('1980s', 5).forEach(id => w.AppBridge.toggleWatchlist(id));
        w.UIShell.switchTo('diary'); await sleep(60);
        ok('5 films stay a flat list (threshold is 5)', d.querySelectorAll('#diaryRoot .pj-wl-sec').length === 0);
        ok('flat list renders rows', d.querySelectorAll('#diaryRoot .pj-wl-row').length === 5);

        // A 6th film (>5), in a second decade → grouped sections.
        pick('2010s', 1).forEach(id => w.AppBridge.toggleWatchlist(id));
        w.UIShell.switchTo('review'); w.UIShell.switchTo('diary'); await sleep(60);
        const secs = d.querySelectorAll('#diaryRoot .pj-wl-sec');
        ok('6 films group into decade sections', secs.length >= 2, 'sections=' + secs.length);
        ok('section shows its decade label + count',
            !!d.querySelector('#diaryRoot .pj-wl-sec-t') && !!d.querySelector('#diaryRoot .pj-wl-sec-n'));

        // v3.8.1: sections default to COLLAPSED.
        ok('decade sections default to collapsed',
            Array.from(secs).every(s => s.classList.contains('collapsed')));

        // First click EXPANDS (since default is collapsed); the choice persists.
        const hdr = d.querySelector('#diaryRoot .pj-wl-sec-h');
        const sec = hdr.closest('.pj-wl-sec'); const era = sec.dataset.era;
        hdr.click();
        ok('clicking a collapsed header expands it', !sec.classList.contains('collapsed'));
        let stored = JSON.parse(w.localStorage.getItem('pj_wl_collapsed') || '{}');
        ok('expanded choice is remembered (false)', stored[era] === false, JSON.stringify(stored));
        hdr.click();
        ok('clicking again collapses it', sec.classList.contains('collapsed'));
        stored = JSON.parse(w.localStorage.getItem('pj_wl_collapsed') || '{}');
        ok('collapsed choice is remembered (true)', stored[era] === true, JSON.stringify(stored));
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
