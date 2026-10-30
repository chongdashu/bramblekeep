# Castle core

The attackable core is an amber, emissive crystal held in a stone and gold socket. The tall pointed silhouette and glowing rim make the objective distinct from the enemy portals. It is authored in Blender Z-up and exported Y-up in metres with its ground pivot at the origin; runtime places it at the existing core coordinates. The existing combat target and health remain simulation-owned, and solo and multiplayer use the same model.

Rebuild:

```sh
'/Applications/Blender.app/Contents/MacOS/Blender' -b -t 2 --python game/art/environment-lab/castle-core/build.py
```

The source and exported GLB are tracked. This is procedural prototype art; review the silhouette and glow at gameplay scale and in night lighting.
