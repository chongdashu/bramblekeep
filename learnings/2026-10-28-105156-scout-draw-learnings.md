# Scout Draw Learnings

Related records:
- `plans/2026-10-28-105156-scout-draw-plan.md`
- `prompts/2026-10-28-105156-scout-draw-prompts.md`

## Context

Scout aiming previously fired automatically while the attack control was held.

## What Happened

The bow now charges and targets farther while held, releases once, and retains the chosen range for projectile collision. Both solo and the in-progress shared-world server use the same draw rules. An isolated snapshot built successfully and passed 362 tests; a browser connected to a separate server verified a full draw and exactly one release. The shared-world integration remains in the existing uncommitted multiplayer files.
