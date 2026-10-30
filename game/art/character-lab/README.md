# Character test scene

Open `?scene=character` (or use Character test in the menu). The knight's movement, facing, and animation here use **local test-only presentation state**; this scene is not a multiplayer simulation and does not change the real game's rules.

- Move with WASD, arrows, or the touch stick. Space or Attack plays a punch; J or the Jump button previews a jump. R or the tuning panel’s Reset pose button resets the position and action; Menu returns to the main game menu. Jump is an animation preview and does not yet add gameplay height or collision.
- Open **Character tuning** to adjust movement speed/acceleration/turn response, the walk-to-run transition, walk/run stride, blend response, action playback/fade, and follow-camera tilt, field of view, framing and follow. The panel's Defaults button restores its defaults. Settings are local to this scene and saved on the device.
- Walk and run use a shared normalized phase advanced by actual displacement after world-boundary clamping. Stride values are starting guesses, not measured foot contacts. The attack and jump play as full-body one-shots layered over locomotion; their transitions and responsiveness still need visual and gameplay review.
- The sparse colored shapes are visual markers, not obstacles. Movement clamps at the test floor's boundaries. The viewer uses the tracked knight GLB, not a placeholder.

A model loaded and responding is not a visual approval. Check animation starts and loops, foot sliding, clipping and the camera at desktop and phone sizes, then compare with the chosen reference after clearing saved tuning (Defaults). No matched-camera comparison has been made by this file.
