# Environment art study

Two fal GPT Image 2.5 Flare reference sheets propose a sparse camp, branching meadow, river bridge, ruin and castle approach (`landscape.jpg`) and nine modular props including two tree silhouettes (`props.jpg`). They are AI-generated visual references, not proof of modeled assets or final art. Exact prompts and sanitized receipts are alongside each image; landscape cost $0.0374 and props cost $0.0372, total $0.0746.

`environment-kit.blend` and `environment-kit.glb` are a small procedural prototype inspired by those sheets, not full-fidelity reproductions. The actual kit includes round trees, pines, shrubs, rocks, a path, a winding stream, segmented bridge, a tent, sign, a keep, ruins, subtle meadow variation, distant hills, sparse grass and flowers, and cloud forms. Its seventeen meshes declare 8,574 triangles; the foliage and stream materials use `vgd_kind` extras so the renderer's sway and wave settings have representative materials. The existing `gate-kit.glb` is loaded separately in the lab. The original procedural kit used no Tripo credits.

To rebuild and check the kit from the project root with Blender 5.2:

```sh
'/Applications/Blender.app/Contents/MacOS/Blender' --background --python game/art/environment-lab/build-kit.py
'/Applications/Blender.app/Contents/MacOS/Blender' --background --python game/art/environment-lab/verify-kit.py
```

A clean re-import reported seventeen mesh objects with Blender-space bounds from `[-44.07, -12.8, -4.7]` to `[46.02, 89.22, 20.86]` metres; distant hill bases intentionally extend below ground, and the height/depth include low cloud samples. This does not establish runtime appearance, material fidelity or actual draw counts. Real renderer comparison to the references is still needed, and these forms are intentionally simplified: no final painted textures, high-fidelity leaves, populated world, minion, or animation is claimed.

The environment scene applies its own saved look in `castle-environment-lab-v5`; the panel's **Reset defaults** removes that key and restores renderer defaults. `?envDefaults` starts the scene with defaults even if this key exists. Its settings are independent of the engine's development tuning panel and are not the game's shipped look. Controls cover renderer style numeric values and colors, sun direction/elevation, ground color, camera pitch, field of view and width. The default camera points near the horizon to show the real procedural sky, and the canvas supports mouse/pen/touch dragging plus WASD/stick panning. Wind and waves require the tagged materials in this kit; bloom depends on backend capability. The emissive orb is only a lighting test fixture.

The [experimental Tripo keep](keep/README.md) is pale in its generated reference; the lab applies a reversible, tunable whole-material tint for comparison with the darker castle direction. The original procedural kit remains available and unchanged.

The [experimental Tripo tree](tree/README.md) adds a fuller static foliage sample; its packed material cannot sway leaves independently. The keep and tree cost 100 Tripo credits together. The keep reference added $0.0373 on fal, bringing cumulative project fal spend to $0.8616. These assets are experiments; terrain, water and material fidelity still fall short of the chosen concept.
