# Portrait Teaser Prompts

Linked plan file: `plans/2026-10-28-072732-portrait-teaser-plan.md`
Linked learnings file: `learnings/2026-10-28-072732-portrait-teaser-learnings.md`

## User Verbatim

Author: `User`

Exact user message(s):

```text
do a teaser of the game, with the characters and scene, in portrait mobile view, with the players running or moving , heading toward the castle, basically something nice a cool. add a bgm track, and add any sfx that would help
```

Follow-up:

```text
continue using latest
```

Follow-up:

```text
it's pretty good, let's have made with GPT 6.1 Terra as the sub text in the final scene
rather than castle adventure
can we have a different title? mahybe a word play with Teera?
```

Asked to choose among Terra word-play titles for the final card, the user declined and wrote:

```text
maybe no need for title, just said made with GPT 6.1 Terra 
stay tuned for more updates!
```

Follow-up:

```text
let's have it in share
```

## User Preferences

Author: `User`

```text
Portrait mobile view. The characters and the scene. The players running or moving toward the castle. A background music track and sound effects. The follow-up "continue using latest" is read as a re-shoot on the newest build (see Assistant Summary).
End card, no title: "Made with GPT 6.1 Terra" as the sub text, then "Stay tuned for more updates!". The teaser goes into share/, with a full-quality copy linked under the web encode.
```

## Assistant Summary

```text
A 20 s portrait teaser of the environment world: the knight, spellcaster and scout run toward the castle, with a generated score and sound effects. Master 1080x1920 at 60 fps; web encode 720x1280 with an end-card poster, plus a 1080x1920 full-quality copy under share/. The footage was shot on commit 6eb872d plus uncommitted environment work from another session. "continue using latest" was taken as a request to re-shoot on the newest build at that point. The castle patrol commits (defe28b, 0e3267d, cba97c2) landed after the snapshot and are not in the footage. After review, the title card became an end card: "Made with GPT 6.1 Terra" and "Stay tuned for more updates!", with no title. Only 16-20 s was re-rendered and spliced onto the earlier footage; the music and sound effects are unchanged.
```

## Working Findings

Author: `Assistant`

```text
- Capture: the engine's ?capture mode renders frame by frame (canvas 1620x2880, WebGPU; 1200 frames in 213 s; no errors in the render log), downsampled to a 1080x1920 master at 60 fps.
- Footsteps: 121 step cues (dirt 103, wood 18), placed on the heroes' foot contacts from the scene's per-frame log, panned and attenuated by camera distance.
- Score: 4 timed sections (4 s, 7 s, 3 s, 6 s; 20 s total) at 120 BPM. Each section text is 149 to 162 characters, under the 200-character limit.
- Sound generation: the tool keeps 3 requests in flight; the account allows 4 concurrent requests, and a 429 response retries after 4 s.
- Loudness, measured with ffmpeg ebur128: pre-encode mix WAV -14.3 LUFS integrated, -1.2 dBTP, LRA 7.3 LU; final 720x1280 web encode -14.4 LUFS, -0.6 dBTP, LRA 7.2 LU; full-quality 1080x1920 copy -14.4 LUFS, -0.9 dBTP, LRA 7.2 LU; the master MP4 decodes to -14.4 LUFS and -0.8 dBTP after its AAC encode.
- Web encode, measured with ffprobe: H.264 720x1280 yuv420p at 60/1 fps, AAC 48 kHz stereo, 20.01 s, 3,325,900 bytes (final; the first cut was 3,348,226 bytes); 1200 frames decode.
- End card: re-rendered alone, 240 frames (4.0 s) from a hard cut at 16 s (out/teaser/render-v2/teaser-video-from-16s.mp4), then spliced onto the 0-16 s footage.
```

## Model Prompts Used

### ElevenLabs Music Prompt Sent (seed 23, chosen; seed 11 used the same section texts)

Composition plan sections, verbatim from `out/teaser/music/teaser-score-seed23.json` (ignored, not committed). Each section also carries 120 BPM, instrumental, and positive and negative style tags in the same file.

```text
[Intro: campfire at night] {instrumental; quiet and magical; harp, celesta, low strings, a hint of the hero melody on flute; short drum pickup at the end}   (4000 ms)
[The run] {instrumental; starts on the downbeat: driving taiko, galloping string ostinato, bold french horn hero melody, energetic playful adventure}   (7000 ms)
[Build: the castle looms] {instrumental; climbing string tremolo, snare and timpani roll crescendo, swelling brass, a breath of silence at the very end}   (3000 ms)
[Climax and title] {instrumental; opens on one huge orchestral hit with cymbal crash, triumphant hero theme on horns and strings, final button hit that rings out}   (6000 ms)
```

### ElevenLabs Music Exact Invocation

```bash
# out/teaser/tools/music.mjs (ignored, not committed)
# request body: model_id "music_v2_5", composition_plan (the four sections above), seed 11 or 23
```

### Outcome

```text
Seeds 11 and 23 both generated, each 20 s in four sections. Seed 23 was chosen because its strongest hit lands at 14.05 s, the slow-motion cut, with accents at 4.05 s (the knight rally) and 16.05 s (the title).
```

### ElevenLabs Sound Generation Prompts Sent (eleven_text_to_sound_v2)

Verbatim from `out/teaser/tools/sfx.mjs` (ignored, not committed). Each entry also sets a duration and prompt influence in that file, and some are looped.

```text
night-ambience: Calm night meadow ambience, soft crickets, gentle wind in the trees, very distant owl, no music
campfire: Close campfire crackling and popping, warm wood fire, no music
river: Gentle river stream flowing under a small wooden bridge, babbling water, no music
steps-dirt: Six separate single footsteps of a person running on a dry dirt path, leather boots, each step clearly separated by short silence
steps-wood: Six separate single footsteps of a person running on hollow wooden bridge planks, leather boots, each step clearly separated by short silence
whoosh: Fast cinematic air whoosh pass-by transition, clean, short
whoosh-soft: Soft airy cinematic swish transition, gentle, short
sword: Steel sword swung fast through the air with a bright metallic ring, fantasy combat
sword-raise: Sword drawn from a scabbard with a bright metallic shing
magic: Whimsical magic spell cast from a wizard staff, sparkling shimmer and a soft magical burst, fantasy
bow: Wooden bow string pulled back creaking, then arrow released with a twang and a fast whoosh
impact: Huge deep cinematic trailer boom impact with a long reverb tail, sub bass hit
riser: Cinematic rising whoosh riser building tension, ending abruptly, no music
shimmer: Magical sparkle chime shimmer reveal, bright fairy dust twinkle, fantasy logo reveal
banner: Large cloth banners flapping in a strong wind on a castle wall
```

### ElevenLabs Sound Generation Exact Invocation

```bash
# out/teaser/tools/sfx.mjs (ignored, not committed)
# request body: text (above), duration_seconds, prompt_influence, model_id "eleven_text_to_sound_v2", loop where set
```

### Outcome

```text
15 clips in out/teaser/sfx/ (mp3 with a json per clip). A 429 response retries after 4 s; the tool keeps 3 requests in flight. The footstep clips are cut into grains and placed on the logged foot contacts; the slow-motion weapon sounds are pitched down.
```
