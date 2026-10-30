# Turning and scene menu learnings

Related records:
- `plans/2026-10-27-212309-turning-scene-menu-plan.md`
- `prompts/2026-10-27-212309-turning-scene-menu-prompts.md`

## Context

The user reported characters snapping on direction changes, could not find the scenes in the main menu, and asked for a stable local port.

## What happened

Integrated character and AI ally facing now ease along the shortest angular path rather than snapping. Inspection also found the run clip endpoints differ by up to 43.63 degrees on a forearm; blending the last 15% into the start reduces that loop discontinuity in the integrated game and character lab. This is a runtime mitigation, not evidence that full cycles or foot contacts have been artistically approved.

Character test, Environment test and Asset viewer are direct main-menu links; Play enters the integrated game. A game-owned menu layout fits the links on smaller screens. The committed build is served locally at `http://localhost:5173/`.

## Verification

`a4c95a5` passed build, 258 game tests, and the menu/turn browser test: desktop direct entry for all three scenes, visible menu bounds at desktop, emulated portrait and short landscape, and a real-input reversal changing rendered facing over multiple frames. The character lab test passed desktop and emulated portrait. The preceding `688f95c` passed Rust workspace and vendored-skill checks, with two Rust documentation examples ignored. Packaged smoke covers WebGPU and WebGL2 desktop and emulated phone. Physical-phone play and perceptual animation quality remain open.
