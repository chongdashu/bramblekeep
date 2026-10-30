# Distant tree LOD

The distant forest uses a decimated copy of the existing normalized `tripo-tree.glb`; it retains its single textured material, UVs and 3.8 m nominal height. The generator uses Blender's collapse decimator at 40%: the original declares 10,370 triangles and the exported LOD 4,148. Its base and coordinate conventions are inherited from the original tree.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python game/art/environment-lab/forest/build.py -- 0.40
```

The runtime loads the LOD once and shares geometry and textures with model instances. The current renderer still submits one model draw per tree; this is not hardware-instanced rendering. Measure on target devices before claiming a performance improvement. The distant placements are generated deterministically in `environment-forest.ts` and do not collide; playable-area trees retain full-detail models and collision. The geometry is intentionally static in the background. Compare the four `--preview` ratios at the same camera to evaluate silhouette loss. The 40% version still has rough leaves up close, and the shared texture remains 2.3 MB. No new paid generation was used.
