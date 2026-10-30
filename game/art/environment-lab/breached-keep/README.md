# Breached keep

The gameplay-only export subtracts a two-metre-wide passage through the existing `tripo-keep.glb`. The environment test continues using the original closed keep. Blender imports the tracked keep, removes doorway triangles in a centered passage (roughly 2 m wide, 2.3 m high in asset space) through its full depth, and exports the same Y-up, foot-origin glTF with its existing textures. At the scene's 1.2 × 1.4 × 1 scale the passage is 2.4 m wide and 3.22 m tall. Character collision permits a narrower central lane to account for player radius.

Rebuild with Blender 5.2:

```sh
blender --background --python-exit-code 1 --python game/art/environment-lab/breached-keep/build.py
```

This is a prototype cut through generated geometry; inspect texture seams and silhouette in the runtime before treating it as final art.
