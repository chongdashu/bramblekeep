# Environment test: expanded floor plan

**Prototype, not a multiplayer-capacity claim.** The playable area is 44 × 52 m (x −22..22, z −26..26), compared with the current combat slice's roughly 15 × 20 m. The 40 m direct approach is about seven seconds at the 6 m/s test speed. The castle faces the camp; up-screen moves toward the castle in the default camera.

```text
                        NORTH / up-screen (−Z)
    x −22                      0                        +22
 z −26 ┌────────────────────────────────────────────────┐
       │  outer grove          CASTLE             grove │
 z −18 │                  ┌── CLOSED ──┐                │
       │  tree             │   KEEP     │          tree │
       │                   └────────────┘               │
       │         west clearing       east clearing      │
       │      tree                                 tree │
 z  +8 ≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋ [  BRIDGE  ] ≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋≋
       │             broad open route                   │
       │    tree                                tree    │
 z +22 │          CAMP   ● START                        │
 z +26 └────────────────────────────────────────────────┘
                        SOUTH / camp (+Z)
```

- The camp tent sits beside the spawn. A single broad route goes north through a wooden bridge to the closed castle. Side clearings provide room to wander on both banks. The river is visually blocked outside the bridge; there is no swimming in this test.
- The keep's closed footprint, tent, tree trunks, camp props, signposts, rock clusters, ruin piers, visible water edge and low boundary markers constrain the walking character. The landscape and small accents are decorative; the test is about spatial scale and traversal, not combat, enemy encounters or a finished level.
- A Blender-authored prop kit adds a campfire, crates, trail sign, bridge lanterns, rock clusters, shrubs and a small ruin. Its placements and approximate collision circles come from the same game-owned layout file. The Tripo keep, tree and knight and the procedural environment kit are reused. The camp tent is a new Tripo candidate made from an existing prop-sheet crop (50 credits, no new fal charge). The bridge, route and edge markers are simple game-owned blockout shapes.
- Keyboard and touch stick move the knight; mouse left-drag pans, right-drag orbits and scroll zooms. On touch the left half is the movement stick and the right half pans. Recenter returns the view to the knight. Look tuning and its saved controls remain available. Exploration starts immediately, without a countdown.

Review at target sizes with real input: walk from camp across the bridge to the castle, confirm water and closed castle collision and screen-space controls, pan/orbit/zoom, recenter, and check the landmarks at character scale. Saved look overrides must be cleared for visual review. This is a modest environment test, not a playable multiplayer world or an approved final art treatment.

## Runtime review — `dfd50e0`

[Camp view](../../share/media/20261027-expanded-map/desktop-camp.jpg) · [Bridge view](../../share/media/20261027-expanded-map/desktop-bridge.jpg) · [Portrait view](../../share/media/20261027-expanded-map/phone-camp.jpg) · [B/C concept and runtime comparison](../../share/media/20261027-expanded-map/reference-runtime-approx.jpg). The concept camera settings are unknown, so this comparison is approximate and the visual look remains open rather than approved. Ground, river and bridge are still flat and simplified; the tent canvas has generation artifacts; tint affects the castle's packed materials; and the knight is small on portrait. There is no combat or networked multiplayer in this scene.

The final environment browser suite passed with WebGPU and WebGL2 explicitly selected at desktop, emulated portrait and short landscape. It exercised bridge-to-castle traversal, off-bridge water collision, simultaneous touch movement and pan, reset, recenter and saved-look reload. At `dfd50e0` an isolated build and 260 game tests passed. The preceding `e44b495` passed Rust workspace tests, skill sync and packaged smoke; the subsequent change added renderer reporting and the renderer-aware test. Two Rust documentation examples were ignored. Physical-device testing remains open. The tent cost 50 Tripo credits and no additional fal spend.

## Prop pass — `9add1be`

The existing route has a Blender-authored campfire, crates, trail sign, bridge lanterns, rocks, shrubs and a small ruin. Prop placements and solid collision circles use one shared layout; the direct camp-to-castle route and the ruin opening remain walkable. The fire and lanterns are static; they do not cast dynamic light. [Starting view before and after](../../share/media/20261027-world-props/before-after.jpg) uses the same camera defaults and fresh overrides; [portrait](../../share/media/20261027-world-props/phone.jpg) shows the new layout. The original B/C concept camera settings are unknown, so the [concept comparison](../../share/media/20261027-expanded-map/reference-runtime-approx.jpg) cannot be precisely matched. The look remains open: terrain, river and bridge are flat, the new props are simplified beside the textured tree and tent, the tent has texture artifacts, and the character is small in portrait.

The clean Blender reimport reported 11 meshes and 3,384 triangles. The final `9add1be` isolated build, 261 game tests and dedicated WebGPU/WebGL2 environment matrix passed at desktop, emulated portrait and short landscape. The immediately preceding `68e2225` passed the Rust workspace, skill synchronization and packaged smoke; `9add1be` changes only the sign's geometry. Two Rust documentation examples were ignored. Physical-device and perceptual animation checks remain open; no new paid generation was used.
