# Experimental Tripo keep

One candidate, generated from `reference.jpg` with Tripo P1. The asset is an experiment for the environment lab, not an approved visual match: the generated reference and model are pale white stone, whereas the chosen C mockup shows dark, weathered stone. The lab applies a reversible whole-material tint to make an honest darker comparison; because Tripo produced one material and texture, this also darkens roofs and other parts. It does not add the separate stone materials, wear or texture variation in the reference. `receipt.json` records the exact $0.0373 fal charge and 50 Tripo credits. No retry was used.

The provider original and reference are preserved. `build.py` imports the original, rotates provider +X to Blender -Y front, normalizes height to 9 m and centers the base, packs the textures and exports `game/public/assets/environment-lab/tripo-keep.glb`. Clean reimport bounds are 9 m wide × 4.068 m deep × 9 m tall; the GLB has 15,937 declared triangles, one material with embedded base, roughness/metallic and normal textures. These checks do not prove appearance in the runtime or functional collision. The gate is closed, with no break animation.

```sh
'/Applications/Blender.app/Contents/MacOS/Blender' --background --python game/art/environment-lab/keep/build.py
```

The lab uses `environment-kit-no-keep.glb`, built without the simple keep so the generated one does not overlap it. The existing `environment-kit.glb` is retained unchanged. Build the variant with:

```sh
ENV_LAB_NO_KEEP=1 '/Applications/Blender.app/Contents/MacOS/Blender' --background --python game/art/environment-lab/build-kit.py
```
