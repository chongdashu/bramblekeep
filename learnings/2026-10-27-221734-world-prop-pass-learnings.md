# World prop pass learnings

Related records:
- `plans/2026-10-27-221734-world-prop-pass-plan.md`
- `prompts/2026-10-27-221734-world-prop-pass-prompts.md`

## Context

The user asked for more world props, offered Blender as a tool, and asked for main-game progress.

## What happened

A game-owned Blender generator creates a campfire, crates, sign, two lanterns, rock clusters, bushes and a small ruin from a common placement file. The static combined export is 11 meshes and 3,384 triangles. Collision circles are derived from the same placements, with an open direct route and traversable ruin opening. The fire and lanterns are visual samples and do not cast dynamic light. Four Blender preview passes were inspected and a clean GLB reimport checked bounds and proximity to the declared colliders. No new paid generation was used.

The main game remains a local compact arena with characters, minions, optional AI allies, gate and core; the larger map and this prop kit remain in Environment test. Real multiplayer, persistence, population scaling, authored enemy and class attack animation and integration of the expanded world into combat remain open.

## Quality and verification

The starting-view before/after uses the same camera defaults and cleared overrides. The original concept's camera settings are unknown, so comparison to the concept is approximate and the environment look is still unapproved. The ground, water and bridge remain flat, these props are simpler than the textured existing models, the tent has texture artifacts and the knight is small in portrait.

The final `9add1be` isolated build, 261 game tests and WebGPU/WebGL2 environment checks passed at desktop, emulated portrait and short landscape. The immediately preceding `68e2225` passed Rust workspace tests, vendored-skill sync and packaged WebGPU/WebGL2 smoke; the subsequent revision only changes the sign's geometry. Two Rust documentation examples are ignored; physical-phone testing and subjective play feel remain open. The updated committed build is served at `http://localhost:5173/`.
