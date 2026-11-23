/* Launch Radar dashboard - no framework, no network, reads window.RADAR from ../data.js. */
(function () {
  'use strict';
  var R = window.RADAR;
  if (!R) return;

  var $ = function (s, root) { return (root || document).querySelector(s); };
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function money(n) {
    if (!isFinite(n)) return '—';
    if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + Math.round(n);
  }
  function pct(n) { return n === null || n === undefined ? '—' : (n > 0 ? '+' : '') + n.toFixed(1) + '%'; }
  function multi(n) { return (n >= 10 ? n.toFixed(1) : n >= 1 ? n.toFixed(2) : n.toFixed(3)) + '×'; }
  function year(n) { return n === null ? 'unknown' : n >= 365 ? (n / 365).toFixed(1) + ' yrs' : n + ' days'; }
  function chip(text, cls) { return el('span', 'chip' + (cls ? ' ' + cls : ''), text); }

  var FMT = new Intl.NumberFormat('en-US');
  var SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    return n;
  }
  function svgText(x, y, text, cls) {
    var t = svgEl('text', { x: x, y: y, 'font-size': '10', fill: '#66738c', 'font-family': 'ui-monospace,monospace' });
    if (cls) t.setAttribute('class', cls);
    t.textContent = text;
    return t;
  }
  var view = { q: '', cat: 'all', conf: 'all', scope: 'candidates', sort: 'rank', dir: 1 };
  var pins = new Set();
  try { pins = new Set(JSON.parse(localStorage.getItem('radar.pins') || '[]')); } catch (e) { pins = new Set(); }
  function savePins() {
    try { localStorage.setItem('radar.pins', JSON.stringify(Array.from(pins))); } catch (e) {}
    var nav = $('#pinNav');
    if (nav) nav.textContent = pins.size;
    var btn = $('#compareBtn');
    if (btn) btn.hidden = pins.size < 2;
  }

  function route() {
    var raw = (location.hash || '#/board').replace(/^#/, '');
    var qs = raw.split('?');
    var parts = qs[0].split('/').filter(Boolean);
    var params = new URLSearchParams(qs[1] || '');
    if (parts[0] === 'p' && parts[1]) return { name: 'detail', slug: decodeURIComponent(parts[1]) };
    if (parts[0] === 'live') return { name: 'live' };
    if (parts[0] === 'method') return { name: 'method' };
    if (parts[0] === 'compare') return { name: 'compare', params: params };
    return { name: 'board', params: params };
  }

  function show(name) {
    $('#kpis').hidden = name === 'detail';
    $('#statusLine').hidden = name === 'detail';
    $('#contract').hidden = name === 'detail';
    $('#boardView').hidden = name !== 'board';
    $('#liveView').hidden = name !== 'live';
    $('#methodView').hidden = name !== 'method';
    $('#compareView').hidden = name !== 'compare';
    $('#detailView').hidden = name !== 'detail';
    document.querySelectorAll('.tabs a').forEach(function (a) {
      var active = a.getAttribute('data-tab') === name;
      if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  // ---------- value map ----------
  function valueMap(rows) {
    var W = 200, H = 52, pad = 3;
    var cs = rows.filter(function (r) { return r.candidate; }).slice(0, 90);
    var xs = cs.map(function (r) { return Math.log10(r.tvl); });
    var ys = cs.map(function (r) { return Math.log10(r.implied); });
    var lo = Math.min.apply(null, xs.concat(ys)) - 0.2;
    var hi = Math.max.apply(null, xs.concat(ys)) + 0.2;
    var sx = function (v) { return pad + ((v - lo) / (hi - lo)) * (W - 2 * pad); };
    var sy = function (v) { return H - pad - ((v - lo) / (hi - lo)) * (H - 2 * pad); };
    var root = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Implied value against TVL for launch candidates' });
    var m = Math.log10(R.model.globalMedian);
    root.appendChild(svgEl('line', { x1: sx(lo), y1: sy(lo + m), x2: sx(hi), y2: sy(hi + m), stroke: '#3a4a68', 'stroke-dasharray': '3 3', 'stroke-width': '1' }));
    cs.forEach(function (r, i) {
      root.appendChild(svgEl('circle', { cx: sx(xs[i]), cy: sy(ys[i]), r: r.watch ? 2.2 : 1.5, fill: r.watch ? '#f5b33c' : '#8a6a2a', opacity: r.watch ? 0.95 : 0.6 }));
    });
    return root;
  }

  // ---------- header ----------
  function renderChrome() {
    $('#asOf').textContent = R.asOf;
    $('#peerCount').textContent = FMT.format(R.counts.live);
    var c = R.counts;
    var top = R.rows.filter(function (r) { return r.candidate; })[0] || R.rows[0];
    var kpis = [
      ['Pre-token records', FMT.format(c.preToken), 'all ranked on the board', false],
      ['Launch candidates', FMT.format(c.candidates), 'past the wrapped / bridge / CEX rules', true],
      ['Watchlist covered', c.watchlistCovered + '/' + c.watchlist, 'every $' + (R.floor / 1e6) + 'M+ pre-token record', false],
      ['Live token peers', FMT.format(c.live), 'price the category multiples', false],
      ['Aggregate launch value', money(c.aggregateCandidates), c.candidates + ' candidates · top ' + (top ? top.name + ' ' + money(top.implied) : ''), true]
    ];
    var box = $('#kpis');
    box.replaceChildren();
    kpis.forEach(function (k) {
      var card = el('div', 'kpi' + (k[3] ? ' hot' : ''));
      card.appendChild(el('span', null, k[0]));
      card.appendChild(el('b', null, k[1]));
      card.appendChild(el('em', null, k[2]));
      box.appendChild(card);
    });
    var chartCard = el('div', 'kpi chartCard');
    chartCard.appendChild(el('span', null, 'Value map'));
    chartCard.appendChild(valueMap(R.rows));
    box.appendChild(chartCard);
    var line = $('#statusLine');
    line.replaceChildren();
    var flow = [
      [FMT.format(c.protocols), 'protocols'],
      [FMT.format(c.preToken) + '/' + FMT.format(c.preToken), 'with no token, all ranked'],
      [FMT.format(c.candidates), 'launch candidates'],
      [FMT.format(c.live), 'live peers, separated'],
      [FMT.format(c.unpriced), 'unpriced token records']
    ];
    flow.forEach(function (f, i) {
      if (i) line.appendChild(el('span', 'flowArrow', '→'));
      var item = el('span', 'flowItem' + (i === 2 ? ' hot' : i === 3 ? ' ok' : ''));
      item.appendChild(el('b', null, f[0]));
      item.appendChild(document.createTextNode(' ' + f[1]));
      line.appendChild(item);
    });
    line.appendChild(el('span', 'flowNote', '342 + 128 + 288 = 758 · watchlist ' + c.watchlistCovered + '/' + c.watchlist + ' · 144 of the 342 are bridge, CEX or wrapped/versioned products, shown under All records'));
    $('#contract').textContent = 'Coverage ' + c.watchlistCovered + '/' + c.watchlist + ' watchlist, ' + c.preToken + '/' + c.preToken + ' pre-token ranked · Model ' + c.live + ' live peers, 80% band, 5-fold + walk-forward held out · Plans 8 costed steps per row, gas per active hour · Page sort, filter, detail, sandbox, compare, CSV';
  }

  // ---------- CSV ----------
  function csvCell(v) {
    var t = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  }
  function exportCsv(rows) {
    var head = ['rank', 'candidate_rank', 'name', 'slug', 'category', 'chains', 'tvl_usd', 'change_7d', 'age_days', 'implied_value_usd', 'low_usd', 'high_usd', 'multiple', 'peers', 'confidence', 'watchlist', 'candidate', 'verdict'];
    var lines = [head.join(',')].concat(rows.map(function (r) {
      return [r.rank, r.candidateRank, r.name, r.slug, r.category, r.chains.join('|'), r.tvl, r.ch7, r.age, r.implied, r.low, r.high, r.multiple, r.peers, r.confidence, r.watch, r.candidate, r.plan.verdict].map(csvCell).join(',');
    }));
    var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'launch-radar.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  // ---------- shortlist compare ----------
  function renderCompare(params) {
    var host = $('#compareBody');
    host.replaceChildren();
    var fromUrl = params ? (params.get('slugs') || '').split(',').filter(Boolean) : [];
    var chosen = fromUrl.length
      ? fromUrl.map(function (slug) { return R.rows.filter(function (r) { return r.slug === slug; })[0]; }).filter(Boolean).slice(0, 4)
      : R.rows.filter(function (r) { return pins.has(r.slug); }).slice(0, 4);
    $('#pinNav').textContent = pins.size;
    if (chosen.length < 2) {
      var p = el('p', 'empty', chosen.length === 0 ? 'Star two or more rows on the board to compare them here.' : 'One more star and the compare table appears.');
      host.appendChild(p);
      return;
    }
    var table = el('table', 'compareTable');
    var thead = el('thead');
    var hr = el('tr');
    hr.appendChild(el('th', null, 'Metric'));
    chosen.forEach(function (r) { hr.appendChild(el('th', 'num', r.name)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var body = el('tbody');
    [
      ['Implied value', function (r) { return money(r.implied); }],
      ['80% band', function (r) { return money(r.low) + ' – ' + money(r.high); }],
      ['TVL', function (r) { return money(r.tvl); }],
      ['7-day change', function (r) { return pct(r.ch7); }],
      ['No token for', function (r) { return year(r.age); }],
      ['Peer multiple', function (r) { return multi(r.terms.peerMultiple) + ' (' + r.peers + ')'; }],
      ['Confidence', function (r) { return r.confidence; }],
      ['Farm verdict', function (r) { return r.plan.verdict; }]
    ].forEach(function (row) {
      var tr = el('tr');
      tr.appendChild(el('td', null, row[0]));
      chosen.forEach(function (r) { tr.appendChild(el('td', 'num', row[1](r))); });
      body.appendChild(tr);
    });
    table.appendChild(body);
    host.appendChild(table);
    var links = el('p', 'footnote');
    links.appendChild(document.createTextNode('Open a detail page: '));
    chosen.forEach(function (r, i) {
      if (i) links.appendChild(document.createTextNode(' · '));
      var a = el('a', 'inlineLink', r.name);
      a.href = '#/p/' + encodeURIComponent(r.slug);
      links.appendChild(a);
    });
    host.appendChild(links);
  }

  // ---------- board ----------
  function categories() {
    var out = [];
    R.rows.forEach(function (r) { var k = r.category || 'Uncategorised'; if (out.indexOf(k) < 0) out.push(k); });
    return out.sort();
  }
  function filtered() {
    var q = view.q.trim().toLowerCase();
    var out = R.rows.filter(function (r) {
      if (view.scope === 'candidates' && !r.candidate) return false;
      if (view.scope === 'watch' && !r.watch) return false;
      if (view.scope === 'pinned' && !pins.has(r.slug)) return false;
      if (view.cat !== 'all' && (r.category || 'Uncategorised') !== view.cat) return false;
      if (view.conf === 'high' && r.confidence !== 'high') return false;
      if (view.conf === 'medium' && r.confidence === 'low') return false;
      if (q) {
        var hay = (r.name + ' ' + (r.category || '') + ' ' + r.chains.join(' ') + ' ' + r.slug).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    var rank = { high: 0, medium: 1, low: 2 };
    out.sort(function (a, b) {
      var d = 0;
      if (view.sort === 'name') d = a.name.localeCompare(b.name);
      else if (view.sort === 'confidence') d = rank[a.confidence] - rank[b.confidence];
      else if (view.sort === 'ch7') d = (a.ch7 === null ? -999 : a.ch7) - (b.ch7 === null ? -999 : b.ch7);
      else if (view.sort === 'age') d = (a.age === null ? -1 : a.age) - (b.age === null ? -1 : b.age);
      else if (view.sort === 'multiple') d = a.multiple - b.multiple;
      else if (view.sort === 'implied') d = a.implied - b.implied;
      else if (view.sort === 'tvl') d = a.tvl - b.tvl;
      else d = a.rank - b.rank;
      return d * view.dir;
    });
    return out;
  }
  function bandCell(r) {
    var td = el('td', 'bandcol');
    var band = el('div', 'band');
    var track = el('div', 'track');
    var lo = Math.log10(Math.max(1, r.low));
    var hi = Math.log10(Math.max(10, r.high));
    var mid = Math.log10(r.implied);
    var min = lo - 0.45, max = hi + 0.45;
    var span = Math.max(0.001, max - min);
    var fill = el('i', 'fill');
    fill.style.left = ((lo - min) / span) * 100 + '%';
    fill.style.width = Math.max(2, ((hi - lo) / span) * 100) + '%';
    var mark = el('i', 'mark');
    mark.style.left = Math.min(99, Math.max(1, ((mid - min) / span) * 100)) + '%';
    track.appendChild(fill);
    track.appendChild(mark);
    band.appendChild(track);
    var lbl = el('div', 'lbl');
    lbl.appendChild(el('span', null, money(r.low)));
    lbl.appendChild(el('span', null, money(r.high)));
    band.appendChild(lbl);
    td.appendChild(band);
    return td;
  }
  function boardRow(r) {
    var tr = el('tr');
    tr.tabIndex = 0;
    tr.addEventListener('click', function () { location.hash = '#/p/' + encodeURIComponent(r.slug); });
    tr.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); location.hash = '#/p/' + encodeURIComponent(r.slug); } });

    var starTd = el('td', 'starcol');
    var star = el('button', 'star' + (pins.has(r.slug) ? ' on' : ''), pins.has(r.slug) ? '★' : '☆');
    star.type = 'button';
    star.setAttribute('aria-label', 'Shortlist ' + r.name);
    star.setAttribute('aria-pressed', pins.has(r.slug) ? 'true' : 'false');
    star.addEventListener('click', function (e) {
      e.stopPropagation();
      if (pins.has(r.slug)) pins.delete(r.slug); else pins.add(r.slug);
      savePins();
      star.textContent = pins.has(r.slug) ? '★' : '☆';
      star.className = 'star' + (pins.has(r.slug) ? ' on' : '');
      star.setAttribute('aria-pressed', pins.has(r.slug) ? 'true' : 'false');
    });
    starTd.appendChild(star);
    tr.appendChild(starTd);

    var rank = el('td', 'rank');
    rank.appendChild(el('b', null, r.candidate ? '#' + r.candidateRank : '—'));
    rank.appendChild(el('div', 'subline', r.candidate ? '#' + r.rank + ' overall' : '#' + r.rank + ' overall'));
    tr.appendChild(rank);

    var name = el('td');
    var nm = el('div', 'name', r.name);
    if (r.watch) nm.appendChild(chip('WATCH', 'watch'));
    if (!r.candidate) nm.appendChild(chip('EXCLUDED'));
    name.appendChild(nm);
    name.appendChild(el('div', 'subline', (r.category || 'Uncategorised') + ' · ' + (r.chains.slice(0, 3).join(', ') || 'chain n/a') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '')));
    tr.appendChild(name);

    tr.appendChild(el('td', 'num money', money(r.tvl)));
    var ch = el('td', 'num ' + (r.ch7 > 0 ? 'up' : r.ch7 < 0 ? 'dn' : 'flat'), pct(r.ch7));
    tr.appendChild(ch);
    tr.appendChild(el('td', 'num age', year(r.age)));
    tr.appendChild(el('td', 'num implied', money(r.implied)));
    tr.appendChild(bandCell(r));
    tr.appendChild(el('td', 'num multiple', multi(r.multiple)));
    var conf = el('td');
    var wrap = el('div', 'conf');
    wrap.appendChild(el('i', 'dot ' + r.confidence));
    wrap.appendChild(el('span', null, r.confidence[0].toUpperCase() + r.confidence.slice(1) + ' · ' + r.peers + ' peer' + (r.peers === 1 ? '' : 's')));
    conf.appendChild(wrap);
    tr.appendChild(conf);
    return tr;
  }
  function renderBoard() {
    var rows = filtered();
    var body = $('#tbody');
    body.replaceChildren();
    rows.forEach(function (r) { body.appendChild(boardRow(r)); });
    $('#empty').hidden = rows.length > 0;
    var label = view.scope === 'candidates' ? 'launch candidates' : view.scope === 'watch' ? 'watchlist records' : view.scope === 'pinned' ? 'shortlisted records' : 'pre-token records';
    var scopeTotal = view.scope === 'candidates' ? R.counts.candidates : view.scope === 'watch' ? R.counts.watchlist : view.scope === 'pinned' ? R.rows.filter(function (r) { return pins.has(r.slug); }).length : R.rows.length;
    var count = $('#count');
    count.replaceChildren();
    count.appendChild(el('b', null, rows.length));
    count.appendChild(document.createTextNode(' of ' + scopeTotal + ' ' + label + (view.cat !== 'all' ? ' in ' + view.cat : '') + ' · sorted by ' + (view.sort === 'multiple' ? 'multiple' : view.sort)));
  }
  function buildControls() {
    var sel = $('#cat');
    sel.appendChild(new Option('All categories (' + R.rows.length + ')', 'all'));
    categories().forEach(function (c) {
      var n = R.rows.filter(function (r) { return (r.category || 'Uncategorised') === c; }).length;
      sel.appendChild(new Option(c + ' (' + n + ')', c));
    });
    function sync() {
      view.q = $('#q').value;
      view.cat = $('#cat').value;
      view.conf = $('#conf').value;
      view.scope = $('#scope').value;
      renderBoard();
    }
    $('#q').addEventListener('input', sync);
    $('#cat').addEventListener('change', sync);
    $('#conf').addEventListener('change', sync);
    $('#scope').addEventListener('change', sync);
    $('#csv').addEventListener('click', function () { exportCsv(filtered()); });
    $('#compareBtn').addEventListener('click', function () { location.hash = '#/compare'; });
    $('#reset').addEventListener('click', function () {
      view = { q: '', cat: 'all', conf: 'all', scope: 'candidates', sort: 'rank', dir: 1 };
      $('#q').value = ''; $('#cat').value = 'all'; $('#conf').value = 'all'; $('#scope').value = 'candidates';
      document.querySelectorAll('#table th').forEach(function (th) { th.removeAttribute('data-active'); });
      renderBoard();
    });
    var numeric = ['tvl', 'ch7', 'implied', 'multiple', 'age'];
    document.querySelectorAll('#table th[data-sort]').forEach(function (th) {
      th.addEventListener('click', function () {
        var key = th.getAttribute('data-sort');
        if (view.sort === key) view.dir = -view.dir;
        else view.dir = numeric.indexOf(key) >= 0 ? -1 : 1;
        view.sort = key;
        document.querySelectorAll('#table th').forEach(function (h) { h.removeAttribute('data-active'); });
        th.setAttribute('data-active', view.dir > 0 ? 'asc' : 'desc');
        renderBoard();
      });
    });
  }

  // ---------- live peers ----------
  function renderLive() {
    $('#liveN').textContent = R.live.length;
    var body = $('#liveBody');
    body.replaceChildren();
    var med = R.model.globalMedian;
    R.live.forEach(function (p, i) {
      var tr = el('tr');
      tr.appendChild(el('td', 'num rank', i + 1));
      var name = el('td');
      name.appendChild(el('div', 'name', p.name));
      name.appendChild(el('div', 'subline', p.chains.slice(0, 3).join(', ')));
      tr.appendChild(name);
      tr.appendChild(el('td', 'subline', p.category || 'Uncategorised'));
      tr.appendChild(el('td', 'num money', money(p.tvl)));
      tr.appendChild(el('td', 'num money', money(p.mcap)));
      tr.appendChild(el('td', 'num ' + (p.ch7 > 0 ? 'up' : p.ch7 < 0 ? 'dn' : 'flat'), pct(p.ch7)));
      tr.appendChild(el('td', 'num multiple', multi(p.multiple)));
      var rel = el('td', 'num ' + (p.multiple >= med ? 'up' : 'dn'), (p.multiple / med).toFixed(2) + '× median');
      tr.appendChild(rel);
      body.appendChild(tr);
    });
  }

  // ---------- what-if sandbox ----------
  function sandbox(r, host) {
    var box = el('div', 'sandbox');
    var head = el('div', 'sbHead');
    head.appendChild(el('h4', null, 'What-if sandbox'));
    var reset = el('button', 'ghost sbReset', 'Reset');
    reset.type = 'button';
    head.appendChild(reset);
    box.appendChild(head);
    box.appendChild(el('p', 'sbHint', 'Move the three snapshot inputs and the same formula reprices this protocol.'));

    var tvlMax = 15000000000;
    var tvlSlide = el('input'); tvlSlide.type = 'range'; tvlSlide.min = '0'; tvlSlide.max = '1000'; tvlSlide.step = '1';
    var growthSlide = el('input'); growthSlide.type = 'range'; growthSlide.min = '-60'; growthSlide.max = '120'; growthSlide.step = '1';
    var ageSlide = el('input'); ageSlide.type = 'range'; ageSlide.min = '0'; ageSlide.max = '1825'; ageSlide.step = '1';
    var tvlOut = el('b'); var growthOut = el('b'); var ageOut = el('b');
    var result = el('div', 'sbOut');
    var valueOut = el('b'); var bandOut = el('em');
    result.appendChild(el('span', null, 'Implied value'));
    result.appendChild(valueOut);
    result.appendChild(bandOut);

    function tvlToSlider(v) { return Math.round(1000 * Math.log(Math.max(5000000, v) / 5000000) / Math.log(3000)); }
    function sliderToTvl(v) { return 5000000 * Math.pow(3000, v / 1000); }
    function draw() {
      var tvl = sliderToTvl(Number(tvlSlide.value));
      var growth = Number(growthSlide.value);
      var age = Number(ageSlide.value);
      var g = Math.exp(0.3 * Math.max(-60, Math.min(120, growth)) / 100);
      var m = 0.6 + 0.4 * Math.min(age, 1095) / 1095;
      var implied = Math.max(1, Math.round(tvl * r.terms.peerMultiple * g * m));
      var lo = Math.round(implied * (r.low / r.implied));
      var hi = Math.round(implied * (r.high / r.implied));
      tvlOut.textContent = money(tvl);
      growthOut.textContent = pct(growth);
      ageOut.textContent = year(age);
      valueOut.textContent = money(implied);
      bandOut.textContent = '80% band ' + money(lo) + ' – ' + money(hi) + ' · ×' + (implied / tvl).toFixed(3) + ' TVL';
    }
    function row(label, slide, out) {
      var line = el('label', 'sbRow');
      line.appendChild(el('span', null, label));
      line.appendChild(slide);
      line.appendChild(out);
      return line;
    }
    box.appendChild(row('TVL', tvlSlide, tvlOut));
    box.appendChild(row('7-day growth', growthSlide, growthOut));
    box.appendChild(row('No token for', ageSlide, ageOut));
    box.appendChild(result);
    function resetAll() {
      tvlSlide.value = String(tvlToSlider(r.tvl));
      growthSlide.value = String(Math.round(r.ch7 === null ? 0 : Math.max(-60, Math.min(120, r.ch7))));
      ageSlide.value = String(Math.round(r.age === null ? 365 : Math.min(1825, r.age)));
      draw();
    }
    [tvlSlide, growthSlide, ageSlide].forEach(function (s) { s.addEventListener('input', draw); });
    reset.addEventListener('click', resetAll);
    resetAll();
    host.appendChild(box);
  }

  // ---------- detail ----------
  function detail(slug) {
    var r = R.rows.filter(function (x) { return x.slug === slug; })[0];
    var host = $('#detailView');
    host.replaceChildren();
    if (!r) {
      host.appendChild(el('p', 'empty', 'No protocol named ' + slug + ' on this board.'));
      return;
    }
    var back = el('a', 'back', '← Back to the radar board');
    back.href = '#/board';
    host.appendChild(back);

    var top = el('div', 'detailTop');
    var title = el('div', 'detailTitle');
    var rank = el('span', 'rankChip' + (r.candidate ? '' : ' dim'), r.candidate ? '#' + r.candidateRank : 'not a candidate');
    title.appendChild(rank);
    title.appendChild(el('h2', null, r.name));
    if (r.watch) title.appendChild(chip('WATCHLIST', 'watch'));
    if (r.candidate) title.appendChild(chip('PRE-TOKEN', 'ok'));
    top.appendChild(title);
    var meta = el('div', 'detailMeta');
    meta.appendChild(el('b', null, r.category || 'Uncategorised'));
    meta.appendChild(document.createTextNode(' · ' + (r.chains.join(', ') || 'chain n/a') + ' · listed ' + (r.listed || 'unknown') + ' (' + year(r.age) + ')'));
    top.appendChild(meta);
    if (!r.candidate) top.appendChild(el('div', 'notCand', 'Not ranked as a launch candidate: ' + (r.whyNot || 'excluded by the watchlist rules') + '. Its figures are shown for completeness.'));
    host.appendChild(top);

    var stats = el('div', 'statGrid');
    [
      ['Implied value', money(r.implied), 'if its token launched on this record', true],
      ['80% band', money(r.low) + ' – ' + money(r.high), 'held-out coverage ' + Math.round(r.bandCoverage * 100) + '%', false],
      ['TVL', money(r.tvl), pct(r.ch7) + ' over 7 days', false],
      ['No token for', r.age === null ? 'unknown' : Math.round(r.age / 30.4) + ' months', r.listed ? 'listed ' + r.listed : 'listing date not recorded', false]
    ].forEach(function (s) {
      var d = el('div', 'stat');
      d.appendChild(el('span', null, s[0]));
      d.appendChild(el('b', s[3] ? 'hot' : '', s[1]));
      d.appendChild(el('em', null, s[2]));
      stats.appendChild(d);
    });
    host.appendChild(stats);

    var cols = el('div', 'cols');
    var left = el('div', 'panel');
    left.appendChild(el('h3', null, 'How the number is built'));
    var terms = el('div', 'terms');
    [
      ['TVL', money(r.tvl), 'snapshot'],
      ['Peer multiple', multi(r.terms.peerMultiple), r.peers + ' live peer' + (r.peers === 1 ? '' : 's') + (r.terms.categoryMedian === null ? ', all-market fallback' : ', category ' + multi(r.terms.categoryMedian))],
      ['Growth', r.terms.growth.toFixed(3) + '×', '7d ' + pct(r.ch7)],
      ['Maturity', r.terms.maturity.toFixed(3) + '×', r.age === null ? 'age assumed 1 yr' : year(r.age) + ' without a token'],
      ['Implied', money(r.implied), 'TVL × peer × growth × maturity', true]
    ].forEach(function (t) {
      var d = el('div', 'term' + (t[3] ? ' result' : ''));
      d.appendChild(el('span', null, t[0]));
      d.appendChild(el('b', null, t[1]));
      d.appendChild(el('em', null, t[2]));
      terms.appendChild(d);
    });
    left.appendChild(terms);
    var sc = el('div', 'scenarios');
    [['Conservative', r.scenarios.conservative], ['Base', r.scenarios.base], ['Stretch', r.scenarios.stretch]].forEach(function (pair, i) {
      var item = el('span', i === 1 ? 'base' : '');
      item.appendChild(document.createTextNode(pair[0]));
      item.appendChild(el('b', null, money(pair[1])));
      sc.appendChild(item);
    });
    sc.appendChild(el('em', null, 'a quarter of held-out peers land below / above'));
    left.appendChild(sc);
    var peerWord = r.peers === 1 ? '1 live-token peer' : r.peers + ' live-token peers';
    left.appendChild(el('p', null,
      'The category multiple is the geometric median market-cap/TVL of ' + peerWord + ' in ' + (r.category || 'this category') +
      ', shrunk ' + Math.round((1 - r.terms.shrinkage) * 100) + '% toward the all-market ' + multi(r.terms.globalMedian) +
      '. That gives ' + multi(r.terms.peerMultiple) + ', then growth and maturity adjust it. The 80% band is the held-out residual range for ' +
      r.confidence + '-confidence protocols.'));
    sandbox(r, left);

    var peers = R.live.filter(function (p) { return (p.category || 'Uncategorised') === (r.category || 'Uncategorised'); }).slice(0, 6);
    if (peers.length) {
      left.appendChild(el('h3', null, 'Live peers in ' + (r.category || 'this category')));
      var pt = el('table', 'mini');
      var ph = el('thead');
      var phr = el('tr');
      ['Protocol', 'TVL', 'Market cap', 'MC/TVL'].forEach(function (h, i) { phr.appendChild(el('th', i ? 'num' : '', h)); });
      ph.appendChild(phr);
      pt.appendChild(ph);
      var pb = el('tbody');
      peers.forEach(function (p) {
        var tr = el('tr');
        tr.appendChild(el('td', null, p.name));
        tr.appendChild(el('td', 'num', money(p.tvl)));
        tr.appendChild(el('td', 'num', money(p.mcap)));
        tr.appendChild(el('td', 'num', multi(p.multiple)));
        pb.appendChild(tr);
      });
      pt.appendChild(pb);
      left.appendChild(pt);
    }
    cols.appendChild(left);

    var right = el('div', 'panel');
    right.appendChild(el('h3', null, 'Farm plan'));
    right.appendChild(el('p', null, '$' + r.plan.capital + ' capital · $' + r.plan.gas + ' gas · ' + r.plan.hours + ' hours over ' + r.plan.weeks + ' weeks · $' + r.plan.gasPerHour + ' gas per active hour. Concrete steps, not a slogan.'));
    var plan = el('table', 'mini planTable');
    var thead = el('thead');
    var hr = el('tr');
    ['#', 'Step', 'Cost', 'Time'].forEach(function (h) { hr.appendChild(el('th', null, h)); });
    thead.appendChild(hr);
    plan.appendChild(thead);
    var pbody = el('tbody');
    r.plan.steps.forEach(function (s, i) {
      var tr = el('tr');
      tr.appendChild(el('td', null, i + 1));
      tr.appendChild(el('td', null, s.action));
      tr.appendChild(el('td', 'cost', s.cost));
      tr.appendChild(el('td', 'time', s.time));
      pbody.appendChild(tr);
    });
    plan.appendChild(pbody);
    right.appendChild(plan);
    right.appendChild(el('div', 'verdict', r.plan.verdict));
    right.appendChild(el('h3', null, 'Before you spend gas'));
    var ul = el('ul', 'dd');
    r.dd.forEach(function (t) { ul.appendChild(el('li', null, t)); });
    right.appendChild(ul);
    cols.appendChild(right);
    host.appendChild(cols);
  }

  // ---------- calibration chart ----------
  function drawCalibration(check) {
    var host = $('#calChart');
    host.replaceChildren();
    if (!check.points || check.points.length === 0) return;
    var W = 1160, H = 300, L = 54, R = 18, T = 14, B = 40;
    var vals = check.points.map(function (p) { return Math.log10(p.actual); }).concat(check.points.map(function (p) { return Math.log10(p.predicted); }));
    var lo = Math.floor(Math.min.apply(null, vals)), hi = Math.ceil(Math.max.apply(null, vals));
    var sx = function (v) { return L + ((v - lo) / (hi - lo)) * (W - L - R); };
    var sy = function (v) { return H - B - ((v - lo) / (hi - lo)) * (H - T - B); };
    var root = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Held-out implied value against actual market cap' });
    for (var e = lo; e <= hi; e++) {
      root.appendChild(svgEl('line', { x1: sx(e), y1: sy(lo), x2: sx(e), y2: sy(hi), stroke: '#182338', 'stroke-width': '1' }));
      root.appendChild(svgEl('line', { x1: sx(lo), y1: sy(e), x2: sx(hi), y2: sy(e), stroke: '#182338', 'stroke-width': '1' }));
      root.appendChild(svgText(sx(e), H - B + 16, money(Math.pow(10, e)), 'mid'));
      root.appendChild(svgText(L - 8, sy(e) + 3, money(Math.pow(10, e)), 'end'));
    }
    root.appendChild(svgEl('line', { x1: sx(lo), y1: sy(lo), x2: sx(hi), y2: sy(hi), stroke: '#f5b33c', 'stroke-width': '1.4', 'stroke-dasharray': '5 5', opacity: '0.85' }));
    var colors = { high: '#2fd6b5', medium: '#f5b33c', low: '#9a86b8' };
    check.points.forEach(function (p) {
      var x = Math.log10(p.actual), y = Math.log10(p.predicted);
      var c = svgEl('circle', { cx: sx(x), cy: sy(y), r: 3.4, fill: colors[p.bucket], opacity: 0.72 });
      var title = svgEl('title', {});
      title.textContent = p.slug + ': actual ' + money(p.actual) + ', implied ' + money(p.predicted);
      c.appendChild(title);
      root.appendChild(c);
    });
    var legend = [['high', 'high'], ['medium', 'medium'], ['low', 'low']];
    legend.forEach(function (l, i) {
      var lx = W - R - 210 + i * 70;
      root.appendChild(svgEl('circle', { cx: lx, cy: T + 4, r: 4, fill: colors[l[0]] }));
      root.appendChild(svgText(lx + 9, T + 8, l[1], 'start'));
    });
    host.appendChild(root);
  }

  // ---------- method ----------
  function renderMethod() {
    var c = R.model.check;
    var wf = c.walkForward;
    $('#checkIntro').textContent = c.folds + '-fold cross-validation: fit the category multiples on four fifths of the ' + R.model.livePeers + ' live-token protocols, then price the fifth it has never seen (' + c.n + ' held-out predictions). Walk-forward test: fit the older 70% of dated peers, then price the ' + wf.n + ' newer tokens it never saw — median miss ' + wf.medianFactor.toFixed(2) + 'x, rank correlation ' + wf.spearman.toFixed(2) + ', band coverage ' + Math.round(wf.coverage * 100) + '%.';
    var bt = $('#bucketTable tbody');
    bt.replaceChildren();
    c.buckets.forEach(function (b) {
      var tr = el('tr');
      tr.appendChild(el('td', null, b.bucket[0].toUpperCase() + b.bucket.slice(1)));
      tr.appendChild(el('td', 'num', b.n));
      tr.appendChild(el('td', 'num', b.low.toFixed(3) + '× – ' + b.high.toFixed(1) + '×'));
      tr.appendChild(el('td', 'num', Math.round(b.coverage * 100) + '%'));
      tr.appendChild(el('td', 'num', b.medianFactor.toFixed(2) + '×'));
      bt.appendChild(tr);
    });
    var score = $('#scoreRow');
    score.replaceChildren();
    [['Rank correlation', c.spearman.toFixed(2), 'predicted vs actual, held out'], ['Median miss', c.medianFactor.toFixed(2) + '×', 'factor, not a percent'], ['Within 2×', Math.round(c.within2x * 100) + '%', 'of held-out peers'], ['Walk-forward miss', c.walkForward.medianFactor.toFixed(2) + '×', 'older peers to newer']].forEach(function (s) {
      var d = el('div', 'score');
      d.appendChild(el('span', null, s[0]));
      d.appendChild(el('b', null, s[1]));
      d.appendChild(el('em', null, s[2]));
      score.appendChild(d);
    });
    drawCalibration(c);
    var ct = $('#catTable tbody');
    ct.replaceChildren();
    c.categories.slice(0, 12).forEach(function (r) {
      var tr = el('tr');
      tr.appendChild(el('td', null, r.name));
      tr.appendChild(el('td', 'num', r.n));
      tr.appendChild(el('td', 'num', r.medianMultiple.toFixed(2) + '×'));
      tr.appendChild(el('td', 'num', r.medianFactor.toFixed(2) + '×'));
      ct.appendChild(tr);
    });
    var kt = $('#countTable');
    var kb = el('tbody');
    [
      ['Protocols in the snapshot', R.counts.protocols],
      ['Records with no token', R.counts.preToken],
      ['Launch candidates ranked', R.counts.candidates],
      ['On the snapshot watchlist', R.counts.watchlist],
      ['Live tokens separated', R.counts.live],
      ['Excluded: bridge TVL', R.counts.excludedBridge],
      ['Excluded: exchange product', R.counts.excludedCex],
      ['Excluded: wrapped / versioned', R.counts.excludedProduct],
      ['Token records without a price', R.counts.unpriced],
      ['Board rows written', R.rows.length]
    ].forEach(function (r) {
      var tr = el('tr');
      tr.appendChild(el('td', null, r[0]));
      tr.appendChild(el('td', 'num', FMT.format(r[1])));
      kb.appendChild(tr);
    });
    kt.replaceChildren(kb);
    $('#provenance').textContent = 'Source: ' + R.source + '. Snapshot date ' + R.asOf + ', watchlist floor $' + FMT.format(R.floor) + '.';
  }

  // ---------- boot ----------
  function applyParams(params) {
    if (!params) return;
    view.q = params.get('q') || '';
    view.cat = params.get('cat') || 'all';
    view.conf = params.get('conf') || 'all';
    view.scope = params.get('scope') || 'candidates';
    $('#q').value = view.q;
    if ($('#cat').querySelector('option[value="' + CSS.escape(view.cat) + '"]')) $('#cat').value = view.cat;
    $('#conf').value = view.conf;
    $('#scope').value = view.scope;
  }
  function render() {
    var r = route();
    show(r.name);
    if (r.name === 'board') {
      applyParams(r.params);
      renderBoard();
    } else if (r.name === 'live') renderLive();
    else if (r.name === 'method') renderMethod();
    else if (r.name === 'compare') renderCompare(r.params);
    else detail(r.slug);
    window.scrollTo(0, 0);
  }
  savePins();
  renderChrome();
  buildControls();
  renderMethod();
  window.addEventListener('hashchange', render);
  render();
})();
