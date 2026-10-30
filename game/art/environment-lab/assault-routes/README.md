# Camp-to-castle flank routes

The two flank trails branch from camp, cross the river on separate timber bridges, and rejoin the central gate approach. They give groups a choice of approach and a way around congestion; they do not add separate objectives or imply cover mechanics. The central bridge remains the direct route. The gate, levers and courtyard retain their existing rules.

`game/src/scenes/assault-routes.json` owns the crossing centres and trail centreline, shared by movement, footsteps and this Blender generator. The side bridge decks are 2.9 m wide, with a 2.5 m collision corridor before the player radius. Player/server collision remains authoritative in `environment-map.ts`. Trail vertices sample the meadow height field; the river itself remains impassable outside the three crossings. The isolated lookout and arch were removed because they served no objective and disconnected visual cues from the routes.

Blender is Z-up; the game is Y-up, in metres, with the level origin as the pivot. Editable source and runtime export are tracked. Rebuild with:

```sh
'/Applications/Blender.app/Contents/MacOS/Blender' -b -t 2 --python game/art/environment-lab/assault-routes/build.py
'/Applications/Blender.app/Contents/MacOS/Blender' -b -t 2 --python game/art/environment-lab/world-props/build.py -- --export
```

These are prototype routes. Their final appearance, encounter distribution, camera readability and performance with a large group still need player review.
