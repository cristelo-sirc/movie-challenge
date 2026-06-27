/**
 * JSDOM boot harness for the Poster Journal app.
 *
 * Boots the REAL index.html + the real JS bundle against the REAL data chunks,
 * using a local-file fetch shim (no server needed). Returns the live window so
 * tests can drive the UI and assert on the DOM.
 *
 * Why concatenate the scripts into one program: the app's modules are top-level
 * `const X = (function(){…})()` bindings that, in a browser, share one global
 * lexical environment across <script> tags. Node's per-script vm scopes do not,
 * so we join every script (in index.html order) into a single program and run it
 * once — which faithfully reproduces cross-module visibility.
 *
 * Usage:
 *   const { boot } = require('./boot');
 *   const app = await boot({ localStorage: { '5000-movie-challenge': '{...}' } });
 *   // app.window, app.document, app.errors, app.close()
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');

function readIndex() {
    return fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
}

// Collect local <script src> paths in document order (skip http/https libs we
// can't run, e.g. fonts). lz-string/qrcode are local and ARE included.
function scriptOrder(html) {
    const out = [];
    const re = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        const src = m[1].split('?')[0].split('#')[0];
        if (/^https?:/i.test(src)) continue;
        out.push(src);
    }
    return out;
}

// Strip <script> tags and external <link> (fonts) so JSDOM parses pure markup;
// we inject the concatenated program ourselves after shims are installed.
function stripHead(html) {
    return html
        .replace(/<script\b[\s\S]*?<\/script>/gi, '')
        .replace(/<link\b[^>]*googleapis[^>]*>/gi, '')
        .replace(/<link\b[^>]*gstatic[^>]*>/gi, '')
        .replace(/<link\b[^>]*fonts\.[^>]*>/gi, '');
}

function buildBundle(html) {
    const parts = [];
    for (const rel of scriptOrder(html)) {
        const file = path.join(ROOT, rel);
        parts.push('/* ===== ' + rel + ' ===== */\n' + fs.readFileSync(file, 'utf8'));
    }
    // Test-only: expose the top-level `const` modules (which are NOT on window)
    // so Node-side tests can inspect engine state. Appended INSIDE the bundle so
    // it shares the same lexical scope as the modules. Adds nothing to app logic.
    const expose = `
;window.__app = (function(){ var o={};
  ['SlidingWindow','StorageManager','StatsEngine','GamificationManager','ItemManager','ConfigLoader','DataLoader','ThemeManager','AudioManager']
  .forEach(function(n){ try{ o[n]=eval(n); }catch(e){} });
  return o;
})();`;

    // ";" + newline guards against ASI surprises when joining minified libs.
    return parts.join('\n;\n') + expose;
}

function installShims(window, errors) {
    // Local-file fetch (maps data/* URLs to disk, ignores ?v= / cache opts).
    window.fetch = function (url) {
        try {
            let p = String(url).split('?')[0].split('#')[0].replace(/^\.?\//, '');
            const text = fs.readFileSync(path.join(ROOT, p), 'utf8');
            return Promise.resolve({
                ok: true, status: 200,
                json: () => Promise.resolve(JSON.parse(text)),
                text: () => Promise.resolve(text)
            });
        } catch (e) {
            return Promise.resolve({
                ok: false, status: 404,
                json: () => Promise.reject(e),
                text: () => Promise.resolve('')
            });
        }
    };

    window.matchMedia = function (q) {
        return {
            matches: false, media: q, onchange: null,
            addListener() {}, removeListener() {},
            addEventListener() {}, removeEventListener() {},
            dispatchEvent() { return false; }
        };
    };

    window.requestAnimationFrame = function (cb) { return setTimeout(() => cb(Date.now()), 0); };
    window.cancelAnimationFrame = function (id) { clearTimeout(id); };
    window.scrollTo = function () {};

    try {
        Object.defineProperty(window.navigator, 'vibrate', { value: () => true, configurable: true });
    } catch (e) { /* some envs lock navigator; non-fatal */ }

    // Disable Web Audio cleanly: with no AudioContext, AudioManager.init() fails
    // safe (isEnabled=false) and every sound no-ops. Audio is irrelevant to logic
    // and a partial stub throws inside playback handlers, so we omit it entirely.
    window.AudioContext = window.webkitAudioContext = undefined;

    // Record app-thrown errors so tests can fail loudly.
    window.addEventListener('error', (e) => {
        errors.push((e && e.error && e.error.stack) || (e && e.message) || String(e));
    });
    const origErr = window.console.error.bind(window.console);
    window.console.error = function (...a) { errors.push(a.map(String).join(' ')); origErr(...a); };
}

function boot(opts) {
    opts = opts || {};
    const html = readIndex();
    const errors = [];

    // Capture uncaught exceptions thrown inside event handlers (jsdom routes
    // these to the virtual console as 'jsdomError') so the suite fails loudly
    // on a real throw instead of silently swallowing it.
    const vc = new VirtualConsole();
    vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e && (e.detail && e.detail.stack || e.message) || e)));

    const dom = new JSDOM(stripHead(html), {
        runScripts: 'dangerously',
        pretendToBeVisual: true,
        url: 'https://localhost/',
        virtualConsole: vc,
        beforeParse(window) { installShims(window, errors); }
    });

    const window = dom.window;

    // Seed localStorage BEFORE the app boots (for resume/import/persist tests).
    if (opts.localStorage) {
        for (const k of Object.keys(opts.localStorage)) {
            window.localStorage.setItem(k, opts.localStorage[k]);
        }
    }

    // Run the whole bundle as one program (shared lexical scope = browser-like).
    const scriptEl = window.document.createElement('script');
    scriptEl.textContent = buildBundle(html);
    window.document.body.appendChild(scriptEl);

    // Wait until the app has booted (cards rendered) or time out.
    const deadline = Date.now() + (opts.timeout || 9000);
    return new Promise((resolve, reject) => {
        (function pump() {
            const app = window.__app || {};
            const ready = app.SlidingWindow &&
                window.document.querySelector('#cardStack .movie-card');
            const fullyLoaded = app.DataLoader && app.DataLoader.isFullyLoaded;
            if (ready && (opts.waitFullyLoaded ? fullyLoaded : true)) {
                return resolve({
                    dom, window, document: window.document, errors,
                    close: () => dom.window.close()
                });
            }
            if (Date.now() > deadline) {
                return reject(new Error('boot timeout. errors=\n' + errors.join('\n') +
                    '\ncardStack html: ' + (window.document.querySelector('#cardStack') || {}).innerHTML));
            }
            setTimeout(pump, 30);
        })();
    });
}

module.exports = { boot, ROOT, scriptOrder, buildBundle };
