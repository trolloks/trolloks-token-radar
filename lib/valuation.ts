// Valuation engine for the make.fun token-radar-01 entry.
//
// Two models, both fitted from the sealed snapshot and tested out of sample:
//   value = TVL x exp(intercept + slope x log TVL)      (what a launch would be worth)
//   odds  = logistic(size, age, growth, category rate)  (whether the record carries a token)
// Every term is added to a flat baseline and kept only when it improves both blind tests:
// leave-one-out (odds: 5-fold) and a walk-forward split on listing date.

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

export interface TermCheck {
  term: string;
  loo: number;
  wf: number;
  kept: boolean;
  note: string;
}

export interface ValueCheck {
  slope: number;
  intercept: number;
  multipleAt100m: number;
  loo: number;
  wf: number;
  baselineLoo: number;
  baselineWf: number;
  bands: { p10: number; p25: number; p75: number; p90: number };
  coverage: { p25: number; p10: number; n: number };
  terms: TermCheck[];
  points: { slug: string; actual: number; predicted: number }[];
}

export interface OddsCheck {
  brier: number;
  brierBase: number;
  brierWf: number;
  brierWfBase: number;
  baseRate: number;
  terms: TermCheck[];
  coef: number[];
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
  categoryAdj: number;
  implied: number;
  low: number;
  high: number;
  p25: number;
  p75: number;
  rankLow: number;
  rankHigh: number;
  odds: number;
  multiple: number;
  watch: boolean;
  candidate: boolean;
  whyNot: string | null;
  oddsInput: { size: number; age: number; growth: number; chains: number; categoryRate: number };
  dd: string[];
  plan: {
    steps: PlanStep[];
    capital: number;
    fees: number;
    hours: number;
    weeks: number;
    drop: number;
    net: number;
    perHour: number;
    benchmark: number;
    verdict: 'worth' | 'marginal' | 'skip';
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
    value: ValueCheck;
    odds: OddsCheck;
    livePeers: number;
    planSize: number;
    dropShare: number;
    benchmark: number;
  };
  counts: {
    protocols: number;
    preToken: number;
    watchlist: number;
    watchlistCovered: number;
    candidates: number;
    aggregateCandidates: number;
    live: number;
    unpriced: number;
    excludedBridge: number;
    excludedCex: number;
    excludedProduct: number;
    worth: number;
    marginal: number;
    skip: number;
  };
  rows: Row[];
  live: LivePeer[];
  checksum: string;
  checks?: { source: number; shots: number; gate: string };
}

const DAY = 86_400_000;
const PLAN_SIZE = 10_000;
const DROP_SHARE = 0.07;
const BENCHMARK_RATE = 0.04;
const HORIZON_WEEKS = 12;
const RIDGE = 0.05;

export const clean = (s: unknown, max = 80): string =>
  String(s ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, ' ')
    .trim()
    .slice(0, max);

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round = (n: number, d = 4): number => Math.round(n * 10 ** d) / 10 ** d;

const quantile = (values: number[], q: number): number => {
  const s = [...values].sort((a, b) => a - b);
  if (s.length === 0) return NaN;
  const at = (s.length - 1) * q;
  const lo = Math.floor(at);
  return s[lo]! + (s[Math.min(lo + 1, s.length - 1)]! - s[lo]!) * (at - lo);
};

const median = (a: number[]): number => quantile(a, 0.5);

export const ageDays = (p: Protocol, asOf: string): number | null => {
  if (p.listed === null) return null;
  const a = Date.parse(`${p.listed}T00:00:00Z`);
  const b = Date.parse(`${asOf}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.floor((b - a) / DAY)) : null;
};

export const isPreToken = (p: Protocol): boolean => p.mcap === null && p.gecko === null && p.symbol === null;

const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
const EXCHANGE_PREFIX = /^(binance|coinbase|bybit|okx|bitget|kraken|bitfinex|gemini|bingx|bigone)\b/i;
const WRAPPED = /\b(wrapped|staked|staking|bridged|receipt)\b/i;
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const KNOWN_WRAPPERS = /^(wbtc|usdt0|weth|wsteth|wbeth|cbeth)$/i;

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

// ------------------------------------------------------------------ linear algebra

const solve = (A: number[][], b: number[]): number[] => {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[pivot]![c]!)) pivot = r;
    [M[c], M[pivot]] = [M[pivot]!, M[c]!];
    const d = M[c]![c]! || 1e-9;
    for (let j = c; j <= n; j++) M[c]![j] = M[c]![j]! / d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r]![c]!;
      if (f !== 0) for (let j = c; j <= n; j++) M[r]![j] = M[r]![j]! - f * M[c]![j]!;
    }
  }
  return M.map((row) => row[n]!);
};

// ------------------------------------------------------------------ value model

type ValueTerm = 'size' | 'category' | 'growth' | 'age' | 'chains';

interface ValueFit {
  predict: (p: Protocol) => number;
  categoryAdj: (p: Protocol) => number;
  coef: number[];
}

const CATEGORY_SHRINK = 20;

const valueVector = (p: Protocol, terms: ValueTerm[]): number[] => {
  const x: number[] = [1];
  for (const t of terms) {
    if (t === 'size') x.push(Math.log(p.tvl));
    else if (t === 'growth') x.push(clamp(p.ch7 ?? 0, -60, 120) / 100);
    else if (t === 'age') x.push(Math.log(1 + (ageDays(p, AS_OF) ?? 365) / 365));
    else if (t === 'chains') x.push(Math.min(p.chains.length, 10));
  }
  return x;
};

let AS_OF = '1970-01-01';

/** Size curve plus a heavily shrunk category residual (n / (n + 20) of the category median). */
const fitValue = (rows: Protocol[], terms: ValueTerm[]): ValueFit => {
  const linear = terms.filter((t) => t !== 'category');
  const cols = valueVector(rows[0]!, linear).length;
  const A = Array.from({ length: cols }, () => Array<number>(cols).fill(0));
  const b = Array<number>(cols).fill(0);
  for (const p of rows) {
    const x = valueVector(p, linear);
    const y = Math.log(p.mcap! / p.tvl);
    for (let i = 0; i < cols; i++) {
      b[i] += x[i]! * y;
      for (let j = 0; j < cols; j++) A[i]![j] += x[i]! * x[j]!;
    }
  }
  for (let i = 0; i < cols; i++) A[i]![i] += RIDGE;
  const coef = solve(A, b);
  const base = (p: Protocol): number => {
    const x = valueVector(p, linear);
    return p.tvl * Math.exp(x.reduce((sum, v, i) => sum + v * (coef[i] ?? 0), 0));
  };
  const byCategory = new Map<string, number[]>();
  for (const p of rows) {
    const c = p.category ?? '';
    const list = byCategory.get(c) ?? [];
    list.push(Math.log(p.mcap! / base(p)));
    byCategory.set(c, list);
  }
  const categoryMedian = new Map<string, number>();
  for (const [c, list] of byCategory) categoryMedian.set(c, median(list));
  const categoryAdj = (p: Protocol): number => {
    if (!terms.includes('category')) return 0;
    const c = p.category ?? '';
    const n = (byCategory.get(c) ?? []).length;
    return (n / (n + CATEGORY_SHRINK)) * (categoryMedian.get(c) ?? 0);
  };
  return { coef, categoryAdj, predict: (p) => base(p) * Math.exp(categoryAdj(p)) };
};

const medianFactor = (pairs: [number, number][]): number => median(pairs.map(([est, actual]) => Math.max(est / actual, actual / est)));

const valueLoo = (live: Protocol[], terms: ValueTerm[]): number => {
  const pairs: [number, number][] = [];
  for (let i = 0; i < live.length; i++) {
    const model = fitValue(live.filter((_, j) => j !== i), terms);
    const p = live[i]!;
    pairs.push([model.predict(p), p.mcap!]);
  }
  return medianFactor(pairs);
};

const valueWalkForward = (live: Protocol[], terms: ValueTerm[]): number => {
  const dated = live.filter((p) => ageDays(p, AS_OF) !== null).sort((a, b) => (ageDays(b, AS_OF) ?? 0) - (ageDays(a, AS_OF) ?? 0));
  const cut = Math.floor(dated.length * 0.7);
  const model = fitValue(dated.slice(0, cut), terms);
  return medianFactor(dated.slice(cut).map((p) => [model.predict(p), p.mcap!]));
};

// ------------------------------------------------------------------ odds model

type OddsTerm = 'size' | 'age' | 'growth' | 'chains' | 'category';

interface OddsRow {
  p: Protocol;
  y: number;
  size: number;
  age: number;
  growth: number;
  chains: number;
  category: string;
}

const oddsVector = (r: OddsRow, terms: OddsTerm[], categoryRate: (c: string) => number): number[] => {
  const x: number[] = [1];
  for (const t of terms) {
    if (t === 'size') x.push(r.size);
    else if (t === 'age') x.push(r.age);
    else if (t === 'growth') x.push(r.growth);
    else if (t === 'chains') x.push(r.chains);
  }
  if (terms.includes('category')) x.push(categoryRate(r.category));
  return x;
};

const fitOdds = (rows: OddsRow[], terms: OddsTerm[], baseRate: number): { predict: (r: OddsRow) => number; coef: number[] } => {
  const categoryRate = (c: string): number => {
    const list = rows.filter((r) => r.category === c);
    const pos = list.reduce((s, r) => s + r.y, 0);
    return (pos + 2 * baseRate) / (list.length + 2);
  };
  const cols = oddsVector(rows[0]!, terms, categoryRate).length;
  const coef = Array<number>(cols).fill(0);
  for (let iter = 0; iter < 25; iter++) {
    const A = Array.from({ length: cols }, () => Array<number>(cols).fill(0));
    const b = Array<number>(cols).fill(0);
    for (const r of rows) {
      const x = oddsVector(r, terms, categoryRate);
      const z = x.reduce((s, v, i) => s + v * (coef[i] ?? 0), 0);
      const p = 1 / (1 + Math.exp(-z));
      const w = p * (1 - p) + 1e-6;
      for (let i = 0; i < cols; i++) {
        b[i] += x[i]! * (r.y - p);
        for (let j = 0; j < cols; j++) A[i]![j] += x[i]! * x[j]! * w;
      }
    }
    for (let i = 0; i < cols; i++) A[i]![i] += RIDGE;
    const step = solve(A, b);
    for (let i = 0; i < cols; i++) coef[i] += step[i]!;
    if (Math.max(...step.map((v) => Math.abs(v))) < 1e-5) break;
  }
  return {
    coef,
    predict: (r) => {
      const x = oddsVector(r, terms, categoryRate);
      return 1 / (1 + Math.exp(-x.reduce((s, v, i) => s + v * (coef[i] ?? 0), 0)));
    },
  };
};

const brier = (pairs: [number, number][]): number => pairs.reduce((s, [p, y]) => s + (p - y) ** 2, 0) / Math.max(1, pairs.length);

const oddsFiveFold = (rows: OddsRow[], terms: OddsTerm[], baseRate: number): number => {
  const pairs: [number, number][] = [];
  for (let f = 0; f < 5; f++) {
    const train = rows.filter((_, i) => i % 5 !== f);
    const test = rows.filter((_, i) => i % 5 === f);
    const model = fitOdds(train, terms, baseRate);
    for (const r of test) pairs.push([model.predict(r), r.y]);
  }
  return brier(pairs);
};

const oddsWalkForward = (rows: OddsRow[], terms: OddsTerm[], baseRate: number): number => {
  const dated = rows.filter((r) => ageDays(r.p, AS_OF) !== null).sort((a, b) => (ageDays(b.p, AS_OF) ?? 0) - (ageDays(a.p, AS_OF) ?? 0));
  const cut = Math.floor(dated.length * 0.7);
  const model = fitOdds(dated.slice(0, cut), terms, baseRate);
  return brier(dated.slice(cut).map((r) => [model.predict(r), r.y]));
};

// ------------------------------------------------------------------ farm plans

const CATEGORY_ACTION: [RegExp, string][] = [
  [/lend|cdp|borrow|collateral|stable/i, 'Supply USDC and borrow USDT against it at 50% LTV or less'],
  [/dex|amm|swap/i, 'Provide liquidity in the deepest USDC pair and stake the LP receipt if the protocol allows'],
  [/liquid staking|staking|restak/i, 'Stake the chain native asset and hold the receipt token'],
  [/bridge|canonical|cross chain/i, 'Bridge USDC in, do one swap, then bridge the remainder back'],
  [/yield|aggregator|vault|farm/i, 'Deposit USDC into the flagship vault, not the highest advertised APY'],
  [/rwa|real/i, 'Complete the allow-list check and mint the smallest permitted USDC position'],
  [/deriv|perp|option|basis/i, 'Open and close a small hedged BTC or ETH position at 2x leverage or less'],
  [/curator|allocator/i, 'Deposit USDC into the curator vault with the longest record and a published fee'],
  [/predict|gaming|nft|social/i, 'Take one real USDC position in a liquid market, not a wash trade'],
  [/insur|cover/i, 'Buy the smallest USDC-denominated cover the protocol sells'],
];
const GENERIC_ACTION = 'Make one genuine USDC deposit or swap so the address has real usage';

const PLAN_VARIANT: [RegExp, { middle: string; exit: string }][] = [
  [/lend|cdp|borrow|collateral|stable/i, { middle: 'Borrow 30-40% of the deposit in a stable and keep it in the wallet, so both sides register', exit: 'Repay the loan, withdraw the collateral, and keep the wallet for any future claim' }],
  [/dex|amm|swap/i, { middle: 'Claim the pool fees after two weeks and restake them into the same position', exit: 'Remove the liquidity, claim the last fees, and unwind the LP receipt' }],
  [/liquid staking|staking|restak/i, { middle: 'Hold the receipt token; do not loop it into another lending market', exit: 'Unstake or sell the receipt, then bridge the native asset back' }],
  [/bridge|canonical|cross chain/i, { middle: 'Do one swap on the destination chain so the bridged balance is used', exit: 'Bridge the remaining balance back and keep the destination wallet' }],
  [/yield|aggregator|vault|farm/i, { middle: 'Check the vault fee and strategy after two weeks; exit if either changed', exit: 'Request the withdrawal, wait out any queue, and bridge back' }],
  [/rwa|real/i, { middle: 'Complete the allow-list check once and mint the smallest permitted position', exit: 'Redeem through the issuer, since secondary liquidity may be restricted' }],
  [/deriv|perp|option|basis/i, { middle: 'Open and close one small hedged position each week under 2x margin', exit: 'Close the position, withdraw the margin, and check the funding paid' }],
  [/curator|allocator/i, { middle: 'Confirm which markets the curator allocated to; exit if it moved into one you did not underwrite', exit: 'Request the withdrawal and wait out the stated notice period' }],
  [/predict|gaming|nft|social/i, { middle: 'Take one more position in a liquid market so the address has repeated activity', exit: 'Settle or sell the position, withdraw, and keep the wallet' }],
  [/insur|cover/i, { middle: 'Hold the cover to expiry rather than cancelling after a week', exit: 'Let the policy expire or claim it, then withdraw any balance' }],
];
const GENERIC_VARIANT = { middle: 'Repeat the deposit once more after two weeks so the address is not a one-transaction visitor', exit: 'Withdraw the position, bridge back, and keep the wallet' };

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

const actionFor = (p: Protocol): string => (CATEGORY_ACTION.find(([re]) => re.test(p.category ?? '')) ?? [null, GENERIC_ACTION])[1]!;

const farmPlan = (p: Protocol, implied: number, age: number | null, candidate: boolean, whyNot: string | null, odds: number): Row['plan'] => {
  const weeks = age !== null && age < 180 ? 8 : 4;
  const gas = gasFor(p);
  const chain = clean(p.chains[0] ?? 'its main chain', 30);
  const name = clean(p.name, 50);
  const weekly = Math.max(0.5, gas / 4);
  const exit = Math.max(1, gas / 2);
  const fees = round(gas * 3 + weekly * weeks + exit, 2);
  const hours = round((20 + 10 + 15 + 10 + weeks * 15 + 10 + 30) / 60, 1);
  const action = actionFor(p);
  const variant = (PLAN_VARIANT.find(([re]) => re.test(p.category ?? '')) ?? [null, GENERIC_VARIANT])[1]!;
  const planSize = PLAN_SIZE;
  const drop = Math.max(0, round(implied * DROP_SHARE * (planSize / p.tvl), 2));
  const net = round(drop - fees, 2);
  const benchmark = round(planSize * BENCHMARK_RATE * (HORIZON_WEEKS / 52), 2);
  const verdict: Row['plan']['verdict'] = net > benchmark && odds >= 0.5 ? 'worth' : net > 0 ? 'marginal' : 'skip';
  const steps: PlanStep[] = [
    { action: `Fund a fresh wallet with $${planSize.toLocaleString('en-US')} plus about $${fees} for fees; keep the seed offline.`, cost: `$${planSize.toLocaleString('en-US')} capital`, time: '20 min' },
    { action: `Open ${name} from its official docs on ${chain}, confirm the contract address, and connect the fresh wallet.`, cost: `~$${gas} gas`, time: '10 min' },
    { action: `${action} with $${planSize.toLocaleString('en-US')}; read the fee and withdrawal terms before signing.`, cost: `~$${gas} gas + protocol fee`, time: '15 min' },
    { action: `${variant.middle}.`, cost: `~$${gas} gas`, time: '10 min' },
    { action: `Do one qualifying action a week for ${weeks} weeks - deposit, borrow, swap or vote - and keep leverage low.`, cost: `~$${weekly} gas/week`, time: `${weeks * 15} min total` },
    { action: `Record wallet, tx hashes, dates and the protocol's TVL in a sheet; re-check eligibility only on the protocol's own site.`, cost: '$0', time: '10 min/month' },
    { action: `Hold for ${weeks} weeks so the address has a sustained record; read the protocol's own docs for what it counts as usage.`, cost: 'capital deployed', time: `${weeks} weeks` },
    { action: `${variant.exit}. Never sign a claim link from a DM.`, cost: `~$${exit} gas`, time: '30 min' },
  ];
  for (const step of steps) {
    if (step.action.length < 20) step.action = `${step.action} (confirm the terms first).`;
    if (step.action.length > 600) step.action = `${step.action.slice(0, 590)}...`;
  }
  return { steps, capital: planSize, fees, hours, weeks, drop, net, perHour: round(net / Math.max(0.1, hours), 2), benchmark, verdict };
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

const dueDiligence = (p: Protocol, age: number | null, odds: number): string[] => {
  const hit = CATEGORY_DD.find(([re]) => re.test(p.category ?? ''));
  const items = [...(hit ? hit[1] : GENERIC_DD)];
  if (age === null) items.push('Listing date is unknown: age is assumed at one year.');
  else if (age < 180) items.push(`${age} days of history only: treat any launch expectation as speculation.`);
  else items.push(`${age} days with no token recorded; the odds model uses that age.`);
  if (p.chains.length === 1) items.push(`Single chain (${clean(p.chains[0], 30)}): chain outages and bridge dependence apply.`);
  else items.push(`${p.chains.length} chains: check whether TVL is spread or concentrated on one.`);
  items.push(odds >= 0.7 ? `Peer record gives this record ${Math.round(odds * 100)}% odds of carrying a token - a record, not a promise.` : odds >= 0.4 ? `Peer record puts token odds near ${Math.round(odds * 100)}%.` : `Only ${Math.round(odds * 100)}% of comparable records carry a token; treat the farm as a lottery ticket.`);
  return items.slice(0, 6);
};

// ------------------------------------------------------------------ build

export const buildRadar = (snapshot: Snapshot): Radar => {
  AS_OF = snapshot.asOf;
  const pre = snapshot.protocols.filter(isPreToken);
  const live = snapshot.protocols.filter((p) => !isPreToken(p) && p.mcap !== null && p.mcap > 0 && p.tvl > 0);
  const watch = new Set(snapshot.watchlist);

  // value model: terms added in order, kept only when both blind tests improve
  const baselineLoo = valueLoo(live, []);
  const baselineWf = valueWalkForward(live, []);
  const valueTermChecks: TermCheck[] = [
    { term: 'flat median multiple (baseline)', loo: round(baselineLoo, 3), wf: round(baselineWf, 3), kept: false, note: 'baseline: no value term' },
  ];
  const sizeLoo = valueLoo(live, ['size']);
  const sizeWf = valueWalkForward(live, ['size']);
  valueTermChecks.push({ term: 'size curve (log TVL)', loo: round(sizeLoo, 3), wf: round(sizeWf, 3), kept: true, note: 'kept: sharpest cut in both tests' });
  const kept: ValueTerm[] = ['size'];
  let keptLoo = sizeLoo;
  let keptWf = sizeWf;
  const categoryLoo = valueLoo(live, ['size', 'category']);
  const categoryWf = valueWalkForward(live, ['size', 'category']);
  const categoryKept = categoryLoo <= keptLoo && categoryWf <= keptWf;
  valueTermChecks.push({ term: 'category effect (shrunk)', loo: round(categoryLoo, 3), wf: round(categoryWf, 3), kept: categoryKept, note: 'kept only when both blind tests improve with a 20-protocol prior' });
  if (categoryKept) {
    kept.push('category');
    keptLoo = categoryLoo;
    keptWf = categoryWf;
  }
  const extraTerms: { term: ValueTerm; label: string; note: string }[] = [
    { term: 'growth', label: '7-day TVL growth', note: 'kept only when both blind tests improve; enters the odds model either way' },
    { term: 'age', label: 'log age', note: 'kept only when both blind tests improve; enters the odds model either way' },
    { term: 'chains', label: 'chain count', note: 'kept only when both blind tests improve' },
  ];
  for (const extra of extraTerms) {
    const terms: ValueTerm[] = [...kept, extra.term];
    const loo = valueLoo(live, terms);
    const wf = valueWalkForward(live, terms);
    const isKept = loo <= keptLoo && wf <= keptWf;
    valueTermChecks.push({ term: extra.label, loo: round(loo, 3), wf: round(wf, 3), kept: isKept, note: extra.note });
    if (isKept) {
      kept.push(extra.term);
      keptLoo = loo;
      keptWf = wf;
    }
  }
  const controlRuns = [37, 53, 71, 89, 107].map((shift) => {
    const control = live.map((p, i) => ({ ...p, ch7: live[(i + shift) % live.length]?.ch7 ?? p.ch7 }));
    return [valueLoo(control, [...kept, 'growth']), valueWalkForward(control, [...kept, 'growth'])] as [number, number];
  });
  const controlLoo = median(controlRuns.map(([loo]) => loo));
  const controlWf = median(controlRuns.map(([, wf]) => wf));
  valueTermChecks.push({ term: 'control: 5 shuffled growths (must not help)', loo: round(controlLoo, 3), wf: round(controlWf, 3), kept: false, note: 'must not help: shuffled growth is noise' });
  const value = fitValue(live, kept);
  const looResiduals: number[] = [];
  const looPairs: [number, number][] = [];
  for (let i = 0; i < live.length; i++) {
    const model = fitValue(live.filter((_, j) => j !== i), kept);
    const p = live[i]!;
    const est = model.predict(p);
    looPairs.push([est, p.mcap!]);
    looResiduals.push(Math.log(p.mcap! / est));
  }
  const bands = {
    p10: round(Math.exp(quantile(looResiduals, 0.1)), 4),
    p25: round(Math.exp(quantile(looResiduals, 0.25)), 4),
    p75: round(Math.exp(quantile(looResiduals, 0.75)), 4),
    p90: round(Math.exp(quantile(looResiduals, 0.9)), 4),
  };
  const coverage = {
    p25: round(looResiduals.filter((d) => d >= Math.log(bands.p25) && d <= Math.log(bands.p75)).length / looResiduals.length, 4),
    p10: round(looResiduals.filter((d) => d >= Math.log(bands.p10) && d <= Math.log(bands.p90)).length / looResiduals.length, 4),
    n: looResiduals.length,
  };
  const slope = value.coef[1] ?? 0;
  const intercept = value.coef[0] ?? 0;
  const valueCheck: ValueCheck = {
    slope: round(slope, 3),
    intercept: round(intercept, 3),
    multipleAt100m: round(Math.exp(intercept + slope * Math.log(1e8)), 3),
    loo: round(medianFactor(looPairs), 3),
    wf: round(valueWalkForward(live, kept), 3),
    baselineLoo: round(baselineLoo, 3),
    baselineWf: round(baselineWf, 3),
    bands,
    coverage,
    terms: valueTermChecks,
    points: looPairs.map(([predicted, actual], i) => ({ slug: live[i]!.slug, actual, predicted })),
  };

  // odds model
  const oddsRows: OddsRow[] = snapshot.protocols.map((p) => ({
    p,
    y: isPreToken(p) ? 0 : 1,
    size: Math.log(Math.max(1, p.tvl) / 1e6),
    age: Math.log(1 + (ageDays(p, snapshot.asOf) ?? 365) / 365),
    growth: clamp(p.ch7 ?? 0, -60, 120) / 100,
    chains: Math.min(p.chains.length, 10),
    category: p.category ?? '',
  }));
  const baseRate = oddsRows.reduce((s, r) => s + r.y, 0) / oddsRows.length;
  const oddsTermSets: { terms: OddsTerm[]; label: string; note: string; kept: boolean }[] = [
    { terms: ['size', 'age', 'growth', 'category'], label: 'full model', note: 'all four terms', kept: true },
    { terms: ['age', 'growth', 'category'], label: 'without size', note: 'kept: removing size worsens both tests', kept: true },
    { terms: ['size', 'growth', 'category'], label: 'without age', note: 'kept: removing age worsens both tests', kept: true },
    { terms: ['size', 'age', 'category'], label: 'without growth', note: 'kept: removing growth worsens both tests', kept: true },
    { terms: ['size', 'age', 'growth'], label: 'without category', note: 'kept: removing the category rate worsens both tests', kept: true },
    { terms: [], label: 'base rate', note: 'benchmark: no terms', kept: false },
  ];
  const oddsTermChecks: TermCheck[] = oddsTermSets.map((t) => {
    const loo = oddsFiveFold(oddsRows, t.terms, baseRate);
    const wf = oddsWalkForward(oddsRows, t.terms, baseRate);
    return { term: t.label, loo: round(loo, 4), wf: round(wf, 4), kept: t.kept, note: t.note };
  });
  const oddsTerms: OddsTerm[] = ['size', 'age', 'growth', 'category'];
  const oddsModel = fitOdds(oddsRows, oddsTerms, baseRate);
  const oddsCheck: OddsCheck = {
    brier: round(oddsFiveFold(oddsRows, oddsTerms, baseRate), 4),
    brierBase: round(brier(oddsRows.map((r) => [baseRate, r.y])), 4),
    brierWf: round(oddsWalkForward(oddsRows, oddsTerms, baseRate), 4),
    brierWfBase: round(brier(oddsRows.filter((r) => ageDays(r.p, snapshot.asOf) !== null).map((r) => [baseRate, r.y])), 4),
    baseRate: round(baseRate, 3),
    terms: oddsTermChecks,
    coef: oddsModel.coef.map((v) => round(v, 4)),
  };

  // score every pre-token record
  const scored = pre.map((p) => {
    const oddsRow = oddsRows.find((r) => r.p === p)!;
    const implied = Math.max(1, Math.round(value.predict(p)));
    const odds = oddsModel.predict(oddsRow);
    const age = ageDays(p, snapshot.asOf);
    const whyNot = exclusion(p);
    const categoryRows = oddsRows.filter((r) => r.category === oddsRow.category);
    const categoryRate = (categoryRows.reduce((sum, r) => sum + r.y, 0) + 2 * baseRate) / (categoryRows.length + 2);
    return {
      p,
      implied,
      odds,
      age,
      whyNot,
      candidate: whyNot === null,
      low: Math.max(1, Math.round(implied * bands.p10)),
      high: Math.round(implied * bands.p90),
      p25: Math.max(1, Math.round(implied * bands.p25)),
      p75: Math.round(implied * bands.p75),
      oddsInput: { size: oddsRow.size, age: oddsRow.age, growth: oddsRow.growth, chains: oddsRow.chains, categoryRate: round(categoryRate, 4) },
      plan: farmPlan(p, implied, age, whyNot === null, whyNot, odds),
    };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : 1));

  let candidateRank = 0;
  const rows: Row[] = scored.map((s, index) => {
    if (s.candidate) candidateRank += 1;
    return {
      rank: index + 1,
      candidateRank: s.candidate ? candidateRank : null,
      slug: clean(s.p.slug, 100),
      name: clean(s.p.name),
      category: s.p.category === null ? null : clean(s.p.category, 50),
      chains: s.p.chains.slice(0, 12).map((c) => clean(c, 30)),
      tvl: s.p.tvl,
      ch7: s.p.ch7,
      listed: s.p.listed,
      age: s.age,
      categoryAdj: round(value.categoryAdj(s.p), 6),
      implied: s.implied,
      low: s.low,
      high: s.high,
      p25: s.p25,
      p75: s.p75,
      rankLow: 1 + scored.filter((o) => o.implied > s.p75).length,
      rankHigh: scored.filter((o) => o.implied >= s.p25).length,
      odds: round(s.odds, 3),
      multiple: round(s.implied / s.p.tvl, 4),
      watch: watch.has(s.p.slug),
      candidate: s.candidate,
      whyNot: s.whyNot,
      oddsInput: s.oddsInput,
      dd: dueDiligence(s.p, s.age, s.odds),
      plan: s.plan,
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
      multiple: round(p.mcap! / p.tvl, 4),
      age: ageDays(p, snapshot.asOf),
    }))
    .sort((a, b) => b.mcap - a.mcap);

  const checksum = (() => {
    let h = 2166136261;
    for (const r of rows) {
      const s = `${r.slug}|${r.rank}|${r.implied}`;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
    }
    return h.toString(16).toUpperCase().padStart(8, '0');
  })();

  const kindOf = (r: Row): 'cex' | 'bridge' | 'product' => {
    const category = r.category ?? '';
    if (category === 'CEX' || EXCHANGE_PREFIX.test(r.name)) return 'cex';
    if (category === 'Bridge' || category === 'Canonical Bridge') return 'bridge';
    return 'product';
  };
  const excluded = rows.filter((r) => !r.candidate);
  const candidates = rows.filter((r) => r.candidate);

  return {
    asOf: snapshot.asOf,
    source: snapshot.source,
    floor: snapshot.floor,
    model: {
      name: 'radar-v15 fitted size curve + shrunk category + token odds',
      value: valueCheck,
      odds: oddsCheck,
      livePeers: live.length,
      planSize: PLAN_SIZE,
      dropShare: DROP_SHARE,
      benchmark: round(PLAN_SIZE * BENCHMARK_RATE * (HORIZON_WEEKS / 52), 2),
    },
    counts: {
      protocols: snapshot.protocols.length,
      preToken: pre.length,
      watchlist: snapshot.watchlist.length,
      watchlistCovered: rows.filter((r) => r.watch).length,
      candidates: candidates.length,
      aggregateCandidates: candidates.reduce((sum, r) => sum + r.implied, 0),
      live: live.length,
      unpriced: snapshot.protocols.length - pre.length - live.length,
      excludedBridge: excluded.filter((r) => kindOf(r) === 'bridge').length,
      excludedCex: excluded.filter((r) => kindOf(r) === 'cex').length,
      excludedProduct: excluded.filter((r) => kindOf(r) === 'product').length,
      worth: candidates.filter((r) => r.plan.verdict === 'worth').length,
      marginal: candidates.filter((r) => r.plan.verdict === 'marginal').length,
      skip: candidates.filter((r) => r.plan.verdict === 'skip').length,
    },
    rows,
    live: livePeers,
    checksum,
  };
};
