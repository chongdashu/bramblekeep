# Castle courtyard

A paved central fighting space leads from the gate to the core. Two small barracks frame the core arena; their open fronts face the arena. When the gate is breached, replacement minions appear at those entrances and walk into the courtyard. Before breach, two visible exterior wall doors provide the muster points so enemies do not pass through a closed gate. The spawn is deferred if a player is too close.

`game/src/scenes/courtyard-layout.json` is the source for building dimensions, collision and minion spawn points. Violet glowing door markings identify the active enemy entrances. The core and gate remain unobstructed. Blender is Z-up; glTF and the game are Y-up. Units are metres and the exported world-space asset has the level origin as its pivot. The remaining distant-hills mesh was removed from the runtime scene because it extended into the castle and buried the rear keep; the distant mountain silhouettes remain outside the playable map.

Rebuild from the repository root:

```sh
'/Applications/Blender.app/Contents/MacOS/Blender' -b -t 2 --python game/art/environment-lab/courtyard/build.py
```

The asset is a playable prototype and remains subject to visual and multiplayer playtesting.

## Garden courtyard art pass

The masonry, portal arches, heraldic banners, rear planters and ivy frame a clear central arena. The gold inlay is flat and non-colliding, and frames the playable heart tree. The environment test previews the same heart tree as gameplay. The rear planters are solid and share their bounds with `courtyard-layout.json`; sconces share positions with the runtime flames and local lights. Runtime selects the six courtyard lights and core lighting when the camera is inside, within the renderer's eight-light limit.

[ImageGen concept](../../../../share/media/extra/game/art/environment-lab/courtyard/guardian-courtyard-concept.jpg) is an approximately matched-composition art target, not a gameplay screenshot. Its prompt is in `guardian-courtyard-concept.txt`.
