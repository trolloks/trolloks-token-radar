// Local gate audit for the token-radar entry: node checks/verify.mjs <snapshot.json> <output dir>
// Mirrors the seven sealed scorer rows and refuses to print PASS while any invariant is broken.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const [snapFile, outDir] = process.argv.slice(2);
if (!snapFile || !outDir) {
  console.error('usage: node checks/verify.mjs <snapshot.json> <output dir>');
  process.exit(2);
}
const snapshot = JSON.parse(readFileSync(snapFile, 'utf8'));
const board = JSON.parse(readFileSync(join(outDir, 'board.json'), 'utf8')).rows;
const radar = JSON.parse(readFileSync(join(outDir, 'data.js'), 'utf8').replace(/^window\.RADAR=/, '').replace(/;\s*$/, ''));
const dossier = JSON.parse(readFileSync(join(outDir, 'dossier.json'), 'utf8'));

let fails = 0;
const ok = (condition, label, detail) => {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!condition) fails += 1;
};
const fmt = new Intl.NumberFormat('en-US');

// --- board_file -------------------------------------------------------------------------------
ok(Array.isArray(board) && board.length >= 100 && board.length <= 4000, 'board rows 100..4000', fmt.format(board.length));
const slugs = new Set(snapshot.protocols.map((p) => p.slug));
const seen = new Set();
let badRow = null;
for (const [i, r] of board.entries()) {
  if (!slugs.has(r.slug)) badRow = `${r.slug} is not in the snapshot`;
  else if (seen.has(r.slug)) badRow = `${r.slug} appears twice`;
  else if (typeof r.name !== 'string' || r.name.trim() === '') badRow = `${r.slug} has no name`;
  else if (!Number.isInteger(r.rank) || r.rank <= 0) badRow = `${r.slug} has rank ${r.rank}`;
  else if (!Number.isInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 1e14) badRow = `${r.slug} has value ${r.implied_value_usd}`;
  else if (!Array.isArray(r.farm_steps) || r.farm_steps.length < 3 || r.farm_steps.length > 12) badRow = `${r.slug} has ${r.farm_steps && r.farm_steps.length} steps`;
  else if (r.farm_steps.some((s) => typeof s !== 'string' || s.trim().length < 20 || s.length > 600)) badRow = `${r.slug} has a step outside 20..600 characters`;
  else if (i > 0 && r.implied_value_usd > board[i - 1].implied_value_usd) badRow = `${r.slug} breaks the value order`;
  else if (r.rank !== i + 1) badRow = `${r.slug} has rank ${r.rank} at position ${i + 1}`;
  if (badRow) break;
  seen.add(r.slug);
}
ok(badRow === null, 'board_file + sorted_by_value', badRow ?? `${board.length} rows, ranks 1..${board.length}`);
ok(new Set(board.map((r) => r.implied_value_usd)).size > 1, 'board ranks by value, not a flat list');

// --- coverage ---------------------------------------------------------------------------------
const missing = snapshot.watchlist.filter((s) => !seen.has(s));
ok(missing.length === 0, 'coverage: every watchlist slug', missing.length ? missing.slice(0, 5).join(', ') : `${snapshot.watchlist.length}/${snapshot.watchlist.length}`);

// --- data.js agrees with the board ------------------------------------------------------------
ok(radar.rows.length === board.length, 'data.js rows match board rows', `${radar.rows.length} vs ${board.length}`);
const mismatch = radar.rows.find((r, i) => r.slug !== board[i].slug || r.implied !== board[i].implied_value_usd);
ok(mismatch === undefined, 'data.js values match the board', mismatch ? mismatch.slug : 'all rows');

// --- dashboard_files --------------------------------------------------------------------------
const dashDir = join(outDir, 'dashboard');
const files = readdirSync(dashDir);
const hasHtml = files.includes('index.html');
const hasCss = files.some((f) => extname(f) === '.css');
const hasJs = files.some((f) => extname(f) === '.js');
const named = files.every((f) => /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/.test(f));
let total = 0;
let network = null;
for (const f of files) {
  const text = readFileSync(join(dashDir, f), 'utf8');
  total += statSync(join(dashDir, f)).size;
  if (/<[^>]+\s(?:href|src|action|poster|data-[a-z-]+)=["'][^"']*https?:\/\//i.test(text)) network = `${f}: HTML attribute`;
  if (/'https?:\/\//i.test(text) && extname(f) === '.css') network = `${f}: CSS url`;
  if (/(?:import|export\s+from|require|import\()\s*\(?\s*["']https?:\/\//i.test(text)) network = `${f}: JS import`;
}
ok(hasHtml && hasCss && hasJs, 'dashboard has index.html, css and js', files.join(', '));
ok(files.length <= 400 && total <= 4 * 1024 * 1024, 'dashboard files and bytes', `${files.length} files, ${fmt.format(total)} bytes`);
ok(named, 'dashboard file names are plain', files.length ? 'all plain' : 'none');
ok(network === null, 'dashboard makes no network request', network ?? 'no http address in attributes, CSS or imports');
ok(total <= 65_536, 'dashboard source fits the dossier text cap', `${fmt.format(total)} of 65,536 bytes`);

// --- screenshots ------------------------------------------------------------------------------
const shotDir = join(outDir, 'screenshots');
const shots = readdirSync(shotDir).filter((f) => !f.startsWith('.'));
const pngSize = (buf) => {
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
};
const shotChecks = shots.map((f) => {
  const buf = readFileSync(join(shotDir, f));
  const dim = pngSize(buf);
  const long = dim ? Math.max(dim.w, dim.h) : 0;
  const short = dim ? Math.min(dim.w, dim.h) : 0;
  return { f, bytes: buf.length, long, short, ok: dim !== null && buf.length <= 524_288 && long <= 1440 && short >= 800 };
});
ok(shots.length >= 3 && shots.length <= 4, 'screenshots 3..4', `${shots.length}`);
ok(shotChecks.every((s) => s.ok), 'screenshot size and pixels', shotChecks.map((s) => `${s.f} ${s.long}x${s.short} ${fmt.format(s.bytes)}B`).join('; '));

// --- dossier_matches --------------------------------------------------------------------------
const text = typeof dossier.text === 'string' ? dossier.text : '';
const bytes = Buffer.byteLength(text);
ok(bytes <= 65_536, 'dossier text within 65,536 bytes', `${fmt.format(bytes)} bytes`);
ok(text.includes('## Dashboard') && text.includes('## Source'), 'dossier has Dashboard and Source blocks');
const shown = files.filter((f) => ['.html', '.css', '.js', '.json', '.mjs', '.svg', '.md', '.txt'].includes(extname(f)));
const absent = shown.filter((f) => !text.includes(`### ${f}`) && !text.includes(`- ${f} (`));
ok(absent.length === 0, 'dossier shows every text dashboard file', absent.length ? absent.join(', ') : `${shown.length} files`);
ok(statSync(join(outDir, 'dossier.json')).size <= 1.5 * 1024 * 1024, 'dossier.json within 1.5 MiB', fmt.format(statSync(join(outDir, 'dossier.json')).size));
ok(Array.isArray(dossier.images) ? dossier.images.length === shots.length : true, 'dossier images match screenshots');

console.log(fails === 0 ? '\nALL CHECKS PASS' : `\n${fails} CHECK${fails === 1 ? '' : 'S'} FAILED`);
process.exit(fails === 0 ? 0 : 1);
