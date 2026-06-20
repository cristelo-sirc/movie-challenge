/**
 * Poster Journal UI Shell (v3.4)
 *
 * Adds the bottom-tab navigation and the Diary / Decades screens on top of the
 * existing engine. It RENDERS only — every number comes from the same modules
 * the app already uses (SlidingWindow, StatsEngine, ItemManager, Gamification,
 * ConfigLoader). It never writes progress, never touches the share/QR format,
 * and never changes the decade-filter logic (that stays in app.js).
 *
 * app.js calls UIShell.onAppUpdate(data) on every engine update; on the legacy
 * page (no UIShell) that call is a guarded no-op.
 */
const UIShell = (function () {
    'use strict';

    const IMG = 'https://image.tmdb.org/t/p/';
    let activeScreen = 'review';
    let lastData = null;          // most recent engine update payload
    let detailEra = null;         // currently open decade detail, if any
    let lastFilterSig = '';       // to detect decade-selection changes
    let dataReadyLatched = false; // re-render scroll screens once full data lands

    const $ = (id) => document.getElementById(id);
    const dataReady = () => (typeof DataLoader === 'undefined') ? true : !!DataLoader.isFullyLoaded;

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function num(n) { return (n || 0).toLocaleString(); }
    function posterUrl(item, size) {
        if (!item) return '';
        const p = item.poster_path || item.poster;
        if (!p) return '';
        return p.startsWith('http') ? p : (IMG + (size || 'w185') + p);
    }
    function imgTag(item, size, cls) {
        const u = posterUrl(item, size);
        if (!u) return '';
        return `<img src="${u}" alt="" loading="lazy" class="${cls || ''}" onerror="this.style.visibility='hidden'">`;
    }

    // ---- engine helpers ----------------------------------------------------
    function cfg() { return (typeof ConfigLoader !== 'undefined' && ConfigLoader.isInitialized) ? ConfigLoader.get() : null; }
    function eras() { const c = cfg(); return (c && c.eras.groups) || []; }
    function items() { return (typeof ItemManager !== 'undefined') ? ItemManager.getAll() : []; }
    function state() { return (typeof SlidingWindow !== 'undefined') ? SlidingWindow.getState() : { seen: [], notSeen: [], history: [] }; }
    function progress() { return (typeof SlidingWindow !== 'undefined') ? SlidingWindow.getProgress() : null; }
    function eraOf(item) {
        if (typeof ItemManager !== 'undefined' && ItemManager.isInitialized) return ItemManager.getEraId(item);
        const y = item.year; if (y < 1990) return '1980s'; if (y < 2000) return '1990s'; if (y < 2010) return '2000s'; if (y < 2020) return '2010s'; return '2020s';
    }
    function eraTotals() {
        // exact per-decade totals from the manifest when available
        const m = (typeof DataLoader !== 'undefined') ? DataLoader.manifest : null;
        const out = {};
        if (m && m.chunks) m.chunks.forEach(c => { out[c.id] = c.count; });
        return out;
    }

    // =======================================================================
    //  NAVIGATION
    // =======================================================================
    function switchTo(screen) {
        if (!screen) return;
        activeScreen = screen;
        document.querySelectorAll('.pj-screen').forEach(s => s.classList.toggle('active', s.dataset.screen === screen));
        document.querySelectorAll('.pj-nav button[data-go]').forEach(b => b.classList.toggle('active', b.dataset.go === screen));
        if (screen === 'decades') { detailEra = null; showDecadeList(); }
        if (screen === 'diary') renderDiary();
        if (screen === 'decades') renderDecades();
        if (screen === 'settings') renderSettings();
        // reset scroll
        const el = document.querySelector('.pj-screen.active');
        if (el) el.scrollTop = 0;
    }

    function wireNav() {
        document.querySelectorAll('[data-go]').forEach(btn => {
            btn.addEventListener('click', () => switchTo(btn.dataset.go));
        });
        const fb = $('decadeFilterBtn');
        if (fb) fb.addEventListener('click', () => {
            if (window.AppBridge && AppBridge.openDecadePicker) AppBridge.openDecadePicker();
        });
    }

    // =======================================================================
    //  REVIEW  (ring + prev/next peeks + year caption)
    // =======================================================================
    function updateReview(data) {
        const p = data && data.progress;
        if (p) {
            const pct = Math.round(p.percent || 0);
            const ring = $('pjRing'); if (ring) ring.style.setProperty('--p', pct);
            const rp = $('rvRingPct'); if (rp) rp.textContent = pct + '%';
            const sub = $('rvCountSub'); if (sub) sub.textContent = pct + '% complete';
        }
        // year caption from current top card
        const win = (data && data.window) || [];
        const cur = win[0];
        const yEl = $('rvYear'); if (yEl) yEl.textContent = cur ? (cur.year || '') : '';
        // next peek = upcoming card; prev peek = last rated movie (from history)
        const nextEl = $('peekNext'); if (nextEl) nextEl.innerHTML = win[1] ? imgTag(win[1], 'w342') : '';
        const prevEl = $('peekPrev');
        if (prevEl) {
            const st = data && data.state;
            const hist = (st && st.history) || [];
            let prevItem = null;
            for (let i = hist.length - 1; i >= 0; i--) {
                const it = (typeof ItemManager !== 'undefined') ? ItemManager.getById(hist[i].id) : null;
                if (it) { prevItem = it; break; }
            }
            prevEl.innerHTML = prevItem ? imgTag(prevItem, 'w342') : '';
        }
    }

    // =======================================================================
    //  DIARY
    // =======================================================================
    function loadingHTML(msg) {
        return `<div class="pj-card" style="text-align:center;color:var(--pj-tx-1)">${esc(msg || 'Finishing loading your movies…')}</div>`;
    }
    function renderDiary() {
        const root = $('diaryRoot'); if (!root) return;
        if (!dataReady()) { root.innerHTML = loadingHTML('Finishing loading your movies — your Diary fills in a moment…'); return; }

        const st = state();
        const seenSet = new Set(st.seen), notSeenSet = new Set(st.notSeen);
        const all = items(), groups = eras();
        const total = (cfg() && cfg().data.totalCount) || all.length;
        const seen = st.seen.length, notSeen = st.notSeen.length, rated = seen + notSeen;
        const remaining = Math.max(0, total - rated);
        const ratedPct = total ? Math.round(rated / total * 100) : 0;
        const seenPct = total ? (seen / total * 100) : 0;
        const notSeenPct = total ? (notSeen / total * 100) : 0;

        const rows = StatsEngine.statsByEra(all, seenSet, notSeenSet, groups);
        const best = rows.slice().sort((a, b) => b.pct - a.pct)[0] || { name: '—', pct: 0 };
        const years = StatsEngine.rankYears(all, seenSet, 0);
        const topYear = years[0] ? years[0].year : '—';

        // timeline 1980..2025 — real seen counts + seen-ratio colour
        const perYear = {};
        for (const m of all) {
            const y = m.year; if (!perYear[y]) perYear[y] = { seen: 0, total: 0 };
            perYear[y].total++; if (seenSet.has(m.id)) perYear[y].seen++;
        }
        let maxSeen = 1; for (let y = 1980; y <= 2025; y++) if (perYear[y]) maxSeen = Math.max(maxSeen, perYear[y].seen);
        let bars = '';
        for (let y = 1980; y <= 2025; y++) {
            const d = perYear[y] || { seen: 0, total: 0 };
            const h = Math.max(4, Math.round(d.seen / maxSeen * 100));
            const ratio = d.total ? d.seen / d.total : 0;
            bars += `<i style="height:${h}%;background:${lerpColor(ratio)}" title="${y}: ${d.seen} seen"></i>`;
        }

        const chapters = rows.map(r => {
            const warm = r.pct < 40, on = r.id === best.id;
            return `<div class="pj-chip ${on ? 'on' : ''}"><div class="d">${esc(r.id)}</div>` +
                `<div class="p">${r.pct}%</div><div class="pj-bar ${warm ? 'warm' : ''}"><i style="width:${r.pct}%"></i></div></div>`;
        }).join('');

        root.innerHTML = `
      <div class="pj-card">
        <div class="pj-kicker">Movie DNA</div>
        <div class="pj-dna">
          <div><div class="big s">${num(seen)}</div><div class="lab">Seen</div></div>
          <div class="pj-donut" style="--p:${seenPct};--q:${notSeenPct}"><b><i>${ratedPct}%</i><span>Complete</span></b></div>
          <div><div class="big r">${num(remaining)}</div><div class="lab r">Remaining</div></div>
        </div>
        <div class="pj-dim" style="font-size:11.5px;text-align:center;margin-top:12px">
          ${num(seen)} seen · ${num(notSeen)} haven't seen · ${num(remaining)} left of ${num(total)}
        </div>
      </div>
      <div class="pj-duo">
        <div class="pj-card pj-mini s">
          <span class="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="20" x2="6" y2="13"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="9"/></svg></span>
          <div class="pj-kicker muted">Strongest decade</div>
          <div class="v">${esc(best.name)}</div><div class="t">${best.pct}% seen</div>
        </div>
        <div class="pj-card pj-mini">
          <span class="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 7.1-1.01z"/></svg></span>
          <div class="pj-kicker muted">Top year</div>
          <div class="v">${esc(topYear)}</div><div class="t">${years[0] ? num(years[0].seen) + ' seen' : 'Most watched'}</div>
        </div>
      </div>
      <div class="pj-card" style="margin-top:12px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div class="pj-kicker muted">Timeline</div><div class="pj-dim" style="font-size:11px">1980–2025</div>
        </div>
        <div class="pj-timeline">${bars}</div>
        <div class="pj-tl-axis"><span>1980</span><span>2025</span></div>
      </div>
      <div class="pj-kicker muted" style="margin:18px 0 8px">By decade</div>
      <div class="pj-chapters">${chapters}</div>`;
    }

    function lerpColor(t) {
        // coral (240,101,111) -> green (47,209,139)
        t = Math.max(0, Math.min(1, t));
        const r = Math.round(240 + (47 - 240) * t), g = Math.round(101 + (209 - 101) * t), b = Math.round(111 + (139 - 111) * t);
        return `rgb(${r},${g},${b})`;
    }

    // =======================================================================
    //  DECADES (list + detail)
    // =======================================================================
    function showDecadeList() {
        const list = $('decadesList'), det = $('decadeDetail');
        if (list) list.hidden = false;
        if (det) det.hidden = true;
    }
    function showDecadeDetailView() {
        const list = $('decadesList'), det = $('decadeDetail');
        if (list) list.hidden = true;
        if (det) det.hidden = false;
    }

    function renderDecades() {
        if (detailEra) { renderDecadeDetail(detailEra); return; }
        const root = $('decadesRoot'); if (!root) return;
        // filter summary
        const active = (typeof SlidingWindow !== 'undefined') ? SlidingWindow.getActiveEras() : [];
        const totalEras = eras().length;
        const sum = $('decadeFilterSummary');
        if (sum) sum.textContent = active.length === totalEras ? `All ${totalEras} on`
            : active.length === 0 ? 'None on' : `${active.length} of ${totalEras} on`;

        if (!dataReady()) { root.innerHTML = loadingHTML('Finishing loading your movies…'); return; }

        const st = state(), seenSet = new Set(st.seen), notSeenSet = new Set(st.notSeen);
        const all = items(), groups = eras(), totals = eraTotals();
        const rows = StatsEngine.statsByEra(all, seenSet, notSeenSet, groups);
        const byId = {}; rows.forEach(r => byId[r.id] = r);

        root.innerHTML = groups.map(g => {
            const r = byId[g.id] || { seen: 0, rated: 0, pct: 0 };
            const total = (totals[g.id] != null) ? totals[g.id] : (r.total || 0);
            const remaining = Math.max(0, total - r.rated);
            const strip = decadeStrip(g, seenSet, 3);
            const warm = r.pct < 40;
            return `<button class="pj-deccard" data-era="${g.id}">
        <span class="pj-decstrip">${strip}</span>
        <span class="pj-decmeta">
          <span class="n">${esc(g.name)}<span class="pct">${r.pct}%</span></span>
          <span class="s">${num(r.seen)} seen · ${num(remaining)} remaining</span>
          <span class="pj-bar ${warm ? 'warm' : ''}"><i style="width:${r.pct}%"></i></span>
        </span>
        <span class="pj-chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></span>
      </button>`;
        }).join('');

        root.querySelectorAll('.pj-deccard').forEach(b => b.addEventListener('click', () => openDetail(b.dataset.era)));
    }

    function decadeStrip(group, seenSet, n) {
        const all = items();
        const inEra = all.filter(m => m.year >= group.min && m.year <= group.max && (m.poster_path || m.poster));
        const seenFirst = inEra.filter(m => seenSet.has(m.id)).concat(inEra.filter(m => !seenSet.has(m.id)));
        return seenFirst.slice(0, n).map(m => imgTag(m, 'w92')).join('');
    }

    function openDetail(eraId) {
        detailEra = eraId;
        showDecadeDetailView();
        renderDecadeDetail(eraId);
        const el = document.querySelector('.pj-screen.active'); if (el) el.scrollTop = 0;
    }

    function renderDecadeDetail(eraId) {
        const host = $('decadeDetail'); if (!host) return;
        const group = eras().find(g => g.id === eraId); if (!group) { switchTo('decades'); return; }
        const st = state(), seenSet = new Set(st.seen), notSeenSet = new Set(st.notSeen);
        const all = items(), totals = eraTotals();
        const r = StatsEngine.statsByEra(all, seenSet, notSeenSet, [group])[0] || { seen: 0, notSeen: 0, rated: 0, total: 0, pct: 0 };
        const total = (totals[eraId] != null) ? totals[eraId] : (r.total || 0);
        const remaining = Math.max(0, total - r.rated);

        // milestone ticket (lifetime — same global model as ranks)
        const lifeSeen = (typeof GamificationManager !== 'undefined') ? GamificationManager.totalSeen : st.seen.length;
        const ms = (cfg() && cfg().gamification && cfg().gamification.milestones) || [];
        const reached = ms.filter(m => m <= lifeSeen).pop();
        const rank = (typeof GamificationManager !== 'undefined') ? GamificationManager.getRank(lifeSeen) : null;
        const ticket = reached
            ? `<div class="k">MILESTONE</div><div class="star">★</div><div class="n">${num(reached)}</div><div class="t">movies seen</div>`
            : `<div class="k">RANK</div><div class="star">★</div><div class="n" style="font-size:15px">${esc(rank ? rank.name : 'Extra')}</div><div class="t">${num(lifeSeen)} seen</div>`;

        // top years within the decade
        const perYear = {};
        for (const m of all) {
            if (m.year < group.min || m.year > group.max) continue;
            if (!perYear[m.year]) perYear[m.year] = { seen: 0, total: 0, movies: [] };
            perYear[m.year].total++; perYear[m.year].movies.push(m);
            if (seenSet.has(m.id)) perYear[m.year].seen++;
        }
        const ranked = Object.keys(perYear).map(y => ({ y: +y, ...perYear[y] }))
            .sort((a, b) => (b.seen - a.seen) || (a.y - b.y)).slice(0, 5);
        const yearsHTML = ranked.length ? ranked.map((row, i) => {
            const thumbs = row.movies.filter(m => seenSet.has(m.id)).concat(row.movies.filter(m => !seenSet.has(m.id)))
                .filter(m => m.poster_path || m.poster).slice(0, 3).map(m => imgTag(m, 'w92')).join('');
            const pct = row.total ? Math.round(row.seen / row.total * 100) : 0;
            return `<div class="pj-yrow"><div class="pj-yrank">${i + 1}</div>
        <div class="pj-yinfo"><div class="yh"><span class="yy">${row.y}</span><span class="yc">${num(row.seen)} / ${num(row.total)}</span></div>
          <div class="pj-bar"><i style="width:${pct}%"></i></div></div>
        <div class="pj-ythumbs">${thumbs}</div></div>`;
        }).join('') : `<p class="pj-dim" style="font-size:12.5px">Mark films from the ${esc(group.name)} as seen to build your top years.</p>`;

        // recently seen (history first, fallback to seen-in-decade)
        const recent = recentlySeen(eraId, 10);
        const recentHTML = recent.length
            ? recent.map(m => imgTag(m, 'w185')).join('')
            : `<span class="empty">Nothing seen here yet.</span>`;

        host.innerHTML = `
      <div class="pj-det-head">
        <button class="pj-back" id="pjDetBack"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg> Decades</button>
        <div class="pj-det-title">${esc(group.name)}</div>
        <button class="pj-iconbtn" id="pjDetFilter" aria-label="Choose decades"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg></button>
      </div>
      <div class="pj-card pj-hero">
        <div>
          <div class="pname">${esc(group.name)}</div><div class="plab">Your progress</div>
          <div class="pj-bar ${r.pct < 40 ? 'warm' : ''}"><i style="width:${r.pct}%"></i></div>
          <div class="pcount">${num(r.seen)} seen · ${num(remaining)} remaining<span class="pct-inline">${r.pct}%</span></div>
        </div>
        <div class="pj-ticket">${ticket}</div>
      </div>
      <div class="pj-kicker muted pj-section-k">Top years</div>
      <div>${yearsHTML}</div>
      <div class="pj-kicker muted pj-section-k">Recently seen</div>
      <div class="pj-recent">${recentHTML}</div>
      <button class="pj-cta" id="pjContinue">Continue<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg></button>`;

        const back = $('pjDetBack'); if (back) back.addEventListener('click', () => { detailEra = null; switchTo('decades'); });
        const filt = $('pjDetFilter'); if (filt) filt.addEventListener('click', () => { if (window.AppBridge) AppBridge.openDecadePicker(); });
        const cont = $('pjContinue'); if (cont) cont.addEventListener('click', () => {
            if (window.AppBridge && AppBridge.reviewDecade) AppBridge.reviewDecade(eraId);
            detailEra = null; switchTo('review');
        });
    }

    function recentlySeen(eraId, n) {
        const st = state(), seenSet = new Set(st.seen);
        const out = [], used = new Set();
        const hist = st.history || [];
        for (let i = hist.length - 1; i >= 0 && out.length < n; i--) {
            const h = hist[i]; if (h.action !== 'seen') continue;
            if (used.has(h.id)) continue;
            const it = (typeof ItemManager !== 'undefined') ? ItemManager.getById(h.id) : null;
            if (it && (!eraId || eraOf(it) === eraId)) { out.push(it); used.add(h.id); }
        }
        if (out.length < n) {
            // fallback: seen items in this decade (list order, latest-ish last)
            const all = items();
            for (let i = all.length - 1; i >= 0 && out.length < n; i--) {
                const it = all[i];
                if (!seenSet.has(it.id) || used.has(it.id)) continue;
                if (eraId && eraOf(it) !== eraId) continue;
                out.push(it); used.add(it.id);
            }
        }
        return out;
    }

    // =======================================================================
    //  SETTINGS (live stats; action buttons are wired by app.js)
    // =======================================================================
    function renderSettings() {
        const p = progress(); if (!p) return;
        const a = $('statSeen'), b = $('statSkipped'), c = $('statRemaining');
        if (a) a.textContent = num(p.globalSeen);
        if (b) b.textContent = num(p.globalNotSeen);
        if (c) c.textContent = num(p.globalRemaining);
    }

    // =======================================================================
    //  ENGINE HOOK (called by app.js on every update)
    // =======================================================================
    function onAppUpdate(data) {
        lastData = data;
        updateReview(data);

        // refresh visible scroll screens when the selection changed or full data just landed
        const sig = (typeof SlidingWindow !== 'undefined') ? SlidingWindow.getActiveEras().slice().sort().join(',') : '';
        const filterChanged = sig !== lastFilterSig; lastFilterSig = sig;
        const readyNow = dataReady();
        const readyJustLatched = readyNow && !dataReadyLatched; if (readyNow) dataReadyLatched = true;

        if (filterChanged || readyJustLatched) {
            if (activeScreen === 'diary') renderDiary();
            else if (activeScreen === 'decades') renderDecades();
            else if (activeScreen === 'settings') renderSettings();
        }
    }

    function init() {
        wireNav();
        // ensure the initial highlight matches the visible screen
        switchTo('review');
        if (lastData) updateReview(lastData);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    return { onAppUpdate, switchTo, _renderDiary: renderDiary, _renderDecades: renderDecades };
})();

if (typeof window !== 'undefined') window.UIShell = UIShell;
