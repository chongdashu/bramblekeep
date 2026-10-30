# Portrait Teaser Plan

Linked prompts file: `prompts/2026-10-28-072732-portrait-teaser-prompts.md`
Linked learnings file: `learnings/2026-10-28-072732-portrait-teaser-learnings.md`

## Goal

A 20-second portrait teaser for the game: the three heroes and the environment world, the players running toward the castle, a music track and sound effects. The milestone output is a 720x1280 web-lite MP4, an end-card poster and a 1080x1920 full-quality copy for the journey. The 1080x1920 master stays out of the repository; the full-quality copy is a web encode of it.

## Approach

1. Build a scripted teaser scene (`?scene=teaser`) as a subclass of the environment lab scene, in an ignored snapshot of the checkout. It is not committed, because it depends on uncommitted environment work from another session.
2. Lay out eight shots on a 20 s timeline: world establishing, campfire gather, the charge, the bridge crossing, the game's chase camera up the trail, the castle crane reveal, a slow-motion attack at the gate with a shockwave, and an end card.
3. Render frame by frame through the engine's capture mode at 1620x2880, downsampled to a 1080x1920 master at 60 fps.
4. Generate a four-section score at 120 BPM with two seeds, and pick the seed whose hits land on the cuts.
5. Generate fifteen sound effects. Cut footstep grains, place them on the heroes' logged foot contacts, pan and attenuate them by camera distance, and pitch the slow-motion weapon sounds down.
6. Mix to a master, then measure loudness and true peak.
7. Encode the web-lite MP4 and poster, stage them under `share/media/20261028-teaser/`, add the journey step, and record the prompts, plan and learnings.
8. After review, change the end card. The title is dropped; the card reads "Made with GPT 6.1 Terra", then "Stay tuned for more updates!". Re-render only 16-20 s (240 frames, from a hard cut), splice it onto the 0-16 s footage, re-encode the web files and poster, and update the journey step.
9. Add a 1080x1920 full-quality copy under `share/media/20261028-teaser/`, linked under the 720x1280 embedded video, so the page stays light.

## Verification

- ffprobe on the web encode: H.264 720x1280 at 60 fps, AAC stereo, 20.01 s; 1200 frames.
- ebur128 on the pre-encode master mix (-14.3 LUFS, -1.2 dBTP, LRA 7.3 LU), on the final web encode (-14.4 LUFS, -0.6 dBTP) and on the full-quality copy (-14.4 LUFS, -0.9 dBTP).
- The render log reports no errors.
- The staged copies match their sources byte for byte (`cmp`), and their staged blob hashes match `git hash-object`.
- `append_step.py` validated the journey step when it was first added. The end-card change edits that step in place. The page and its media return 200 from a local HTTP server.
- Headless Chrome screenshots at 500 and 1140 CSS px wide show the step, the single-column gallery and the portrait poster card. The phone-width check at 390 px was not possible: headless Chrome here has a 500 px minimum window.
- Not done: an audition of the audio by ear, and a browser click-through of the journey page.
