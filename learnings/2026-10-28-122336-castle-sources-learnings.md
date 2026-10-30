# Castle Sources Learnings

Related records:
- `plans/2026-10-28-122336-castle-sources-plan.md`
- `prompts/2026-10-28-122336-castle-sources-prompts.md`

## Context

The prior gate controls were near the center, and source selection depended on enemy slot; courtyard and shared-world changes were already uncommitted.

## What Happened

The levers moved to x ±5.2. The in-progress shared world rotates between exterior castle exits, two hollow tree nests and, after breach, courtyard barracks. The sources are solid where players should not enter; enemies spawn on clear ground and respawns visually emerge. The isolated integrated snapshot passed 381 tests, a two-client gate check and a full two-client victory/reset. A standalone committed build passed 310 tests; the wider lever placement revealed a scripted route that had to navigate around a torch. The source system depends on existing uncommitted courtyard and multiplayer work and remains uncommitted with it. A visual comparison to a matched concept remains open.
