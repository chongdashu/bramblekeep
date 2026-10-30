# Combat greybox archive

The original camp-to-core greybox remains playable from the main menu as **Greybox archive**, or directly via `?scene=greybox`. Its implementation and simulation remain in `game/src/game.ts`, `game/src/integrated-art.ts`, and `game/crate/src/world.rs` for now. This directory preserves reference copies of those files from the transition to the environment-based game. The files here are source snapshots, not a standalone build; use the playable menu entry or Git history to run the original prototype.

The main game is now the environment-world patrol slice. The archive keeps its original three-minion, gate and core rules and its AI teammates.
