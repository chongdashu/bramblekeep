# Bramblekeep (the game)

This folder is the game. The engine in `../src` and `../crates/engine` knows nothing about it: it reaches this folder
only through the `@game` alias (`src/index.ts`) and `game.json`.

```sh
npm run dev      # the game at http://localhost:5173 (T opens tuning, B the debug panel, on the dev server only)
npm run play     # the shared world server plus the client, for multiplayer
npm run test:game
npm run smoke    # the packaged build in headless Chrome
```

## What's here

| Path | What it is |
| --- | --- |
| `game.json` | The game's identity, the list of files that ship, the model preview list and the smoke driver |
| `src/` | The game in TypeScript: heroes, combat, the gate and levers, the heart tree and the Bramble Boss, HUD, menus, the multiplayer client, audio, and the scenes (`scenes/`) |
| `crate/` | The Rust simulation (`bramblekeep-sim`), compiled to `public/wasm/sim.wasm` by `npm run wasm` |
| `server/` | The authoritative multiplayer world: Colyseus room, AI teammates, persistence, identity and the health endpoint. [README](server/README.md) |
| `public/` | The web root: the models, audio and UI art that ship. `wasm/` is generated and not tracked |
| `analytics/` | The anonymous play-stats contract and Convex backend. Switched off here: no deployment is named in `analytics/release.json` |
| `docs/` | Design notes, asset and slice contracts, floor plans and the review of each milestone |
| `art/`, `assets/` | The Blender build and verification scripts, the prompts behind each generated reference and the notes on each model. The Blender source files themselves are not included |
| `archive/` | The first greybox simulation, kept for reference |
| `tests/` | Unit tests (`*.test.ts`) and browser checks (`*.mjs`) for the game |

## Running your own world

The shared world needs an always-on WebSocket server. `npm run play` starts one locally. To host it, build
`server/Dockerfile` and set the environment described in [server/README.md](server/README.md). The client finds
the server through `VITE_COLYSEUS_URL`. Play stats are optional and off by default.
