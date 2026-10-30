# Courtyard Reinforcements Learnings

Related records:
- `plans/2026-10-28-164446-courtyard-reinforcements-plan.md`
- `prompts/2026-10-28-164446-courtyard-reinforcements-prompts.md`

## Context

The shared six-enemy cap let exterior patrols occupy every slot, so barracks could remain inactive throughout the boss encounter.

## What Happened

The boss courtyard now has two dedicated reinforcement slots, with a six-second spacing between arrivals and respawns. The simulation skips occupied doorways, continues while a player remains inside after a gate repair, and resets for a new round. The concurrent commit `05e1170` included the changes. An isolated build of that revision passed 453 tests and a two-client browser breach that observed both courtyard defenders.
