# Expanded playable map learnings

Related records:
- `plans/2026-10-27-214210-expanded-playable-map-plan.md`
- `prompts/2026-10-27-214210-expanded-playable-map-prompts.md`

## Context

The user requested a playable floor plan and assets for an expanded map in the scene test, delegated to a sub-agent. Prior oversized world concepts had been rejected.

## What happened

The environment test now provides a 44 × 52 m local walking space. The approximately 40 m camp-to-castle route crosses a central bridge and has side clearings. Water, castle, tree and tent colliders constrain the player; mouse and touch pan, orbit/zoom, look tuning, recenter and reset remain available. The test does not contain combat or networking and its capacity for 20–30 players is unverified.

The sub-agent reused the existing modular kit and generated one Tripo tent from a crop of the existing prop reference. A same-camera comparison showed it was clearer than the former wedge, but the canvas has mottled artifacts. No new fal was spent; the tent cost 50 Tripo credits. Cumulative fal remains $1.1932 of the $10 cap. The agent recorded its source, export, receipt and measured dimensions.

## Quality and verification

The user-facing build on port 5173 uses `dfd50e0`. The environment matrix passed WebGPU and WebGL2 desktop, emulated portrait and short landscape, including actual crossing and castle/water collision, simultaneous touch movement and pan, recenter, reset and saved look. An independent `dfd50e0` build and 260 game tests passed; the preceding `e44b495` passed Rust workspace tests, skill sync and WebGPU/WebGL2 packaged smoke. The subsequent change adds renderer reporting and test support. Two Rust doc examples were ignored, and physical-device testing remains open.

The selected concept cameras are unknown, so the reference comparison is approximate. The scene remains an unapproved blockout: the ground, water and bridge are flat, the packed castle tint darkens multiple materials, the tent has generated artifacts, and the knight is small on portrait.
