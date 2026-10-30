# Ranged Combat Learnings

Related records: `prompts/2026-10-28-074757-ranged-combat-prompts.md` and `plans/2026-10-28-074757-ranged-combat-plan.md`.

Knight, Scout and Spellcaster recovery intervals are 0.72, 0.85 and 1.0 seconds. Arrows assist within a forward cone and gently follow the selected target, while the orb flies slower and bursts near its impact. Both sweep against obstacles and targets. Play had not previously called its impact sound; it now does, with a 1.2 kHz low-pass and 12 ms onset. FFmpeg measured the filtered source at -38.5 LUFS and -16.6 dBTP before the bus; a person must judge the sound by ear.

The browser test used real controls to fire both projectiles and confirmed rapid taps did not repeat the cast during recovery. Unit tests cover cooldowns, aim cone, collision, area damage and audio routing. Switching class originally left the previous hero overlaid; Play now returns that hero to camp. Projectile visuals are basic primitives or the existing arrow asset, with no matched-camera concept comparison; phone and touch review remain open.
