# Environment and allies plan

Linked prompts file: `prompts/2026-10-27-204211-environment-allies-prompts.md`  
Linked learnings file: `learnings/2026-10-27-204211-environment-allies-learnings.md`

## Goal

Improve environment navigation and visual depth, make the combat controls discoverable, and support optional local teammates for greybox playtests.

## Approach

1. Add input guidance and in-range feedback for combat.
2. Add up to three local AI allies that move, fight, share objective progress and respawn.
3. Iterate on the environment camera, procedural sky, lighting and assets; add mouse and touch panning and preserve tunability.
4. Compare saved-override-free runtime captures with the selected references, document visual gaps and test committed builds in isolation.

## Verification

Build, Rust and game tests, packaged WebGPU/WebGL2 smoke, dedicated lab tests including drag panning and sky, plus visual review of same-camera runtime captures and an approximate concept comparison.
