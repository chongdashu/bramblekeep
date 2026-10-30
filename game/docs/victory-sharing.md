# Victory sharing

When the shared boss is defeated, the client copies a rendered world frame and keeps it with the frozen round scores. The results screen opens a share preview that remains available even after the server starts the next round. The player can save the PNG or open an X compose window; X's web composer does not accept a local file attachment, so the player attaches the saved image. The public play link is the verified landing page, `https://bramblekeep.vercel.app/`, rather than a local URL or a short-lived game embed.

`GameRuntime.captureFrame()` is a game-neutral, post-render frame-copy hook, and `GameRuntime.returnToMenu()` exposes an immediate return from game-owned pre-play screens. Both are candidates for upstreaming to the engine. Captures remain local to the browser unless the player chooses to share them.
