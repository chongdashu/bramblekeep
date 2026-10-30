# Asset contract — camp-to-castle kickoff

All dimensions and budgets below are **proposed** until measured; the source/export/runtime checks remain pending.

## Header and source boundaries

| Field | Decision |
| --- | --- |
| Slice / version | Camp-to-castle gym / 0.1 |
| Runtime | Existing engine GLB loader, WebGPU/WebGL 2 |
| Authoring | Blender 5.2.0 LTS, Tripo for generated assets; fal GPT Image 2.5 for references |
| Status | Proposed, subject to export and runtime verification |
| Sources | `game/assets/blender/characters/` one blend per character; `game/assets/blender/environment/` one environment kit |
| Exports | `game/public/assets/characters/` and `game/public/assets/environment/`; generators write to `out/`, promote deliberately |

## Shared conventions

| Concern | Proposed agreement |
| --- | --- |
| Scale | 1 Blender unit = 1 metre |
| Axes | Blender Z up, -Y forward; glTF/runtime +Y up, +Z front. Verify conversion in export, no second unverified rotation. |
| Pivot | Character origin at floor between feet; environment pieces at ground contact with explicit placement origin. |
| Transforms | Apply scale/rotation before export; use glTF Blender axis conversion; export selection only. |
| IDs | Stable lowercase names: `hero-knight`, `gate-kit`. |
| Layout | Game owns gameplay collision, spawns and state; visual assets never own rules. |
| Character | `hero-knight`: 1.6 m tall, roughly 0.8 m wide, no weapon/held item in model or sheet; first representative class, proportions proposed. |
| Environment | `gate-kit`: doorway 2.6 m wide × 3.0 m high; walls roughly 4 m tall; scale reference is 1.6 m character. |
| Grid | 0.5 m placement increment, proposed. |
| Material | glTF opaque default, linear mipmapped sampling; no unsupported extensions; verify texture and color after reimport. |
| Art style | Selected B/C mockups: readable, simple whimsical 3D; sparse composition, no excess clutter. Texel density/face budget unmeasured, inspect before multiplying. |

## Character attachment and motion

| Name | Meaning / status |
| --- | --- |
| `socket_hand_r`, `socket_hand_l` | Hand-mounted attachments; full post-pose transforms, orientation verified with asymmetric marker. Proposed; no held item included in character. |
| `idle`, `walk`, `run`, `jump`, `attack` | Requested clips; idle/walk/run loop, jump/attack one-shot. In-place root; gameplay owns movement and attack hit. Timing/stride and clipping unmeasured. |

## Runtime exports and acceptance

| ID | Collection / source | Export | Collider / clips | Status |
| --- | --- | --- | --- | --- |
| hero-knight | `hero-knight` / character blend | `game/public/assets/characters/hero-knight.glb` | game-owned capsule; requested clips above | Proposed, unmeasured |
| gate-kit | `gate-kit` / environment blend | `game/public/assets/environment/gate-kit.glb` | game-owned simple bounds; none | Proposed, unmeasured |

Check representative export and clean reimport, axes, bounds, textures, socket and clip playback in runtime; place character beside door, compare model with turnaround, and capture remaining gaps. Hash exports and keep provider originals and reproducible processing recipes. No acceptance check is yet passed.

## Kickoff measurements — revision f4c9791

- **Knight:** GLB reimport and engine viewer report 1.60 m tall × 1.00 m wide × 0.40 m deep, 11,541 triangles, one skin with 41 joints. Five clips are present; viewer selection of run and attack was exercised. Blender uses -Y forward and glTF +Z front. Hand sockets are absent; foot contact, loop closure, clipping and action timing remain unverified. The 2.17 s punch is provisional.
- **Gate:** clean Blender reimport reports 6.4 m wide × 2.06 m deep × 5.57 m tall; doorway authored 2.6 m wide and 3 m high. Engine viewer reports 9,552 triangles and eight primitives. Static; no gate opening animation. The actual knight has been rendered beside it at contract scale ([comparison](../../share/media/20261027-kickoff/gate-and-knight.jpg)).
- **Visual acceptance:** pending. The gym is proxy geometry and is not a matched-camera runtime realization of the chosen B/C mockups; material, silhouette, environment detail, lighting, animation and UI gaps remain. The knight turnaround comparison uses different framing and lighting.

## Weapon prototype contract

- Tripo sword and staff attach to `R_Hand`; bow attaches to `L_Hand`; a separate arrow attaches to `R_Hand` during the attack and is used for the scout projectile. Rig orientation is calibrated against idle and follows the full animated hand transform.
- The source arrow and repeatable orientation/export script are under `game/assets/blender/weapons/`; all four runtime GLBs are tracked and included in release assets. The game owns attack timing and simulation hits.
- Weapon grips, animation exaggeration and physical contact need visual review. The image-guided bow has a string without a fused arrow; the string is static rather than deforming with the draw. Provider tasks, costs and limitations are in [weapon provenance](../art/weapons/README.md).
