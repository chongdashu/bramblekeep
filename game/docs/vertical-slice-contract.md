# Kickoff gym contract

All tuning is **proposed**; this gym is a mechanic test, not the complete multiplayer slice.

- **Purpose:** move from a camp proxy through open space, attack minion proxies, and see a gate open after the required minions are defeated. Reset immediately to try again. No countdown, swoop, or pause card on entry.
- **Input:** desktop keyboard movement and action, mobile virtual joystick and minimal action button. Camera angled top-down and follows player. Collision bounds are visible on demand.
- **Ownership:** game simulation owns movement, attacks, enemies and gate; renderer consumes state. Gym runs locally; online synchronization, population scaling, server authority, joining/leaving and persistence are unproven and not claimed.
- **Layout:** proposed 1 unit = 1 metre, camp → open field → gate; clear spawn and route, collision authored in game code.
- **Assets:** placeholders only in gym. Character and environment exports follow [asset contract](asset-contract.md), tested separately in a viewer.
- **Rules:** proposed finite enemies and automatic gate opening after they are defeated; no timer. Damage, AI, controls and thresholds are gym experiments, not accepted balance. Boss/core relationship and post-victory recovery remain open.
- **Acceptance:** actual keyboard and touch input, move/collision/attack/gate/reset, direct and menu entry without countdown, desktop and portrait inspection, test results and limitations. Asset export/reimport and viewer checks are separate.

## Current greybox experiment

- Minions idle until a player approaches, then pursue and damage on contact. The player's health recovers at camp on defeat; defeated minions stay cleared for that local run. The gate opens after all minions are cleared and the player can attack a core behind it.
- Holding attack repeats a short-range auto-targeted strike. Move speed, attack reach and interval, and minion speed, awareness and contact interval have development tuning sliders. These are experimental local rules, not agreed multiplayer design or balance.
- The core clears on three hits and the player can reset; how a persistent world recovers after success remains open. No boss, network session, population scaling or drop-in/out is implemented.
- A separate character test scene owns only its own local motion and animation settings. The environment lab owns its own look settings; neither writes gameplay authority or changes the selected game look.

## AI ally experiment

The greybox has a local option for zero to three AI allies. They start at camp, pursue minions, share gate/core progress, take contact damage and return to camp if defeated. Selecting a new count reintroduces added allies at camp; resetting retains the selected count. These are local NPCs, not network clients, and do not establish multiplayer synchronization, population scaling, or final balance.

Camera follow now uses a game-neutral `CameraRig.yaw` hook in the engine, including yaw-aware ground input and bounds. This extension should be considered for upstreaming; the game chooses the rear-facing camera and the environment lab owns its orbit controls.
