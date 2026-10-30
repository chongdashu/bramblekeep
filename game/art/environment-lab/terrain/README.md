# Rolling meadow

The environment lab replaces the crossing's flat grass node with this terrain. It
preserves the river cutout and uses the crossing's packed grass material. The
height field in `game/src/scenes/terrain.json` drives both this export and the
runtime's character/tree heights. The path, bridge and static props have flat
pads. Terrain is visual and walkable; the existing 2D collision map is unchanged.

Rebuild after generating the river crossing asset:

```sh
blender -b -t 2 --python game/art/environment-lab/terrain/build.py
```
