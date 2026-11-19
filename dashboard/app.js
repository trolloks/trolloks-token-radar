(function () {
  'use strict';
  var D = window.RADAR;
  var $ = function (id) { return document.getElementById(id); };
  // All dynamic text goes through textContent; no snapshot string is ever parsed as HTML.
  function el(tag, text, cls, attrs) {
    var e = document.createElement(tag);
    if (text != null) e.textContent = text;
    if (cls) e.className = cls;
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function usd(n) {
    if (n == null) return '–';
    var a = Math.abs(n);
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + Math.round(n);
  }
  function pct(n) { return n == null ? '–' : (n > 0 ? '+' : '') + n.toFixed(1) + '%'; }
  var st = { view: 'board', q: '', cat: '', scope: 'all', row: '' };
  var bySlug = Object.create(null); // null prototype: hash values like "constructor" or "__proto__" are never found

  if (!D || !D.rows) { $('main').textContent = 'Data failed to load (data.js).'; return; }
  D.rows.forEach(function (r) { bySlug[r.slug] = r; });

  $('meta').textContent = 'Snapshot ' + D.as_of + ' · ' + D.source + ' · model ' + D.model_version;
  var L = D.model.loo;
  var stats = [
    [D.board_size, 'ranked rows'], [D.watchlist_size, 'watchlist (all covered)'], [D.early_size, 'early candidates below ' + usd(D.floor_usd)],
    [D.model.live_peers, 'live-token peers used'], [D.model.global_median_ratio.toFixed(2) + '×', 'median mcap / TVL, all peers']
  ];
  stats.forEach(function (s) { var d = el('div', null, 'stat'); d.appendChild(el('b', String(s[0]))); d.appendChild(el('span', s[1])); $('stats').appendChild(d); });

  // Model check: the leave-one-out diagnostic, written for someone choosing where to look first.
  (function () {
    var box = $('check');
    box.appendChild(el('h2', 'Model check: how wrong has this method been on tokens we can see?', null, { id: 'chkh' }));
    if (!L.n) { box.appendChild(el('p', 'Not available: this snapshot has fewer than two live-token protocols with a market cap, so the method cannot be tested against known values.')); return; }
    var big = el('div', null, 'big');
    function card(v, t) { var d = el('div'); d.appendChild(el('b', v)); d.appendChild(el('span', t)); big.appendChild(d); }
    var f = L.median_factor;
    card(f.toFixed(1) + '× (a factor, not a percent)', 'Median error factor over ' + L.n + ' live-token protocols (unit: times too high or too low)');
    card((L.coverage * 100).toFixed(0) + '% (' + L.covered + ' of ' + L.n + ')', 'Held-out market caps that fell inside the low–high range shown for them');
    card((L.within_2x * 100).toFixed(0) + '%', 'Held-out protocols whose estimate was within 2× of the real market cap');
    box.appendChild(big);
    var ul = el('ul');
    [
      'How it was run: each live-token protocol was re-valued by this same model with itself removed from its category peers and from the all-market median, then compared with its actual market cap. The unit of every figure is USD market cap; errors are ratios.',
      'Error factor ' + f.toFixed(1) + '×: error = the larger of estimate ÷ actual and actual ÷ estimate, so 1× is exact and 2× means off by double or by half. At the median, half of the protocols were off by more than ' + f.toFixed(1) + '×, in either direction. For a typical estimate of $100M about half of the back-tested protocols had an actual value between ' + usd(100e6 / f) + ' and ' + usd(100e6 * f) + ' (the other half were further out), so the range is very wide.',
      'Coverage ' + (L.coverage * 100).toFixed(0) + '%: the shown ranges held the real value only about this often, so treat them as rough bands, not 90% intervals.',
      'Why this is not a forecast: it measures how the method fit protocols that already have tokens, using the same snapshot the model was built on. Pre-token protocols differ (many never launch a token), the market changes, and the model was not tuned on separate data. Past coverage does not mean a future estimate has that chance of being right.',
      'How to use it: rank order is for triage, not pricing. Prefer rows whose confidence is not “very low”, with several live peers, and whose category back-test (shown in the detail dialog) is better than the overall one. Then verify issuer, audits, token plans and TVL quality in the detail dialog before spending time.'
    ].forEach(function (t) { ul.appendChild(el('li', t)); });
    box.appendChild(ul);
  })();

  var cats = Object.create(null);
  D.rows.forEach(function (r) { var c = r.category || 'Uncategorised'; cats[c] = (cats[c] || 0) + 1; });
  var cs = $('cat');
  cs.appendChild(el('option', 'All categories (' + D.rows.length + ')', null, { value: '' }));
  Object.keys(cats).sort().forEach(function (c) { cs.appendChild(el('option', c + ' (' + cats[c] + ')', null, { value: c })); });

  var mb = $('methodBody');
  [
    'Peer group: live-token protocols (any market cap, CoinGecko id or symbol) in the same category. Their market cap ÷ TVL gives a ratio; we use the median, shrunk toward the all-market median when peers are few (weight n/(n+' + D.model.shrink + ')).',
    'Estimate = TVL × ratio × growth × maturity. Growth = 1 + 0.3 × clamp(7d change, −60%, +120%). Maturity = 0.6 + 0.4 × min(age, 1095 days)/1095; unknown age counts as 365 days.',
    'Range: the peers\' 25th–75th percentile ratio, then widened by 1.6× each way, and more when peers are under ' + D.model.min_peers + ', or age is unknown or under 180 days. Treat the range, not the point, as the answer.',
    'Excluded from early candidates: anything with a recorded token (live), exchanges, versioned pools (e.g. "V3", "2.0") and wrapper/receipt products such as exchange-issued staked assets. The whole watchlist is always ranked.',
    'Back-test: see the “Model check” panel above the table.',
    'Live-token rows are shown only as the market\'s own values and are never ranked with pre-token protocols.'
  ].forEach(function (t) { mb.appendChild(el('p', t)); });

  function readHash() {
    var o = { view: 'board', q: '', cat: '', scope: 'all', row: '' };
    var h = location.hash.replace(/^#/, '');
    h.split('&').forEach(function (kv) {
      var i = kv.indexOf('='); if (i < 1) return;
      var k = kv.slice(0, i), v;
      try { v = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); } catch (e) { return; }
      if (k === 'view' && (v === 'board' || v === 'live')) o.view = v;
      else if (k === 'q') o.q = v.slice(0, 80);
      else if (k === 'cat' && (v === '' || cats[v])) o.cat = v;
      else if (k === 'scope' && /^(all|watch|early)$/.test(v)) o.scope = v;
      else if (k === 'row' && bySlug[v]) o.row = v;
    });
    st = o;
  }
  function writeHash() {
    var p = [];
    if (st.view !== 'board') p.push('view=' + st.view);
    if (st.q) p.push('q=' + encodeURIComponent(st.q));
    if (st.cat) p.push('cat=' + encodeURIComponent(st.cat));
    if (st.scope !== 'all') p.push('scope=' + st.scope);
    if (st.row) p.push('row=' + encodeURIComponent(st.row));
    var h = p.length ? '#' + p.join('&') : location.pathname + location.search;
    history.replaceState(null, '', h);
  }
  function match(r) {
    if (st.cat && (r.category || 'Uncategorised') !== st.cat) return false;
    if (!st.q) return true;
    var hay = (r.name + ' ' + r.slug + ' ' + (r.category || '') + ' ' + (r.chains || []).join(' ')).toLowerCase();
    return st.q.toLowerCase().split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
  }
  function head(cols) {
    var t = $('tbl'); t.textContent = '';
    var cap = el('caption', st.view === 'board' ? 'Pre-token protocols ranked by estimated value' : 'Live-token protocols: market values', 'muted');
    cap.style.cssText = 'position:absolute;left:-999px';
    t.appendChild(cap);
    var tr = el('tr');
    cols.forEach(function (c) { tr.appendChild(el('th', c[0], c[1] ? 'n' : '', { scope: 'col' })); });
    var th = el('thead'); th.appendChild(tr); t.appendChild(th);
    var tb = el('tbody'); t.appendChild(tb); return tb;
  }
  function chg(v) { var td = el('td', pct(v), 'n ' + (v == null ? '' : v >= 0 ? 'up' : 'dn')); return td; }
  function render() {
    $('scopeL').style.display = st.view === 'board' ? '' : 'none';
    Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === st.view)); });
    $('q').value = st.q; $('cat').value = st.cat; $('scope').value = st.scope;
    var n, tb;
    if (st.view === 'board') {
      var rows = D.rows.filter(function (r) { return match(r) && (st.scope === 'all' || (st.scope === 'watch') === r.watch); });
      n = rows.length;
      tb = head([['#', 1], ['Protocol'], ['Category'], ['TVL', 1], ['7d', 1], ['Implied value', 1], ['Range (low – high)'], ['Implied ÷ TVL', 1], ['Peers', 1], ['Confidence']]);
      rows.forEach(function (r) {
        var tr = el('tr');
        tr.appendChild(el('td', String(r.rank), 'n'));
        var td = el('td'); var b = el('button', r.name, 'link', { type: 'button', 'aria-haspopup': 'dialog', 'data-slug': r.slug });
        b.addEventListener('click', function () { st.row = r.slug; writeHash(); openRow(); });
        td.appendChild(b); if (r.watch) { td.appendChild(document.createTextNode(' ')); td.appendChild(el('span', 'watch', 'tag w')); }
        tr.appendChild(td);
        tr.appendChild(el('td', r.category || '–'));
        tr.appendChild(el('td', usd(r.tvl), 'n'));
        tr.appendChild(chg(r.ch7));
        tr.appendChild(el('td', usd(r.implied), 'n'));
        var rg = el('td'); rg.appendChild(rangeBar(r)); rg.appendChild(document.createTextNode(' ' + usd(r.low) + ' – ' + usd(r.high)));
        tr.appendChild(rg);
        tr.appendChild(el('td', (r.implied / r.tvl).toFixed(2) + '×', 'n'));
        tr.appendChild(el('td', r.peers + ' live / ' + r.pre_peers + ' pre', 'n'));
        tr.appendChild(el('td', r.conf));
        tb.appendChild(tr);
      });
    } else {
      var lv = D.live.filter(function (r) { return match({ name: r.name, slug: r.slug, category: r.category, chains: [] }); });
      n = lv.length;
      tb = head([['Protocol'], ['Category'], ['Market cap', 1], ['TVL', 1], ['Mcap ÷ TVL', 1], ['7d TVL', 1]]);
      lv.forEach(function (r) {
        var tr = el('tr');
        tr.appendChild(el('td', r.name)); tr.appendChild(el('td', r.category || '–'));
        tr.appendChild(el('td', usd(r.mcap), 'n')); tr.appendChild(el('td', usd(r.tvl), 'n'));
        tr.appendChild(el('td', r.ratio.toFixed(2) + '×', 'n')); tr.appendChild(chg(r.ch7));
        tb.appendChild(tr);
      });
    }
    $('count').textContent = 'Showing ' + n + ' of ' + (st.view === 'board' ? D.rows.length : D.live.length) + (n === 0 ? ' — no matches, try Reset.' : '');
  }
  function rangeBar(r) {
    // Log scale between low and high so the point sits visibly inside the band.
    var lo = Math.log(r.low), hi = Math.log(r.high), x = hi > lo ? (Math.log(r.implied) - lo) / (hi - lo) : 0.5;
    var w = el('span', null, 'range', { role: 'img', 'aria-label': 'Estimate ' + usd(r.implied) + ' within ' + usd(r.low) + ' to ' + usd(r.high) });
    var bar = el('i'); bar.style.left = '0'; bar.style.right = '0'; w.appendChild(bar);
    var m = el('u'); m.style.left = Math.max(0, Math.min(97, x * 100)).toFixed(1) + '%'; w.appendChild(m);
    return w;
  }
  var lastFocus = null, lastSlug = '';
  // Re-find the opener after the table was re-rendered; fall back to the search box so focus is never lost.
  function restoreFocus() {
    var t = null;
    if (lastSlug) Array.prototype.forEach.call($('tbl').querySelectorAll('button.link'), function (x) { if (x.getAttribute('data-slug') === lastSlug) t = x; });
    if (!t && lastFocus && lastFocus.isConnected) t = lastFocus;
    (t || $('q')).focus();
  }
  function kv(parent, k, v) { var d = el('div'); d.appendChild(el('b', v)); d.appendChild(el('span', k)); parent.appendChild(d); }
  function list(parent, title, items, ordered) {
    parent.appendChild(el('h3', title)); var l = el(ordered ? 'ol' : 'ul');
    items.forEach(function (t) { l.appendChild(el('li', t)); }); parent.appendChild(l);
  }
  function openRow() {
    var r = bySlug[st.row], dlg = $('dlg'); if (!r) return;
    var b = $('dbody'); b.textContent = '';
    var c = el('button', 'Close', 'close', { type: 'button' }); c.addEventListener('click', function () { dlg.close(); });
    b.appendChild(c);
    b.appendChild(el('h2', '#' + r.rank + ' ' + r.name, null, { id: 'dtitle' }));
    b.appendChild(el('p', (r.category || 'Uncategorised') + ' · ' + (r.chains.join(', ') || 'chain unknown') + ' · ' + (r.watch ? 'watchlist' : 'early candidate') + ' · listed ' + (r.listed || 'unknown') + (r.age != null ? ' (' + r.age + ' days)' : ''), 'muted'));
    var g = el('div', null, 'kv');
    kv(g, 'Implied value', usd(r.implied)); kv(g, 'Wide range', usd(r.low) + ' – ' + usd(r.high)); kv(g, 'Current TVL', usd(r.tvl)); kv(g, '7d TVL change', pct(r.ch7));
    kv(g, 'Implied market cap ÷ TVL', (r.implied / r.tvl).toFixed(2) + '×'); kv(g, 'Peer ratio used', r.ratio.toFixed(2) + '×');
    kv(g, 'Category median (live)', r.cat_ratio == null ? 'no peers' : r.cat_ratio.toFixed(2) + '×'); kv(g, 'All-market median', D.model.global_median_ratio.toFixed(2) + '×');
    kv(g, 'Peer group', r.peers + ' live-token, ' + r.pre_peers + ' pre-token on board'); kv(g, 'Confidence', r.conf);
    b.appendChild(g);
    var lc = r.loo_cat;
    if (L.n) b.appendChild(el('p', 'Back-test for this category (leave-one-out, live-token ' + (r.category || 'uncategorised') + ' protocols): ' + (lc ? 'median error ' + lc.median_factor.toFixed(1) + '×, ' + (lc.coverage * 100).toFixed(0) + '% of ranges held the real market cap, n = ' + lc.n + '. ' + (lc.median_factor > L.median_factor ? 'Worse than the overall ' + L.median_factor.toFixed(1) + '×: be more sceptical of this estimate.' : 'Not worse than the overall ' + L.median_factor.toFixed(1) + '×.') : 'fewer than ' + D.model.min_peers + ' held-out peers, no category-level result; only the overall ' + L.median_factor.toFixed(1) + '× applies.') + ' A typical-error band is ' + usd(r.implied / L.median_factor) + ' – ' + usd(r.implied * L.median_factor) + ' (estimate ÷ and × the overall median error). This describes past fit on live tokens, not the chance this protocol launches a token or reaches that value.', 'muted'));
    b.appendChild(el('p', 'Arithmetic: ' + usd(r.tvl) + ' × ' + r.ratio.toFixed(3) + ' × growth ' + r.gm.toFixed(3) + ' × maturity ' + r.mm.toFixed(3) + ' = ' + usd(r.implied) + '. The range is intentionally wide; the true figure could sit outside it.', 'muted'));
    list(b, 'Due diligence for this protocol', r.dd);
    list(b, 'Low-cost farm plan', r.steps, true);
    if (!dlg.open) { lastFocus = document.activeElement; lastSlug = r.slug; }
    if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }
    c.focus();
  }
  $('dlg').addEventListener('close', function () { st.row = ''; writeHash(); restoreFocus(); });
  $('dlg').addEventListener('click', function (e) { if (e.target === this) this.close(); });
  $('q').addEventListener('input', function () { st.q = this.value.trim().slice(0, 80); writeHash(); render(); });
  $('cat').addEventListener('change', function () { st.cat = this.value; writeHash(); render(); });
  $('scope').addEventListener('change', function () { st.scope = this.value; writeHash(); render(); });
  $('reset').addEventListener('click', function () { st = { view: st.view, q: '', cat: '', scope: 'all', row: '' }; writeHash(); render(); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (b) {
    b.addEventListener('click', function () { st.view = b.getAttribute('data-view'); writeHash(); render(); });
  });
  function sync() { readHash(); render(); if (st.row) openRow(); else if ($('dlg').open) $('dlg').close(); }
  window.addEventListener('hashchange', sync);
  sync();
})();
