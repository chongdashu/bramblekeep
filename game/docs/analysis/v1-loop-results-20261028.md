# Bramblekeep v1 loop priorities

Jev 1.14.0 evaluated nine candidate scopes against the brief and the current shared checkout on 2026-10-28. Its outputs are structured judgments on the supplied descriptions; Jev did not play the game and no independent player observations were included.

The reproducible ordering is `0.7 * (loop impact / 3) + 0.3 * (v1 fit / 2)`. These weights express this assessment's preference for closing the experience over ease of implementation; the value is not a success probability. `python3 game/docs/analysis/v1-loop-ranking.py` replays the ranking without a network call. The exact inputs, rubric, raw predictions and results are in the adjacent `v1-loop-jev-*.json` files.

| Rank | Candidate | Loop impact / 3 | v1 fit / 2 | Weighted |
| --- | --- | --- | --- | --- |
| 1 | Heart-tree encounter | 2.54 | 1.77 | 0.858 |
| 2 | Class combat and feedback | 2.29 | 1.88 | 0.816 |
| 3 | Post-victory return loop | 2.02 | 1.81 | 0.743 |
| 4 | Population scaling | 2.08 | 1.63 | 0.730 |
| 5 | Onboarding | 1.82 | 2.00 | 0.725 |

With an 80/20 impact/fit weighting the first three stay the same. At 50/50, onboarding becomes third and return becomes fourth. This sensitivity and the close fourth/fifth scores make the precise ordering provisional. Mobile controls, real multiplayer reliability and population scaling are release requirements regardless of their score; no score overrides those explicit requirements.

Three authored synthetic smoke cases passed their labeled expectations (loop impact 2/2, fit 2/2, user signal 3/3). The nine real candidate judgments were unlabeled: no independent ranking or held-out evaluation exists. The evaluation command exits 1 because these cases are intentionally unlabeled, not because an API request failed. These smoke results do not establish ranking accuracy, player preference or retention.

Twelve live requests used 9,870 input tokens; at the documented Jev 1.14 input rate of $0.042 per million input tokens, estimated input cost is $0.000415, excluding any charges not represented in the response. Resolved model `jev-1.14.0`. Questions hash and case hashes are in the saved report. Next: observe players completing the loop without coaching, alone and together, and compare their reported friction and repeat-play choice with these priorities.
