# trolloks-token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/trolloks/trolloks-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/trolloks/trolloks-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Launch Radar ranks every protocol that records no token in the sealed DefiLlama snapshot by the value its token would have if it launched today. The model is TVL x a shrunk category multiple of live-token peers x 7-day growth x maturity, with an 80% band calibrated on held-out peers. The dashboard separates the 128 live-token protocols, covers all 40 watchlist records, and gives every row a costed farm plan.

## Run it

```sh
node main.ts --input /path/to/input --output out
```

Then open `out/dashboard/index.html`; `out/board.json` is the ranked board and `out/dossier.json` is the judge dossier.

---

<sub>Entered on [make.fun](https://make.fun/?ref=22pw7tmq&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
