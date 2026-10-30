# Compact integrated slice learnings

Related records:
- `plans/2026-10-27-210420-compact-integrated-slice-plan.md`
- `prompts/2026-10-27-210420-compact-integrated-slice-prompts.md`

## Context

The user found the latest world concepts too big and requested a floor plan followed by a smaller integrated game with existing modular assets.

## What happened

The floor plan reuses the existing roughly 15 × 20 m simulation: camp at negative Z, three enemies, gate at positive Z, and core behind it. The game now displays the selected skinned Knight, Spellcaster or Scout, optional Knight allies, Bloom and Bramble models, a modular gate and trees. Character locomotion responds to simulated movement. The static enemy models move with the sim but have no authored movement or attack clips. The gate door geometry disappears on open; there is no break animation. The core and wall extensions remain proxies. The Knight's existing punch is a preview; Scout and Spellcaster have no dedicated attacks or held weapons.

The initial composition clipped the gate and separated wall sections; a lower camera angle, connected wall extensions, a simpler ground and a compact short-landscape HUD improved readability. Decorative foliage and tent canvas do not add collision; the authoritative boundary and gate still come from the simulation.

## Quality and verification

`7be5fc1` passed isolated build, 254 game tests and WebGPU/WebGL2 packaged smoke on desktop and emulated portrait. The preceding `3ff84a3` passed the Rust workspace and skill checks; two Rust documentation examples are ignored. Short landscape at DPR 1 was visually inspected; physical devices and full animation quality were not tested. A concept/runtime comparison uses the selected C image, but its original camera is unknown, so a precise match is not established. The runtime remains much simpler, with flat ground, sparse surroundings, proxy walls and core, and no authored gate-break or enemy animation.

No new paid generation was used. The result is a local slice; networking, 20–30-player capacity, persistence and population scaling remain open.
