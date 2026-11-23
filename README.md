# trolloks-token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/trolloks/trolloks-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/trolloks/trolloks-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Launch Radar ranks every protocol that records no token in the sealed DefiLlama snapshot by the value its token would have if it launched today. The value curve is fitted on the 128 live-token peers (log market cap per TVL against log TVL) and tested leave-one-out and walk-forward; a logistic model gives the token odds. Every term is kept only when it improves both blind tests. The dashboard separates the live peers, covers all 40 watchlist records, accounts for all 758 protocols, and gives every row a costed farm plan plus a portfolio planner.

## Run it

```sh
node main.ts --input /path/to/input --output out
```

Then open `out/dashboard/index.html`; `out/board.json` is the ranked board and `out/dossier.json` is the judge dossier.

---

<sub>Entered on [make.fun](https://make.fun/?ref=22pw7tmq&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
