# Woodland atmosphere learnings

Related records:
- `plans/2026-10-27-225452-woodland-atmosphere-plan.md`
- `prompts/2026-10-27-225452-woodland-atmosphere-prompts.md`

## Outcome

The value-noise and jittered grid produce 10 collidable near trees and 110 distant lightweight silhouettes, in addition to six existing textured trees. The castle route and central sightline are deliberately kept clear. Four new torch posts and their flickering point lights join the campfire and two bridge lantern lights; torch brightness is independently adjustable. Point lights do not cast shadows. Distant trees use primitive canopies rather than textured foliage, and are simplified relative to the near trees.

The first visual pass had glossy, spherical distant crowns; a subsequent revision used multiple lobes and lower gloss. They still read more stylized than the textured foreground trees. The forest is less visible in portrait framing, and ground, water and castle surfaces remain simple compared with the chosen B/C direction. The concept camera is unknown, so the concept comparison is approximate and look approval remains open. The earlier large white shape seen from an orbited night camera remains unresolved. The forest is in the Environment test, not the compact combat game.

At `0875e96` the isolated build and 265 game tests passed; browser checks passed on WebGPU and WebGL2 at desktop, emulated portrait and short landscape. They checked the gate route, water, forest counts, torch lights and temporal flicker. No physical-phone or measured frame-rate performance test was performed. No paid generation was used.
