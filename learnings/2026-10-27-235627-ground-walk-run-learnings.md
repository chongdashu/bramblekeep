# Ground and movement learnings

Related records:
- `plans/2026-10-27-235627-ground-walk-run-plan.md`
- `prompts/2026-10-27-235627-ground-walk-run-prompts.md`

## Outcome

The landscape has tileable grass variation and a textured dirt path with shallow modeled stones. After the first pass the stones looked large and repetitive; the subsequent ground-relief revision used smaller, irregular beveled stones and renderer bump shading. The river channel and bridge remain clear, and ground collision is still flat.

Movement now walks at 40% of the configured run speed, with Shift, gamepad shoulder or the touch Run button selecting run. The run cycle's stride increased from 2.2 to 3.6 metres in the environment and compact game, reducing cycle rate per metre; walk/run clips blend based on movement. Character test has an adjustable run stride, now 3.6 m by default. “Walking is too fat” was interpreted as “too fast.”

The before/after uses the same camera and player position (z about −4.199) at `ce46bfd` and `c7226fe`; animation time and UI differ. The original supplied screenshot's camera settings are unknown. Ground and pavers are still stylized and the mesh's collision stays flat; the visual match to the concepts remains open. The shared development server may also contain other ongoing working-tree changes.

At `f47d465`, the isolated build and 279 game tests passed; Character test checks passed desktop and emulated phone. WebGPU and WebGL2 environment scripts reported all assertions passed but their Node processes remained alive and were stopped. A subsequent WebGPU environment run at `c7226fe` completed successfully. At `823bdc5`, keyboard and touch movement checks passed: 0.65 s moved 1.56 m walking vs 3.90 m running on keyboard, and 1.65 m vs 3.63 m on touch; the compact combat game moved 1.07 m vs 2.60 m. Character test selected walk at 1.36 m/s and run at 3.40 m/s. The packaged smoke at `97ba2f1` passed desktop and emulated phone on both renderers. The later revisions cover touch-button visibility, ground refinements, camera views and tests; they were not packaged-smoke tested again. Physical-phone testing and perceptual animation/foot-contact review remain open. No paid generation was used.
