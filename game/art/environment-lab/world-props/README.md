# Expanded-world prop kit contract

**Prototype / in review.** The Blender generator `build.py` makes a cohesive, game-owned prop kit and lays out its instances from `game/src/scenes/world-props.json`. It exports a compact combined static GLB for the Environment test and retains editable Blender source. Positions and collisions share the same JSON; the main camp-to-castle path remains clear. This kit is not yet approved final art.

- Units: metres. Blender is Z-up, glTF/runtime is Y-up; the generator maps Blender `(x, y, z)` to runtime `(x, z, -y)`. Each component is authored on the ground; the combined level export uses the world origin.
- Props: campfire and stones, crates, trail sign, bridge lanterns, rock clusters and shrubs. The formerly isolated ruin is not placed in the playable map. The fire geometry is a static sample; runtime adds flame and light. The bridge lanterns have four emissive panes and runtime point lights.
- Collision: solid props declare circular colliders in the layout; decorative shrubs have none. Only the props that remain in the layout contribute collision. Simulation owns movement and all collider radii; no glTF collider is loaded.
- Preview images and temporary iteration renders go in ignored `out/`, not in the shipped asset. Track editable `.blend`, generator, layout and runtime GLB.

Rebuild using Blender 5.2:

```sh
'/Applications/Blender.app/Contents/MacOS/Blender' --background --python game/art/environment-lab/world-props/build.py -- --export
```

Geometry and performance are verified from the actual export and browser, not inferred from the reference. The prop reference is the project's existing `../props.jpg`; no new generation was purchased.

## Checks and limits

A clean Blender reimport of the GLB reported **10 meshes, 3,272 triangles**, with every authored solid collider having nearby exported geometry. Verify after rebuilding:

```sh
'/Applications/Blender.app/Contents/MacOS/Blender' --background --python game/art/environment-lab/world-props/verify.py
```

The generator asserts at least 5 mm of separation for sign, crate and lantern face details. These checks do not prove the full mesh is free from every overlap or that the art matches the reference. Several deliberately overlapping shapes form a single bush, log pile or rock cluster; the baked flames are hidden in the runtime, which supplies animated flames and point lights; the lantern panes use emissive material and nearby runtime lights. `world-props.json` colliders are approximate circles, not mesh collision.
