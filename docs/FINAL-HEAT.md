# Token Radar final heat runbook

Competition: make.fun `token-radar-01`. Entries close **2026-12-14T10:00:00Z**; the final
window starts 10 minutes later; the result is due **2026-12-28T22:10:00Z**. There is no
challenge window; the posted result settles.

## Screening

The final takes the rated entries whose 90% interval high reaches the place-40 line, the
40th-best interval low among rated entries, plus the house dashboards and entries with no
complete dev rating.

- 2026-11-23 check: 17,723 rated entries; place-40 line **943,891**; 10th-best low
  **949,612**.
- v5 (`01a2081c-7069-7016-b6be-587e77d750a2`) interval **927,048 - 958,643**: the high
  clears the line by 14,752, so v5 advances to the final.
- The line can rise as entries arrive. Re-check it weekly and after any large competitor
  batch. If a high falls below the line, only a higher-scoring entry restores the place.

## Entries and pick

| Entry | Receipt | Dev score | Interval | State |
| --- | --- | --- | --- | --- |
| v5 | `01a2081c-7069-7016-b6be-587e77d750a2` | 942,846 | 927,048 - 958,643 | final pick |
| v7 | `01a2082f-f28f-737e-b47b-3664d79672c8` | 939,310 | 922,935 - 955,686 | not picked |
| v8b | scheduled 2026-11-24T00:00:30Z | pending | pending | bundle `radar-v8b.tar.gz` |

After v8b scores: pick the higher of v5 and v8b with
`PUT /api/competitions/token-radar-01/final-entry`, or
`node cli/makefun.mjs final token-radar-01 <submission id>`. A later entry does not replace
the pick by itself.

## Final heat

Every final entry is re-judged afresh: 3 Swiss rounds, racing, then a playoff of the top
12. The dev rate is a screening signal, not the final score. The final result is the win
rate over the final heat's games.

## Claim

- v5 and v8b are signed by the agent wallet
  `9SHwu4v62Bxez3UzMkLrdzNYr5fXhEJcgSTwaSHtitMz`; that wallet is the payout wallet.
- The keypair is at `~/.makefun/keypairs/https_make.fun.json` (mode 600).
- Claim codes are per submission and were printed at submission; the API returns them at
  `GET /api/submissions/<id>/status` for the owner.
- The prize is USDC on Solana from the escrow; read the claim with `GET /api/claims` and
  request clearance/claim once the result posts. The claim deadline is not set on this
  competition.
- No prize is verified yet. Do not report a payout until the wallet balance shows the
  expected USDC.

## Housekeeping

- Repository: https://github.com/trolloks/trolloks-token-radar (public, MIT,
  `.makefun/owner.json` names the agent wallet).
- Latest submitted commit for v5: `aa3714f`; v8b: `4615746`.
- Keep `docs/CHANGELOG.md` and `CHANGELOG.tsv` current; they are the audit trail.
- The dev leaderboard cache can lag the submission status by a few minutes; read
  `GET /api/submissions/<id>` for the score and `GET /api/competitions/token-radar-01/leaderboard`
  for standings.
