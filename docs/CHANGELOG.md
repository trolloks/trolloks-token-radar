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
- Held until the change is judged large enough to spend an entry.
