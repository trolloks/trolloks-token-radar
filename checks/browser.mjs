// Runtime smoke check: the dashboard must render populated views without JS errors.
// usage: node checks/browser.mjs <output dir>
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const outDir = process.argv[2];
if (!outDir) {
  console.error('usage: node checks/browser.mjs <output dir>');
  process.exit(2);
}
const chrome = process.env.CHROME || 'google-chrome';
const url = `file://${resolve(outDir, 'dashboard', 'index.html')}`;
const checks = [
  { route: '#/board', must: ['launch candidates', 'USD', 'board.json'], name: 'board' },
  { route: '#/p/xrpl-dex', must: ['XRPL DEX', 'Farm verdict', 'Watch XRPL DEX'], name: 'detail' },
  { route: '#/board?verdict=worth&scope=candidates', must: ['Worth farming', 'XRPL DEX'], name: 'filtered' },
];
let failed = 0;
for (const check of checks) {
  const r = spawnSync(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--enable-logging=stderr', '--v=0', '--virtual-time-budget=4000',
    '--user-data-dir=/tmp/opencode/browser-' + check.name,
    '--dump-dom', `${url}${check.route}`,
  ], { encoding: 'utf8', timeout: 60_000 });
  const errors = (r.stderr || '').split('\n').filter((line) => /Uncaught|TypeError|ReferenceError|SyntaxError/.test(line));
  const missing = check.must.filter((text) => !(r.stdout || '').includes(text));
  const pass = r.status === 0 && errors.length === 0 && missing.length === 0;
  console.log(`${pass ? 'PASS' : 'FAIL'} browser ${check.name}${missmissing(errors, missing)}`);
  if (!pass) failed += 1;
}
console.log(failed === 0 ? '\nBROWSER CHECKS PASS' : `\n${failed} BROWSER CHECK${failed === 1 ? '' : 'S'} FAILED`);
process.exit(failed === 0 ? 0 : 1);

function missmissing(errors, missing) {
  const parts = [];
  if (errors.length) parts.push(errors[0].slice(0, 160));
  if (missing.length) parts.push('missing ' + missing.join(', '));
  return parts.length ? ` — ${parts.join('; ')}` : '';
}
