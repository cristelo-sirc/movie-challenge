/* Smoke test: prove the harness boots the real app against real data. */
const { boot } = require('./boot');

(async () => {
    const app = await boot({ waitFullyLoaded: false });
    const { document, window } = app;

    const checks = [];
    const ok = (name, cond) => checks.push([name, !!cond]);

    const A = window.__app || {};
    ok('SlidingWindow exists', A.SlidingWindow);
    ok('UIShell exists', window.UIShell);
    ok('AppBridge exists', window.AppBridge);
    ok('Streaming exists', window.Streaming);
    ok('a card rendered', document.querySelector('#cardStack .movie-card'));
    ok('card has a title', (document.querySelector('.card-title') || {}).textContent);
    ok('Seen/Haven\'t-Seen buttons present', document.getElementById('seenBtn') && document.getElementById('skipBtn'));
    ok('bottom-nav present', document.querySelector('.pj-nav, .pj-tabbar, [data-tab]'));
    ok('no app errors at boot', app.errors.length === 0);

    // Give late chunks a moment, then report total loaded.
    const total = A.ItemManager && A.ItemManager.getAll ? A.ItemManager.getAll().length : 0;
    ok('loaded a meaningful item count (>1000)', total > 1000);

    let pass = 0;
    for (const [name, c] of checks) { console.log((c ? 'PASS' : 'FAIL') + '  ' + name); if (c) pass++; }
    console.log(`\n${pass}/${checks.length} checks passed; items loaded=${total}; errors=${app.errors.length}`);
    if (app.errors.length) console.log('--- errors ---\n' + app.errors.slice(0, 5).join('\n'));
    app.close();
    process.exit(pass === checks.length ? 0 : 1);
})().catch(e => { console.error('SMOKE BOOT FAILED:\n', e.message); process.exit(2); });
