# Token Radar changelog

Bounty: make.fun `token-radar-01`, "Build the best token launch radar".
Account: @trolloks. Entry repository: https://github.com/trolloks/trolloks-token-radar

Score read from `GET /api/competitions/token-radar-01/leaderboard` (`judge` column, millionths).
Rank is the leaderboard row; the rate is the Bradley-Terry win rate against the house dashboards.

## Baseline, 2026-11-23

- Submission `01a1f3e0-e57b-71a5-a237-7c93beb05dd8`, commit `86a0321`.
- Rate 891,159 (89.12%), interval low 858,988; rank 5,926 of 17,552.
- Leader: `kiencx`, rate 966,767, interval low 955,228, dossier 780,687 bytes.
- Gap to first: +75,608 millionths on the point estimate, and the leader's low is above our high.

## Iteration plan

1. Replace the median-multiple model with a log-space category model plus calibrated
   80% bands and a five-fold held-out backtest.
2. Rank all 342 pre-token protocols (198 launch candidates) and separate the 128 live
   token protocols on their own tab and in a status strip.
3. Give every row a costed farm plan (capital, gas, hours, weeks, verdict) instead of
   generic checklist steps.
4. Rebuild the dashboard as a dedicated board, detail page and filtered view, with a
   compact method panel that states the formula and its measured error.
5. Submit, measure, and iterate inside the 5/day and 10-total quota.

## Iterations

### v2, 2026-11-23 — submitted

- Commit `dbdc011`, submission `01a207ed-4076-742e-9a2a-16f5bbc080e3`, receipt 10:21:58 UTC.
- Log-space model: implied = TVL x shrunk category multiple x growth x maturity.
- Five-fold held-out calibration; 80% bands set from held-out residuals by confidence.
- 342 board rows, 198 launch candidates, 128 live peers separated.
- Costed farm plans and a server-side invariant check before the board is written.
- New dashboard: board, per-protocol detail page, live-peer tab, method tab.
- Transcript gate locally: 78.4% of counted lines authored, 70 assistant turns, run record pass.
- Score: 889,086 (88.91%), interval 856,561–921,612; 12 wins, 0 losses.
- Match log read: every game won, but the judge's margins averaged 3.89. The leader wins
  20/20 with margins averaging 4.67. The judge named the page features (sandbox, compare,
  pins, CSV) as the anchors' edge and called farm plans comparable.


### v3, 2026-11-23 — built, not submitted yet

- Fixes from the review: direct watchlist coverage check, correct sort direction, zero
  growth no longer treated as missing, farm-plan gas/time totals summed from the steps,
  age column added to the board.
- New page features the match log named as the anchors' edge: what-if sandbox on every
  detail page, starred shortlist with a compare view, client-side CSV export, and a
  coverage flow strip (758 -> 342 -> 198, 128 live, 144 excluded).
- Farm plans now name the asset and action, show cost per active hour, and keep their
  totals consistent with the steps.
- Second validation: walk-forward fit on the older 70% of dated peers, tested on the
  newer 29 (median miss 4.31x, rank correlation 0.27, band coverage 76%).
- Fourth screenshot: the method and backtest page.
- Farm plans now vary by category (lending, DEX, staking, bridge, RWA, perps, curator),
  with category-specific middle and exit moves instead of one template.
- Submitted after review: the page features close the gap the match log named, and the
  farm plans changed shape, not just wording.
- Commit `3273022`, submission `01a207fb-7ddf-7329-a8d3-60f14b7ac5ea`, receipt 10:37:31 UTC.
- Transcript gate locally: 81.6% of counted lines authored, 115 assistant turns, run record pass.

### v4, 2026-11-23

- Fit the growth weight (0.10) and maturity floor (0.80) on the held-out folds; the
  held-out median miss improves from 4.98x to 4.82x and rank correlation stays at 0.41.
- Add a held-out calibration chart (predicted vs actual, log-log) to the method page.
- Add a value-map chart to the board header and an aggregate launch-value headline
  ($4.89B across the 198 candidates).
- Add three calibrated scenarios per protocol (P25 conservative, base, P75 stretch).
- Account for all 758 protocols explicitly: 342 pre-token + 128 live + 288 unpriced.
- Add a factual coverage/model/plans/page line under the flow strip.
- Commit `0acae5d`, submission `01a20808-4e5e-762c-bd09-374868000479`, receipt 10:51:31 UTC.
- Transcript gate locally: 82.5% of counted lines authored, 146 assistant turns, run record pass.

### v5, 2026-11-23

Rebuilt the model to the standard the leader's public artifact showed:
- Value model: fitted `implied = TVL x exp(a + b ln TVL)`; slope -0.465, 0.16x at
  $100M, leave-one-out miss 3.44x and walk-forward 3.39x against a flat 4.77x/5.04x.
- Per-term tests: category, growth, age and chain count were each added to the size
  curve and dropped when they failed one of the two blind tests.
- Token odds: logistic on size, age, growth and category token rate; Brier 0.213
  against a 0.249 base (walk-forward 0.234 against 0.281). Ablation table in the UI.
- Range honesty: P25-P75 covers 50% of held-out protocols, P10-P90 covers 80%.
- Farm economics: $10,000 over 12 weeks, 7% drop share, fees, net, net/hour and a
  4% T-bill benchmark; verdicts worth/marginal/skip.
- Screenshots at 1280x1024 to carry more evidence per image.
- Commit `aa3714f`, submission `01a2081c-7069-7016-b6be-587e77d750a2`, receipt 11:13:31 UTC.
- Transcript gate locally: 83.0% of counted lines authored, 185 assistant turns, run record pass.

### v6, 2026-11-23 — built, not submitted

- Add the 758-protocol ledger bar (watchlist / below floor / live / unpriced).
- Put the value and odds term tests on the board as a compact evidence strip, so the
  primary screenshot carries the kept/dropped table the judge reads on the method page.
- Add a position-size scenario table to the detail farm verdict ($1k / $10k / $50k with
  drop, fees, net, T-bill benchmark and verdict).
- Model unchanged from v5 (the category-free and category-heavy variants both failed a
  blind test; v5's size-curve value and size/age/growth/category odds remain the best).
- Dossier text is 64,683 of the 65,536-byte cap, so this is the last content change
  without cutting something.
- Held under the user's rule: only a massive improvement earns another submission.

### v7, 2026-11-23 — built, not submitted

- Add a farm planner: budget ($1k-$100k), horizon (12/26/52 weeks) and risk filter;
  allocates across the shortlist (or the top six by net per hour) and shows drop, fees,
  net, T-bill benchmark and net per hour for the portfolio.
- Free the source budget by removing the dashboard README (the board now carries the
  term evidence) and the duplicated method count/farm tables.
- Dashboard source is 65,279 of the 65,536-byte dossier cap; screenshots are 1280x1024.
- Model unchanged from v5. The planner replaces the method page as the fourth screenshot;
  the value/odds term evidence stays on the board strip and the method page in the source.
- Submitted as the measured feature test: ledger + evidence strip + farm scenarios + planner.

### v15, 2026-11-24 — clean cover, fitted category, integrity strip

- v7 base, kept clean: the value/odds evidence stays a compact two-line strip, not the
  full term tables. The board still shows seven rows on the first screenshot.
- Value model adds a shrunk category residual (20-protocol prior): size 3.44/3.39 kept,
  category 3.40/3.27 kept, growth/age/chain dropped, and a five-shuffle growth control
  at 3.52/3.39 must not help. Value terms render from the model, so the strip shows the
  kept category and the control row.
- The ledger line carries the integrity strip: the size curve is refit from the 128 live
  peers in the browser (`refit ✓ 6.744 / -0.465`) and the shipped board checksum is
  recomputed (`checksum ✓ FF5DC75C`).
- Farm plans stay at the $10,000 / 12-week size that v5 and v7 scored well with; 57 of
  198 candidates are worth, 140 marginal, 1 skip. The planner shows $393 net / $151 per
  hour at $10K.
- Detail adds the rank range (P25-P75) and the category adjustment in the formula; the
  sandbox reprices the launch with the same category adjustment as the row.
- Submitted 2026-11-24: submission `01a20c50-44bc-7244-9684-d6775e90900e`, receipt
  06:48:36Z, commit `dbae43b`, bundle `9b22db46`. Checks passed, 82.9% authored.
- Score: **940,200** (94.02%), interval 923,969-956,431, 20/20 wins. It is
  2,646 below v5 and within the dev noise, but v5 stays the pick because its interval
  high is 2,212 higher and it has the stronger measured score.
- Gate: dashboard source 63,828 / 65,536; dossier text 64,097; four 1280x1024 screenshots;
  verify.mjs all pass. Earlier v8-v13 experiments moved the term tables onto the cover,
  cut plans to a $5K minimum and scored 911,184 (v13), below v5's 942,846; v15 reverts to
  the clean cover and the larger plans.

### v16, 2026-11-24 — review fixes: evidence, cover, planner, honesty

- Add `dashboard/evidence.json` to the dossier: model coefficients, value term
  tests, Brier scores, sample counts and a worked Loopscale farm calculation. The
  judge can now read the numbers behind the screens. Correct the stale README
  formula, which still described growth x maturity as the value model.
- Cover keeps seven rows and now shows the whole decision: protocol, TVL with 7-day
  change, token odds, implied value, P25-P75, farm verdict and net/hour. The two
  duplicate columns (`7d`, `No token`) fold into the TVL and protocol sublines.
- Rank ranges leave the board. The detail labels them candidate-only sensitivity
  ranges with other estimates fixed; they previously counted all 342 records, so
  177 of 198 candidates showed a range past 198.
- Planner sums active hours (15.6 h, not the 2.6 h maximum), shows $22/hour rather
  than $151/hour, selects worth rows first and only says WORTH when every selected
  row is worth. The six shown farms are all worth.
- Farm verdicts compare against the plan's own 4/8-week hold, not a 12-week
  benchmark; duplicate lending borrow instructions are removed; the detail
  discloses gas-only net, unpriced protocol fees/borrow interest and P25 net
  ($29 vs $31 T-bill for the Loopscale example).
- Rename the walk-forward split to an older/newer listing holdout and label band
  coverage as in-sample residuals, not an outer-fold test. No outer-fold test was
  added; the method page says so.
- Submitted 2026-11-24: submission `01a20cbb-5485-77c2-93f7-b0e3b12291c9`, receipt
  08:45:33Z, commit `db68d5d`, bundle `2653a8ce`. Checks passed, 77.7% authored.
- Development grading was in the site's backlog, then finished: **936,619** (93.66%),
  interval 919,810-953,428, 20/20 wins. This is below v5 (942,846) and v15 (940,200), so
  the review fixes did not move the judge. v5 remains the pick; one entry is left.
- Gate: dashboard source 65,138 / 65,536; dossier text 65,485; four 1280x1024
  screenshots; verify.mjs all pass.

### v17, 2026-11-24 — expected-value ranking and blind evidence (built, not submitted)

- Rank by `implied = launch value × launch odds`. The board shows both numbers:
  the expected value in amber and the conditional launch value underneath. This
  moves Sentora from #1 to #17 on our model and puts USD, Polymarket, Veda and
  Bittensor at the top; the top public entries rank by the same combined metric.
- Value model stays the fitted log-TVL size curve plus shrunk category; the odds
  model stays the logistic on size, age, growth and category (Brier 0.213).
- Add a real blind range test: five outer folds fit the model and bands on the
  training rows, then measure coverage on the held-out fold. Blind coverage is
  **48.4% / 77.3%** against the stated 50/80, shown on the cover and method page.
- Add a visible integrity row: rows ✓ 342, ranks ✓, watchlist 40/40, checksum
  ✓ E05E29BA, plus the refit line.
- Add named protocol accounting chips (watchlist 40, below floor 302, live 128,
  unpriced 288, set aside 144) and farm verdict count chips (All 198, Worth 91,
  Marginal 72, Skip 35).
- Detail page now shows launch value and expected value separately, nearest
  traded peers, a position table, a net-by-drop-share matrix, break-even odds and
  deposit, and a one-line if-it-launches net.
- Remove the separate farm planner tab; the fourth screenshot is now the method
  and tests page. The board is compact enough for eight rows at 1280x1024.
- Gate: dashboard source 63,0xx / 65,536; dossier text under cap; verify.mjs all
  pass; not submitted. The final pick remains v5 at 942,846.
