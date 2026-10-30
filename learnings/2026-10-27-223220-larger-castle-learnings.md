# Larger castle learnings

Related records:
- `plans/2026-10-27-223220-larger-castle-plan.md`
- `prompts/2026-10-27-223220-larger-castle-prompts.md`

## Outcome

The keep is wider and taller, with two walls, battlements and roofed towers. The new architecture uses simple runtime meshes and matching collision; it is a blockout with flat surfaces, not final textured castle art. The gate remains closed in the environment test; this does not alter the compact combat game.

The prior and current runtime images use the same default starting camera with saved overrides cleared. Concept cameras are unknown, so concept comparison remains approximate. Walls need material detail and the castle has no built-out interior. Ground and water remain flat, and portrait framing still needs review.

Revision `9b9e213` passed WebGPU and WebGL2 environment browser checks; `6808542` passed the build and 261 game tests. The later change only added wall trim and slits. Tests covered desktop and emulated phone and short landscape, including walking across the bridge to the closed gate. No physical-device test or paid generation.
