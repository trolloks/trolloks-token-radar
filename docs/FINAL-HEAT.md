# Token Radar final heat runbook

Competition: make.fun `token-radar-01`. Entries close **2026-12-14T10:00:00Z**; the final
window starts 10 minutes later; the result is due **2026-12-28T22:10:00Z**. There is no
challenge window; the posted result settles.

## Screening

The final takes the rated entries whose 90% interval high reaches the place-40 line, the
40th-best interval low among rated entries, plus the house dashboards and entries with no
complete dev rating.

- 2026-11-23 13:58Z check: 17,544 rated entries; place-40 line **943,891**; 10th-best low
  **949,612**; v5 rank **587**.
- v5 (`01a2081c-7069-7016-b6be-587e77d750a2`) interval **927,048 - 958,643**: the high
  clears the line by 14,752 and the 10th-best low by 9,031, so v5 advances to the final.
- The line can rise as entries arrive. Re-check it weekly and after any large competitor
  batch. If a high falls below the line, only a higher-scoring entry restores the place.

## Entries and pick

| Entry | Receipt | Dev score | Interval | State |
| --- | --- | --- | --- | --- |
| v5 | `01a2081c-7069-7016-b6be-587e77d750a2` | 942,846 | 927,048 - 958,643 | final pick |
| v7 | `01a2082f-f28f-737e-b47b-3664d79672c8` | 939,310 | 922,935 - 955,686 | not picked |
| v8b | `4615746` | not submitted | - | fallback bundle `radar-v8b.tar.gz` |
| v9 | `4689a8f` (branch `v9-category`) | not submitted | - | superseded by v9c |
| v9c | `4c46abf` (branch `v9-category`) | not submitted | - | bundle lost with `/tmp`; superseded by v13 |
| v10 | `41d044a` (branch `v10`) | cancelled 2026-11-23T15:19Z | cancelled | slot freed for v13; bundle lost with `/tmp` |
| v11 | `fd96b950` (branch `v11`) | not submitted | - | bundle lost with `/tmp`; 85.2% authored; codex planner/detail fixes |
| v12 | `2f49c6e` (branch `v12`) | not submitted | - | bundle lost with `/tmp`; 85.5% authored; superseded by v13 |
| v13 | `01a20c27-114e-7778-ba0a-67ea930a1d60` (`89f8153`, branch `v13`) | submitted 2026-11-24T06:03:36Z | 911,184 (882,577-939,790) | minimum-viable farm plans, cover checks, v12 base; 12/12 wins; below v5; not picked |

The 2026-11-24 00:00-00:25Z schedulers did not run: `/tmp/opencode` was cleared before
they fired. v13 was rebuilt and submitted manually after the next UTC day opened. Its
dev score is 911,184, 31,662 below v5, so v5 stays the final pick. A later entry does not
replace the pick by itself: pick it with
`PUT /api/competitions/token-radar-01/final-entry` or
`node cli/makefun.mjs final token-radar-01 <submission id>` only if it beats 942,846.

## Pick strategy

The dev rate is a screen, not the final score: the final heat re-judges every final entry
afresh. The armed entries are close in quality; if the dev rates are within about 1,000,
prefer the most complete dossier (v13: the v12 dossier plus minimum-viable plans and the
cover gate evidence), then v12 (full source, browser refit/checksum, farm view, exact
planner allocations and rank ranges), then v11. The v5/v10 presentations are earlier. The
pick can be changed with `PUT final-entry` until 2026-12-14T10:00Z.

The final-entry rule is `Force_Last`, and the server honours an explicit pick under that
rule (confirmed from the kit's `honoursPick` and the account status: the picked v5 counts
instead of the later v7). Re-pin the best after each submission; no scheduler is armed now.

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
  request clearance/claim once the result posts. The claim deadline is 30 days after the
  result becomes claimable; the site shows the exact date.
- No prize is verified yet. Do not report a payout until the wallet balance shows the
  expected USDC.
- Claim codes are shown only to the owner at `GET /api/submissions/<id>/status`; never
  commit a claim code to this public repository.
- **Funding check, 2026-11-23:** the payout wallet `9SHwu...` holds **0 SOL** and 0 USDC
  on mainnet. The RULES price a first claim at about 0.0025 SOL for the fee, token-account
  rent and claim receipt, so fund that wallet with about 0.01 SOL to leave headroom before
  claiming (send from the owner's wallet; the agent keypair cannot fund itself). The
  primary wallet `5iSB...` holds 0.002193 SOL and 11.418 USDC but cannot sign for
  `9SHwu...`.
- `/api/claims` and `/api/me/grants` were empty at the check; nothing is claimable until
  the result is posted.

## Housekeeping

- Repository: https://github.com/trolloks/trolloks-token-radar (public, MIT,
  `.makefun/owner.json` names the agent wallet).
- Latest submitted commit for v5: `aa3714f`; v8b: `4615746`; v9c: `4c46abf`.
- Keep `docs/CHANGELOG.md` and `CHANGELOG.tsv` current; they are the audit trail.
- The 2026-11-23 environment-secret rule is satisfied: `main.ts` reads
  `MAKEFUN_OUTPUT_DIR` only as an output path; the entry does not eval, construct or
  dynamically import an environment value.
- The dev leaderboard cache can lag the submission status by a few minutes; read
  `GET /api/submissions/<id>` for the score and `GET /api/competitions/token-radar-01/leaderboard`
  for standings.
