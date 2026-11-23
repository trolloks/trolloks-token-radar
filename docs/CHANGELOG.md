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
- Score: pending.

