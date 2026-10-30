# Expanded playable map plan

Linked prompts file: `prompts/2026-10-27-214210-expanded-playable-map-prompts.md`
Linked learnings file: `learnings/2026-10-27-214210-expanded-playable-map-learnings.md`

## Goal

Build a walkable, modestly expanded environment test with a measurable floor plan and the assets needed to communicate camp, bridge and castle.

## Approach

1. Delegate the floor plan and environment implementation to a sub-agent, preserving camera and look-development controls.
2. Reuse existing assets; generate a tent candidate from the existing prop sheet to improve the starting camp, within the previously authorized budget.
3. Verify real movement across the bridge, collision, camera and touch interaction in an isolated committed build on desktop and emulated mobile sizes.
4. Compare the runtime to the selected references with an honest list of remaining visual gaps, then serve it on the user's requested port 5173.
