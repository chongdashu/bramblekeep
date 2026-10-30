# Lookout and camp landmarks

A small, walkable stone lookout gives the castle approach a change in elevation. Its 2.4 m wide ramp rises 0.9 m over 3 m; the deck is 5.2 × 4 m. A covered well, camp supplies and a lantern marker give the route landmarks without blocking the centre. Layout and collision positions share `game/src/scenes/overlook-layout.json`; the game restricts ledge transitions and uses the ramp height for characters.

The models are original procedural Blender geometry, guided by the adjacent fal reference sheet; they are deliberately simpler than the concept and are a test-scene asset, not final art. The lantern is emissive-looking geometry, not a dynamic light. Rebuild the source and GLB with Blender 5.2:

```sh
blender --background --python-exit-code 1 --python game/art/environment-lab/overlook/build.py
```

Generate an isolated overview with `-- --preview --look 4`. Coordinates are authored in Blender Z-up and exported as glTF Y-up. The layout is tuned for the environment test; revisit footing if the terrain layout changes. The reference cost $0.0371 (receipt alongside the image).
