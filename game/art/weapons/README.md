# Weapons

Tripo P1 text-to-model outputs, 6,000-face requested budget, textures enabled and PBR disabled. The provider GLBs are in `game/public/assets/weapons/`; the arrow is reoriented by `game/assets/blender/weapons/build-arrow.py` from the retained original. The origin is the generated model centre; `game/src/weapons.ts` applies a per-weapon hand grip and scale. The rig's `R_Hand` and `L_Hand` nodes supply the animated attachment transforms. One source is retained for each prop and all are included in the release allowlist.

| Asset | Tripo task | Credits | Notes |
| --- | --- | ---: | --- |
| Sword | fa4fdcf9-a726-47fd-9c03-c728c95e79c5 | 40 | Replacement for the first sword, which had an extra hilt. |
| Staff | b6bd8fa9-aded-4d62-a169-0820c087c60f | 40 | Wooden shaft and violet crystal. |
| Bow | 0fe1d4a8-e5d0-446d-8234-781a90809d63 | 50 | Image-guided model from `bow-reference.png`; one bow with a string and no fused arrow. |
| Arrow | 77a3eb3a-fdb2-4331-a1b9-ff61eada8813 | 40 | Separate arrow for the hand pose. |

The rejected first sword task `dd74ce7c-a17e-4528-ab18-556a15f2a84a` cost 40 credits. Candidate spell and shoot retargets cost 10 credits each (tasks `f1a843f0-2200-40d3-8bc6-4ef62a67db8c` and `4ea0ab6d-1601-4b6d-8ff8-edd16ea6d6ff`); the long crouching shooting motion was unsuitable, so the game uses custom procedural poses. The first text-generated bow (`7d0b5062-0c12-4eb6-a95e-12f4f9a1cd5c`, 40 credits) had a fused arrow. The second (`7c76f1bc-21c8-44bf-8eb7-c0fb8d6eaf99`, 40 credits) had malformed extra limbs. Neither is used. Total: 310 Tripo credits. Local task records are under `experiments/tripo/2026-10-27-weapons/` and may contain expiring provider URLs.

## Blender review

Run `'/Applications/Blender.app/Contents/MacOS/Blender' -b -t 2 --python game/assets/blender/weapons/build-review.py` from the project root to rebuild three hand-parented review scenes in `game/assets/blender/weapons/review/` and their studio renders in `out/weapon-blender-review/`. These scenes show the delivered idle rigs and weapon positions; the custom runtime attack poses are not baked into them. The character test exposes a camera angle control for checking the runtime view from multiple sides.
