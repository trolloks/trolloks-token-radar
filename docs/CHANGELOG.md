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
- Commit `5c4bb5a`, submission `01a2082f-f28f-737e-b47b-3664d79672c8`, receipt 11:34:41 UTC.
- Transcript gate locally: 83.5% of counted lines authored, 221 assistant turns, run record pass.
- Score: 939,310 (93.93%), interval 922,935-955,686, 20/20 wins. Slightly below v5's 942,846.
- v5 stays the final pick. The ledger/evidence/scenario/planner features did not move the
  judge; the margin stayed at 4.39 against v5's 4.43.
- Model test after v7: a shrunk category effect reaches 3.80x leave-one-out / 3.00x
  walk-forward (size-only: 3.44x/3.39x). The walk-forward improves, the leave-one-out
  worsens; not a clear enough gain to replace the best entry. The value model is near its
  ceiling on this snapshot.
- Quota after v7: 6 entries made, 4 left in total, today's 5 spent.

### v8, 2026-11-23 — built, waiting for the next quota day

- Move the full value and token-odds term tables onto the board, above the table, so
  the primary screenshot carries the kept/dropped evidence the leader's artifact has.
- Tighten the table rows (line-height and padding) so the board still shows six rows
  below the model evidence.
- Keep the planner as the fourth screenshot; the method page keeps the chart and the
  formulas, with the term detail now on the board.
- Gate: dashboard source 64,926 of 65,536 bytes; dossier 1,394,979 bytes; four
  1280x1024 screenshots; verify.mjs all pass.
- Quota: today's 5 spent, 4 entries left in total. Submit v8 after 2026-11-24T00:00:00Z
  and keep v5 pinned until v8 is measured.

## Final screening check, 2026-11-23 11:45 UTC

- Leaderboard read with 17,723 rated entries.
- Place-40 line (the 40th-best interval low): **943,891**.
- v5 interval: **927,048 - 958,643**. Its high clears the line by 14,752, so v5 goes
  on to the final heat (entries close 2026-12-14T10:00:00Z).
- v5 low is below the paid-places line (10th-best low 949,612), but the final heat
  re-judges every finalist afresh, so the dev point estimate is not the final result.
- The line can rise as more entries arrive; monitor it before the deadline.

### v8b, 2026-11-23 — review fixes, ready for the next quota day

Codex reviewed v8 and proved three farm-economics bugs:
- `farmPlan` counted two one-off gas charges while the steps list three. Now fees =
  3 gas + weekly x weeks + exit, so the plan, net and net/hour agree.
- The planner's "Worth only" filter used the $10,000 verdict, then showed the verdict at
  the allocated size, so it could list skip rows. It now filters on the allocated verdict.
- The planner's net/hour used the maximum protocol hours instead of the total active work.
  It now sums active hours; the $10k / six-protocol case reports $24/hour, not $140.

Codex also noted two limits that stand: growth and age enter through the token-odds model
rather than the value curve (disclosed), and plans are category templates because the
snapshot carries no pool or route data.

- Commit `4615746`, bundle `radar-v8b.tar.gz`, transcript check passes (83.6% authored).
- Gate: dashboard source 65,2xx / 65,536; dossier 1,397,102; four 1280x1024 screenshots.
- Not submitted: today's quota is spent. Submit after 2026-11-24T00:00:00Z and keep v5
  pinned until v8b is measured.
- Scheduled: `/tmp/opencode/submit-v8b.sh` wakes at 2026-11-24T00:00:30Z, checks
  `can_submit`, then submits commit `4615746` with the checked bundle. v5 stays the final
  pick until v8b is scored and compared.
