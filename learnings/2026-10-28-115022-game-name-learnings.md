# Bramblekeep Name Learnings

Related records:
- `plans/2026-10-28-115022-game-name-plan.md`
- `prompts/2026-10-28-115022-game-name-prompts.md`

## Context

The working title "Castle Adventure" named the setting but not the game. It
said nothing about the drop-in co-op play, the castle as the target, or the
living garden creatures that defend it. The user asked for a better name that
captures the game's essence, then chose one and asked for it to replace the old
name everywhere.

## What Happened

- The proposal recommended Bramblekeep: "bramble" for the living garden
  defenders, "keep" for the castle the heroes storm. It was offered with
  Briarhold, The Sleeping Keep and Gatebreakers.
- A web search found no game called Bramblekeep. The nearest result was
  "Bramble: The Mountain King" (2023), a dark Nordic horror adventure, a
  different genre.
- Commit `f8a17db` renamed the game: `game/game.json` id, title and storage
  prefix (`castle-adventure` to `bramblekeep`); the menu tagline "Storm the
  castle that grows back"; the Rust package `bramblekeep-sim`; the npm package
  `bramblekeep`; the character lab's saved key; the game README; the brief's
  title and decision log; and the journey header and page title.
- Checks on the committed revision in an isolated worktree: `npm run build`
  passed; `npm test` (cargo) gave 49 passed, 0 failed, 2 ignored;
  `npm run test:game` (Vitest) gave 46 files and 310 tests passed.
- `npm run smoke` failed with `window.__game.integratedArt is not a function`.
  The failure was already there before the rename; the default page now opens
  the castle game, but `game/tests/smoke.mjs` still calls the old debug hook.
- The user's dev preview on port 5173 was reloaded in place, and it serves the
  new title.

## Result Quality

- The title screen shows BRAMBLEKEEP and the tagline, centered and unclipped,
  at 1280x720 desktop, 390x844 portrait (DPR 1) and 844x390 short landscape.
  The two staged images are the desktop and portrait captures.
- The castle in the title art is still clean stone with blue roofs and shows no
  brambles or vines, so the name is not yet visible in the castle art.
- The smoke failure is a test problem, not a rename regression, but it means
  the default smoke check does not currently pass.

## Decisions

- The game is named Bramblekeep, with the tagline "Storm the castle that grows
  back".
- The new storage prefix resets players' saved settings once. Returning players
  will see their settings reset one time.
- Historical records (verbatim prompts, old receipts, commit history) keep the
  old name on purpose.
- Another session's untracked articles in `share/20261028-dev-articles/` were
  left out of this change.

Open follow-ups:
- Add brambles and vines to the castle art so the name shows in-game.
- Decide whether to adopt the lore that the gold core is the keep's seed.
- Fix the smoke test's `integratedArt` debug hook (`game/tests/smoke.mjs`).
