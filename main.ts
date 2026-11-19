// trolloks - Token Radar for make.fun token-radar-01. Node, standard library only.
// Reads the snapshot, values pre-token protocols against LIVE peers' market-cap/TVL ratios in the same
// category, writes board.json, data.js, the dashboard, screenshots and dossier.json.
//   MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const arg = (n: string, d: string): string => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1]! : d;
};
const inArg = arg('input', '/input');
const inFile = inArg.endsWith('.json') ? inArg : join(inArg, 'snapshot.json');
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
if (!existsSync(inFile)) { process.stderr.write(`no snapshot at ${inFile}\n`); process.exit(2); }

interface P { slug: string; name: string; category: string | null; chains: string[]; tvl_usd: number; change_7d: number | null; mcap_usd: number | null; listed_at: string | null; gecko_id: string | null; symbol: string | null }

/** Strip control/bidi characters and cap length: snapshot strings are data, never markup. */
const clean = (s: unknown, max = 80): string => String(s ?? '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, ' ').trim().slice(0, max);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function load(): { as_of: string; source: string; floor: number; ps: P[]; watch: string[] } {
  const o = JSON.parse(readFileSync(inFile, 'utf8'));
  if (!o || !Array.isArray(o.protocols) || !Array.isArray(o.watchlist) || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of) || !Number.isSafeInteger(o.floor_usd)) throw new Error('bad snapshot');
  const seen = new Set<string>();
  const ps: P[] = [];
  for (const r of o.protocols) {
    if (!r || typeof r.slug !== 'string' || typeof r.name !== 'string' || num(r.tvl_usd) === null || seen.has(r.slug)) continue;
    seen.add(r.slug);
    ps.push({
      slug: r.slug, name: r.name, category: typeof r.category === 'string' ? r.category : null,
      chains: Array.isArray(r.chains) ? r.chains.filter((c: unknown) => typeof c === 'string') : [],
      tvl_usd: r.tvl_usd, change_7d: num(r.change_7d), mcap_usd: num(r.mcap_usd),
      listed_at: typeof r.listed_at === 'string' ? r.listed_at : null,
      gecko_id: typeof r.gecko_id === 'string' ? r.gecko_id : null, symbol: typeof r.symbol === 'string' ? r.symbol : null,
    });
  }
  return { as_of: o.as_of, source: clean(o.source, 200), floor: o.floor_usd, ps, watch: o.watchlist.filter((s: unknown) => typeof s === 'string') };
}

// ---- eligibility -------------------------------------------------------------------------------
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPER = /\b(wrapped|wrapper|bridged|receipt)\b|^(binance|coinbase|bybit|okx|bitget|kraken|kucoin|crypto\.com)\b/i;
/** Pre-token: the index records no token at all. Any mcap, gecko id or symbol means a live token. */
const preToken = (p: P): boolean => p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
const isLive = (p: P): boolean => !preToken(p) && p.category !== 'CEX';
/** Early candidates: pre-token, no exchange, no versioned pool, no wrapper/receipt of another asset. */
const earlyOk = (p: P): boolean => preToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name) && !WRAPPER.test(p.name);

// ---- model -------------------------------------------------------------------------------------
const quant = (a: number[], q: number): number => {
  const s = [...a].sort((x, y) => x - y);
  if (s.length === 0) return NaN;
  const i = (s.length - 1) * q, lo = Math.floor(i);
  return s[lo]! + (s[Math.min(lo + 1, s.length - 1)]! - s[lo]!) * (i - lo);
};
const MIN_PEERS = 5;
const SHRINK = 5;
const GROWTH_WEIGHT = 0.3;
const DAY = 86_400_000;
const round = (n: number, d = 4): number => Math.round(n * 10 ** d) / 10 ** d;

function build(s: ReturnType<typeof load>) {
  const live = s.ps.filter((p) => isLive(p) && (p.mcap_usd ?? 0) > 0 && p.tvl_usd > 0);
  const ratios = (ps: P[]) => ps.map((p) => p.mcap_usd! / p.tvl_usd);
  const all = ratios(live);
  const gMed = quant(all, 0.5);
  const byCat = new Map<string, P[]>();
  for (const p of live) byCat.set(p.category ?? '', [...(byCat.get(p.category ?? '') ?? []), p]);

  const index = new Map(s.ps.map((p) => [p.slug, p]));
  const chosen = new Map<string, P>();
  for (const w of s.watch) { const p = index.get(w); if (p) chosen.set(w, p); }
  s.ps.filter((p) => !chosen.has(p.slug) && earlyOk(p) && p.tvl_usd < s.floor)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1)).slice(0, 160).forEach((p) => chosen.set(p.slug, p));

  const preByCat = new Map<string, number>();
  for (const p of chosen.values()) preByCat.set(p.category ?? '', (preByCat.get(p.category ?? '') ?? 0) + 1);

  const scored = [...chosen.values()].map((p) => {
    const peers = byCat.get(p.category ?? '') ?? [];
    const r = ratios(peers);
    const n = r.length;
    const catMed = n ? quant(r, 0.5) : gMed;
    const w = n / (n + SHRINK);
    const med = Math.min(3, Math.max(0.03, catMed * w + gMed * (1 - w)));
    const spreadLo = n >= 3 ? quant(r, 0.25) / catMed : 0.35;
    const spreadHi = n >= 3 ? quant(r, 0.75) / catMed : 2.5;
    const age = p.listed_at && Number.isFinite(Date.parse(p.listed_at)) ? Math.max(0, Math.floor((Date.parse(`${s.as_of}T00:00:00Z`) - Date.parse(`${p.listed_at}T00:00:00Z`)) / DAY)) : null;
    const growth = Math.min(120, Math.max(-60, p.change_7d ?? 0));
    const gm = 1 + (growth / 100) * GROWTH_WEIGHT;
    const mm = 0.6 + (Math.min(age ?? 365, 1095) / 1095) * 0.4;
    const implied = Math.max(1, Math.round(p.tvl_usd * med * gm * mm));
    // Deliberately wide band: peer interquartile spread, then widened for thin peer sets and unknown age.
    const widen = 1 + (n < MIN_PEERS ? 0.5 : 0) + (age === null ? 0.25 : age < 180 ? 0.25 : 0);
    const low = Math.max(1, Math.round((implied * Math.min(1, spreadLo)) / (1.6 * widen)));
    const high = Math.round(implied * Math.max(1, spreadHi) * 1.6 * widen);
    const conf = n >= 15 && age !== null && age >= 365 ? 'moderate' : n >= MIN_PEERS ? 'low' : 'very low';
    return { p, n, catMed, med, gm, mm, growth, age, implied, low, high, conf, pre: preByCat.get(p.category ?? '') ?? 0 };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : 1));
  return { scored, live, gMed, gN: all.length };
}

// ---- protocol-specific due diligence -----------------------------------------------------------
const DD: [RegExp, string[]][] = [
  [/lend|cdp|borrow|collateral/i, ['Read the liquidation and bad-debt history; ask who sets oracle and collateral parameters.', 'Check utilisation and the top borrowers: is TVL real supply or recursive looping?', 'Confirm whether admin keys can change risk parameters, and the timelock length.']],
  [/dex|amm|swap/i, ['Split volume from incentives: how much TVL leaves when rewards stop?', 'Check pool concentration and whether liquidity is mercenary or protocol-owned.', 'Look for wash-trading signals: volume far above fees earned.']],
  [/liquid staking|staking|restak/i, ['Review validator or operator set concentration and slashing coverage.', 'Check the redemption path and the receipt token\'s peg history under stress.', 'Is the receipt token a wrapper of an asset you already hold? That is not a separate token upside.']],
  [/bridge/i, ['Find the trust model: multisig, light client or optimistic? Who holds upgrade keys?', 'Check audit scope and past exploit history of this and similar bridges.', 'TVL is locked custody, not usage; compare to monthly transfer volume.']],
  [/yield|aggregator|vault|farm/i, ['Trace where the yield comes from: fees, emissions or leverage?', 'List the underlying protocols; every layer adds smart-contract risk.', 'Check withdrawal limits and strategy-change permissions.']],
  [/rwa|real/i, ['Identify the issuer, custodian and legal wrapper; onchain TVL can be an offchain claim.', 'Check redemption terms and whether transfers are allow-listed (KYC).', 'Token airdrops are unlikely for issuer-controlled assets; verify before spending.']],
  [/deriv|perp|option|basis/i, ['Check insurance fund size, ADL rules and oracle design.', 'Open interest versus TVL tells you if the book is real; look for one dominant market maker.', 'Review jurisdiction notices that could restrict users.']],
  [/curator|allocator/i, ['Look at the curator\'s track record, fee and which markets it can allocate into.', 'TVL belongs to underlying lenders; a curator may never issue its own token.', 'Check timelocks on allocation changes and the cap per market.']],
  [/stable/i, ['Read the collateral backing and peg-defence mechanism.', 'Check depeg history and redemption liquidity.', 'Note issuer freeze powers.']],
  [/insur|cover/i, ['Check claims history and how payouts are decided.', 'Capacity versus TVL: is cover actually purchased?']],
  [/predict|gaming|nft|social/i, ['Check volume vs. TVL; activity, not deposits, drives value here.', 'Verify oracle/resolution mechanics and creator-fee permissions.']],
];
const GENERIC = ['Find the official docs and audits; absence of both is a strong negative.', 'Check who controls upgradeable contracts and whether a timelock exists.', 'Look at TVL history: a one-week spike plus a large 7d change is often incentives.'];
const dd = (p: P, age: number | null, n: number): string[] => {
  const hit = DD.find(([re]) => re.test(p.category ?? ''));
  const items = [...(hit ? hit[1] : GENERIC)];
  if (age !== null && age < 120) items.push(`Only ${age} days old: little history; treat any airdrop expectation as speculation.`);
  if (age === null) items.push('Listing date unknown: age is assumed 365 days and the range is widened.');
  if (p.chains.length === 1) items.push(`Single-chain (${clean(p.chains[0], 30)}): chain-level outages and bridge dependence apply.`);
  if (n < MIN_PEERS) items.push(`Only ${n} live-token peers in this category: the multiple leans on the all-market median.`);
  if ((p.change_7d ?? 0) > 60) items.push('7d TVL jump above 60%: check for a temporary incentive or a single large deposit.');
  return items;
};

const steps = (p: P, age: number | null): string[] => {
  const chain = clean(p.chains[0] ?? 'its main chain', 30), name = clean(p.name, 50);
  const cap = p.tvl_usd >= 1e9 ? 150 : p.tvl_usd >= 1e8 ? 100 : 50;
  const hold = age !== null && age < 180 ? 60 : 30;
  return [
    `Use a fresh wallet holding only farm funds and keep the seed offline. Cost: under $3 gas. Time: 5 minutes.`,
    `Deposit about $${cap} into ${name} on ${chain} through its official app only. Cost: $${cap} capital plus ~$5 gas. Time: 15 minutes.`,
    `Make one genuine action a week (deposit, swap, borrow or vote); no volume farming. Cost: ~$2 gas a week. Time: 10 minutes a week.`,
    `Hold the position for ${hold} days so it spans several snapshots. Cost: capital stays deployed. Time: ${hold} days.`,
    `Never sign claim links from DMs; verify any rewards page from the protocol's own site. Cost: nothing. Time: 10 minutes.`,
    `Keep a log of wallet, dates and transactions to unwind cleanly. Cost: nothing. Time: 5 minutes.`,
  ];
};

// ---- run ---------------------------------------------------------------------------------------
const snap = load();
const { scored, live, gMed, gN } = build(snap);
const board = scored.map((s, i) => ({
  rank: i + 1, slug: s.p.slug, name: s.p.name, category: s.p.category, chains: s.p.chains, tvl_usd: s.p.tvl_usd,
  change_7d: s.p.change_7d, mcap_usd: s.p.mcap_usd, listed_at: s.p.listed_at, gecko_id: s.p.gecko_id, symbol: s.p.symbol,
  token_status: 'pre-token' as const, age_days: s.age, implied_value_usd: s.implied,
  model: { base_multiple: round(s.med), growth_pct: s.growth, growth_multiplier: round(s.gm), maturity_multiplier: round(s.mm), age_days: s.age },
  farm_steps: steps(s.p, s.age),
}));
// gate checks
const wset = new Set(board.map((r) => r.slug));
const missing = snap.watch.filter((w) => snap.ps.some((p) => p.slug === w) && !wset.has(w));
if (missing.length) throw new Error(`watchlist missing: ${missing.join(',')}`);
if (board.length > 1 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) throw new Error('flat board');
for (const r of board) for (const t of r.farm_steps) if (t.length < 20 || t.length > 600) throw new Error(`step length ${r.slug}`);

const wl = new Set(snap.watch);
const radar = {
  as_of: snap.as_of, source: snap.source, floor_usd: snap.floor, model_version: 'trolloks-peer-1',
  model: { global_median_ratio: round(gMed), live_peers: gN, min_peers: MIN_PEERS, shrink: SHRINK, growth_weight: GROWTH_WEIGHT },
  watchlist_size: snap.watch.length, board_size: board.length, early_size: board.filter((r) => !wl.has(r.slug)).length,
  live_size: live.length,
  rows: scored.map((s, i) => ({
    rank: i + 1, slug: clean(s.p.slug, 100), name: clean(s.p.name), category: s.p.category === null ? null : clean(s.p.category, 50),
    chains: s.p.chains.slice(0, 12).map((c) => clean(c, 30)), tvl: s.p.tvl_usd, ch7: s.p.change_7d, listed: s.p.listed_at === null ? null : clean(s.p.listed_at, 10),
    age: s.age, implied: s.implied, low: s.low, high: s.high, ratio: round(s.med), cat_ratio: Number.isNaN(s.catMed) ? null : round(s.catMed),
    peers: s.n, pre_peers: s.pre, conf: s.conf, gm: round(s.gm), mm: round(s.mm), watch: wl.has(s.p.slug), dd: dd(s.p, s.age, s.n).map((t) => clean(t, 240)),
    steps: steps(s.p, s.age).map((t) => clean(t, 600)),
  })),
  live: live.sort((a, b) => b.mcap_usd! - a.mcap_usd!).slice(0, 40).map((p) => ({
    slug: clean(p.slug, 100), name: clean(p.name), category: p.category === null ? null : clean(p.category, 50), tvl: p.tvl_usd, mcap: p.mcap_usd, ch7: p.change_7d, ratio: round(p.mcap_usd! / p.tvl_usd),
  })),
};
const safeJs = JSON.stringify(radar).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), `window.RADAR=${safeJs};\n`);

const copyFiles = (from: string, to: string): string[] => {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  return readdirSync(from).filter((n) => !n.startsWith('.') && statSync(join(from, n)).isFile()).map((n) => (copyFileSync(join(from, n), join(to, n)), n));
};
copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) { process.stderr.write('need 3 screenshots\n'); process.exit(1); }
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: 65_536, screenshots: { max: 4, max_bytes: 524_288 }, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));
process.stdout.write(`trolloks: ${board.length} rows (${radar.early_size} early), ${live.length} live peers, global mcap/TVL median ${round(gMed)}\n`);
