# Camera, world and classes learnings

Related records:
- `plans/2026-10-27-205620-camera-world-classes-plan.md`
- `prompts/2026-10-27-205620-camera-world-classes-prompts.md`

## Context

The user asked for orbit and zoom in the environment lab, a more expansive world study, a lower up-screen castle approach, two class attack prototypes and parallel character and enemy generation.

## What happened

The lab has right-drag orbit, wheel zoom, drag/WASD pan and touch-accessible orbit, pitch and view-width sliders. Gameplay and character cameras face toward the castle from behind, with screen-relative controls. The greybox can switch between Knight, a short-range hit; Spellcaster, a medium-range instant splash; and Scout, a longer-range instant single-target shot. The ranged effects are placeholder hitscan, not final projectile or animation systems. Local allies remain optional.

Five map concepts show alternative routes and an overhead world illustration; the pictures do not prove 20–30-player capacity. Terrain, path width, landmark spacing and measured encounters matter more than simply adding props. Recommended starting exploration is branching ridges plus a bridge and ford; this is not a user selection.

Two Tripo rigged character candidates load in the viewer and character lab with idle/walk/run/jump. They have no class-specific attack clips, weapons or hand sockets. Two static Bloom and Bramble enemy candidates load in the viewer; they are not gameplay enemies. Bramble's face is partly hidden by its crown at the tested viewer angle.

## Quality and costs

The camera and runtime remain greybox and do not visually match the generated map imagery. Reference camera parameters are unknown; screenshot comparisons are approximate. Animation deformation, full cycles, foot contact, actual network capacity and physical-device review are open.

This work cost $0.1907 fal for maps, $0.0666 for characters, $0.0743 for enemies, totaling $0.3316. Cumulative fal is $1.1932 of the $10 cap. The two characters cost 230 Tripo credits and enemies 100, totaling 330 credits this round.

## Verification

`ee8779f` passed isolated build, Rust workspace tests, 254 game tests, skill synchronization and packaged smoke with WebGPU/WebGL2 desktop and emulated phone. Two Rust documentation examples were ignored. The environment browser suite passed desktop, portrait and short landscape including mouse orbit, wheel zoom and touch pan. Character switching was exercised in browser; full animation quality remains unreviewed. See the lab review for later checks and evidence.
