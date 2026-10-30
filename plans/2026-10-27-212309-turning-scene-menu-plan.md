# Turning and scene menu plan

Linked prompts file: `prompts/2026-10-27-212309-turning-scene-menu-prompts.md`
Linked learnings file: `learnings/2026-10-27-212309-turning-scene-menu-learnings.md`

## Goal

Reduce snapping in directional changes and make scenes discoverable directly from the main menu; run the game on port 5173.

## Approach

1. Smooth rendered facing along the shortest rotation arc without changing movement authority.
2. Inspect generated locomotion clip boundaries and blend their non-matching endpoints.
3. Place direct character, environment and asset-viewer links in a menu that fits desktop, portrait and short landscape.
4. Exercise real keyboard and touch flows in isolated committed builds and serve the selected revision on port 5173.
