# Environment and Character Labs Learnings

Related records:
- `plans/2026-10-27-184425-environment-character-labs-plan.md`
- `prompts/2026-10-27-184425-environment-character-labs-prompts.md`

## Context

The user requested background environment and character test scenes while the main track improved the greybox.

## What Happened

Two environment reference sheets and a Blender prototype kit feed a scene with supported lighting, shader, post, foliage, water, camera and color controls. A character scene uses the knight with movement, blending, actions and camera settings. The greybox now has pursuing minions, health and camp recovery, gate progression and a core. All are local prototypes; there is no multiplayer.

The initial portrait character capture showed the DEV debug toggle overlapping Attack. A coarse-pointer fix and guard were added; the final committed f263138 scene tests passed. Its packaged WebGPU/WebGL 2 smoke also passed, including keyboard victory and emulated touch attack. Rust and 249 game tests passed on aa0b834 before the overlay-only fix; two Rust docs examples were ignored. Environment scene checks covered desktop, phone and short landscape; character checks covered desktop and phone. No physical phone was tested.

## Decisions and Costs

The generated references cost $0.0746 fal, bringing cumulative spending to $0.8243 of $10. No Tripo credits were spent. The reference/runtime camera is not matched and the visual look remains open; foot contact, clipping, animation timing, online authority and scaling remain unverified. The specified documentation subagent model was unavailable, so capture and journey were prepared locally.
