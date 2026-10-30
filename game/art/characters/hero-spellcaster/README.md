# Spellcaster asset experiment

The turnaround is a GPT Image 2.5 Flare edit using the knight turnaround for style. The front crop was passed to Tripo P1; the generation reference and exact prompt are included. One mesh cost 50 credits, rig 25, four in-place locomotion/jump clips 40, totaling 115 Tripo credits; fal cost $0.0333. IDs and hashes are in `manifest.json`.

`game/assets/blender/characters/hero-spellcaster/tripo-original.glb` is the provider's rigged four-clip output. Rebuild the 1.6 m export and editable Blender file from the project root:

```sh
'/Applications/Blender.app/Contents/MacOS/Blender' --background --python game/assets/blender/characters/hero-spellcaster/build.py -- game/assets/blender/characters/hero-spellcaster 1.6
```

The export has one 11066-triangle mesh, 41-joint skin and idle/walk/run/jump clips. A reimported rest view and representative action poses were inspected, but full animation cycles, skin deformation, root drift, foot contact and browser appearance remain unverified. There is no bow or staff in the mesh, no hand sockets and no class-specific attack clip. The exact silhouette and visual approval remain open.
