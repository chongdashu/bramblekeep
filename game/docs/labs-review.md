# Environment, character and combat test scenes

The initial laboratory baseline was committed at `f263138`; the follow-up environment and combat changes are described below. These are early working tools and a local gameplay experiment, not a finished visual treatment or online build.

## Environment lab

Open `/?scene=environment` directly or choose **Environment test** in the menu. Move the view with WASD or the touch stick. Open **Tune look** for renderer-supported shading, outline, lighting, shadows, bloom, exposure, color, sky, atmosphere, foliage/water effects, sun direction, ground color and camera framing. Settings are saved locally; **Reset defaults** clears them. `?scene=environment&envDefaults` temporarily starts from defaults for comparison.

The lab contains the existing gate and a Blender-authored prototype kit with trees, bushes, rocks, tent, sign, bridge, path and stream. [Landscape references](../../share/media/20261027-labs/landscape-reference.jpg) · [prop references](../../share/media/20261027-labs/prop-reference.jpg) · [runtime scene](../../share/media/20261027-labs/environment-desktop.jpg). The knobs adjust supported renderer parameters; arbitrary shader source editing and post effects not implemented by the engine are not provided.

**Visual gaps:** the runtime camera is steeper than the invented reference camera; the ground is a grid without the reference's grass/terrain, and the trees, water, rock shapes and castle are simpler. This is not a matched-camera visual comparison; the desired look remains unapproved and unfinished. See [the kit's source and reimport notes](../art/environment-lab/README.md).

## Character lab

Open `/?scene=character` or choose **Character test**. The knight responds to movement; Attack and Jump preview their animations. **Character tuning** exposes 15 settings for speed, acceleration, turning, walk/run blend and stride, action playback/fade and camera. Defaults and Reset pose are separate. This scene uses local presentation-only test movement, not the main game simulation. Jump previews an animation and has no gameplay jump physics.

**Visual gaps:** stride settings are guesses; foot contact, body clipping, jump and the slow unarmed attack require gameplay review. The knight remains small in the phone frame and can be reframed with camera controls. There is no matched-camera comparison to the selected mockups. The knight's hand sockets remain absent.

## Combat greybox

Open `/?scene=gym` or choose Play. Move from camp, fight minions, pass the opened gate and attack the core. Hold Space / Attack close to an enemy. Minions pursue when approached and contact causes damage; losing health returns the player to camp without resetting cleared minions. R or pause → Restart resets the local experiment. In development, T opens tunable movement, attack and minion parameters.

The minions, core, camp and castle are proxies. Attacks auto-target the nearest enemy in range, the core clears after three hits, and the world does not yet autonomously reset after victory. These rules are provisional. There is no multiplayer, server authority, join/leave or population scaling yet.

## Checks

- `f263138`: isolated packaged smoke passed WebGPU/WebGL 2 desktop and emulated portrait; keyboard completed the entire loop and touch moved and defeated a minion.
- `aa0b834`: isolated Rust tests, 249 game tests and vendored-skill check passed; the later change touched only mobile laboratory overlays and their guards. Two Rust doc examples are ignored.
- `f263138`: environment lab browser test passed desktop, portrait and short landscape at DPR 1, including tuning persistence, defaults and menu. Character lab passed desktop and portrait including movement, actions, sliders, touch reset and menu. Physical phones, animation quality and matched-camera visual review remain untested.

Environment references cost **$0.0746 fal**; no Tripo credits were used in this milestone. Cumulative fal spending is **$0.8243 of $10**.

## Follow-up: attack guidance, AI allies and environment navigation

The greybox names the current device's attack control and highlights an in-range target. The **AI allies** button (or N on keyboard) cycles from zero to three local test teammates. They move from camp, attack minions and the core, and return to camp when defeated; reset retains the selected count. Their behavior does not simulate networking or population-dependent difficulty.

The environment lab supports dragging the canvas with mouse or touch, as well as WASD/stick panning. Its sky-facing camera, sun, color grade and representative scenery are under visual iteration. `?envDefaults` bypasses saved lab overrides; **Reset defaults** clears them. The procedural sky and clouds are visible; this is not a textured cubemap. The new keep and tree add detail, but the terrain and water remain flat, the bridge and foliage lack the reference’s richness, and the packed keep tint also darkens its roof. The reference camera is unknown, so the concept comparison is approximate; the runtime before/after cameras are identical. The look is not yet accepted. [Concept and runtime comparison](../../share/media/20261027-environment-allies/b-c-final-comparison.jpg).

Follow-up checks at `a2e1132`: isolated build, Rust tests and 253 game tests passed; two Rust documentation examples are ignored. Environment tests passed WebGPU and WebGL2 at desktop, emulated portrait and short landscape, including mouse/touch pan and visible sky. Character tests passed desktop and emulated portrait. Physical-device testing remains open. The castle reference cost $0.0373 fal and the castle plus tree cost 100 Tripo credits; cumulative fal spending is $0.8616 of $10.

At `96e70a8`, the sample gate moved out of the default frame and remains reachable by panning; the isolated environment browser suite passed again.

## Camera, classes and world study

The environment test supports left-drag pan, right-drag orbit and wheel zoom; touch users can use the camera orbit, pitch and view-width sliders in **Tune look**. Gameplay and character test cameras now face the castle direction, and up moves toward the gate. Camera angle and framing remain reviewable, rather than approved final composition. [Concept and phone greybox comparison](../../share/media/20261027-camera-world/concept-vs-greybox.jpg) is approximate because the concept camera settings are unknown; the player and castle are still proxies in the combat scene.

The greybox **Class** button (Q on keyboard) cycles Knight, Spellcaster and Scout. The latter two are local hitscan experiments: medium-range splash and longer-range single-target attacks. Their weapons, projectiles, timing, tuning and animations are provisional. The character test model selector previews three rigged candidates; Scout and Spellcaster have idle/walk/run/jump but no attack, weapons or sockets. Two static enemy candidates appear in the asset viewer and are not wired to combat.

[World map study](../../docs/direction/world-map-study.md) explores routes and an overhead concept; it does not demonstrate real 20–30-player capacity. Terrain, path widths and sightlines need a measured blockout and network playtest. At `ee8779f`, isolated build, Rust workspace tests, 254 game tests, skill check and WebGPU/WebGL2 packaged smoke passed on desktop and emulated phone. The environment test passed desktop, portrait and short landscape; physical-device review remains open. Two Rust documentation examples were ignored.

This round spent $0.3316 fal and 330 Tripo credits. Cumulative fal spend is $1.1932 of $10.

The environment lab uses the game-neutral `Renderer.skyCloud` tint and opacity hook to grade procedural clouds for day and night. This renderer extension is a candidate for upstreaming to the template. The old spherical cloud meshes are omitted; the sky layer remains procedural rather than a painted skybox.

## Attachment editor

Open `?scene=equipment`, select a character and animation, then expand **Edit sockets**. Pause or scrub the animation and adjust the selected attachment's position and rotation. Offsets are shared across that attachment's animations, saved in this browser and picked up by game scenes after reload. The arrow control affects the nocked arrow, not the flying projectile. **Reset attachment** clears the current attachment; **Copy settings** copies all local offsets for sharing. Socket adjustments move weapons, not the rig, hand geometry or animation. Shared base placements and default offsets live in `game/src/equipment-config.json` (positions in metres, rotations in degrees). Browser-saved offsets override the defaults on that origin; reset an attachment to pick up its configured defaults. Copy settings gives the offset values for the `adjustments` section.
