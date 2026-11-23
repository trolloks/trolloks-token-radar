# Launch Radar dashboard

A static page (no framework, no network) that renders the models written by `main.ts`
into `../data.js`. It is the reader-facing half of the token-radar entry.

## Two fitted models

**Value (what a launch would be worth).** `implied = TVL x exp(a + b x ln TVL)` is fitted
on the 128 live-token protocols. The slope is negative: bigger TVL commands a lower
multiple. At $100M TVL the curve gives 0.16x. Out of sample the curve misses by 3.44x
(leave-one-out) and 3.39x (walk-forward), against 4.77x and 5.04x for a flat multiple.

**Odds (whether the record carries a token).** A logistic model on log TVL, log age,
7-day growth and the category token rate. Its Brier score is 0.213 against a 0.248 base
rate (walk-forward 0.234 against 0.281). Growth and age were tested in the value model
and dropped; they enter through the odds, where they survive both tests.

Value terms are added to a flat baseline; odds terms are removed one at a time from the
full model. A term is kept only when it improves both blind tests. The method page shows
the terms, the kept/dropped verdicts and the held-out calibration.

## Range and farm economics

The P25-P75 band covers 50% of held-out protocols and P10-P90 covers 80%. Each detail
page shows a what-if sandbox that reprices the launch from TVL and the odds from growth
and age.

Farm economics use a $10,000 position over 12 weeks: a 7% airdrop share of implied value
pro-rated by position/TVL, minus the plan's fees, against the same money in a 4% T-bill.
The board shows the verdict and net per hour.

## Coverage

All 40 watchlist records, 302 pre-token records below the $50M floor, 128 live-token
peers and 288 token records without a usable price add up to all 758 snapshot protocols.
144 of the 342 pre-token records are bridge, CEX or wrapped/versioned products and are
shown under All records, not in the candidate ranking.

## Page behaviour

- Board: search, category, verdict and scope filters, sortable headers, stars.
- Detail: the two models, live peers, scenarios, sandbox, due diligence, 8-step farm plan.
- Method: both terms tables, range honesty, calibration chart and counts.
- Shortlist: starred protocols compared side by side; CSV export for the filtered board.

Files: `index.html`, `app.css`, `app.js`. Data is `window.RADAR` in `../data.js`.
