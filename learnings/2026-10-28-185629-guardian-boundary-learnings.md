# Guardian boundary learnings

The production world advanced from round 1 to 2 while investigated, and the published revision passed a fixture-triggered finish and reset locally. The guardian could nevertheless follow a target through an open gate: the static roots remain at the heart, making the courtyard look empty. This was reproduced in simulation; the actual live guardian location at the time of the screenshot was not available.

Commit 75055c7 bounds the guardian to the courtyard and recovers an already escaped guardian without resetting its health or phase. Its isolated build, server typecheck and 494 tests passed. In a two-client browser fixture, an escaped guardian returned, was defeated by a human, and reset; the guardian appeared in a second-round runtime capture. The live production server was not deployed during this record and deployment approval is pending.

[Prompt](../prompts/2026-10-28-185629-guardian-boundary-prompts.md) · [Plan](../plans/2026-10-28-185629-guardian-boundary-plan.md)
