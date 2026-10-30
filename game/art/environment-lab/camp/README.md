# Friendly camp

Three canvas shelters, nearby supply and seating, lanterns, bunting, and low meadow flowers form a friendly staging area around the existing campfire. The central spawn grid and routes to all three bridges remain open. Tent footprints, seating, supply, flagpoles and lantern-post collision come from `game/src/scenes/camp-layout.json`, shared by the movement and authoritative server. Canvas ropes, bedrolls, flowers and grass are low decorative details.

All authored geometry is in metres with Blender Z-up and runtime Y-up, at the level origin. The build script samples `terrain.json` so objects sit at the authored meadow elevation. The runtime supplies nearby flickering light; the windows of lanterns are emissive.

Rebuild with:

```sh
'/Applications/Blender.app/Contents/MacOS/Blender' -b -t 2 --python game/art/environment-lab/camp/build.py
```

[Camp concept](../../../../share/media/extra/game/art/environment-lab/camp/camp-concept.jpg) was generated with the built-in ImageGen tool from a real environment screenshot. Prompt: preserve the camera, castle, river, bridges, paths, heroes and campfire; add canvas tents, supplies, log seating, warm lanterns, pennants, grass and flowers grouped around an open spawn and route. It is an approximate art target, not a runtime capture.
