# Kickoff Learnings

Related records:
- `plans/2026-10-27-175658-kickoff-plan.md`
- `prompts/2026-10-27-175658-kickoff-prompts.md`

## Context

The user chose the mix of B's open exploration and C's gate approach, and requested Tripo.

## What Happened

A local placeholder gym implements movement, three stationary targets and a gate that opens when cleared. A knight and static gate were exported and loaded in the engine viewer; a Blender scale image places the real knight beside the reimported gate. The knight's original slash looked like a bow; a second Tripo punch was substituted, and a run hip offset was corrected. Hand sockets, skin clipping, loop closure, foot contact and usable attack timing remain open. The gate has no breach animation.

An isolated checkout of f4c9791 passed build, Rust and game tests, skill check, and packaged WebGPU/WebGL 2 smoke on desktop and emulated phone. The portrait capture revealed an instruction/attack-button overlap; ed4a105 moves the hint and adds a non-overlap smoke check, and its isolated packaged smoke passed on both renderers. Desktop keys cleared enemies and opened the gate; phone touch moved the player and exposed its attack control. Two Rust doc examples are ignored. Online play and physical phone testing remain unverified. A matched-camera comparison to the chosen direction is still pending; the gym is intentionally proxy-only.

## Costs

Character: $0.0372 fal and 135 Tripo credits. Environment: $0.0370 fal and no Tripo credits. Gym: no paid service. Cumulative fal spend: $0.7497 of $10. The specified documentation model was unavailable, so capture and journey were prepared locally.
