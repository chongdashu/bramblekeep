# Prototype game audio

The four interface cues (`menu_hover`, `menu_press`, `menu_back`, `menu_open`) were generated with ElevenLabs for a softer, warm fantasy sound. The cues use the SFX bus and fall back to the engine sounds if their samples have not loaded. The effects were low-pass filtered at 3.5 kHz and adjusted by +8, +13, +20 and −6 dB respectively to balance their differing source levels. The processed true peaks are −14.6, −15.0, −16.5 and −12.6 dBFS. Four effects cost 26 reported credits. The previous `menu_theme` was superseded by the siege score below. Effects still need an audible in-game mix review.

Menu theme prompt: instrumental whimsical fantasy castle action menu, upbeat and adventurous with a steady pulse, warm acoustic strings, rounded woodwinds and soft low hand drums; mellow transients, no piercing bells, bright synth, sharp clicks, vocals or bombast. The effects were prompted as soft, muted wooden navigation and confirmation sounds and a warm cloth-and-wood menu-opening swish, without sharp clicks or high chimes.

Generated with ElevenLabs for in-game use. These are first takes, pending human listening and mix approval. The audio is delivered as MP3 under `game/public/assets/audio/`; no API key is included in the game. Music is crossfaded between 1 and 42 seconds; its loop has not been judged by ear. Footsteps pass through a 15 ms attack (35 ms for gravel) and a 1.3 kHz (wood), 700 Hz (gravel) or 1.7 kHz (grass) low-pass to soften the transient. Hit impacts use a 1.2 kHz low-pass and 12 ms fade; this mix remains pending a human listening check.

| Asset | Duration | Integrated loudness | True peak | Reported generation charge |
| --- | ---: | ---: | ---: | ---: |
| exploration | 45.04 s | −16.7 LUFS | −1.7 dBTP | not reported |
| castle_action | 60.08 s | −14.1 LUFS | −1.2 dBTP | not reported |
| footstep_grass | 0.80 s | −36.3 LUFS | −18.4 dBTP | 8 credits |
| footstep_gravel | 0.80 s | −30.8 LUFS | −12.2 dBTP | 8 credits |
| footstep_wood | 0.80 s | −43.0 LUFS | −15.6 dBTP | 8 credits |
| sword | 0.80 s | −16.4 LUFS | −0.2 dBTP | 8 credits |
| magic | 1.20 s | −21.5 LUFS | −7.9 dBTP | 12 credits |
| bow | 0.80 s | −17.6 LUFS | +0.4 dBTP | 8 credits |
| hit | 0.68 s | −38.2 LUFS | −16.1 dBTP | 7 credits |

| ambience_stream | 10 s | −30.3 LUFS | −13.5 dBTP | 100 credits |
| ambience_fire | 10 s | −52.2 LUFS | −15.9 dBTP | 100 credits |
| enemy_defeat | 1 s | −24.0 LUFS | −4.6 dBTP | 10 credits |
| player_hurt | 0.8 s | −33.5 LUFS | −11.7 dBTP | 8 credits |
| respawn | 1.36 s | −19.5 LUFS | −6.9 dBTP | 14 credits |
| gate_breach | 2 s | −14.4 LUFS | +0.6 dBTP | 20 credits |
| core_clear | 2 s | −21.2 LUFS | −5.0 dBTP | 20 credits |
| orb_impact | 1 s | −32.0 LUFS | −14.6 dBTP | 10 credits |

Loudness and true peaks are measured on the original files using FFmpeg EBU R128; the short effects have substantial silence so integrated loudness is not a perceptual mix judgment. The playback gains and limiter reduce peaks. Music request did not return a billing count; reported SFX total is 349 credits (including the superseded first grass take). Mixing, loop audibility, mobile speakers and actual host behavior remain to be heard.

## Generation prompts

- **exploration**: Instrumental background music for a cozy whimsical fantasy adventure game exploring a sunlit garden castle. Gentle memorable melody on wooden flute, plucked strings and warm acoustic instruments, light rhythmic movement, playful wonder, understated and unobtrusive, no vocals, no dramatic percussion, no sudden changes. Steady looping exploration atmosphere.
- **footstep_grass**: One single soft leather boot step through thick short grass, gentle rustle and muted cushioned landing, no grit, no gravel, no hard click, close dry game foley, one impact only, no voices or ambience.
- **footstep_gravel**: One single soft leather boot step on a dry fine sandy gravel trail, quiet crunch of small stones and sand, muted landing, no sharp click, close dry game foley, one impact only, no voices or ambience.
- **footstep_wood**: One single soft boot footstep on a solid wooden bridge plank, close dry game foley, light hollow wooden knock, no ambience, no voice, one impact only.
- **sword**: One short light sword swing through the air, clean friendly fantasy action game whoosh, no impact, no music, no voice, isolated one shot.
- **magic**: One short gentle magical spell cast, sparkling warm airy chime with quick whoosh, playful fantasy game, no voice, no music, isolated one shot.
- **bow**: One short wooden bowstring release and arrow swish, close clean fantasy game effect, no voice, no ambience, isolated one shot.
- **hit**: One short soft fantasy game hit, padded woody impact with subtle metallic click, friendly action, no voice, no music, isolated one shot.

## Additional effects and ambience

Stream and campfire loops follow the player, fade with distance, and stop while paused. The decoded loop boundary differences are below the 99th percentile of normal adjacent sample changes for both loops; their seams and relative levels still need listening. The campfire source is particularly quiet.

- **ambience_stream**: A gentle small woodland stream flowing steadily over stones, soft low-volume moving water, no wildlife, no music, no voice, no sudden splashes, seamless game ambience loop.
- **ambience_fire**: A small friendly campfire quietly crackling and softly flickering, restrained low-volume steady fire ambience, no roaring, no music, no voice, seamless loop.
- **enemy_defeat**: One short soft whimsical garden creature defeated sound, gentle leafy pop and wooden rustle, playful fantasy game, no voice, no music, one isolated effect.
- **player_hurt**: One short muffled armor impact and soft cloth thump for player damage, gentle friendly fantasy game feedback, no vocalization, no music, isolated one shot.
- **respawn**: One short hopeful magical recovery sound, warm soft airy shimmer and gentle chime, friendly fantasy game, no voice, no music, isolated one shot.
- **gate_breach**: One brief castle gate opening and breaking, deep wooden crack and stone rumble, clear friendly fantasy game event, not frightening, no voice or music, isolated one shot.
- **core_clear**: One short warm uplifting magical victory chime with a soft sparkling finish, whimsical fantasy game objective complete, no voice or music, isolated one shot.
- **orb_impact**: One short soft magical orb impact, rounded airy pop with a faint sparkling tail, playful fantasy game, no voice or music, isolated one shot.

## Castle combat and gate effects

Seven ElevenLabs sound effects add enemy attack swipes, lever hits, lever lock releases, the gate beginning to break, the falling gate's landing, gate closure and heart-tree hits. The enemy and lever cues are driven by gameplay event counters, including strikes on a lever already at zero. Their positions (and enemy damage and other players' attack sounds) attenuate with distance; gate events play globally. The landing cue occurs at the end of the door's 1.2-second fall. Initial snapshots, reconnects, resets, and events observed while paused do not replay the new combat cues. These are still pending an audible mix review.

The seven isolated prompts requested rounded organic swipes, wood-and-iron winch strikes and releases, a low wooden/iron gate groan, a deep door-on-stone impact, a closing latch, and a low woody magical heart impact. All were low-pass filtered at 5 kHz; source gain adjustments were −5, +10, −5, −4, −2, −3 and +5 dB respectively. Their processed true peaks range from −10.5 to −3.5 dBFS. ElevenLabs reported 73 credits for the seven successful generations; three initial requests were rate limited, then retried successfully. Samples are played through the existing SFX and mute buses.

For the reported sharp, repetitive attacks, weapon, enemy attack, lever, heart and orb-impact sounds have a 20 ms fade-in and a 1.7–2.2 kHz playback low-pass; the existing enemy-hit sound retains its 12 ms fade and 1.2 kHz low-pass. Sword, spell, bow, enemy attack and lever hit levels were reduced. Identical attack cues within 120 ms are coalesced, preferring the closest impact when several arrive in one frame; later attacks still sound. This is a mix change, not an audible listening approval.

## Main game music

- **castle_action**: Instrumental background music for a colorful, whimsical fantasy action adventure game, heroes fighting playful castle patrols. Moderate upbeat tempo, lively rhythmic strings and plucked acoustic instruments with warm woodwind melody, gentle low drums for momentum. Energetic and adventurous but light, restrained and unobtrusive under gameplay, no aggressive percussion, no epic trailer impacts, no vocals, no sudden dramatic changes. Consistent steady groove suitable for looping.

This earlier cue and its tempo variants are superseded in the main game by the siege score below. The music charge was not reported.

The previous `castle_combat` and `castle_climax` cues are provisional tempo variants of this recording. The environment lab retains its separate exploration cue.

The variants can be rebuilt from the original without a generation service:

```sh
ffmpeg -i game/public/assets/audio/castle_action.mp3 -af 'atempo=1.18' -codec:a libmp3lame -b:a 128k game/public/assets/audio/castle_combat.mp3
ffmpeg -i game/public/assets/audio/castle_action.mp3 -af 'atempo=1.28' -codec:a libmp3lame -b:a 128k game/public/assets/audio/castle_climax.mp3
```

## Siege score: current main menu and castle game

Jev 1.14.0 chose the serious heroic siege direction from three described alternatives and an unknown option. The input, exact question, live response and small evaluation are in `music-direction-jev*.json`. Its choice was based on descriptions and user feedback; Jev did not hear the recordings. Three deliberately distinct test preferences matched their authored expected choices (3/3), a small smoke check rather than evidence of musical quality or player preference.

The six runtime files are sections of one 148-second ElevenLabs `music_v2_5` composition. The [composition plan](siege-score-plan.json) calls for a recurring minor-key motif, low strings, brass and drums, with a warmer attack and no playful or piercing sounds. It requests distinct approach, combat, breach, core, critical and victory sections. The API reported song ID `xwIA1tJZmY54QS10bQgr`; its music charge was not reported. The original master is in ignored `out/siege-score/master.mp3`; the six MP3s in `public/assets/audio/` are required runtime assets. The sections were extracted at 0, 26, 52, 78, 104 and 130 seconds, with lengths 26, 26, 26, 26, 26 and 18 seconds using FFmpeg's MP3 128 kbps encoder. The menu and approach share the first section. Music loops crossfade inside seconds 1–24 (1–16 for victory). Levels are −15.4 LUFS for approach and −13.4 to −13.9 LUFS for the other sections; gains are 0.30 and 0.25 respectively.

The camp has a separate 45-second ElevenLabs `music_v2_5` cue, `siege_camp.mp3`, generated with a 20-second slice of the approach as a medium-strength audio reference. Its [composition plan](camp-score-plan.json) requests a distinct measured marching rhythm, low pizzicato strings and horn calls, retaining a serious pre-assault mood without becoming tranquil. The reference upload and generation costs were not reported; generation song ID was `pawy5vfsJf6xoTCBYt2O`. The source measures −16.0 LUFS and −1.7 dBFS true peak; the playback gain is 0.32 and the loop crossfades inside seconds 1–42. Audio-reference conditioning guides style and does not guarantee a shared melody. The new cue and its transitions require an in-game listening review.

Both solo and multiplayer use the same rules. Within 6 m of camp, the camp cue plays; after entering, it continues until the player is 8 m from camp to prevent edge flicker. Nearby enemies trigger combat for at least four seconds; the open gate or a player near the core selects the breach section. Combat and objective music take priority over camp. An observed drop in core health selects the core-attack section for six seconds, with further hits renewing the hold. The critical section takes priority when the core is at or below one third health during the assault; victory takes priority over all other states. The room's round identity resets these holds, and an initial snapshot of an already-damaged core is not treated as a new hit. The engine crossfades between sections; it does not synchronize them to musical beats. The generated score, loop joins, transitions and gameplay mix need listening in game before the direction is considered approved.
