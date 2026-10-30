# Portrait Teaser Learnings

Related records:
- `plans/2026-10-28-072732-portrait-teaser-plan.md`
- `prompts/2026-10-28-072732-portrait-teaser-prompts.md`

## Context

The user asked for a portrait teaser with the characters and the scene, the players moving toward the castle, a music track and sound effects. The follow-up "continue using latest" was read as a re-shoot on the newest build at that point. The teaser scene lives in an ignored snapshot, because it depends on uncommitted environment work from another session.

After review, the user asked for a different end card: "Made with GPT 6.1 Terra" as the sub text, with "Stay tuned for more updates!" in place of the title. The user also asked for the teaser to be put in share/.

## What Happened

- The footage comes from commit 6eb872d plus uncommitted environment work. The castle patrol commits (defe28b, 0e3267d, cba97c2) landed after the snapshot and are not in the footage. HEAD has moved on since.
- The engine's capture mode with a game-owned scripted scene gave frame-exact footage: 1200 frames, no errors, rendered at 1620x2880 and downsampled to 1080x1920 at 60 fps.
- Footsteps were placed from the scene's logged foot-bone heights: 121 cues, wood on the bridge and dirt elsewhere.
- Two score seeds were generated. Seed 23 was chosen because its strongest hit lands at 14.05 s, the slow-motion cut, with accents at 4.05 s and 16.05 s, the title.
- The generated campfire and river recordings have transient peaks of about 30 dB and needed soft clipping before they worked as beds.
- A shockwave ring particle grows to 2x its spawn size, so it was sized to stop short of the camera.
- The end card changed after review. Only 16-20 s was re-rendered: 240 frames (4.0 s) from a hard cut, spliced onto the earlier 0-16 s footage. The music and sound effects are the same as before.

## Result Quality

- Loudness, peaks and cue timing were measured, not heard. The audio has not been auditioned by ear.
- The sky in the faces shot reads brighter than the rest of the night.
- The web encode is 720x1280 at 3.3 MB, with an end-card poster. A 1080x1920 full-quality copy (11.4 MB) is linked under it.
- After the end-card change, the 720x1280 web encode reads -14.4 LUFS and -0.6 dBTP; the 1080x1920 copy reads -14.4 LUFS and -0.9 dBTP.
- A true phone-width check could not be run here, because headless Chrome has a 500 px minimum window. The 500 px render shows the single-column gallery, the poster and the video controls with a 0:20 duration.

## Decisions

- Keep the teaser scene and its capture tools out of the repository until the environment work they depend on is committed. The first commit carried only the web-lite encode, the poster and the journey step. The end-card change adds a 1080x1920 full-quality copy (11.4 MB) under share/, linked from the journey page. The 18.9 MB master stays under `out/`.
- Re-shoot on the newest build if the teaser should show the castle patrols.
- A copy change to the end card needed only a 240-frame tail render, not a re-shoot of all 1200 frames. Keep end-card copy in the last shot, so later copy changes stay this cheap.
- For next time:
  1. The engine's capture mode plus a game-owned scripted scene gives frame-exact trailer footage. Footstep SFX can be synced from logged foot-bone heights.
  2. The ElevenLabs Music composition-plan section text must be 200 characters or fewer. The sound-generation tool keeps 3 requests in flight, because the account allows 4 concurrent requests; a 429 retries after 4 s.
  3. Generated campfire and river recordings have about 30 dB transient peaks. Soft-clip them before using them as beds.
  4. Size a shockwave ring so it stops short of the camera: its particle grows to 2x its spawn size.
