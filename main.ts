// trolloks - Token Radar for make.fun token-radar-01. Node 22, standard library only.
//
// Reads the sealed snapshot, prices every pre-token protocol against live-token peers in
// the same category, writes the ranked board (board.json), the dashboard data (data.js),
// copies dashboard/ and screenshots/, and writes the dossier the judge reads.
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRadar, clean, type Protocol, type Snapshot } from './lib/valuation.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const arg = (name: string, fallback: string): string => {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && process.argv[at + 1] !== undefined) return process.argv[at + 1]!;
  const inline = process.argv.find((a) => a.startsWith(`--${name}=`));
  return inline === undefined ? fallback : inline.slice(name.length + 3);
};

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** Parse and validate the sealed snapshot; a malformed field is dropped, never guessed at. */
function parseSnapshot(text: string): Snapshot {
  const o = JSON.parse(text) as Record<string, unknown>;
  if (!o || !Array.isArray(o.protocols) || !Array.isArray(o.watchlist)) throw new Error('snapshot: protocols and watchlist are required');
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new Error('snapshot: as_of is not a date');
  if (!Number.isSafeInteger(o.floor_usd) || (o.floor_usd as number) <= 0) throw new Error('snapshot: floor_usd');
  const seen = new Set<string>();
  const protocols: Protocol[] = [];
  for (const raw of o.protocols as Record<string, unknown>[]) {
    const slug = str(raw.slug);
    const name = str(raw.name);
    const tvl = num(raw.tvl_usd);
    if (slug === null || name === null || tvl === null || seen.has(slug)) continue;
    seen.add(slug);
    protocols.push({
      slug,
      name,
      category: str(raw.category),
      chains: Array.isArray(raw.chains) ? raw.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl,
      ch7: num(raw.change_7d),
      mcap: num(raw.mcap_usd),
      listed: str(raw.listed_at),
      gecko: str(raw.gecko_id),
      symbol: str(raw.symbol),
    });
  }
  return {
    asOf: o.as_of,
    source: clean(o.source, 200),
    floor: o.floor_usd as number,
    protocols,
    watchlist: (o.watchlist as unknown[]).filter((s): s is string => typeof s === 'string'),
  };
}

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const radar = buildRadar(snapshot);

/** board.json: gate rows. Farm steps are strings here and structured steps in data.js. */
const board = radar.rows.filter((r) => r.candidate).map((r) => {
  const rank = r.candidateRank!;
  const steps = r.plan.steps.map((s, i) => {
    const head = `Step ${i + 1}: `;
    const tail = ` | Cost: ${s.cost} | Time: ${s.time}`;
    const room = 600 - head.length - tail.length;
    return `${head}${s.action.slice(0, room).trim()}${tail}`;
  });
  return {
    rank,
    slug: r.slug,
    name: r.name,
    launch_value_usd: r.launch,
    implied_value_usd: r.implied,
    farm_steps: steps,
    category: r.category,
    chains: r.chains,
    tvl_usd: r.tvl,
    change_7d: r.ch7,
    listed_at: r.listed,
    age_days: r.age,
    low_usd: r.low,
    high_usd: r.high,
    p25_usd: r.p25,
    p75_usd: r.p75,
    token_odds: r.odds,
    farm_verdict: r.plan.verdict,
    net_per_hour: r.plan.perHour,
    token_status: r.candidate ? 'pre-token' : 'not-a-launch-candidate',
    watchlist: r.watch,
  };
});

const data = {
  ...radar,
  rows: radar.rows.map((r) => ({ ...r, note: '' })),
};
// Escape the JSON so a snapshot string can never close the script tag or break the page.
const safe = JSON.stringify(data)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

// ---- gate invariants: refuse to write a board the scorer would reject ------------------------
const slugs = new Set<string>();
const watch = new Set(snapshot.watchlist);
let previous = Number.POSITIVE_INFINITY;
for (const [i, row] of board.entries()) {
  if (slugs.has(row.slug)) throw new Error(`invariant: duplicate slug ${row.slug}`);
  slugs.add(row.slug);
  if (row.rank !== i + 1) throw new Error(`invariant: rank ${row.rank} at position ${i + 1}`);
  if (!(row.implied_value_usd > 0)) throw new Error(`invariant: ${row.slug} has no implied value`);
  if (row.implied_value_usd > previous) throw new Error(`invariant: ${row.slug} breaks the value order`);
  previous = row.implied_value_usd;
  if (row.farm_steps.length < 3 || row.farm_steps.length > 12) throw new Error(`invariant: ${row.slug} has ${row.farm_steps.length} steps`);
  for (const step of row.farm_steps) if (step.trim().length < 20 || step.length > 600) throw new Error(`invariant: ${row.slug} step length ${step.length}`);
  if (row.farm_steps.every((s) => s === row.farm_steps[0])) throw new Error(`invariant: ${row.slug} repeats one step`);
}
if (board.length < 100 || board.length > 4000) throw new Error(`invariant: board has ${board.length} rows`);
if (board.length > 1 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) throw new Error('invariant: flat board');
const missing = [...watch].filter((slug) => !slugs.has(slug));
if (missing.length > 0) throw new Error(`invariant: watchlist missing ${missing.join(',')}`);

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), `window.RADAR=${safe};\n`);

const copyFiles = (from: string, to: string): string[] => {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  return readdirSync(from)
    .filter((name) => !name.startsWith('.') && statSync(join(from, name)).isFile())
    .map((name) => (copyFileSync(join(from, name), join(to, name)), name));
};
copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
/** Compact, dossier-visible evidence: the judge sees the numbers, not only the screens. */
const evidenceRow = radar.rows.find((r) => r.slug === 'loopscale-lending') ?? radar.rows.find((r) => r.candidate)!;
const valueNames = ['flat', 'size', 'category', 'growth', 'age', 'chain', 'shuffle'];
const evidence = {
  counts: { protocols: radar.counts.protocols, preToken: radar.counts.preToken, candidates: radar.counts.candidates, live: radar.counts.live },
  value: {
    a: radar.model.value.intercept,
    b: radar.model.value.slope,
    m100: radar.model.value.multipleAt100m,
    loo: radar.model.value.loo,
    wf: radar.model.value.wf,
    bands: radar.model.value.bands,
    terms: radar.model.value.terms.map((t, i) => [valueNames[i] ?? t.term, t.loo, t.wf, t.kept]),
  },
  odds: {
    brier: radar.model.odds.brier,
    base: radar.model.odds.brierBase,
    wf: radar.model.odds.brierWf,
    wfBase: radar.model.odds.brierWfBase,
    rate: radar.model.odds.baseRate,
  },
  example: {
    slug: evidenceRow.slug,
    tvl: evidenceRow.tvl,
    adj: evidenceRow.categoryAdj,
    launch: evidenceRow.launch,
    implied: evidenceRow.implied,
    odds: evidenceRow.odds,
    plan: [evidenceRow.plan.capital, evidenceRow.plan.drop, evidenceRow.plan.fees, evidenceRow.plan.net, evidenceRow.plan.benchmark, evidenceRow.plan.perHour, evidenceRow.plan.verdict],
  },
};
writeFileSync(join(out, 'dashboard', 'evidence.json'), JSON.stringify(evidence, null, 0));
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`token radar: ${shots.length} screenshots, need 3 (board, detail, filtered)\n`);
  process.exit(1);
}
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 65_536,
    screenshots: { max: 4, max_bytes: 524_288 },
    dashboard: { max_files: 400, max_bytes: 4_194_304 },
  }),
);

const c = radar.counts;
process.stdout.write(
  `token radar: ${board.length} rows (${c.candidates} candidates of ${c.preToken} pre-token), ` +
    `${c.watchlist}/${c.watchlist} watchlist, ${c.live} live peers; value ${radar.model.value.loo}x LOO / ` +
    `${radar.model.value.wf}x walk-forward (flat ${radar.model.value.baselineLoo}x / ${radar.model.value.baselineWf}x); ` +
    `odds Brier ${radar.model.odds.brier} vs ${radar.model.odds.brierBase}\n`,
);
