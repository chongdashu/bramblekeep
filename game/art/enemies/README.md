# Enemy appearance experiments

Two static Tripo P1 candidates based on separate fal-generated references: **Bloom**, a small orange flower sprout, and **Bramble**, a larger dark seedpod with leaf armor and curled vine arms. Their readable distinct silhouettes are intended for eventual varied encounters. These are visual candidates, not approved enemy designs or functioning combatants. No rig, animation, behavior, networking, hit response, or collision is included. In particular, the dark Bramble face loses detail in dim lighting and needs a runtime readability check at phone scale. The generated backs and underside require closer inspection before gameplay use.

| Asset | Height | Bounds (width × depth × height) | Declared triangles | Source |
| --- | --- | --- | --- | --- |
| Bloom | 1.0 m | 0.816 × 0.436 × 1.0 m | 11,368 | [reference and receipt](bloom/) |
| Bramble | 1.4 m | 1.622 × 0.848 × 1.4 m | 11,677 | [reference and receipt](bramble/) |

Measurements are from clean Blender 5.2 export reimport, with floor pivot at the origin. Blender Z-up / -Y front exports to glTF Y-up / +Z front; each consists of one opaque material with embedded color, normal and metallic-roughness textures, and no required extensions. These facts are not evidence of browser appearance, animation quality or collision fidelity. The 11k-triangle candidates need LOD and draw-cost review before populating a 20–30-player world. Compare the reference to the runtime at an equivalent camera before accepting the look.

The source `tripo-original.glb`, generated reference and editable `.blend` are retained in each folder. Rebuild and measure without paying the provider again:

```sh
'/Applications/Blender.app/Contents/MacOS/Blender' --background --python game/art/enemies/build.py
'/Applications/Blender.app/Contents/MacOS/Blender' --background --python game/art/enemies/verify.py
```

The two fal references cost **$0.0743** total ($0.0371 Bloom, $0.0372 Bramble); the two Tripo image-to-model tasks consumed **100 credits** (50 each). Exact prompts and sanitized receipts are in each asset folder. The caller owns the shared game preview list and gameplay integration, so merely adding the exports does not substitute them into the greybox.
