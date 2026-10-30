# Kickoff review

The gym and viewer are for reviewing early mechanics and assets, not a complete multiplayer game. The reviewed code/assets revision is `ed4a105`.

- **Gym:** `http://localhost:5189/?scene=gym` while the isolated review server is running. Move with WASD or the left stick; hold Space or Attack close to red minions. Clear three to open the gate. R resets; C shows bounds. Opened directly without a countdown or swoop. [Desktop](../../share/media/20261027-kickoff/gym-desktop.jpg) · [phone](../../share/media/20261027-kickoff/gym-phone.jpg).
- **Asset viewer:** `http://localhost:5189/?scene=viewer` or the Asset viewer entry on the main menu. Select Garden gate or Knight, orbit and select animation clips.
- **Character:** [turnaround vs model](../../share/media/20261027-kickoff/knight-comparison.jpg); clip previews [idle](../../share/media/20261027-kickoff/idle.mp4), [walk](../../share/media/20261027-kickoff/walk.mp4), [run](../../share/media/20261027-kickoff/run.mp4), [jump](../../share/media/20261027-kickoff/jump.mp4), [attack](../../share/media/20261027-kickoff/attack.mp4). The model differs in face detail, lighting and proportions; the comparison framing is not matched. Hand sockets and clipping/contact/loop checks remain open. The unarmed attack is 2.17 seconds and needs timing review.
- **Environment:** [actual knight beside reimported gate](../../share/media/20261027-kickoff/gate-and-knight.jpg), and [source evidence](../art/environment/README.md). The gate is static and closed; no breach animation yet.

## Verification and limits

A clean detached checkout of `f4c9791` passed build, Rust tests, game tests and skill check; the subsequent touch-hint fix was built and its `ed4a105` revision passed packaged smoke. Packaged smoke passed on WebGPU and WebGL 2 for desktop and emulated portrait phone: desktop keyboard cleared all three minions and opened the gate; phone touch stick moved the player, the attack control was visible, and the hint was checked not to overlap it. The two Rust documentation examples marked ignored remain skipped. No physical phone was tested. The viewer loaded both GLBs in the engine and run/attack clips could be selected; the five preview videos were rendered in Blender.

No online multiplayer, server authority, drop-in/out, population scaling, minion AI, boss/core, real animations in the gym, or final visual treatment exists yet. This is not a matched-camera comparison with the selected mockups. Final appearance remains open: proxy geometry, plain lighting, no full environment art, and different character proportions and effects.

## Costs

Character: **$0.0372 fal and 135 Tripo credits** (50 mesh, 25 rig, 60 animation; check was free). Environment: **$0.0370 fal, 0 Tripo credits**. Gym: no paid service. Cumulative fal spend is **$0.7497 of $10**.
