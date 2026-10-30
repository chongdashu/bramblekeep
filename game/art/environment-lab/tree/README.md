# Tree experiment

One Tripo P1 image-to-model candidate was made from `reference.png`, a crop of the existing environment prop sheet. No new fal generation was used. The source tree has one packed material, so its trunk and canopy do not separately participate in the lab's foliage sway control. Its small roots and stones are part of the mesh. It is a candidate for visual comparison, not a final approved tree.

Rebuild the runtime tree from the retained original:

```sh
'/Applications/Blender.app/Contents/MacOS/Blender' --background --python game/art/environment-lab/tree/build.py
```

The script recenters its base and scales it to 3.8 m high. The original and resulting `.blend` retain the source for further art work. In the lab two instances replace the procedural round crowns; the procedural pines remain. The reference crop was generated from `game/art/environment-lab/props.jpg`, whose prompt and fal receipt are in the parent directory.
