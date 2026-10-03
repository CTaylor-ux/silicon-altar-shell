#!/usr/bin/env node
/**
 * prepare-windows.mjs
 *
 * Reads the seven generated Window documents out of the Silicon Altar audit
 * repo and writes addressable copies into public/windows/.
 *
 * It makes exactly two ADDITIVE changes. Neither touches markup structure,
 * CSS, or any visible text — the Windows must look identical to the originals.
 *
 *   1. data-entry-id="<entries.json id>" on every .ev row.
 *      The documents ship with only 3 id attributes (all dossier-overlay
 *      chrome) and one data-dossier attribute that is a DOSSIER GROUPING KEY,
 *      not a row key — it is reused across lanes (W5: 188 rows, 64 keys). So
 *      no event is individually addressable, and answer->location targeting
 *      is impossible without this.
 *
 *   2. A ~40-line postMessage bridge so the shell can scroll/highlight a row
 *      and observe scroll position across the iframe boundary.
 *
 * The audit repo is opened read-only. Nothing is ever written back to it.
 *
 * PROMOTION PATH: change (1) is one line in silicon_altar_generator.py:541 —
 *   f'<div class="ev"{dataattr}>'
 *   f'<div class="ev" data-entry-id="{e["id"]}"{dataattr}>'
 * Once promoted, this script drops to change (2) only.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/* NO DEFAULT, DELIBERATELY. See the matching note in prepare-corpus.mjs: the
 * hardcoded ~/Desktop fallback that used to sit here resolved to a real,
 * abandoned 778-entry copy, so a missing .env.local line built the wrong
 * corpus instead of failing. */
const REPO =
  process.env.SILICON_ALTAR_REPO ||
  readEnvLocal('SILICON_ALTAR_REPO');

const OUT = path.join(process.cwd(), 'public', 'windows');
const META_OUT = path.join(process.cwd(), 'lib', 'windows.generated.json');

function readEnvLocal(key) {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    const m = raw.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

function die(msg) {
  console.error(`\n  prepare-windows FAILED\n  ${msg}\n`);
  process.exit(1);
}

if (!REPO)
  die(
    'SILICON_ALTAR_REPO is not set, and there is no default.\n' +
      '  Add it to .env.local:\n' +
      '    SILICON_ALTAR_REPO=/Users/taylorcolin/dev/Silicon_Altar_LIVE\n' +
      '  NOT a ~/Desktop copy: those are abandoned and stale.'
  );

if (!fs.existsSync(REPO)) die(`Audit repo not found at: ${REPO}\n  Set SILICON_ALTAR_REPO in .env.local`);

// ---------------------------------------------------------------------------
// Lane table, parsed from the generator so display labels stay correct by
// construction rather than transcribed. The corpus has FOURTEEN lanes.
// ---------------------------------------------------------------------------
function parseLanes() {
  const src = fs.readFileSync(path.join(REPO, 'silicon_altar_generator.py'), 'utf8');
  const block = src.match(/^LANES = \[([\s\S]*?)^\]/m);
  if (!block) die('Could not locate the LANES table in silicon_altar_generator.py');
  const lanes = [];
  const re = /\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/g;
  let m;
  while ((m = re.exec(block[1]))) {
    lanes.push({ key: m[1], label: m[2], cls: m[3], thead: unesc(m[4]) });
  }
  if (!lanes.length) die('LANES table parsed to zero lanes');
  return lanes;
}

const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// ---------------------------------------------------------------------------
// Row -> entry mapping.
//
// (window, lane, title) is unique across all 690 entries — verified before this
// script was written. Both halves of the key are present in the emitted HTML:
// the lane display label in <span class="lane-tag">, the title as the first
// text node of <span class="en">. So the match is exact, not positional, and
// stays correct even if the generator's row ordering changes.
// ---------------------------------------------------------------------------
const lanes = parseLanes();
const labelToKey = new Map(lanes.map((l) => [l.label, l.key]));

const entriesRaw = JSON.parse(fs.readFileSync(path.join(REPO, 'entries.json'), 'utf8'));
const entries = Array.isArray(entriesRaw) ? entriesRaw : entriesRaw.entries;

const index = new Map();
for (const e of entries) {
  index.set(`${e.window}\0${e.lane}\0${e.title}`, e);
}

// ---------------------------------------------------------------------------
// The bridge. Injected before </body>. Additive; no styling of its own beyond
// the pulse keyframes, which are scoped to a class the generator never emits.
// ---------------------------------------------------------------------------
const BRIDGE = `
<style id="sa-shell-bridge-style">
/* ITEM C — build provenance is operator information, not member information.
   The .v25-note banner ("<amend> data-first generation … emitted by the L1
   Generator from L4 data … hand-editing prohibited per V2.2 §VI") is hidden
   for members and revealed only in operator view (?operator=1).

   display:none rather than removal: the node stays in the document, so the
   generator's output is untouched and operator view is a class flip, not a
   re-render. The banner is a normal block between .hdr and .legends-sticky and
   is referenced by no sticky offset, so hiding it shifts the blocks beneath it
   up as a group without disturbing their layout. */
html.sa-member .v25-note { display: none; }
html.sa-member .sa-provenance { display: none; }
html.sa-operator .v25-note,
html.sa-operator .sa-provenance { outline: 1px dashed rgba(93,150,196,.5); outline-offset: -1px; }

/* THREAD 37 — the rest of the build text, hidden for members the same way
   (operator view still shows all of it). Record of what was there:
   ~/dev/Silicon_Altar_LIVE/docket/internal_text_thread37/INVENTORY.md.
     .ft      the generator's footer block in every window: a title line with
              its own version ("— V5", "- V2.8"), changelog lines ("v6 — Military
              Lane (10th Column) + ...", "v7.0 — Thread 5 Integration"), "Prepared
              April 2026", and Previous/Next links the shell's rail replaces.
     .pfoot   "Generated <date> · L1 v1 · V2.8"; the motto beside it stays.
     dossier pop-up: the Revision History block (in all 417 dossiers, most of
              it thread numbers, batch names and backlog ids) and the bracketed
              workflow notes on correlation rows ("W4 entry pending").
   The version in the "Correlation Layer (V2.7)" heading is removed in the
   bridge script below, since CSS cannot edit text. */
html.sa-member .ft { display: none; }
html.sa-member .pfoot > span:not(.motto) { display: none; }
html.sa-member .d-block:has(> .d-rev) { display: none; }
html.sa-member .d-corr .placeholder { display: none; }

/* ITEM D — glossary affordances.
   Tokens keep their own look; they gain a pointer and a faint underline on
   hover so they read as askable without new icons in the grid. */
[data-sa-glossary] { cursor: help; }
[data-sa-glossary]:not([data-sa-glossary-via]):hover {
  box-shadow: inset 0 -1px 0 0 currentColor;
}
[data-sa-glossary]:focus-visible {
  outline: 1px solid var(--sig);
  outline-offset: 1px;
}
.lane-tag[data-sa-glossary]:hover { color: var(--bright); }

/* The DOSSIER badge's click already opens the dossier, so its definition is
   reached through a hover "?" rather than by hijacking the button. */
[data-sa-glossary-via="hint"] { position: relative; }
.sa-gloss-hint {
  position: absolute;
  top: -7px; right: -7px;
  width: 13px; height: 13px;
  border-radius: 50%;
  background: var(--panel2);
  border: 1px solid var(--bdr2);
  color: var(--dim);
  font: 600 8px/11px 'IBM Plex Mono', monospace;
  text-align: center;
  cursor: help;
  opacity: 0;
  transition: opacity 120ms ease;
  z-index: 5;
}
[data-sa-glossary-via="hint"]:hover .sa-gloss-hint,
.sa-gloss-hint:hover { opacity: 1; }

/* ITEM D — top-of-window legend collapsed by default, now that every token
   explains itself in place. The shell's Legend button flips the root class. */
html:not(.sa-legend-open) .legends-sticky,
html:not(.sa-legend-open) .legend,
html:not(.sa-legend-open) .note,
html:not(.sa-legend-open) .tlegend { display: none; }

/* MAP LAYER (Thread 35). A small mark in the year cell of rows that have map
   data. The shell sends the list (SA_MAP_ROWS) from lib/maps.generated.json, so
   the generated document is untouched and the list lives in one place. */
.sa-map-mark {
  display: flex; align-items: center; gap: 4px; width: max-content;
  margin-top: 7px; padding: 1px 6px;
  border: 1px solid var(--bdr2); border-radius: 2px; background: transparent;
  color: var(--txt); font: 500 8.5px 'IBM Plex Mono', monospace; letter-spacing: 1.2px;
  cursor: pointer;
}
.sa-map-mark:hover, .sa-map-mark[aria-pressed="true"] {
  color: var(--bright); border-color: var(--dim); background: var(--panel2);
}
.sa-map-mark:focus-visible { outline: 1px solid var(--sig); outline-offset: 1px; }
.sa-map-mark svg { width: 10px; height: 10px; }

@keyframes sa-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(224,93,58,.55); background: rgba(224,93,58,.14); }
  70%  { box-shadow: 0 0 0 14px rgba(224,93,58,0); background: rgba(224,93,58,.05); }
  100% { box-shadow: 0 0 0 0 rgba(224,93,58,0); background: transparent; }
}
.sa-target { animation: sa-pulse 1500ms ease-out 2; border-radius: 3px; }
.sa-target > .en { color: var(--sig) !important; }
@media (prefers-reduced-motion: reduce) {
  .sa-target { animation: none; outline: 2px solid var(--sig); outline-offset: 2px; }
}
</style>
<script id="sa-shell-bridge">
(function () {
  var WINDOW_ID = __WINDOW_ID__;
  var animToken = 0;
  var PANEL_W = 0; // width of the shell's map panel over this frame, 0 when closed

  // Member vs operator view. Operator is opt-in via ?operator=1 on the frame
  // URL, which the shell appends when its own URL carries the same flag.
  // NOTE: BRIDGE is a JS template literal, so any backslash escape here is
  // consumed by the literal before it reaches the emitted file. \\b became a
  // backspace character and the test could never match. Keep this regex free
  // of backslashes rather than double-escaping — it is easier to get right.
  var IS_OPERATOR = /[?&]operator=1/.test(location.search);
  document.documentElement.classList.add(IS_OPERATOR ? 'sa-operator' : 'sa-member');

  // Thread 37: the dossier pop-up's "Correlation Layer (V2.7)" heading carries a
  // protocol version. The generator builds the pop-up on each click, so for
  // members the heading is cleaned after it is built. The row handlers call
  // openDossier by its global name, so replacing the global reaches them.
  if (!IS_OPERATOR && typeof window.openDossier === 'function') {
    var genOpenDossier = window.openDossier;
    window.openDossier = function (id) {
      genOpenDossier(id);
      var t = document.querySelector('.d-corr-title');
      if (t) t.innerHTML = t.innerHTML.replace(/[ ]*[(]V[0-9.]+[)]/, '');
    };
  }

  // The .v25-note banner is one of FIVE places the generator prints build
  // provenance. The other four are text fragments inside elements that also
  // carry member-relevant content (row/entry/dossier counts), so they cannot
  // be hidden by hiding their element. They are wrapped in .sa-provenance
  // instead, which keeps member/operator a pure class flip and leaves the
  // surrounding member content untouched.
  //
  //   .meta       trailing "<amend> data-first generated" line in the stat panel
  //   .statusbar  "· <amend> DATA-FIRST GENERATED" inside the LOADED: line,
  //               which also carries member-relevant row/entry/dossier counts
  //   .live       "GENERATED FROM L4" badge (whole element)
  //   .ft         "<amend> data-first generated • <stamp>" in the footer
  function wrapProvenance() {
    var PATTERNS = [
      { sel: '.meta', re: /(<br\\s*\\/?>)?\\s*[Vv][\\d.]+\\s+data-first generated/ },
      { sel: '.statusbar span', re: /\\s*(?:&middot;|·)\\s*[Vv][\\d.]+\\s+DATA-FIRST GENERATED/ },
      { sel: '.ft', re: /(<br\\s*\\/?>)?\\s*[Vv][\\d.]+\\s+data-first generated[^<]*/ },
    ];
    for (var i = 0; i < PATTERNS.length; i++) {
      var nodes = document.querySelectorAll(PATTERNS[i].sel);
      for (var j = 0; j < nodes.length; j++) {
        var el = nodes[j];
        var m = el.innerHTML.match(PATTERNS[i].re);
        if (!m) continue;
        el.innerHTML = el.innerHTML.replace(
          PATTERNS[i].re,
          '<span class="sa-provenance">' + m[0] + '</span>'
        );
      }
    }
    // Whole-element case: the L4 badge is nothing but provenance.
    var live = document.querySelectorAll('.live');
    for (var k = 0; k < live.length; k++) {
      if (/GENERATED FROM L4/i.test(live[k].textContent || '')) {
        live[k].classList.add('sa-provenance');
      }
    }
  }
  wrapProvenance();
  function post(msg) {
    try { parent.postMessage(Object.assign({ source: 'sa-window', windowId: WINDOW_ID }, msg), '*'); }
    catch (e) {}
  }
  function clearTargets() {
    var prev = document.querySelectorAll('.sa-target');
    for (var i = 0; i < prev.length; i++) prev[i].classList.remove('sa-target');
  }
  function hScroller(el) {
    // Nearest ancestor that actually scrolls horizontally. The timeline table
    // sits in one; the document does not necessarily.
    for (var n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      var s = getComputedStyle(n).overflowX;
      if ((s === 'auto' || s === 'scroll') && n.scrollWidth > n.clientWidth + 1) return n;
    }
    return document.scrollingElement || document.documentElement;
  }
  function docTop(el) {
    var y = 0;
    for (var n = el; n; n = n.offsetParent) y += n.offsetTop;
    return y;
  }
  function scrollToEntry(entryId) {
    var sel = '[data-entry-id="' + (window.CSS && CSS.escape ? CSS.escape(entryId) : entryId) + '"]';
    var el = document.querySelector(sel);
    if (!el) { post({ type: 'SA_TARGET_MISS', entryId: entryId }); return; }
    clearTargets();

    // Expand BEFORE measuring or scrolling: expanding after a smooth scroll has
    // started shifts layout underneath it and the animation is cancelled.
    var body = el.querySelector('.et');
    if (body) body.style.display = 'block';
    el.classList.add('sa-target');

    // Ack on RECEIPT, not on arrival: the shell retries until acked, and an
    // ack that waited for the animation would restart it on every retry.
    post({ type: 'SA_TARGET_HIT', entryId: entryId });
    var token = ++animToken;

    // Let the expansion land, then scroll both axes explicitly.
    //
    // Three things are deliberately NOT used here:
    //   - scrollIntoView: unreliable, because the row sits inside a nested
    //     horizontal scroller (DIV.scroller) rather than the document.
    //   - behavior:'smooth': rAF-driven, so it silently no-ops wherever rAF is
    //     throttled.
    //   - requestAnimationFrame: verified NOT to fire inside these iframes in
    //     at least one embedding context, which stranded the scroll entirely.
    // A timer-driven ease is deterministic in every context and costs nothing.
    setTimeout(function () {
      var hs = hScroller(el);
      var r = el.getBoundingClientRect();
      var usesInner = hs && hs !== document.scrollingElement && hs !== document.documentElement;

      var fromY = window.scrollY;
      var fromX = usesInner ? hs.scrollLeft : window.scrollX;

      // How much pinned chrome sits at the top of the frame right now.
      //
      // The generated windows pin .legends-sticky (top:0), .legend (top:65px)
      // and .tbl thead th (top:95px). With the legend collapsed only the
      // column-header row is pinned, bottoming out at 128px; with it open the
      // stack is taller. Measuring beats hardcoding, because the shell can
      // toggle the legend at any time.
      function topClearance() {
        var sels = ['.legends-sticky', '.legend', '.tbl thead th'];
        var max = 0;
        for (var i = 0; i < sels.length; i++) {
          var el = document.querySelector(sels[i]);
          if (!el) continue;
          var cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.position !== 'sticky') continue;
          var t = parseFloat(cs.top);
          if (!isFinite(t)) continue;
          max = Math.max(max, t + el.offsetHeight);
        }
        return max;
      }

      // Destinations are RECOMPUTED every frame from the element's live
      // position. A freshly mounted neighbour window (W5 is 385 KB / 188 rows)
      // can still be laying out when the target fires; a destination computed
      // once, up front, would be stale before the animation finished.
      function destY() {
        // Put the row's TOP just below the pinned chrome, not its midpoint at
        // the viewport centre. Rows here are frequently taller than the
        // viewport (this one is 1084px in a 700px frame), so centring pushes
        // the title and the first lines of the body off the top of the screen
        // and the reader has to scroll UP to find the start of what they
        // clicked. Reading starts at the top of the entry.
        var pad = topClearance() + 16;
        return Math.max(0, Math.min(
          docTop(el) - pad,
          Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
        ));
      }
      function destX() {
        var rr = el.getBoundingClientRect();
        // Centre in the part of the frame the map panel leaves visible.
        var seenW = Math.max(200, (usesInner ? hs.clientWidth : window.innerWidth) - PANEL_W);
        var raw = usesInner
          ? hs.scrollLeft + (rr.left - hs.getBoundingClientRect().left) - seenW / 2 + rr.width / 2
          : window.scrollX + rr.left - seenW / 2 + rr.width / 2;
        var max = usesInner
          ? hs.scrollWidth - hs.clientWidth
          : document.documentElement.scrollWidth - window.innerWidth;
        return Math.max(0, Math.min(raw, Math.max(0, max)));
      }

      var DUR = 620;
      var t0 = Date.now();
      function ease(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
      function frame() {
        if (token !== animToken) return; // superseded by a newer target
        var p = Math.min(1, (Date.now() - t0) / DUR);
        var e = ease(p);
        var ty = destY();
        var tx = destX();
        window.scrollTo(usesInner ? window.scrollX : fromX + (tx - fromX) * e, fromY + (ty - fromY) * e);
        if (usesInner) hs.scrollLeft = fromX + (tx - fromX) * e;
        if (p < 1) { setTimeout(frame, 16); return; }

        // Correction pass: if late layout (fonts, images) moved the row after
        // the animation settled, snap to it rather than leaving it off-screen.
        setTimeout(function () {
          if (token !== animToken) return;
          var rr = el.getBoundingClientRect();
          var floor = topClearance();
          // Too high (title hidden under the sticky header) or too low
          // (scrolled off the bottom) both mean the landing missed.
          if (rr.top < floor || rr.top > window.innerHeight - 40) {
            window.scrollTo(window.scrollX, destY());
            if (usesInner) hs.scrollLeft = destX();
          }
          post({ type: 'SA_TARGET_ARRIVED', entryId: entryId });
        }, 260);
      }
      frame();
    });
  }
  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || d.source !== 'sa-shell') return;
    if (d.type === 'SA_SCROLL_TO') scrollToEntry(d.entryId);
    else if (d.type === 'SA_CLEAR') clearTargets();
    else if (d.type === 'SA_RESTORE_SCROLL') window.scrollTo(d.x || 0, d.y || 0);
  });
  var tick = null;
  window.addEventListener('scroll', function () {
    if (tick) return;
    tick = setTimeout(function () {
      tick = null;
      post({ type: 'SA_SCROLL', x: window.scrollX, y: window.scrollY });
    }, 160);
  }, { passive: true });
  // Arrow-key window navigation must work while focus is inside the iframe.
  window.addEventListener('keydown', function (e) {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') post({ type: 'SA_NAV', key: e.key });
  });
  // -------------------------------------------------------------------------
  // ITEM D — glossary binding.
  //
  // Binds click handlers to definitional tokens in the ALREADY-RENDERED
  // document. The generator, the L4 data, and the audit repo's generated HTML
  // are all untouched; this only reads the DOM the generator produced and
  // reports a token key upward. Definitions live in the shell (lib/glossary
  // .json) and are never duplicated here.
  //
  // Capture phase + stopPropagation is load-bearing: on rows that carry a
  // dossier, the whole .en span already has a click handler that opens the
  // dossier, and badges live INSIDE .en. Capturing on the badge stops that
  // handler firing, so a badge click yields a definition while a click on the
  // row title still opens the dossier. Existing behaviour is preserved.
  // -------------------------------------------------------------------------
  var LANE_KEY_BY_LABEL = __LANE_MAP_JSON__;

  function tokenKeyFor(el) {
    var cl = el.classList;
    if (cl.contains('mile')) return 'milestone';
    if (cl.contains('dtag')) return 'dossier';
    if (cl.contains('ss')) {
      var s = (el.textContent || '').trim().toUpperCase();
      return /^S[1-4]$/.test(s) ? 'stream:' + s : null;
    }
    if (cl.contains('tt')) {
      // Tier badges carry .ta-.te; CM/CTX carry their own class; the rest are
      // technology tags whose text is the key.
      for (var i = 0; i < 5; i++) {
        var t = ['a', 'b', 'c', 'd', 'e'][i];
        if (cl.contains('t' + t)) return 'tier:' + t.toUpperCase();
      }
      if (cl.contains('cm')) return 'tag:CM';
      if (cl.contains('ctx')) return 'tag:CTX';
      var tx = (el.textContent || '').trim().toUpperCase();
      if (/^T\\d{1,2}$/.test(tx)) return 'tag:' + tx;
      return null;
    }
    if (cl.contains('tk')) {
      var b = el.querySelector('b');
      var k = ((b && b.textContent) || '').trim().toUpperCase();
      if (/^T\\d{1,2}$/.test(k) || k === 'CM' || k === 'CTX') return 'tag:' + k;
      return null;
    }
    // Lane labels appear in three places with different text: the row tag
    // ("Legal"), the collapsed legend swatch row ("Legal"), and the column
    // header ("LEGAL FRAMEWORK"). One normalised map covers all three.
    if (cl.contains('lane-tag') || el.querySelector('.ld') || el.querySelector('.dot')) {
      var t = (el.textContent || '').trim().toUpperCase();
      return LANE_KEY_BY_LABEL[t] || null;
    }
    return null;
  }

  function sendGlossary(el, key) {
    var r = el.getBoundingClientRect();
    post({
      type: 'SA_GLOSSARY',
      token: key,
      rect: { top: r.top, left: r.left, width: r.width, height: r.height },
    });
  }

  function bindToken(el) {
    if (el.getAttribute('data-sa-glossary')) return;
    var key = tokenKeyFor(el);
    if (!key) return;
    el.setAttribute('data-sa-glossary', key);

    // The DOSSIER badge's click is already spoken for — it opens the dossier,
    // which is the product's primary affordance and must not be hijacked. Its
    // definition is reached through the hover "?" instead. Every other token
    // uses the badge itself as the target, as specified.
    if (key === 'dossier') {
      el.setAttribute('data-sa-glossary-via', 'hint');
      var q = document.createElement('span');
      q.className = 'sa-gloss-hint';
      q.textContent = '?';
      q.setAttribute('role', 'button');
      q.setAttribute('tabindex', '0');
      q.setAttribute('aria-label', 'What is a dossier?');
      el.appendChild(q);
      return;
    }

    el.addEventListener(
      'click',
      function (e) {
        e.preventDefault();
        e.stopPropagation();
        sendGlossary(el, key);
      },
      true
    );
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        sendGlossary(el, key);
      }
    });
  }

  function bindAll(root) {
    var sel = '.tt, .ss, .mile, .dtag, .tk, .lane-tag, .legend span, thead th';
    var nodes = (root || document).querySelectorAll(sel);
    for (var i = 0; i < nodes.length; i++) bindToken(nodes[i]);
    return nodes.length;
  }

  // The hover "?" hint for the DOSSIER badge only.
  document.addEventListener(
    'click',
    function (e) {
      var hint = e.target && e.target.closest && e.target.closest('.sa-gloss-hint');
      if (!hint) return;
      e.preventDefault();
      e.stopPropagation();
      var host = hint.parentElement;
      if (host) sendGlossary(host, host.getAttribute('data-sa-glossary'));
    },
    true
  );

  var bound = bindAll(document);

  // Legend collapse is a class on <html>; the shell owns the toggle so no new
  // control is injected into the generated document.
  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || d.source !== 'sa-shell') return;
    if (d.type === 'SA_LEGEND') {
      document.documentElement.classList.toggle('sa-legend-open', !!d.open);
    }
  });
  document.documentElement.classList.remove('sa-legend-open');

  // -------------------------------------------------------------------------
  // MAP LAYER (Thread 35). The shell names the rows that have map data; each
  // gets a MAP mark in its year cell, and a click reports the row upward. The
  // mark is the only thing added to the document, and only on those rows.
  // -------------------------------------------------------------------------
  var MAP_ICON = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 3l3-1.5 4 1.5 3-1.5v8l-3 1.5-4-1.5-3 1.5z" fill="none" stroke="currentColor"/></svg>';
  function markMapRows(ids) {
    var old = document.querySelectorAll('.sa-map-mark');
    for (var i = 0; i < old.length; i++) old[i].parentNode.removeChild(old[i]);
    for (var j = 0; j < (ids || []).length; j++) {
      var id = ids[j];
      var ev = document.querySelector('[data-entry-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
      var tr = ev && ev.closest ? ev.closest('tr') : null;
      var yr = tr ? tr.querySelector('td.yr') : null;
      if (!yr || yr.querySelector('.sa-map-mark')) continue;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sa-map-mark';
      b.setAttribute('data-sa-map', id);
      b.setAttribute('aria-label', 'Open the map for this row');
      b.innerHTML = MAP_ICON + 'MAP';
      yr.appendChild(b);
    }
  }
  document.addEventListener('click', function (e) {
    var m = e.target && e.target.closest && e.target.closest('.sa-map-mark');
    if (!m) return;
    e.preventDefault();
    e.stopPropagation();
    post({ type: 'SA_MAP', entryId: m.getAttribute('data-sa-map') });
  }, true);
  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || d.source !== 'sa-shell') return;
    if (d.type === 'SA_MAP_ROWS') markMapRows(d.entryIds);
    else if (d.type === 'SA_PANEL') {
      PANEL_W = Math.max(0, Number(d.width) || 0);
      // Room on the right while the panel is open, so the last lane columns
      // can scroll clear of it. The document itself is the horizontal
      // scroller, and a margin does not count toward its scroll width, so an
      // invisible absolutely positioned marker past the table's edge does.
      var tbl = document.querySelector('table.tbl');
      var sp = document.getElementById('sa-panel-spacer');
      if (sp) sp.parentNode.removeChild(sp);
      if (tbl && PANEL_W) {
        var r = tbl.getBoundingClientRect();
        sp = document.createElement('div');
        sp.id = 'sa-panel-spacer';
        sp.setAttribute('aria-hidden', 'true');
        sp.style.cssText = 'position:absolute;top:0;width:1px;height:1px;pointer-events:none;visibility:hidden;left:' +
          Math.round(r.right + window.scrollX + PANEL_W) + 'px';
        document.body.appendChild(sp);
      }
    }
    else if (d.type === 'SA_MAP_ACTIVE') {
      var ms = document.querySelectorAll('.sa-map-mark');
      for (var k = 0; k < ms.length; k++) {
        if (ms[k].getAttribute('data-sa-map') === d.entryId) ms[k].setAttribute('aria-pressed', 'true');
        else ms[k].removeAttribute('aria-pressed');
      }
    }
  });

  post({
    type: 'SA_READY',
    rows: document.querySelectorAll('[data-entry-id]').length,
    tokens: bound,
  });
})();
</script>
`;

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------
const files = fs
  .readdirSync(REPO)
  .filter((f) => /^Window\d_.*_GENERATED\.html$/.test(f))
  .sort();

if (files.length !== 7) die(`Expected 7 generated windows in ${REPO}, found ${files.length}`);

fs.mkdirSync(OUT, { recursive: true });

// Capture through to the .et boundary rather than the first </span>: rows with
// a milestone glyph carry a nested <span class="mile">…</span> inside .en, and
// stopping at the first close tag truncates their title to empty.
// The generator emits <div class="et"> unconditionally, so it is a safe fence.
const EV_RE = /<div class="ev"([^>]*)>([\s\S]*?)<span class="en">([\s\S]*?)<div class="et"/g;
const meta = [];
let totalRows = 0;
let totalMatched = 0;

for (const file of files) {
  const windowId = Number(file.match(/^Window(\d)_/)[1]);
  let html = fs.readFileSync(path.join(REPO, file), 'utf8');

  let rows = 0;
  let matched = 0;
  const misses = [];

  html = html.replace(EV_RE, (full, attrs, between, enInner) => {
    rows++;
    // Lane display label sits in the .lane-tag span emitted just before .en.
    const laneM = between.match(/<span class="lane-tag">([^<]*)<\/span>/);
    // Title is the first text node of .en, after an optional milestone glyph.
    const title = unesc(enInner.replace(/^<span class="mile">[\s\S]*?<\/span>/, '').split('<')[0]);
    const laneKey = laneM ? labelToKey.get(laneM[1]) : undefined;

    if (!laneKey) {
      misses.push(`lane label "${laneM ? laneM[1] : '?'}" not in LANES`);
      return full;
    }
    const entry = index.get(`${windowId}\0${laneKey}\0${title}`);
    if (!entry) {
      misses.push(`${laneKey} :: ${title.slice(0, 60)}`);
      return full;
    }
    matched++;
    return full.replace(
      `<div class="ev"${attrs}>`,
      `<div class="ev" data-entry-id="${entry.id}"${attrs}>`
    );
  });

  if (misses.length) {
    console.error(`\n  ${file}: ${misses.length} unmatched row(s):`);
    misses.slice(0, 5).forEach((m) => console.error(`    - ${m}`));
    die('Every .ev row must resolve to an entry. Refusing to emit a partially addressable window.');
  }

  const laneMap = {};
  for (const l of lanes) {
    laneMap[l.label.toUpperCase()] = `lane:${l.key}`;
    laneMap[l.thead.toUpperCase()] = `lane:${l.key}`;
  }
  html = html.replace(
    '</body>',
    BRIDGE.replace('__WINDOW_ID__', String(windowId)).replace(
      '__LANE_MAP_JSON__',
      JSON.stringify(laneMap)
    ) + '</body>'
  );

  fs.writeFileSync(path.join(OUT, `window-${windowId}.html`), html, 'utf8');
  totalRows += rows;
  totalMatched += matched;
  meta.push({ windowId, sourceFile: file, rows });
  console.log(`  W${windowId}  ${String(rows).padStart(3)} rows addressable  <-  ${file}`);
}

// Window metadata for the selector / indicator, read from the corpus itself.
const windowsRaw = JSON.parse(fs.readFileSync(path.join(REPO, 'windows.json'), 'utf8'));
const windowsList = Array.isArray(windowsRaw) ? windowsRaw : windowsRaw.windows;

/* Where a window opens before the previous one ends (W3 from 1652 inside W2's 1602 to 1704;
 * W6 from 1921 inside W5's 1854 to 1929), say so in the header: the windows are storylines,
 * not slices of time, and each row sits in exactly one. The first phase is named when it lies
 * wholly inside the overlap, since it is the reason the window reaches back. Computed from
 * windows.json, so it follows the ranges if they change. (Author request, Thread 35.) */
const byId = new Map(windowsList.map((w) => [Number(String(w.id).replace(/\D/g, '')), w]));
const overlapNote = (id) => {
  const w = byId.get(id), prev = byId.get(id - 1);
  if (!w || !prev || !(w.year_sort_start < prev.year_sort_end)) return null;
  const from = w.year_sort_start, to = prev.year_sort_end;
  const p = (w.phase_dividers ?? [])[0];
  const m = /^(\d{3,4})\s*-\s*(\d{3,4})$/.exec(p?.year_range ?? '');
  const inside = m && Number(m[1]) === from && Number(m[2]) <= to;
  return `overlaps W${id - 1}, ${from} to ${to}${inside ? `: ${p.label}` : ''}`;
};

const metaOut = windowsList.map((w) => {
  const id = Number(String(w.id).replace(/\D/g, ''));
  const found = meta.find((m) => m.windowId === id);
  return {
    id,
    name: w.name,
    yearRange: w.year_range,
    overlap: overlapNote(id),
    entries: w.entries_count,
    dossiers: w.dossiers_count,
    rows: found ? found.rows : 0,
  };
});

fs.writeFileSync(
  META_OUT,
  JSON.stringify({ lanes, windows: metaOut }, null, 2) + '\n',
  'utf8'
);

console.log(
  `\n  ${totalMatched}/${totalRows} rows addressable across 7 windows.` +
    `\n  Audit repo untouched (read-only).\n`
);
