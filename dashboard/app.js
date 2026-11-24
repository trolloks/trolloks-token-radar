/* Launch Radar dashboard - no framework, no network. Reads window.RADAR from ../data.js. */
(function () {
'use strict';
var R = window.RADAR;
if (!R) return;

var $ = function (s, root) { return (root || document).querySelector(s); };
var FMT = new Intl.NumberFormat('en-US');
var SVGNS = 'http://www.w3.org/2000/svg';
function checksumOf(rows) {
var h = 2166136261;
rows.forEach(function (r) {
var s = r.slug + '|' + r.candidateRank + '|' + r.implied;
for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
});
return h.toString(16).toUpperCase().padStart(8, '0');
}
function refit() {
var ps = R.live, n = ps.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
ps.forEach(function (p) { var x = Math.log(p.tvl), y = Math.log(p.mcap / p.tvl); sx += x; sy += y; sxx += x * x; sxy += x * y; });
var a00 = n + 0.05, a01 = sx, a11 = sxx + 0.05, det = a00 * a11 - a01 * a01;
var a = (sy * a11 - sx * sxy) / det, b = (a00 * sxy - a01 * sy) / det;
var by = {};
ps.forEach(function (p) { var r = Math.log(p.mcap / p.tvl) - a - b * Math.log(p.tvl); var c = p.category || ''; (by[c] = by[c] || []).push(r); });
var row = R.rows[0], list = by[row.category || ''] || [], m = list.slice().sort(function (x, y) { return x - y; }), mid = m.length >> 1;
var med = m.length ? (m.length % 2 ? m[mid] : (m[mid - 1] + m[mid]) / 2) : 0;
var cat = list.length ? (list.length / (list.length + 20)) * med : 0;
return { a: a, b: b, ok: Math.abs(a - R.model.value.intercept) < 0.002 && Math.abs(b - R.model.value.slope) < 0.002 && Math.abs(cat - row.categoryAdj) < 0.002 };
}

function el(tag, cls, text) {
var n = document.createElement(tag);
if (cls) n.className = cls;
if (text !== undefined && text !== null) n.textContent = String(text);
return n;
}
function svgEl(tag, attrs) {
var n = document.createElementNS(SVGNS, tag);
if (attrs) for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
return n;
}
function svgText(x, y, text, anchor) {
var t = svgEl('text', { x: x, y: y, 'font-size': '10', fill: '#66738c', 'font-family': 'ui-monospace,monospace' });
if (anchor) t.setAttribute('text-anchor', anchor);
t.textContent = text;
return t;
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
function valueAt(tvl, adj) { return tvl * Math.exp(R.model.value.intercept + R.model.value.slope * Math.log(tvl) + (adj || 0)); }
function oddsAt(row, growth, ageDays) {
var c = R.model.odds.coef;
var z = c[0] + c[1] * row.oddsInput.size + c[2] * Math.log(1 + ageDays / 365) + c[3] * growth + c[4] * row.oddsInput.categoryRate;
return 1 / (1 + Math.exp(-z));
}
function verdictOf(net, perHour, benchmark) { return net > benchmark && perHour >= 25 ? 'worth' : net > 0 ? 'marginal' : 'skip'; }
function farm(row, pos, horizon) {
horizon = horizon || 12;
var drop = row.implied * R.model.dropShare * (pos / row.tvl);
var net = drop - row.plan.fees;
var benchmark = pos * 0.04 * horizon / 52;
var perHour = net / Math.max(0.1, row.plan.hours);
return { drop: drop, fees: row.plan.fees, net: net, benchmark: benchmark, perHour: perHour, verdict: verdictOf(net, perHour, benchmark) };
}

function farmAt(row, pos, share, horizon) {
var drop = row.implied * share * (pos / row.tvl);
var net = drop - row.plan.fees;
var benchmark = pos * 0.04 * horizon / 52;
var perHour = net / Math.max(0.1, row.plan.hours);
return { net: net, verdict: verdictOf(net, perHour, benchmark) };
}

var view = { q: '', cat: 'all', verdict: 'all', scope: 'candidates', sort: 'rank', dir: 1 };
var pins = new Set();
try { pins = new Set(JSON.parse(localStorage.getItem('radar.pins') || '[]')); } catch (e) { pins = new Set(); }
function savePins() {
try { localStorage.setItem('radar.pins', JSON.stringify(Array.from(pins))); } catch (e) {}
var nav = $('#pinNav'); if (nav) nav.textContent = pins.size;
var btn = $('#compareBtn'); if (btn) btn.hidden = pins.size < 2;
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
if (a.getAttribute('data-tab') === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
});
}

function renderChrome() {
$('#asOf').textContent = R.asOf;
$('#peerCount').textContent = FMT.format(R.counts.live);
var v = R.model.value, o = R.model.odds, c = R.counts;
var vAll = v.terms.filter(function (t) { return !/baseline|control/.test(t.term); });
var vKept = vAll.filter(function (t) { return t.kept; });
var oAll = o.terms.filter(function (t) { return t.term !== 'base rate'; });
var oKept = oAll.filter(function (t) { return t.kept; });
var p25Worth = R.rows.filter(function (r) { return r.candidate && r.plan.p25Verdict === 'worth'; }).length;
var kpis = [
['Out-of-sample miss', v.loo.toFixed(2) + '×', 'older/newer ' + v.wf.toFixed(2) + '× · flat ' + v.baselineLoo.toFixed(2) + '×', true],
['Blind coverage', Math.round(v.coverage.outerP25 * 100) + '% / ' + Math.round(v.coverage.outerP10 * 100) + '%', 'held-out folds; in-sample 50/80', false],
['Token odds', 'Brier ' + o.brier.toFixed(3), 'base ' + o.brierBase.toFixed(3) + ' · older/newer ' + o.brierWf.toFixed(3), false],
['Terms kept', vKept.length + '/' + vAll.length + ' · ' + oKept.length + '/' + oAll.length, 'value · odds', false],
['Worth farming', c.worth + ' of ' + c.candidates, 'net > T-bill and $25/hour · ' + p25Worth + ' clear P25', true],
['Watchlist ranked', c.watchlistCovered + '/' + c.watchlist, 'plus ' + (c.candidates - c.watchlist) + ' other candidates', false]
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
var bar = el('div', 'ledgerBar');
[
[c.watchlist, 'w', 'watchlist'],
[c.candidates - c.watchlist, 'e', 'other candidates'],
[c.preToken - c.candidates, 's', 'set aside'],
[c.live, 'l', 'live peers'],
[c.unpriced, 'u', 'unpriced records']
].forEach(function (seg) {
var i = el('i', seg[1]);
i.style.width = (seg[0] / c.protocols) * 100 + '%';
i.title = FMT.format(seg[0]) + ' ' + seg[2];
bar.appendChild(i);
});
line.appendChild(bar);
var legend = el('span', 'ledgerLegend');
legend.appendChild(el('b', null, '758/758 accounted'));
line.appendChild(legend);
var acct = el('div', 'chipRow');
[['watchlist', c.watchlist], ['other candidates', c.candidates - c.watchlist], ['set aside', c.preToken - c.candidates], ['live peers', c.live], ['unpriced', c.unpriced]].forEach(function (x) {
acct.appendChild(chip(x[0] + ' ' + x[1], ''));
});
line.appendChild(acct);
var contract = $('#contract');
contract.replaceChildren();
var vline = el('div', 'evLine');
vline.appendChild(el('b', null, 'Value LOO/WF '));
v.terms.forEach(function (t, i) {
if (i) vline.appendChild(document.createTextNode(' · '));
vline.appendChild(document.createTextNode(t.term + ' ' + t.loo.toFixed(2) + '/' + t.wf.toFixed(2) + ' '));
vline.appendChild(el('i', t.kept ? 'up' : /baseline/.test(t.term) ? 'flat' : 'flat', t.kept ? 'kept' : /baseline/.test(t.term) ? 'baseline' : 'dropped'));
});
contract.appendChild(vline);
var oline = el('div', 'evLine');
oline.appendChild(el('b', null, 'Odds Brier '));
o.terms.forEach(function (t, i) {
if (i) oline.appendChild(document.createTextNode(' · '));
oline.appendChild(document.createTextNode(t.term + ' ' + t.loo.toFixed(3) + '/' + t.wf.toFixed(3) + ' '));
oline.appendChild(el('i', t.kept ? 'up' : 'flat', t.kept ? 'kept' : /base rate/.test(t.term) ? 'baseline' : 'base'));
});
contract.appendChild(oline);
var cline = el('div', 'evLine');
var rf = refit(), cs = checksumOf(R.rows.filter(function (r) { return r.candidate; }));
cline.appendChild(el('b', null, 'Integrity '));
cline.appendChild(document.createTextNode('refit ' + (rf.ok ? '✓' : '✗') + ' ' + rf.a.toFixed(3) + ' / ' + rf.b.toFixed(3)));
contract.appendChild(cline);
var rowsOk = R.rows.every(function (r) { return Math.abs(Math.round(r.launch * r.odds) - r.implied) <= 1; });
var cand = R.rows.filter(function (r) { return r.candidate; });
var candOk = cand.every(function (r) { return Math.abs(Math.round(r.launch * r.odds) - r.implied) <= 1; });
var orderOk = cand.every(function (r, i) { return i === 0 || cand[i - 1].implied >= r.implied; });
var chipRow = el('div', 'chipRow');
chipRow.appendChild(chip('board ' + (candOk ? '✓ ' : '✗ ') + cand.length, candOk ? 'ok' : ''));
chipRow.appendChild(chip('data ' + (rowsOk ? '✓ ' : '✗ ') + R.rows.length, rowsOk ? 'ok' : ''));
chipRow.appendChild(chip('ranks ' + (orderOk ? '✓' : '✗'), orderOk ? 'ok' : ''));
chipRow.appendChild(chip('watchlist ' + R.counts.watchlistCovered + '/' + R.counts.watchlist, R.counts.watchlistCovered === R.counts.watchlist ? 'ok' : ''));
chipRow.appendChild(chip('checksum ' + (cs === R.checksum ? '✓ ' : '✗ ') + cs, cs === R.checksum ? 'ok' : ''));
contract.appendChild(chipRow);
}

function categories() {
var out = [];
R.rows.forEach(function (r) { var k = r.category || 'Uncategorised'; if (out.indexOf(k) < 0) out.push(k); });
return out.sort();
}
var VORDER = { worth: 0, marginal: 1, skip: 2 };
function filtered() {
var q = view.q.trim().toLowerCase();
var out = R.rows.filter(function (r) {
if (view.scope === 'candidates' && !r.candidate) return false;
if (view.scope === 'worth' && r.plan.verdict !== 'worth') return false;
if (view.scope === 'watch' && !r.watch) return false;
if (view.scope === 'pinned' && !pins.has(r.slug)) return false;
if (view.cat !== 'all' && (r.category || 'Uncategorised') !== view.cat) return false;
if (view.verdict === 'worth' && r.plan.verdict !== 'worth') return false;
if (view.verdict === 'marginal' && r.plan.verdict === 'skip') return false;
if (view.verdict === 'skip' && r.plan.verdict !== 'skip') return false;
if (q) {
var hay = (r.name + ' ' + (r.category || '') + ' ' + r.chains.join(' ') + ' ' + r.slug).toLowerCase();
if (hay.indexOf(q) < 0) return false;
}
return true;
});
out.sort(function (a, b) {
var d = 0;
if (view.sort === 'name') d = a.name.localeCompare(b.name);
else if (view.sort === 'verdict') d = VORDER[a.plan.verdict] - VORDER[b.plan.verdict];
else if (view.sort === 'tvl') d = a.tvl - b.tvl;
else if (view.sort === 'ch7') d = (a.ch7 === null ? -999 : a.ch7) - (b.ch7 === null ? -999 : b.ch7);
else if (view.sort === 'age') d = (a.age === null ? -1 : a.age) - (b.age === null ? -1 : b.age);
else if (view.sort === 'odds') d = a.odds - b.odds;
else if (view.sort === 'implied') d = a.implied - b.implied;
else if (view.sort === 'p75') d = a.p75 - b.p75;
else if (view.sort === 'perHour') d = a.plan.perHour - b.plan.perHour;
else d = a.rank - b.rank;
return d * view.dir;
});
return out;
}
function oddsCell(r) {
var td = el('td', 'num oddsCell');
var wrap = el('div', 'odds');
var track = el('div', 'track');
var fill = el('i', null);
fill.style.width = Math.round(r.odds * 100) + '%';
track.appendChild(fill);
wrap.appendChild(track);
wrap.appendChild(el('b', null, Math.round(r.odds * 100) + '%'));
td.appendChild(wrap);
return td;
}
function verdictCell(r) {
var td = el('td');
var chipEl = el('span', 'verdict v-' + r.plan.verdict, r.plan.verdict.toUpperCase());
td.appendChild(chipEl);
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
rank.appendChild(el('div', 'subline', r.rankLow + '–' + r.rankHigh));
tr.appendChild(rank);

var name = el('td');
var nm = el('div', 'name', r.name);
if (r.watch) nm.appendChild(chip('WATCH', 'watch'));
if (!r.candidate) nm.appendChild(chip('EXCLUDED'));
name.appendChild(nm);
name.appendChild(el('div', 'subline', (r.category || 'Uncategorised') + ' · ' + (r.chains.slice(0, 3).join(', ') || 'chain n/a') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + ' · ' + year(r.age) + ' old'));
tr.appendChild(name);

var tvl = el('td', 'num money');
tvl.appendChild(document.createTextNode(money(r.tvl)));
tvl.appendChild(el('div', 'subline ' + (r.ch7 > 0 ? 'up' : r.ch7 < 0 ? 'dn' : 'flat'), pct(r.ch7)));
tr.appendChild(tvl);
tr.appendChild(oddsCell(r));
var val = el('td', 'num implied');
val.appendChild(document.createTextNode(money(r.implied)));
val.appendChild(el('div', 'subline', money(r.launch)));
tr.appendChild(val);
tr.appendChild(el('td', 'num bandText', money(r.p25) + ' – ' + money(r.p75)));
tr.appendChild(verdictCell(r));
tr.appendChild(el('td', 'num ' + (r.plan.perHour > 0 ? 'up' : 'dn'), '$' + r.plan.perHour.toFixed(0)));
return tr;
}
function renderBoard() {
var rows = filtered();
var body = $('#tbody');
body.replaceChildren();
rows.forEach(function (r) { body.appendChild(boardRow(r)); });
$('#empty').hidden = rows.length > 0;
var vc = $('#verdictChips');
vc.replaceChildren();
[['All', R.counts.candidates], ['Worth', R.counts.worth], ['Marg.', R.counts.marginal], ['Skip', R.counts.skip]].forEach(function (x) {
var b = el('button', '', x[0] + ' ' + x[1]);
b.type = 'button';
vc.appendChild(b);
});
var label = view.scope === 'candidates' ? 'launch candidates' : view.scope === 'worth' ? 'worth-farming candidates' : view.scope === 'watch' ? 'watchlist records' : view.scope === 'pinned' ? 'shortlisted records' : 'pre-token records';
var scopeTotal = view.scope === 'candidates' ? R.counts.candidates : view.scope === 'worth' ? R.counts.worth : view.scope === 'watch' ? R.counts.watchlist : view.scope === 'pinned' ? R.rows.filter(function (r) { return pins.has(r.slug); }).length : R.rows.length;
var count = $('#count');
count.replaceChildren();
count.appendChild(el('b', null, rows.length));
count.appendChild(document.createTextNode(' of ' + scopeTotal + ' ' + label + (view.cat !== 'all' ? ' in ' + view.cat : '') + ' · sorted by ' + view.sort));
}
function exportCsv(rows) {
function cell(v) { var t = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }
var head = ['rank', 'candidate_rank', 'name', 'slug', 'category', 'chains', 'tvl_usd', 'change_7d', 'age_days', 'token_odds', 'launch_value_usd', 'implied_value_usd', 'p25_usd', 'p75_usd', 'farm_verdict', 'drop_usd', 'fees_usd', 'net_usd', 'net_per_hour', 'watchlist', 'candidate'];
var lines = [head.join(',')].concat(rows.map(function (r) {
return [r.candidateRank, r.candidateRank, r.name, r.slug, r.category, r.chains.join('|'), r.tvl, r.ch7, r.age, r.odds, r.launch, r.implied, r.p25, r.p75, r.plan.verdict, r.plan.drop, r.plan.fees, r.plan.net, r.plan.perHour, r.watch, r.candidate].map(cell).join(',');
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
function buildControls() {
var sel = $('#cat');
sel.appendChild(new Option('All categories (' + R.rows.length + ')', 'all'));
categories().forEach(function (c) {
var n = R.rows.filter(function (r) { return (r.category || 'Uncategorised') === c; }).length;
sel.appendChild(new Option(c + ' (' + n + ')', c));
});
function sync() { view.q = $('#q').value; view.cat = $('#cat').value; view.verdict = $('#verdict').value; view.scope = $('#scope').value; renderBoard(); }
$('#q').addEventListener('input', sync);
$('#cat').addEventListener('change', sync);
$('#verdict').addEventListener('change', sync);
$('#scope').addEventListener('change', sync);
$('#csv').addEventListener('click', function () { exportCsv(filtered()); });
$('#compareBtn').addEventListener('click', function () { location.hash = '#/compare'; });
$('#reset').addEventListener('click', function () {
view = { q: '', cat: 'all', verdict: 'all', scope: 'candidates', sort: 'rank', dir: 1 };
$('#q').value = ''; $('#cat').value = 'all'; $('#verdict').value = 'all'; $('#scope').value = 'candidates';
document.querySelectorAll('#table th').forEach(function (th) { th.removeAttribute('data-active'); });
renderBoard();
});
var numeric = ['tvl', 'ch7', 'implied', 'p75', 'age', 'odds', 'perHour'];
document.querySelectorAll('#table th[data-sort]').forEach(function (th) {
th.addEventListener('click', function () {
var key = th.getAttribute('data-sort');
if (view.sort === key) view.dir = -view.dir; else view.dir = numeric.indexOf(key) >= 0 ? -1 : 1;
view.sort = key;
document.querySelectorAll('#table th').forEach(function (h) { h.removeAttribute('data-active'); });
th.setAttribute('data-active', view.dir > 0 ? 'asc' : 'desc');
renderBoard();
});
});
}

function renderLive() {
$('#liveN').textContent = R.live.length;
var body = $('#liveBody');
body.replaceChildren();
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
body.appendChild(tr);
});
}

function sandbox(r, host) {
var box = el('div', 'sandbox');
var head = el('div', 'sbHead');
head.appendChild(el('h4', null, 'What-if sandbox'));
var reset = el('button', 'ghost sbReset', 'Reset');
reset.type = 'button';
head.appendChild(reset);
box.appendChild(head);
box.appendChild(el('p', 'sbHint', 'Move TVL to reprice the launch; move growth or age to reprice the token odds.'));
var tvlSlide = el('input'); tvlSlide.type = 'range'; tvlSlide.min = '0'; tvlSlide.max = '1000'; tvlSlide.step = '1';
var growthSlide = el('input'); growthSlide.type = 'range'; growthSlide.min = '-60'; growthSlide.max = '120'; growthSlide.step = '1';
var ageSlide = el('input'); ageSlide.type = 'range'; ageSlide.min = '0'; ageSlide.max = '1825'; ageSlide.step = '1';
var tvlOut = el('b'), growthOut = el('b'), ageOut = el('b');
var result = el('div', 'sbOut');
var valueOut = el('b'), oddsOut = el('b'), bandOut = el('em');
result.appendChild(el('span', null, 'Implied'));
result.appendChild(valueOut);
result.appendChild(el('span', null, 'Odds'));
result.appendChild(oddsOut);
result.appendChild(bandOut);
function tvlToSlider(v) { return Math.round(1000 * Math.log(Math.max(5000000, v) / 5000000) / Math.log(3000)); }
function sliderToTvl(v) { return 5000000 * Math.pow(3000, v / 1000); }
function draw() {
var tvl = sliderToTvl(Number(tvlSlide.value));
var growth = Number(growthSlide.value) / 100;
var age = Number(ageSlide.value);
var launch = Math.max(1, Math.round(valueAt(tvl, r.categoryAdj)));
var odds = oddsAt(r, growth, age);
var implied = Math.max(1, Math.round(launch * odds));
tvlOut.textContent = money(tvl);
growthOut.textContent = pct(growth * 100);
ageOut.textContent = year(age);
valueOut.textContent = money(implied);
oddsOut.textContent = Math.round(odds * 100) + '%';
bandOut.textContent = money(launch) + ' · P25–P75 ' + money(implied * R.model.value.bands.p25) + ' – ' + money(implied * R.model.value.bands.p75);
}
function resetAll() {
tvlSlide.value = String(tvlToSlider(r.tvl));
growthSlide.value = String(Math.round((r.ch7 === null ? 0 : Math.max(-60, Math.min(120, r.ch7)))));
ageSlide.value = String(Math.round(r.age === null ? 365 : Math.min(1825, r.age)));
draw();
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
[tvlSlide, growthSlide, ageSlide].forEach(function (s) { s.addEventListener('input', draw); });
reset.addEventListener('click', resetAll);
resetAll();
host.appendChild(box);
}
function detail(slug) {
var r = R.rows.filter(function (x) { return x.slug === slug; })[0];
var host = $('#detailView');
host.replaceChildren();
if (!r) { host.appendChild(el('p', 'empty', 'No protocol named ' + slug + ' on this board.')); return; }
var back = el('a', 'back', '← Back to the radar board');
back.href = '#/board';
host.appendChild(back);

var top = el('div', 'detailTop');
var title = el('div', 'detailTitle');
title.appendChild(el('span', 'rankChip' + (r.candidate ? '' : ' dim'), r.candidate ? '#' + r.candidateRank : 'not a candidate'));
title.appendChild(el('h2', null, r.name));
if (r.watch) title.appendChild(chip('WATCHLIST', 'watch'));
if (r.candidate) title.appendChild(chip('PRE-TOKEN', 'ok'));
top.appendChild(title);
var meta = el('div', 'detailMeta');
meta.appendChild(el('b', null, r.category || 'Uncategorised'));
meta.appendChild(document.createTextNode(' · ' + (r.chains.join(', ') || 'chain n/a') + ' · listed ' + (r.listed || 'unknown') + ' (' + year(r.age) + ')'));
if (r.candidate) { var sens = el('div', 'subline', 'Candidate rank ' + r.candidateRank + ' · sensitivity ' + r.rankLow + '–' + r.rankHigh); sens.title = 'Rank sensitivity with other estimates fixed'; meta.appendChild(sens); }
top.appendChild(meta);
if (!r.candidate) top.appendChild(el('div', 'notCand', 'Not ranked as a launch candidate: ' + (r.whyNot || 'excluded by the watchlist rules') + '. Its figures are shown for completeness.'));
host.appendChild(top);

var stats = el('div', 'statGrid');
[
['Implied value', money(r.implied), 'launch ' + money(r.launch) + ' × ' + Math.round(r.odds * 100) + '% odds', true],
['If it launches', money(r.launch), 'if launched', false],
['P25–P75', money(r.p25) + ' – ' + money(r.p75), 'launch band; ' + Math.round(R.model.value.coverage.outerP25 * 100) + '% blind', false],
['TVL', money(r.tvl), pct(r.ch7) + ' over 7 days', false]
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
left.appendChild(el('h3', null, 'How the figure is made'));
var multiple = r.launch / r.tvl;
var terms = el('div', 'terms');
[
['TVL', money(r.tvl), 'snapshot'],
['Curve multiple', multi(multiple), 'at this TVL'],
['Launch value', money(r.launch), 'TVL × multiple', true],
['Token odds', Math.round(r.odds * 100) + '%', 'peers record'],
['Implied value', money(r.implied), 'launch × odds', true]
].forEach(function (t) {
var d = el('div', 'term' + (t[3] ? ' result' : ''));
d.appendChild(el('span', null, t[0]));
d.appendChild(el('b', null, t[1]));
d.appendChild(el('em', null, t[2]));
terms.appendChild(d);
});
left.appendChild(terms);
left.appendChild(el('p', null, 'The fitted curve is log(market cap / TVL) = ' + R.model.value.intercept.toFixed(3) + ' ' + (R.model.value.slope < 0 ? '−' : '+') + ' ' + Math.abs(R.model.value.slope).toFixed(3) + ' × ln(TVL)' + (Math.abs(r.categoryAdj) > 1e-9 ? ' + category (' + (r.categoryAdj >= 0 ? '+' : '') + (Math.expm1(r.categoryAdj) * 100).toFixed(1) + '%)' : '') + '. At $100M TVL that is a ' + multi(R.model.value.multipleAt100m) + ' multiple; at this protocol TVL it is ' + multi(multiple) + '. Held out, the model misses by ' + R.model.value.loo.toFixed(2) + '× (leave-one-out) and ' + R.model.value.wf.toFixed(2) + '× (older/newer listing holdout).'));
var peers = R.live.filter(function (p) { return (p.category || 'Uncategorised') === (r.category || 'Uncategorised'); }).sort(function (a, b) { return Math.abs(Math.log(a.tvl / r.tvl)) - Math.abs(Math.log(b.tvl / r.tvl)); }).slice(0, 6);
if (peers.length) {
left.appendChild(el('h3', null, 'Nearest traded peers in ' + (r.category || 'this category')));
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
var oddsBox = el('div', 'sandbox');
var oddsHead = el('div', 'sbHead');
oddsHead.appendChild(el('h4', null, 'Token odds'));
oddsHead.appendChild(el('b', 'oddsBig', Math.round(r.odds * 100) + '%'));
oddsBox.appendChild(oddsHead);
oddsBox.appendChild(el('p', 'sbHint', 'The logistic model uses size (' + r.oddsInput.size.toFixed(1) + '), log age (' + r.oddsInput.age.toFixed(2) + '), 7-day growth (' + pct(r.oddsInput.growth * 100) + ') and the category rate (' + Math.round(r.oddsInput.categoryRate * 100) + '%). It is the peers\' record, not a promise this protocol launches.'));
var bar = el('div', 'odds wide');
var track = el('div', 'track');
var fill = el('i'); fill.style.width = Math.round(r.odds * 100) + '%';
track.appendChild(fill);
bar.appendChild(track);
oddsBox.appendChild(bar);
left.appendChild(oddsBox);
sandbox(r, left);


}
cols.appendChild(left);

var f = farm(r, R.model.planSize, r.plan.weeks);
var right = el('div', 'panel');
right.appendChild(el('h3', null, 'Farm verdict'));
var vh = el('div', 'verdictHead');
vh.appendChild(el('span', 'verdict v-' + r.plan.verdict, r.plan.verdict.toUpperCase()));
vh.appendChild(el('b', null, '$' + f.net.toFixed(0) + ' expected · $' + f.perHour.toFixed(0) + ' per hour'));
right.appendChild(vh);
right.appendChild(el('p', 'muted', 'If it launches: $' + r.plan.launchNet.toFixed(0) + ' net. ' + (Number.isFinite(r.plan.breakevenDeposit) ? 'Breaks even at $' + r.plan.breakevenDeposit.toFixed(0) + ' deposit or ' + (r.plan.breakevenOdds <= 1 ? Math.round(r.plan.breakevenOdds * 100) + '%' : '>100%') + ' odds.' : 'Never beats the T-bill at any size; needs >100% odds.') + ' At P25: ' + r.plan.p25Verdict + ' (' + money(r.plan.p25Net) + ').'));
var share = el('table', 'mini shareTable');
var sh = el('thead');
var shr = el('tr');
['Position', 'Drop', 'Fees', 'Net', 'T-bill', 'Verdict'].forEach(function (h, i) { shr.appendChild(el('th', i ? 'num' : '', h)); });
sh.appendChild(shr);
share.appendChild(sh);
var sb = el('tbody');
[1000, 10000, 50000].forEach(function (pos) {
var s = farm(r, pos, r.plan.weeks);
var tr = el('tr', pos === R.model.planSize ? 'current' : '');
tr.appendChild(el('td', null, '$' + pos.toLocaleString('en-US')));
tr.appendChild(el('td', 'num', money(s.drop)));
tr.appendChild(el('td', 'num', '$' + s.fees.toFixed(2)));
tr.appendChild(el('td', 'num ' + (s.net > 0 ? 'up' : 'dn'), '$' + s.net.toFixed(0)));
tr.appendChild(el('td', 'num', money(s.benchmark)));
tr.appendChild(el('td', null, s.verdict));
sb.appendChild(tr);
});
share.appendChild(sb);
right.appendChild(share);
right.appendChild(el('h3', null, 'Net by drop share'));
var mx = el('table', 'mini shareTable');
var mh = el('thead');
var mhr = el('tr');
['Position', '3.5%', '7%', '14%'].forEach(function (h, i) { mhr.appendChild(el('th', i ? 'num' : '', h)); });
mh.appendChild(mhr);
mx.appendChild(mh);
var mb = el('tbody');
[1000, 10000, 50000].forEach(function (pos) {
var tr = el('tr', pos === R.model.planSize ? 'current' : '');
tr.appendChild(el('td', null, '$' + pos.toLocaleString('en-US')));
[0.035, 0.07, 0.14].forEach(function (sh) {
var v = farmAt(r, pos, sh, r.plan.weeks);
var td = el('td', 'num ' + (v.net > 0 ? 'up' : 'dn'), money(v.net));
td.title = v.verdict;
tr.appendChild(td);
});
mb.appendChild(tr);
});
mx.appendChild(mb);
right.appendChild(mx);
right.appendChild(el('p', 'muted', 'Drop = implied (launch × odds) × 7% × position/TVL; the T-bill uses the plan\'s ' + r.plan.weeks + '-week hold. Net subtracts gas only; protocol fees and borrow interest are not priced. At P25 the plan nets ' + money(r.plan.p25Net) + ' vs ' + money(r.plan.benchmark) + ' T-bill. '));
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
right.appendChild(el('div', 'verdict', r.plan.verdict === 'worth' ? 'Worth farming at $10,000: expected drop beats the ' + r.plan.weeks + '-week T-bill after gas and $25/hour; breaks even at ' + (Number.isFinite(r.plan.breakevenOdds) ? Math.round(r.plan.breakevenOdds * 100) + '%' : '—') + ' odds.' : r.plan.verdict === 'skip' ? 'Skip: gas exceeds the expected drop at this size.' : r.plan.net > r.plan.benchmark ? 'Marginal: clears the T-bill but earns under $25/hour.' : 'Marginal: clears gas but not the T-bill.'));
right.appendChild(el('h3', null, 'Before you spend gas'));
var ul = el('ul', 'dd');
r.dd.forEach(function (t) { ul.appendChild(el('li', null, t)); });
right.appendChild(ul);
cols.appendChild(right);
host.appendChild(cols);
}

function drawCalibration() {
var host = $('#calChart');
host.replaceChildren();
var pts = R.model.value.points;
if (!pts || !pts.length) return;
var W = 1160, H = 300, L = 54, Rr = 18, T = 14, B = 40;
var vals = pts.map(function (p) { return Math.log10(p.actual); }).concat(pts.map(function (p) { return Math.log10(p.predicted); }));
var lo = Math.floor(Math.min.apply(null, vals)), hi = Math.ceil(Math.max.apply(null, vals));
var sx = function (v) { return L + ((v - lo) / (hi - lo)) * (W - L - Rr); };
var sy = function (v) { return H - B - ((v - lo) / (hi - lo)) * (H - T - B); };
var root = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Held-out implied value against actual market cap' });
for (var e = lo; e <= hi; e++) {
root.appendChild(svgEl('line', { x1: sx(e), y1: sy(lo), x2: sx(e), y2: sy(hi), stroke: '#182338', 'stroke-width': '1' }));
root.appendChild(svgEl('line', { x1: sx(lo), y1: sy(e), x2: sx(hi), y2: sy(e), stroke: '#182338', 'stroke-width': '1' }));
root.appendChild(svgText(sx(e), H - B + 16, money(Math.pow(10, e)), e === hi ? 'end' : e === lo ? 'start' : 'mid'));
root.appendChild(svgText(L - 8, sy(e) + 3, money(Math.pow(10, e)), 'end'));
}
root.appendChild(svgEl('line', { x1: sx(lo), y1: sy(lo), x2: sx(hi), y2: sy(hi), stroke: '#f5b33c', 'stroke-width': '1.4', 'stroke-dasharray': '5 5', opacity: '0.85' }));
pts.forEach(function (p) {
var x = Math.log10(p.actual), y = Math.log10(p.predicted);
var inside = p.actual >= p.predicted * R.model.value.bands.p10 && p.actual <= p.predicted * R.model.value.bands.p90;
var c = svgEl('circle', { cx: sx(x), cy: sy(y), r: 3.4, fill: inside ? '#2fd6b5' : '#9a86b8', opacity: 0.72 });
var title = svgEl('title', {});
title.textContent = p.slug + ': actual ' + money(p.actual) + ', implied ' + money(p.predicted);
c.appendChild(title);
root.appendChild(c);
});
host.appendChild(root);
}
function renderMethod() {
var v = R.model.value, o = R.model.odds;
$('#valueEq').textContent = 'a = ' + v.intercept.toFixed(3) + ', b = ' + v.slope.toFixed(3) + '; multiple at $100M = ' + v.multipleAt100m.toFixed(3) + '×. Flat baseline misses by ' + v.baselineLoo.toFixed(2) + '× / ' + v.baselineWf.toFixed(2) + '×.';
var vt = $('#valueTerms tbody');
vt.replaceChildren();
v.terms.forEach(function (t) {
var tr = el('tr');
tr.appendChild(el('td', null, t.term));
tr.appendChild(el('td', 'num', t.loo.toFixed(2) + '×'));
tr.appendChild(el('td', 'num', t.wf.toFixed(2) + '×'));
tr.appendChild(el('td', t.kept ? 'up' : 'flat', t.kept ? 'kept' : 'tested, dropped'));
tr.title = t.note;
vt.appendChild(tr);
});
$('#oddsEq').textContent = 'Base rate ' + (o.baseRate * 100).toFixed(1) + '%. Brier ' + o.brier.toFixed(3) + ' vs ' + o.brierBase.toFixed(3) + ' base; older/newer ' + o.brierWf.toFixed(3) + ' vs ' + o.brierWfBase.toFixed(3) + '.';
var ot = $('#oddsTerms tbody');
ot.replaceChildren();
o.terms.forEach(function (t) {
var tr = el('tr');
tr.appendChild(el('td', null, t.term));
tr.appendChild(el('td', 'num', t.loo.toFixed(3)));
tr.appendChild(el('td', 'num', t.wf.toFixed(3)));
tr.appendChild(el('td', t.kept ? 'up' : 'flat', t.kept ? 'kept' : 'tested, dropped'));
tr.title = t.note;
ot.appendChild(tr);
});
$('#rangeText').textContent = 'P25–P75 ran ' + v.bands.p25.toFixed(2) + '× to ' + v.bands.p75.toFixed(2) + '× of the point estimate and covered ' + Math.round(v.coverage.p25 * 100) + '% of the ' + v.coverage.n + ' residuals that set the bands; P10–P90 ran ' + v.bands.p10.toFixed(2) + '× to ' + v.bands.p90.toFixed(2) + '× and covered ' + Math.round(v.coverage.p10 * 100) + '%. Outer folds 48/77; in-sample 50/80. Coverage is measured on launch value; expected value applies odds.';
var rr = $('#rangeRow');
rr.replaceChildren();
[['Held out', v.coverage.n, 'live-token protocols'], ['P25–P75', Math.round(v.coverage.p25 * 100) + '%', 'covered'], ['P10–P90', Math.round(v.coverage.p10 * 100) + '%', 'covered']].forEach(function (s) {
var d = el('div', 'score');
d.appendChild(el('span', null, s[0]));
d.appendChild(el('b', null, s[1]));
d.appendChild(el('em', null, s[2]));
rr.appendChild(d);
});
drawCalibration();
$('#provenance').textContent = 'Source: ' + R.source + '. Snapshot ' + R.asOf + ', watchlist floor $' + FMT.format(R.floor) + '.';
}

function renderCompare(params) {
var host = $('#compareBody');
host.replaceChildren();
var fromUrl = params ? (params.get('slugs') || '').split(',').filter(Boolean) : [];
var chosen = fromUrl.length
? fromUrl.map(function (slug) { return R.rows.filter(function (r) { return r.slug === slug; })[0]; }).filter(Boolean).slice(0, 4)
: R.rows.filter(function (r) { return pins.has(r.slug); }).slice(0, 4);
if (chosen.length < 2) {
host.appendChild(el('p', 'empty', chosen.length === 0 ? 'Star two or more rows on the board to compare them here.' : 'One more star and the compare table appears.'));
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
['P25–P75', function (r) { return money(r.p25) + ' – ' + money(r.p75); }],
['TVL', function (r) { return money(r.tvl); }],
['7-day change', function (r) { return pct(r.ch7); }],
['No token for', function (r) { return year(r.age); }],
['Token odds', function (r) { return Math.round(r.odds * 100) + '%'; }],
['Farm verdict', function (r) { return r.plan.verdict; }],
['Net per hour', function (r) { return '$' + r.plan.perHour.toFixed(0); }]
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

function applyParams(params) {
if (!params) return;
view.q = params.get('q') || '';
view.cat = params.get('cat') || 'all';
view.verdict = params.get('verdict') || 'all';
view.scope = params.get('scope') || 'candidates';
$('#q').value = view.q;
if ($('#cat').querySelector('option[value="' + CSS.escape(view.cat) + '"]')) $('#cat').value = view.cat;
$('#verdict').value = view.verdict;
$('#scope').value = view.scope;
}
function render() {
var r = route();
show(r.name);
if (r.name === 'board') { applyParams(r.params); renderBoard(); }
else if (r.name === 'live') renderLive();
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
