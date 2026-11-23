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
  var view = { q: '', cat: 'all', conf: 'all', scope: 'candidates', sort: 'rank', dir: 1 };

  function route() {
    var raw = (location.hash || '#/board').replace(/^#/, '');
    var qs = raw.split('?');
    var parts = qs[0].split('/').filter(Boolean);
    var params = new URLSearchParams(qs[1] || '');
    if (parts[0] === 'p' && parts[1]) return { name: 'detail', slug: decodeURIComponent(parts[1]) };
    if (parts[0] === 'live') return { name: 'live' };
    if (parts[0] === 'method') return { name: 'method' };
    return { name: 'board', params: params };
  }

  function show(name) {
    $('#kpis').hidden = name === 'detail';
    $('#statusLine').hidden = name === 'detail';
    $('#boardView').hidden = name !== 'board';
    $('#liveView').hidden = name !== 'live';
    $('#methodView').hidden = name !== 'method';
    $('#detailView').hidden = name !== 'detail';
    document.querySelectorAll('.tabs a').forEach(function (a) {
      var active = a.getAttribute('data-tab') === name;
      if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  // ---------- header ----------
  function renderChrome() {
    $('#asOf').textContent = R.asOf;
    $('#peerCount').textContent = FMT.format(R.counts.live);
    var c = R.counts;
    var top = R.rows.filter(function (r) { return r.candidate; })[0] || R.rows[0];
    var kpis = [
      ['Pre-token records', FMT.format(c.preToken), 'DefiLlama records no token', false],
      ['Launch candidates', FMT.format(c.candidates), 'past the wrapped / bridge / CEX rules', true],
      ['Watchlist covered', c.watchlist + '/' + c.watchlist, 'every $' + (R.floor / 1e6) + 'M+ pre-token record', false],
      ['Live token peers', FMT.format(c.live), 'price the category multiples', false],
      ['Top implied value', money(top ? top.implied : 0), top ? top.name : '', true]
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
    var line = $('#statusLine');
    line.replaceChildren();
    [FMT.format(c.protocols) + ' protocols in the snapshot', FMT.format(c.preToken) + ' pre-token', FMT.format(c.candidates) + ' launch candidates', FMT.format(c.live) + ' live tokens separated', FMT.format(c.unpriced) + ' token records without a price'].forEach(function (t, i) {
      line.appendChild(chip(t, i === 3 ? 'ok' : ''));
    });
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
      else if (view.sort === 'tvl') d = b.tvl - a.tvl;
      else if (view.sort === 'ch7') d = (b.ch7 || -999) - (a.ch7 || -999);
      else if (view.sort === 'multiple') d = b.multiple - a.multiple;
      else if (view.sort === 'implied') d = b.implied - a.implied;
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
    var label = view.scope === 'candidates' ? 'launch candidates' : view.scope === 'watch' ? 'watchlist records' : 'pre-token records';
    var scopeTotal = view.scope === 'candidates' ? R.counts.candidates : view.scope === 'watch' ? R.counts.watchlist : R.rows.length;
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
    $('#reset').addEventListener('click', function () {
      view = { q: '', cat: 'all', conf: 'all', scope: 'candidates', sort: 'rank', dir: 1 };
      $('#q').value = ''; $('#cat').value = 'all'; $('#conf').value = 'all'; $('#scope').value = 'candidates';
      document.querySelectorAll('#table th').forEach(function (th) { th.removeAttribute('data-active'); });
      renderBoard();
    });
    document.querySelectorAll('#table th[data-sort]').forEach(function (th) {
      th.addEventListener('click', function () {
        var key = th.getAttribute('data-sort');
        if (key === 'rank' || key === 'name' || key === 'confidence') view.dir = view.sort === key ? -view.dir : 1;
        else view.dir = view.sort === key ? -view.dir : -1;
        view.sort = key;
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
    var peerWord = r.peers === 1 ? '1 live-token peer' : r.peers + ' live-token peers';
    left.appendChild(el('p', null,
      'The category multiple is the geometric median market-cap/TVL of ' + peerWord + ' in ' + (r.category || 'this category') +
      ', shrunk ' + Math.round((1 - r.terms.shrinkage) * 100) + '% toward the all-market ' + multi(r.terms.globalMedian) +
      '. That gives ' + multi(r.terms.peerMultiple) + ', then growth and maturity adjust it. The 80% band is the held-out residual range for ' +
      r.confidence + '-confidence protocols.'));

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
    right.appendChild(el('p', null, '$' + r.plan.capital + ' capital · $' + r.plan.gas + ' gas · about ' + r.plan.hours + ' hours over ' + r.plan.weeks + ' weeks. Concrete steps, not a slogan.'));
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

  // ---------- method ----------
  function renderMethod() {
    var c = R.model.check;
    $('#checkIntro').textContent = c.folds + '-fold cross-validation: fit the category multiples on four fifths of the ' + R.model.livePeers + ' live-token protocols, then price the fifth it has never seen. ' + c.n + ' held-out predictions in all.';
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
    [['Rank correlation', c.spearman.toFixed(2), 'predicted vs actual, held out'], ['Median miss', c.medianFactor.toFixed(2) + '×', 'factor, not a percent'], ['Within 2×', Math.round(c.within2x * 100) + '%', 'of held-out peers']].forEach(function (s) {
      var d = el('div', 'score');
      d.appendChild(el('span', null, s[0]));
      d.appendChild(el('b', null, s[1]));
      d.appendChild(el('em', null, s[2]));
      score.appendChild(d);
    });
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
    else detail(r.slug);
    window.scrollTo(0, 0);
  }
  renderChrome();
  buildControls();
  renderMethod();
  window.addEventListener('hashchange', render);
  render();
})();
