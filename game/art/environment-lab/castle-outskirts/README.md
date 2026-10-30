# Castle outskirts

The outer service lanes use crates, barrels, spare timber, shrubs, flowers and warm post lanterns. A continuous low timber barricade marks the playable side and rear edge. The side lanes stay open and connect around the back of the castle; the barricades sit along the world edge rather than cutting across that route.

World metres, Blender Z-up, runtime Y-up; world origin pivot. The build samples `terrain.json`. `castle-outskirts.json` is shared by the generator and movement code: invisible movement colliders follow the visible barricades, supply piles and lantern posts. Decorative vegetation does not block players. The same `canStand` function is used by client and authoritative server.

Rebuild with:

```sh
'/Applications/Blender.app/Contents/MacOS/Blender' -b -t 2 --python game/art/environment-lab/castle-outskirts/build.py
```
