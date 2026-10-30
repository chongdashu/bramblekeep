# Enemy animation

Bloom, bramble, mushroom and stump are Tripo P1 characters with Tripo biped
rigs and in-place idle/walk clips, except for the stump, whose failed automatic rig was replaced with a simple Blender-authored armature and walk. The controller moves them; gait phase follows
travel distance. The attack is a game-authored bone pose with a wind-up and
follow-through. Tripo's kick and boxing clips were inspected but did not give a
usable attack for the sprout's proportions. The original downloaded GLBs are
retained alongside the reproducible Blender exporter:

```
blender -b -t 2 --python game/art/enemies/build-animated.py
blender -b -t 2 --python game/art/enemies/build-stump-rig.py
```

Export heights are 1.0 m (bloom and mushroom), 1.4 m (bramble) and 1.35 m
(stump); front is glTF +Z, with root at ground level. In play, shared size
profiles scale these to approximately 1.0 m, 1.15 m, 1.54 m and 1.82 m
for Bloom, Mushroom, Bramble and Stump respectively. The profiles also set
target radii and gait stride in solo and multiplayer. Generated mushroom and
stump task IDs are 0b0ac7dc-e6a7-4485-8b3c-ee9647681830 and
d35dca8d-8686-46d3-a2ea-2f65b8560dc7, at 40 credits each. This iteration's
four rigs cost 25 credits each; locomotion retargets cost 130 credits and the
four attack experiments cost 40 credits, for 350 credits in total.

| Enemy | Rig task | Locomotion task | Attack experiment |
| --- | --- | --- | --- |
| Bloom | e38f1cab-9860-4696-a1ba-7c654210c909 | f95c595c-11f5-45b5-807a-15b4d547dcf1 | 38f27dd1-b1e4-4e70-bc84-3d59065c5a73 |
| Bramble | 9b95c8c9-d2e4-4d0f-9f57-512d08af45e0 | 42567894-d19e-4875-8d64-79c777237906 | 599cd62f-136d-4039-95ed-c87eafeff2cd |
| Mushroom | 5a9e52f4-8dcc-480c-804c-aa816b74814f | 5e395c2e-14b5-4811-b188-8eea3e4a9a40 | 40a36d3f-1f27-4fbe-85b9-9f0a6480f411 |
| Stump (rejected rig) | 44c6707d-daa5-4c70-a403-3ed9f36b8d95 | d7f8dabd-7a25-46fa-ba98-a8e31e748991 | 4c63f030-ee89-48c4-86a4-6206f996e2ba |

The stump mesh is rotated to glTF +Z before the left and right limb weights
are assigned; its source import uses quaternion rotation, so the builder sets
Euler mode before applying that rotation. The stump walk is a simple procedural
rig, not a Tripo retarget. Its short
limbs deform noticeably on close inspection and should receive further weight
painting before a close-up presentation.
