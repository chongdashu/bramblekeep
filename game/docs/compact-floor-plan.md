# Compact camp-to-castle floor plan

**Working plan, 2026-10-27.** This deliberately replaces the oversized map concepts for the first integrated slice. The playable area is the existing approximately **15 × 20 m** simulation, measured in game coordinates, with the camera behind the player facing toward +Z. It is a small local combat space, not a verified 20–30-player map.

```text
                         +Z / up-screen
       x -7.5                                    x +7.5
 z 10.5 ┌─────────────────────────────────────────────┐
        │           courtyard   ● CORE (0, 8.5)       │
 z  6   ├──────────── WALL ───[ GATE ]─── WALL ───────┤
        │                  enemy                      │
        │        tree      clearing       tree        │
 z  0   │                  enemy                       │
        │        enemy        open approach           │
        │                                             │
 z -7   │      camp edge   PLAYER / allies             │
 z -9.5 └─────────────────────────────────────────────┘
                         -Z / camp
```

- The player starts at `(0, -7)` and approaches three minions. Defeating them opens the gate at `z = 5.5`; the core is at `(0, 8.5)`.
- The path remains broad and unobstructed. Trees and the camp tent sit at or beyond the playable sides; decorative scenery is not solid collision. The authoritative simulation still supplies the outer bounds and gate collision.
- The existing modular gate provides the main landmark; its door pieces disappear when the sim opens the gate. Wall extensions align with the simulated gate boundary. The core remains a visible proxy in the courtyard.
- The selected class uses the existing rigged Knight, Spellcaster or Scout model. Three minions use the existing Bloom and Bramble candidates; optional allies are represented by the Knight. Simulation positions and combat rules remain authoritative.
- The static enemy assets have no attack animations. The Knight's available punch previews attacks; the other classes retain their temporary ranged effects without claiming dedicated attack clips. Walk and run animations are driven from measured movement.

The compact plan is a working composition for integration, not an approved final level. Validate the camera, silhouette, gate clearance, input, reset and full loop on desktop and emulated portrait; compare against the chosen concept and list remaining visual gaps. Real multiplayer, persistent state and population scaling remain future work.

## Integration review — `7be5fc1`

[Desktop runtime](../../share/media/20261027-compact-slice/desktop.jpg) · [Portrait runtime](../../share/media/20261027-compact-slice/portrait.jpg) · [Short landscape runtime](../../share/media/20261027-compact-slice/short-landscape.jpg) · [C reference and runtime comparison](../../share/media/20261027-compact-slice/concept-vs-runtime.jpg). These are screenshots of the isolated packaged build with fresh browser settings. The C concept's camera is unknown, so the comparison is approximate, not matched-camera approval.

Remaining visual gaps include flat ground, sparse camp and surroundings, proxy walls and core, unanimated static enemies and a gate that disappears instead of breaking. The Scout and Spellcaster have no attack clips or held weapons; their attacks remain instant-hit greybox experiments. Three class models and enemy candidates render within the sim-driven loop, but animation quality, physical-phone performance and multiplayer remain unverified.

Checks at `7be5fc1`: isolated build, 254 game tests and packaged WebGPU/WebGL2 smoke passed on desktop and emulated portrait, including a full keyboard loop, touch combat, selected model checks and gate door visibility. Short landscape at DPR 1 was captured and inspected. The earlier `3ff84a3` Rust workspace and vendored-skill checks passed; two Rust doc examples are ignored. No new asset generation was purchased.
