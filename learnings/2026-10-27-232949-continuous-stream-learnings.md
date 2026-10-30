# Continuous stream learnings

Related records:
- `plans/2026-10-27-232949-continuous-stream-plan.md`
- `prompts/2026-10-27-232949-continuous-stream-prompts.md`

## Outcome

The Blender crossing's continuous stream, bed and banks now span x = −80 to +80 m, beyond the playable x = −22 to +22 m. Eight new rocks and four trees border the outer banks; the stream blocks movement except at the bridge. Their positions and approximate collision are game-owned in a shared JSON layout.

A clean Blender GLB reimport verified the endpoints, five water cross sections against the collision equation, and geometry near all eight rock centres. The extended asset has 11 meshes, 30,232 declared triangles and is 1,240,516 bytes; these figures are inventory, not measured mobile performance. Four runtime views were inspected: bridge, east, west and emulated portrait. A matched-camera runtime before/after uses parent `f55c8d2` and revision `19b99fb`; animated water and walk timing vary slightly. Original concept cameras are unknown, so the concept comparison remains approximate. The banks and water remain stylized and flat, the water highlight pattern is stretched across a longer channel, and the obstacles are approximate rather than mesh collision.

The isolated build and 277 game tests passed at `19b99fb`, as did WebGPU and WebGL2 environment tests on desktop, emulated portrait and short landscape. The route to the gate, off-bridge water collision, camera, touch movement and saved look were checked. No physical-phone test or paid generation.
