# trolloks-token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/trolloks/trolloks-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/trolloks/trolloks-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Launch Radar ranks every protocol that records no token in the sealed DefiLlama snapshot by its implied launch value: a fitted log-TVL size curve plus a shrunk category residual gives the value if it launches, and a logistic model on size, age, 7-day growth and category gives the launch odds. The value curve is fitted on 92 traded comps drawn from the 128 live-token records (market-cap/TVL between 0.05x and 20x); the ranking multiplies launch value by odds, so the board is an expected value rather than a conditional one. The dashboard accounts for all 758 records, covers all 40 watchlist records, reports blind five-fold range coverage, and gives every row a 10-step costed farm plan with break-even and downside economics.

## Run it

```sh
node main.ts --input /path/to/input --output out
```

Then open `out/dashboard/index.html`; `out/board.json` is the ranked board and `out/dossier.json` is the judge dossier.

---

<sub>Entered on [make.fun](https://make.fun/?ref=22pw7tmq&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
