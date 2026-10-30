# Environment and allies learnings

Related records:
- `plans/2026-10-27-204211-environment-allies-plan.md`
- `prompts/2026-10-27-204211-environment-allies-prompts.md`

## Context

The user asked for more intuitive attacks, an environment look closer to the north star with panning, and other-player simulation in the greybox.

## What happened

Attack guidance now identifies the input and highlights reachable targets. Zero to three optional local AI allies share combat and objectives; they are not networked clients and do not scale difficulty by population. The environment now has drag and keyboard/stick pan, a sky-facing camera, procedural sky and clouds, revised lighting, a Tripo castle keep and a fuller tree. Several iterations exposed a pale gate obscuring the new keep and a light-colored generated castle; the old gate was moved away and a reversible whole-material tint was applied to the keep. The packed material also darkens its roof.

A castle reference cost $0.0373 on fal; two Tripo assets cost 100 credits. Cumulative fal expenditure is $0.8616 of the $10 limit. The tree was made from an existing prop reference with no new fal charge.

## Result quality

The runtime before/after captures share a camera; matching the concept camera precisely is impossible from the available image alone. The scene is still short of the chosen B/C references: the terrain and water are flat and simplified, the bridge and vegetation lack their detail and material quality, and the world is not populated. The procedural sky is not a textured cubemap. The tree has one packed material and is static. This is an experiment, not visual approval.

## Verification and decisions

An isolated `a2e1132` build, Rust and 253 game tests passed; two Rust documentation examples are ignored. Dedicated environment tests covered pan, sky and controls at desktop, portrait and short landscape with WebGPU and WebGL2. Character lab passed desktop and emulated portrait. The packaged smoke covers desktop and emulated phone. A subsequent gate-position-only commit `96e70a8` passed the dedicated environment browser suite and cleared the extra gate from the opening frame. Physical-device review remains open. Keep the visual direction open and use the comparison as a basis for the next pass.
