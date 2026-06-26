/**
 * Streaming Availability (v3.5)
 *
 * Shows "Where to watch" for a movie, using data baked daily by a GitHub
 * Action (scripts/enrich_watch_providers.js → data/streaming-us.json) from
 * TMDB's watch/providers endpoint, which is powered by JustWatch.
 *
 * Design notes:
 *  - NO API key lives here. The data is pre-fetched at build time, so nothing
 *    secret ships to the browser (same model as the rest of the movie data).
 *  - Availability is split honestly: Subscription / Free / Rent / Buy. We never
 *    imply a title is free-to-stream when it's actually rent or buy only.
 *  - If a movie has no baked data yet (e.g. before the first refresh runs, or a
 *    title with no US listings), we fall back to a live link to the full TMDB
 *    listing — so the feature is useful even with an empty data file.
 *  - Region is fixed to US for now; the data file is per-region by design.
 */
const Streaming = (function () {
    'use strict';

    const REGION = 'US';
    const DATA_URL = 'data/streaming-us.json';
    const CREDIT = 'Streaming data by JustWatch via TMDB';

    let map = null;          // id (string) -> { link, stream[], free[], rent[], buy[] }
    let ready = false;       // data fetch has resolved (success OR failure)
    let loadError = false;   // fetch failed (offline / missing file)
    const pending = [];      // containers awaiting first load: [{ el, id }]
    const readyCbs = [];     // listeners fired once data resolves

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // A live, always-current fallback that needs no key and no baked data.
    function tmdbWatchLink(id) {
        return 'https://www.themoviedb.org/movie/' + encodeURIComponent(id) + '/watch?locale=' + REGION;
    }

    function load() {
        if (typeof fetch === 'undefined') { ready = true; loadError = true; flush(); return; }
        fetch(DATA_URL, { cache: 'no-cache' })
            .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
            .then(function (j) { map = j || {}; ready = true; flush(); })
            .catch(function () { map = {}; ready = true; loadError = true; flush(); });
    }

    function get(id) {
        if (!map) return null;
        return map[String(id)] || null;
    }

    function provs(names) {
        return (names || []).map(function (n) { return '<span class="pj-prov">' + esc(n) + '</span>'; }).join('');
    }

    function group(tag, names) {
        return '<div class="pj-strm-row">' +
            '<span class="pj-strm-tag t-' + tag.toLowerCase() + '">' + tag + '</span>' +
            '<span class="pj-provs">' + provs(names) + '</span></div>';
    }

    // v3.6: a labeled section for the dedicated Watch panel (more room than the
    // inline block, so each category gets its own header).
    function section(label, kind, names) {
        if (!names || !names.length) return '';
        return '<div class="pj-strm-sec s-' + kind + '">' +
            '<div class="pj-strm-sec-h">' + esc(label) + '</div>' +
            '<div class="pj-provs">' + provs(names) + '</div></div>';
    }

    // Roomy sectioned view for the Watch button. Order: Free -> Subscription ->
    // Rent -> Buy (Free and Subscription prioritized at the top).
    function renderPanelHTML(id) {
        if (!ready) return '<div class="pj-strm pj-strm-panel pj-strm-load">Checking where to watch…</div>';
        const d = get(id);
        const link = (d && d.link) || tmdbWatchLink(id);
        let secs = '';
        if (d) {
            secs += section('Free', 'free', d.free);
            secs += section('Subscription', 'subscription', d.stream);
            secs += section('Rent', 'rent', d.rent);
            secs += section('Buy', 'buy', d.buy);
        }
        const body = secs || '<div class="pj-strm-none">No US streaming listings found — tap below for the latest options.</div>';
        return '<div class="pj-strm pj-strm-panel">' +
            '<div class="pj-strm-h">Where to watch <span class="pj-strm-region">' + REGION + '</span></div>' +
            body +
            '<a class="pj-strm-link" href="' + link + '" target="_blank" rel="noopener noreferrer">All options on TMDB ↗</a>' +
            '<div class="pj-strm-credit">' + esc(CREDIT) + '</div>' +
            '</div>';
    }

    // Compact inline block (kept for reference; the card now uses renderPanelHTML).
    function renderHTML(id) {
        if (!ready) {
            return '<div class="pj-strm pj-strm-load">Checking where to watch…</div>';
        }
        const d = get(id);
        const link = (d && d.link) || tmdbWatchLink(id);
        const sections = [];
        if (d) {
            if (d.stream && d.stream.length) sections.push(group('Subscription', d.stream));
            if (d.free && d.free.length) sections.push(group('Free', d.free));
            if (d.rent && d.rent.length) sections.push(group('Rent', d.rent));
            if (d.buy && d.buy.length) sections.push(group('Buy', d.buy));
        }
        const body = sections.length
            ? sections.join('')
            : '<div class="pj-strm-none">No US streaming listings found — tap below for the latest options.</div>';
        return '<div class="pj-strm">' +
            '<div class="pj-strm-h">Where to watch <span class="pj-strm-region">' + REGION + '</span></div>' +
            body +
            '<a class="pj-strm-link" href="' + link + '" target="_blank" rel="noopener noreferrer">All options on TMDB ↗</a>' +
            '<div class="pj-strm-credit">' + esc(CREDIT) + '</div>' +
            '</div>';
    }

    // Render into a container now; if data isn't ready, show a placeholder and
    // upgrade it once the fetch resolves.
    function renderInto(el, id) {
        if (!el) return;
        el.innerHTML = renderPanelHTML(id);
        if (!ready) pending.push({ el: el, id: id });
    }

    function flush() {
        while (pending.length) {
            const p = pending.pop();
            if (p && p.el) p.el.innerHTML = renderPanelHTML(p.id);
        }
        while (readyCbs.length) {
            const cb = readyCbs.pop();
            try { cb(); } catch (e) { /* listener must never break callers */ }
        }
    }

    // Compact one-line summary for watchlist rows (always a working link).
    function renderRowHTML(id) {
        const d = get(id);
        const link = (d && d.link) || tmdbWatchLink(id);
        let label = 'Where to watch';
        if (ready && d) {
            if (d.free && d.free.length) label = 'Free: ' + d.free.slice(0, 2).join(', ');
            else if (d.stream && d.stream.length) label = 'Subscription: ' + d.stream.slice(0, 2).join(', ');
            else if ((d.rent && d.rent.length) || (d.buy && d.buy.length)) label = 'Rent or buy';
        }
        return '<a class="pj-wl-strm" href="' + link + '" target="_blank" rel="noopener noreferrer">' +
            esc(label) + ' ↗</a>';
    }

    // Register a callback to run once the data resolves (or immediately if it
    // already has). Lets the Diary refresh its summaries when data lands.
    function onReady(cb) {
        if (typeof cb !== 'function') return;
        if (ready) { try { cb(); } catch (e) { /* no-op */ } }
        else readyCbs.push(cb);
    }

    // Kick off the load as soon as the script runs.
    load();

    return {
        load: load,
        get: get,
        renderHTML: renderHTML,
        renderPanelHTML: renderPanelHTML,
        renderInto: renderInto,
        renderRowHTML: renderRowHTML,
        onReady: onReady,
        get isReady() { return ready; },
        get hadError() { return loadError; },
        // test seam: inject a map without a network fetch
        _setMap: function (m) { map = m || {}; ready = true; loadError = false; flush(); }
    };
})();

if (typeof window !== 'undefined') window.Streaming = Streaming;
if (typeof module !== 'undefined' && module.exports) module.exports = Streaming;
