# Camp tent candidate

One Tripo P1 model was generated from `reference.png`, a crop of the existing environment prop sheet (`../props.jpg`). The provider task consumed 50 credits; no new fal image was generated. The original download, sanitized receipt, crop and editable Blender source are retained here. The candidate was selected over the featureless procedural wedge after a same-camera runtime comparison: its poles, ties and blue ridge are readable. Its canvas remains visibly mottled/torn-looking and is not a final approved asset.

Rebuild with Blender 5.2:

```sh
'/Applications/Blender.app/Contents/MacOS/Blender' --background --python game/art/environment-lab/tent/build.py
```

The static model is normalized to 2.2 m high with its base centred at the origin. Blender measures 3.336 × 2.983 × 2.2 m. The exported GLB declares 11,998 triangles, one packed material and no required extensions. Its scene collision uses a matching rectangle in game-owned world coordinates. This is an art experiment; texture quality and the approximate collider remain open.
