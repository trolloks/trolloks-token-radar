// Valuation engine for the make.fun token-radar-01 entry.
//
// One snapshot, one model:
//   implied value = TVL x shrunk category multiple x growth x maturity
// The category multiple is the geometric median market-cap/TVL of live-token peers in
// the same category, shrunk toward the all-market median with 5 pseudo-peers. Growth and
// maturity are the snapshot's own 7-day TVL change and the days since DefiLlama listed
// the protocol. The 80% band is calibrated on held-out residuals, not asserted.

export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl: number;
  ch7: number | null;
  mcap: number | null;
  listed: string | null;
  gecko: string | null;
  symbol: string | null;
}

export interface Snapshot {
  asOf: string;
  source: string;
  floor: number;
  protocols: Protocol[];
  watchlist: string[];
}

export interface PlanStep {
  action: string;
  cost: string;
  time: string;
}

export interface CalibrationBucket {
  bucket: 'high' | 'medium' | 'low';
  n: number;
  low: number;
  high: number;
  coverage: number;
  medianFactor: number;
  within2x: number;
}

export interface CategoryCheck {
  name: string;
  n: number;
  medianMultiple: number;
  medianFactor: number;
}

export interface ModelCheck {
  folds: number;
  n: number;
  spearman: number;
  medianFactor: number;
  within2x: number;
  buckets: CalibrationBucket[];
  categories: CategoryCheck[];
  walkForward: {
    n: number;
    medianFactor: number;
    spearman: number;
    coverage: number;
  };
}

export interface Row {
  rank: number;
  candidateRank: number | null;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl: number;
  ch7: number | null;
  listed: string | null;
  age: number | null;
  implied: number;
  low: number;
  high: number;
  multiple: number;
  peers: number;
  confidence: 'high' | 'medium' | 'low';
  watch: boolean;
  candidate: boolean;
  whyNot: string | null;
  terms: {
    peerMultiple: number;
    categoryMedian: number | null;
    globalMedian: number;
    shrinkage: number;
    growth: number;
    maturity: number;
  };
  bandCoverage: number;
  dd: string[];
  plan: {
    steps: PlanStep[];
    capital: number;
    gas: number;
    hours: number;
    weeks: number;
    gasPerHour: number;
    verdict: string;
  };
  note: string;
}

export interface LivePeer {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl: number;
  mcap: number;
  ch7: number | null;
  multiple: number;
  age: number | null;
}

export interface Radar {
  asOf: string;
  source: string;
  floor: number;
  model: {
    name: string;
    formula: string;
    growthWeight: number;
    maturityFloor: number;
    maturityDays: number;
    shrinkPeers: number;
    globalMedian: number;
    livePeers: number;
    check: ModelCheck;
  };
  counts: {
    protocols: number;
    preToken: number;
    watchlist: number;
    watchlistCovered: number;
    candidates: number;
    live: number;
    unpriced: number;
    excludedBridge: number;
    excludedCex: number;
    excludedProduct: number;
  };
  rows: Row[];
  live: LivePeer[];
}

const DAY = 86_400_000;
const GROWTH_WEIGHT = 0.3;
const MATURITY_FLOOR = 0.6;
const MATURITY_DAYS = 1095;
const SHRINK_PEERS = 5;
const FOLDS = 5;

export const clean = (s: unknown, max = 80): string =>
  String(s ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, ' ')
    .trim()
    .slice(0, max);

const quantile = (values: number[], q: number): number => {
  const s = [...values].sort((a, b) => a - b);
  if (s.length === 0) return NaN;
  const at = (s.length - 1) * q;
  const lo = Math.floor(at);
  const hi = Math.min(lo + 1, s.length - 1);
  return s[lo]! + (s[hi]! - s[lo]!) * (at - lo);
};

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const median = (a: number[]): number => quantile(a, 0.5);
const round = (n: number, d = 4): number => Math.round(n * 10 ** d) / 10 ** d;

/** Age in whole days from the snapshot's own date; null when DefiLlama records no listing. */
export const ageDays = (p: Protocol, asOf: string): number | null => {
  if (p.listed === null) return null;
  const a = Date.parse(`${p.listed}T00:00:00Z`);
  const b = Date.parse(`${asOf}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.floor((b - a) / DAY)) : null;
};

export const isPreToken = (p: Protocol): boolean => p.mcap === null && p.gecko === null && p.symbol === null;

const EXCLUDED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);
const EXCHANGE_PREFIX = /^(binance|coinbase|bybit|okx|bitget|kraken|bitfinex|gemini|bingx|bigone)\b/i;
const WRAPPED = /\b(wrapped|staked|staking|bridged|receipt)\b/i;
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const KNOWN_WRAPPERS = /^(wbtc|usdt0|weth|wsteth|wbeth|cbeth)$/i;

/** Why a pre-token record is not a launch candidate, or null when it is one. */
export const exclusion = (p: Protocol): string | null => {
  const category = p.category ?? '';
  if (EXCLUDED_CATEGORIES.has(category)) {
    return category === 'CEX'
      ? 'exchange balance sheet, not a protocol that issues its own token'
      : `${category} TVL is a receipt or custody of an asset whose token already trades`;
  }
  if (EXCHANGE_PREFIX.test(p.name)) return 'exchange-branded product of a live token';
  if (KNOWN_WRAPPERS.test(p.name)) return 'wrapped or bridged product of a live token';
  if (WRAPPED.test(p.name)) return 'wrapped or staked product of a live token';
  if (VERSIONED.test(p.name)) return 'versioned pool of another protocol';
  return null;
};

interface Model {
  globalLog: number;
  byCategory: Map<string, number[]>;
  predict: (p: Protocol) => number;
  peers: (p: Protocol) => number;
  categoryMultiple: (p: Protocol) => number | null;
}

const fitModel = (live: Protocol[]): Model => {
  const byCategory = new Map<string, number[]>();
  for (const p of live) {
    const key = p.category ?? '';
    const list = byCategory.get(key) ?? [];
    list.push(Math.log(p.mcap! / p.tvl));
    byCategory.set(key, list);
  }
  const globalLog = byCategory.size === 0 ? Math.log(0.25) : median([...byCategory.values()].flat());

  const peers = (p: Protocol): number => (byCategory.get(p.category ?? '') ?? []).length;
  const categoryLog = (p: Protocol): number => {
    const list = byCategory.get(p.category ?? '') ?? [];
    const n = list.length;
    const own = n === 0 ? globalLog : median(list);
    const w = n / (n + SHRINK_PEERS);
    return own * w + globalLog * (1 - w);
  };
  const predict = (p: Protocol): number => {
    const base = Math.exp(categoryLog(p));
    const growth = Math.exp((GROWTH_WEIGHT * clamp(p.ch7 ?? 0, -60, 120)) / 100);
    const age = ageDays(p, AS_OF_CACHE) ?? 365;
    const maturity = MATURITY_FLOOR + (Math.min(age, MATURITY_DAYS) / MATURITY_DAYS) * (1 - MATURITY_FLOOR);
    return p.tvl * base * growth * maturity;
  };
  return { globalLog, byCategory, predict, peers, categoryMultiple: (p) => Math.exp(categoryLog(p)) };
};

// The snapshot's date is threaded through build(); the model only needs it for age.
let AS_OF_CACHE = '1970-01-01';

const bucketOf = (peers: number, age: number | null): 'high' | 'medium' | 'low' =>
  peers >= 10 && age !== null && age >= 365 ? 'high' : peers >= 5 ? 'medium' : 'low';

interface Residual {
  bucket: 'high' | 'medium' | 'low';
  category: string;
  d: number;
  factor: number;
  predicted: number;
  actual: number;
  tvl: number;
}

const spearman = (a: number[], b: number[]): number => {
  const ranks = (v: number[]): number[] => {
    const order = [...v.keys()].sort((i, j) => v[i]! - v[j]!);
    const out = Array<number>(v.length);
    order.forEach((index, k) => (out[index] = k));
    return out;
  };
  const ra = ranks(a);
  const rb = ranks(b);
  const n = a.length;
  const mean = (n - 1) / 2;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (ra[i]! - mean) * (rb[i]! - mean);
    da += (ra[i]! - mean) ** 2;
    db += (rb[i]! - mean) ** 2;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
};

const crossValidate = (live: Protocol[]): ModelCheck => {
  const residuals: Residual[] = [];
  for (let fold = 0; fold < FOLDS; fold++) {
    const train = live.filter((_, i) => i % FOLDS !== fold);
    const test = live.filter((_, i) => i % FOLDS === fold);
    if (train.length === 0) continue;
    const model = fitModel(train);
    for (const p of test) {
      const predicted = model.predict(p);
      if (!(predicted > 0) || !(p.mcap! > 0)) continue;
      residuals.push({
        bucket: bucketOf(model.peers(p), ageDays(p, AS_OF_CACHE)),
        category: p.category ?? '',
        d: Math.log(p.mcap! / predicted),
        factor: Math.max(predicted / p.mcap!, p.mcap! / predicted),
        predicted,
        actual: p.mcap!,
        tvl: p.tvl,
      });
    }
  }
  const buckets: CalibrationBucket[] = (['high', 'medium', 'low'] as const).map((bucket) => {
    const list = residuals.filter((r) => r.bucket === bucket);
    const d = list.map((r) => r.d);
    const low = list.length >= 5 ? quantile(d, 0.1) : quantile(residuals.map((r) => r.d), 0.1);
    const high = list.length >= 5 ? quantile(d, 0.9) : quantile(residuals.map((r) => r.d), 0.9);
    return {
      bucket,
      n: list.length,
      low: round(Math.exp(low), 4),
      high: round(Math.exp(high), 4),
      coverage: list.length ? round(list.filter((r) => r.d >= low && r.d <= high).length / list.length, 4) : 0,
      medianFactor: list.length ? round(median(list.map((r) => r.factor)), 3) : 0,
      within2x: list.length ? round(list.filter((r) => r.factor <= 2).length / list.length, 4) : 0,
    };
  });
  const byCategory = new Map<string, Residual[]>();
  for (const r of residuals) byCategory.set(r.category, [...(byCategory.get(r.category) ?? []), r]);
  const categories: CategoryCheck[] = [...byCategory.entries()]
    .filter(([, list]) => list.length >= 5)
    .map(([name, list]) => ({
      name: clean(name || 'Uncategorised', 50),
      n: list.length,
      medianMultiple: round(Math.exp(median(list.map((r) => Math.log(r.actual / r.tvl)))), 3),
      medianFactor: round(median(list.map((r) => r.factor)), 3),
    }))
    .sort((a, b) => b.n - a.n);
  // Walk-forward: fit the older 70% of dated live tokens, price the newer 30% it never saw.
  const dated = live.filter((p) => ageDays(p, AS_OF_CACHE) !== null).sort((a, b) => (ageDays(b, AS_OF_CACHE) ?? 0) - (ageDays(a, AS_OF_CACHE) ?? 0));
  const cut = Math.floor(dated.length * 0.7);
  const earlier = dated.slice(0, cut);
  const later = dated.slice(cut);
  const forwardModel = earlier.length > 0 ? fitModel(earlier) : null;
  const forward = later
    .map((p) => {
      const predicted = forwardModel!.predict(p);
      return predicted > 0 && p.mcap! > 0 ? { predicted, actual: p.mcap!, d: Math.log(p.mcap! / predicted), factor: Math.max(predicted / p.mcap!, p.mcap! / predicted) } : null;
    })
    .filter((x): x is { predicted: number; actual: number; d: number; factor: number } => x !== null);
  const forwardBand = bucketBand(buckets, 'medium');
  const walkForward = {
    n: forward.length,
    medianFactor: forward.length ? round(median(forward.map((r) => r.factor)), 3) : 0,
    spearman: forward.length ? round(spearman(forward.map((r) => r.predicted), forward.map((r) => r.actual)), 3) : 0,
    coverage: forward.length ? round(forward.filter((r) => r.d >= Math.log(forwardBand.low) && r.d <= Math.log(forwardBand.high)).length / forward.length, 4) : 0,
  };

  return {
    folds: FOLDS,
    n: residuals.length,
    spearman: round(spearman(residuals.map((r) => r.predicted), residuals.map((r) => r.actual)), 3),
    medianFactor: round(median(residuals.map((r) => r.factor)), 3),
    within2x: round(residuals.filter((r) => r.factor <= 2).length / Math.max(1, residuals.length), 4),
    buckets,
    categories,
    walkForward,
  };
};

const bucketBand = (buckets: CalibrationBucket[], bucket: 'high' | 'medium' | 'low') => {
  const found = buckets.find((b) => b.bucket === bucket);
  return found ?? { low: 0.08, high: 14, coverage: 0.8 };
};

const CATEGORY_ACTION: [RegExp, string][] = [
  [/lend|cdp|borrow|collateral|stable/i, 'Supply USDC (or the chain native stable) and borrow USDT against it at 50% LTV or less'],
  [/dex|amm|swap/i, 'Provide liquidity in the deepest USDC pair and stake the LP receipt if the protocol allows'],
  [/liquid staking|staking|restak/i, 'Stake the chain native asset (ETH, SOL or the listed asset) and hold the receipt token'],
  [/bridge|canonical|cross chain/i, 'Bridge USDC in, do one swap, then bridge the remainder back so both directions register'],
  [/yield|aggregator|vault|farm/i, 'Deposit USDC into the flagship vault, not the highest advertised APY, and read the fee'],
  [/rwa|real/i, 'Complete the allow-list check and mint the smallest permitted USDC position'],
  [/deriv|perp|option|basis/i, 'Open and close a small hedged BTC or ETH position at 2x leverage or less'],
  [/curator|allocator/i, 'Deposit USDC into the curator vault with the longest track record and a published fee'],
  [/predict|gaming|nft|social/i, 'Take one real position in a liquid market with USDC, not a wash trade'],
  [/insur|cover/i, 'Buy the smallest USDC-denominated cover the protocol sells and hold it through the window'],
];
const GENERIC_ACTION = 'Make one genuine USDC deposit or swap so the address has real usage';

const actionFor = (p: Protocol): string => {
  const hit = CATEGORY_ACTION.find(([re]) => re.test(p.category ?? ''));
  return hit ? hit[1] : GENERIC_ACTION;
};

const CHAIN_GAS: [RegExp, number][] = [
  [/ethereum/i, 8],
  [/solana/i, 0.1],
  [/base|arbitrum|optimism|polygon|gnosis|linea|scroll|blast/i, 0.6],
  [/bsc|avalanche|tron/i, 0.8],
];
const gasFor = (p: Protocol): number => {
  const chain = p.chains[0] ?? '';
  const hit = CHAIN_GAS.find(([re]) => re.test(chain));
  return hit ? hit[1] : 2;
};

const farmPlan = (
  p: Protocol,
  implied: number,
  confidence: 'high' | 'medium' | 'low',
  peers: number,
  age: number | null,
  candidate: boolean,
  whyNot: string | null,
): Row['plan'] => {
  const capital = implied >= 250_000_000 && p.tvl >= 100_000_000 ? 200 : p.tvl >= 100_000_000 ? 150 : 75;
  const weeks = age !== null && age < 180 ? 8 : 4;
  const gas = gasFor(p);
  const chain = clean(p.chains[0] ?? 'its main chain', 30);
  const name = clean(p.name, 50);
  const weekly = Math.max(0.5, gas / 4);
  const exit = Math.max(1, gas / 2);
  // Every figure below is the sum of the steps that show it, so the summary and the table agree.
  const totalGas = round(gas * 2 + weekly * weeks + exit, 2);
  const hours = round((20 + 10 + 15 + weeks * 15 + 10 + 30) / 60, 1);
  const gasPerHour = round(totalGas / Math.max(0.1, hours), 2);
  const action = actionFor(p);
  const verdict = !candidate
    ? `Skip as a launch farm: ${whyNot ?? 'not a launch candidate'}.`
    : confidence === 'low' && peers < 3
      ? 'Watch only: fewer than three live peers price this category, so the band is wide and the rank is provisional.'
      : implied >= 250_000_000 && peers >= 5
        ? `High-conviction farm: ${peers} live peers and a $${Math.round(implied / 1e6)}M implied launch value justify the full $${capital} budget.`
        : `Speculative farm: budget $${capital}, expect no token, and size it as a lottery ticket rather than a yield trade.`;
  const steps: PlanStep[] = [
    {
      action: `Fund a fresh wallet with $${capital} plus about $${totalGas} for gas; keep the seed offline and never reuse your main wallet.`,
      cost: `$${capital} capital + $${totalGas} gas`,
      time: '20 min',
    },
    { action: `Open ${name} from its official docs on ${chain}, confirm the contract address, and connect the fresh wallet.`, cost: `~$${gas} gas`, time: '10 min' },
    { action: `${action} with $${capital}; read the fee and withdrawal terms before signing.`, cost: `~$${gas} gas + protocol fee`, time: '15 min' },
    { action: `Do one qualifying action a week for ${weeks} weeks - deposit, borrow, swap or vote - and keep leverage low; never wash-trade volume.`, cost: `~$${weekly} gas/week`, time: `${weeks * 15} min total` },
    { action: `Record wallet, tx hashes, dates and the protocol's TVL in a sheet; re-check eligibility only on the protocol's own site.`, cost: '$0', time: '10 min/month' },
    { action: `Hold the position for ${weeks} weeks so the address has a sustained record; read the protocol's own docs for what it counts as usage.`, cost: 'capital stays deployed', time: `${weeks} weeks` },
    { action: `Exit by withdrawing, repaying any loan and bridging back; keep the wallet for future claims and never sign a DM link.`, cost: `~$${exit} gas`, time: '30 min' },
  ];
  for (const step of steps) {
    if (step.action.length < 20) step.action = `${step.action} (confirm the terms first).`;
    if (step.action.length > 600) step.action = `${step.action.slice(0, 590)}...`;
  }
  return { steps, capital, gas: totalGas, hours, weeks, gasPerHour, verdict };
};

const CATEGORY_DD: [RegExp, string[]][] = [
  [/lend|cdp|borrow|collateral/i, ['Read the liquidation and bad-debt history, and who sets oracle and collateral parameters.', 'Check the top borrowers: is TVL real supply or recursive looping?', 'Confirm whether admin keys can change risk parameters, and the timelock length.']],
  [/dex|amm|swap/i, ['Split volume from incentives: how much TVL leaves when rewards stop?', 'Check pool concentration and whether liquidity is mercenary or protocol-owned.', 'Look for wash trading: volume far above the fees the pool earns.']],
  [/liquid staking|staking|restak/i, ['Review validator or operator concentration and slashing coverage.', 'Check the redemption path and the receipt token peg under stress.', 'A receipt of an asset you already hold is not a second token upside.']],
  [/bridge|canonical|cross chain/i, ['Find the trust model: multisig, light client or optimistic, and who holds upgrade keys.', 'Check audits and the exploit history of this and similar bridges.', 'TVL is locked custody, not usage; compare it with monthly transfer volume.']],
  [/yield|aggregator|vault|farm/i, ['Trace where the yield comes from: fees, emissions or leverage?', 'List the underlying protocols; every layer adds smart-contract risk.', 'Check withdrawal limits and who can change the strategy.']],
  [/rwa|real/i, ['Identify the issuer, custodian and legal wrapper; onchain TVL can be an offchain claim.', 'Check redemption terms and whether transfers are allow-listed.', 'Issuer-controlled assets rarely airdrop; verify before spending gas.']],
  [/deriv|perp|option|basis/i, ['Check the insurance fund, ADL rules and oracle design.', 'Open interest versus TVL tells you whether the book is real or one market maker.', 'Read the jurisdiction notices that could restrict your address.']],
  [/curator|allocator/i, ["Read the curator's track record, fee and the markets it may allocate into.", 'TVL belongs to the underlying lenders; a curator may never issue its own token.', 'Check timelocks on allocation changes and the cap per market.']],
  [/predict|gaming|nft|social/i, ['Check volume versus TVL; activity, not deposits, drives value here.', 'Verify the resolution oracle and creator-fee permissions.', 'Read the market rules for the market you actually trade.']],
];
const GENERIC_DD = ['Find the official docs and audits; the absence of both is a strong negative.', 'Check who controls upgradeable contracts and whether a timelock exists.', 'Look at the TVL history: a one-week spike plus a large 7-day change is often incentives.'];

const dueDiligence = (p: Protocol, peers: number, age: number | null, confidence: string): string[] => {
  const hit = CATEGORY_DD.find(([re]) => re.test(p.category ?? ''));
  const items = [...(hit ? hit[1] : GENERIC_DD)];
  if (age === null) items.push('Listing date is unknown: age is assumed at one year and the band is widened.');
  else if (age < 180) items.push(`${age} days of history only: treat any launch expectation as speculation.`);
  else items.push(`${age} days with no token recorded: a long record supports the maturity multiplier.`);
  if (p.chains.length === 1) items.push(`Single chain (${clean(p.chains[0], 30)}): chain outages and bridge dependence apply.`);
  else items.push(`${p.chains.length} chains: check whether TVL is spread or concentrated on one.`);
  if (peers < 5) items.push(`Only ${peers} live-token peers in this category, so the multiple leans on the all-market median.`);
  else items.push(`${peers} live-token peers in this category; the band is calibrated on held-out protocols.`);
  if ((p.ch7 ?? 0) > 60) items.push('7-day TVL jump above 60%: look for a temporary incentive or one large deposit.');
  return items.slice(0, 6);
};

export const buildRadar = (snapshot: Snapshot): Radar => {
  AS_OF_CACHE = snapshot.asOf;
  const pre = snapshot.protocols.filter(isPreToken);
  const live = snapshot.protocols.filter((p) => !isPreToken(p) && p.mcap !== null && p.mcap > 0 && p.tvl > 0);
  const model = fitModel(live);
  const check = crossValidate(live);
  const watch = new Set(snapshot.watchlist);

  const scored = pre.map((p) => {
    const predicted = model.predict(p);
    const peers = model.peers(p);
    const age = ageDays(p, snapshot.asOf);
    const confidence = bucketOf(peers, age);
    const band = bucketBand(check.buckets, confidence);
    const widen = (age === null ? 1.3 : 1) * (peers < 3 ? 1.2 : 1);
    const implied = Math.max(1, Math.round(predicted));
    const whyNot = exclusion(p);
    return {
      p,
      implied,
      low: Math.max(1, Math.round(implied * band.low / widen)),
      high: Math.round(implied * band.high * widen),
      peers,
      age,
      confidence,
      bandCoverage: band.coverage,
      candidate: whyNot === null,
      whyNot,
      terms: {
        peerMultiple: round(model.categoryMultiple(p) ?? Math.exp(model.globalLog)),
        categoryMedian: (model.byCategory.get(p.category ?? '') ?? []).length
          ? round(Math.exp(median(model.byCategory.get(p.category ?? '')!)), 3)
          : null,
        globalMedian: round(Math.exp(model.globalLog), 3),
        shrinkage: round(peers / (peers + SHRINK_PEERS), 3),
        growth: round(Math.exp((GROWTH_WEIGHT * clamp(p.ch7 ?? 0, -60, 120)) / 100), 3),
        maturity: round(MATURITY_FLOOR + (Math.min(age ?? 365, MATURITY_DAYS) / MATURITY_DAYS) * (1 - MATURITY_FLOOR), 3),
      },
    };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : 1));

  let candidateRank = 0;
  const rows: Row[] = scored.map((s, index) => {
    if (s.candidate) candidateRank += 1;
    const rank = index + 1;
    return {
      rank,
      candidateRank: s.candidate ? candidateRank : null,
      slug: clean(s.p.slug, 100),
      name: clean(s.p.name),
      category: s.p.category === null ? null : clean(s.p.category, 50),
      chains: s.p.chains.slice(0, 12).map((c) => clean(c, 30)),
      tvl: s.p.tvl,
      ch7: s.p.ch7,
      listed: s.p.listed,
      age: s.age,
      implied: s.implied,
      low: s.low,
      high: s.high,
      multiple: round(s.implied / s.p.tvl, 3),
      peers: s.peers,
      confidence: s.confidence,
      watch: watch.has(s.p.slug),
      candidate: s.candidate,
      whyNot: s.whyNot,
      terms: s.terms,
      bandCoverage: s.bandCoverage,
      dd: dueDiligence(s.p, s.peers, s.age, s.confidence),
      plan: farmPlan(s.p, s.implied, s.confidence, s.peers, s.age, s.candidate, s.whyNot),
      note: '',
    };
  });

  const livePeers: LivePeer[] = live
    .map((p) => ({
      slug: clean(p.slug, 100),
      name: clean(p.name),
      category: p.category === null ? null : clean(p.category, 50),
      chains: p.chains.slice(0, 8).map((c) => clean(c, 30)),
      tvl: p.tvl,
      mcap: p.mcap!,
      ch7: p.ch7,
      multiple: round(p.mcap! / p.tvl, 3),
      age: ageDays(p, snapshot.asOf),
    }))
    .sort((a, b) => b.mcap - a.mcap);

  const kindOf = (r: Row): 'cex' | 'bridge' | 'product' => {
    const category = r.category ?? '';
    if (category === 'CEX' || EXCHANGE_PREFIX.test(r.name)) return 'cex';
    if (category === 'Bridge' || category === 'Canonical Bridge') return 'bridge';
    return 'product';
  };
  const excluded = rows.filter((r) => !r.candidate);

  return {
    asOf: snapshot.asOf,
    source: snapshot.source,
    floor: snapshot.floor,
    model: {
      name: 'radar-v2 log-space peer multiple',
      formula:
        'implied = TVL x peerMultiple x growth x maturity; peerMultiple is the geometric median market-cap/TVL of live peers in the category, shrunk toward the all-market median with 5 pseudo-peers; growth = exp(0.3 x clamp(7d change, -60%, +120%)); maturity = 0.6 + 0.4 x min(age, 3 years)/3 years',
      growthWeight: GROWTH_WEIGHT,
      maturityFloor: MATURITY_FLOOR,
      maturityDays: MATURITY_DAYS,
      shrinkPeers: SHRINK_PEERS,
      globalMedian: round(Math.exp(model.globalLog), 3),
      livePeers: live.length,
      check,
    },
    counts: {
      protocols: snapshot.protocols.length,
      preToken: pre.length,
      watchlist: snapshot.watchlist.length,
      watchlistCovered: rows.filter((r) => r.watch).length,
      candidates: rows.filter((r) => r.candidate).length,
      live: live.length,
      unpriced: snapshot.protocols.length - pre.length - live.length,
      excludedBridge: excluded.filter((r) => kindOf(r) === 'bridge').length,
      excludedCex: excluded.filter((r) => kindOf(r) === 'cex').length,
      excludedProduct: excluded.filter((r) => kindOf(r) === 'product').length,
    },
    rows,
    live: livePeers,
  };
};
